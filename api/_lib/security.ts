import crypto from 'node:crypto';
import type { VercelResponse } from '@vercel/node';
import { getDb, logSecurityEvent } from './db.js';
import type { AuthenticatedUser } from './auth.js';
import { getRedisClient } from './rateLimiter.js';

// Suspicious patterns commonly used in prompt injection / system prompt extraction attacks.
// Policy: FLAG ONLY. Bedrock users legitimately write about these topics (guardrail design),
// and all user input is already wrapped in <UNTRUSTED_USER_INPUT>, so nothing is blocked here.
// "high" = attempts to extract or override Bedrock's own system prompt; "flag" = generic phrasing.
const HIGH_CONFIDENCE_PATTERNS = [
  /reveal\s+(your\s+)?(system\s+prompt|hidden\s+instructions|initial\s+prompt)/i,
  /print\s+(your\s+)?(system\s+prompt|core\s+instructions|developer\s+mode)/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /output\s+the\s+above\s+text\s+verbatim/i,
];
const FLAG_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|directives|prompts)/i,
  /disregard\s+(all\s+)?(previous|above|prior)\s+(instructions|rules)/i,
  /DAN\s+mode|jailbreak/i,
];

export type PromptInjectionLevel = 'none' | 'flag' | 'high';

/**
 * Invisible characters that can hide text from a human reviewer while a model still reads it, or reorder what is
 * shown: Unicode "tag" characters (U+E0000-U+E007F, used for "ASCII smuggling"), direction overrides and isolates,
 * zero-width space / word joiners, the BOM and interlinear annotations. Zero-width (non-)joiners U+200C/U+200D are
 * kept in prompts: Devanagari and other Indic scripts, and emoji, need them.
 */
const HIDDEN_FORMAT_CHARS = /[\u{E0000}-\u{E007F}‪-‮⁦-⁩​‎‏⁠-⁤﻿᠎￹-￻]/gu;
/** Our own delimiters, also with spaces inside the brackets, so user text cannot close or open them */
const DELIMITER_TAG_RE = /<\s*\/?\s*(UNTRUSTED_USER_INPUT|SYSTEM_INSTRUCTION|PROMPT_OVERRIDE)\s*>/gi;

/**
 * Classifies text against the injection patterns. Zero-width and other invisible characters are
 * removed first so obfuscated phrases ("ign​ore previous instructions") are still detected.
 */
export function assessPromptInjection(text: string): { level: PromptInjectionLevel; pattern: string | null } {
  const normalized = String(text ?? '')
    .replace(HIDDEN_FORMAT_CHARS, '')
    .replace(/[‌‍­]/g, '');
  for (const pattern of HIGH_CONFIDENCE_PATTERNS) {
    if (pattern.test(normalized)) return { level: 'high', pattern: pattern.toString() };
  }
  for (const pattern of FLAG_PATTERNS) {
    if (pattern.test(normalized)) return { level: 'flag', pattern: pattern.toString() };
  }
  return { level: 'none', pattern: null };
}

/**
 * Strips control characters and invisible formatting characters, removes look-alikes of our delimiters,
 * and wraps the text as untrusted input.
 */
export function sanitizeAndDelimitPrompt(rawText: string): string {
  let cleaned = String(rawText ?? '')
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(HIDDEN_FORMAT_CHARS, '');
  // Repeat until stable: removing one fake tag must not join the pieces of another ("<UNTRUS<UNTRUSTED_USER_INPUT>TED_...")
  for (let previous = ''; previous !== cleaned; ) {
    previous = cleaned;
    cleaned = cleaned.replace(DELIMITER_TAG_RE, '');
  }
  return `<UNTRUSTED_USER_INPUT>\n${cleaned.trim()}\n</UNTRUSTED_USER_INPUT>`;
}

/**
 * Checks for prompt injection and logs a security event if detected (flag only, never blocks).
 */
export function checkPromptInjection(text: string, userId?: string, ipAddress?: string): boolean {
  const { level, pattern } = assessPromptInjection(text);
  if (level === 'none') return false;
  logSecurityEvent({
    userId,
    eventType: 'SUSPICIOUS_PROMPT_INJECTION',
    severity: 'WARN',
    ipAddress,
    message: `Prompt injection pattern detected (level: ${level}): ${pattern}`,
  });
  return true;
}

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

/**
 * Server-side AI usage quotas (rolling 5-hour window).
 *
 * Usage is recorded in "QuotaEvent" through reserve_quota() (migration 0004), or in
 * "SecurityLog" while that migration is not applied. No API lets users modify or delete
 * either table (unlike "Trace", which users can clear via DELETE /api/traces). Anonymous
 * callers (e.g. the desktop app, which has no long-lived Clerk session yet) are
 * metered per client IP with the same limits as the free tier.
 *
 * - generation: full prompt synthesis (the advertised "10 prompts / 5 hours")
 * - assist:     questions, refine and model test calls (generous abuse cap)
 */
export type QuotaBucket = 'generation' | 'assist';

const QUOTA_LIMITS: Record<QuotaBucket, { free: number; paid: number }> = {
  generation: { free: 10, paid: 500 },
  assist: { free: 100, paid: 1000 },
};

const QUOTA_EVENT: Record<QuotaBucket, string> = {
  generation: 'AI_QUOTA_GENERATION',
  assist: 'AI_QUOTA_ASSIST',
};

export interface QuotaReservation {
  allowed: boolean;
  /** true when the quota store could not be reached (request is refused) */
  unavailable: boolean;
  bucket: QuotaBucket;
  limit: number;
  /** The caller is on a paid plan (decides the wording of the "limit reached" answer) */
  paid?: boolean;
  resetMs: number;
  /** Row holding this unit of usage; null when nothing was recorded */
  reservationId: string | null;
  /** Table holding reservationId: "QuotaEvent" (migration 0004) or the older "SecurityLog" path */
  store?: 'QuotaEvent' | 'SecurityLog';
  /** Set when the shared daily ceiling for callers who are not signed in was reached */
  reason?: 'anonymous_daily_cap';
  /** Anonymous requests: today's shared counter this request was counted in (given back by releaseQuota) */
  anonDailyKey?: string;
}

/**
 * One ceiling per day for ALL callers who are not signed in together (each one also has its own per-IP limit).
 * Without it, many addresses (proxies, botnets) could use up the shared provider allowance and lock signed-in
 * users out. Counted in Redis; when Redis is missing or fails the request is not blocked by this check (the
 * per-IP quota in the database still applies). Tune with ANON_AI_DAILY_CAP_GENERATION / _ASSIST (0 = refuse all).
 */
const ANON_DAILY_CAP_DEFAULTS: Record<QuotaBucket, number> = { generation: 300, assist: 3000 };

function anonymousDailyCap(bucket: QuotaBucket): number {
  const raw = process.env[`ANON_AI_DAILY_CAP_${bucket.toUpperCase()}`];
  const n = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : ANON_DAILY_CAP_DEFAULTS[bucket];
}

const anonymousDailyKey = (bucket: QuotaBucket) => `quota:anon-daily:${bucket}:${new Date().toISOString().slice(0, 10)}`; // UTC day

/**
 * The anonymous counter for today, or null when Redis is missing or failing (then the ceiling does not block anyone;
 * per-IP limits still apply). Reading does not count: only granted requests are counted (countAnonymousDaily).
 */
async function readAnonymousDaily(key: string): Promise<number | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    return Number(await redis.get(key)) || 0;
  } catch (err: any) {
    console.warn('[Quota] Anonymous daily counter unavailable, relying on per-IP limits:', err?.message || err);
    return null;
  }
}

/** Counts one granted anonymous request; the new total, or null when Redis is unavailable. */
async function countAnonymousDaily(key: string): Promise<number | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const used = await redis.incr(key);
    if (used === 1) await redis.expire(key, 2 * 24 * 60 * 60);
    return used;
  } catch (err: any) {
    console.warn('[Quota] Anonymous daily counter unavailable, relying on per-IP limits:', err?.message || err);
    return null;
  }
}

/** Gives one anonymous request back (it was refused after counting, or refunded). */
async function uncountAnonymousDaily(key: string): Promise<void> {
  try {
    await getRedisClient()?.decr(key);
  } catch {
    // The ceiling is a safety net: being one too strict for the rest of the day is acceptable
  }
}

// Postgres codes for "function / table does not exist": migration 0004 is not applied to this database yet
const PG_UNDEFINED_FUNCTION = '42883';
const PG_UNDEFINED_TABLE = '42P01';
// After a "not applied" answer, use the SecurityLog path for this long before checking again
const QUOTA_TABLE_RECHECK_MS = 5 * 60 * 1000;
let quotaTableMissingUntil = 0;

/**
 * Reserves one unit through reserve_quota() (migration 0004), which locks per user / IP so parallel
 * requests cannot overshoot the limit. Returns null when the migration is not applied, so the caller
 * can use the older SecurityLog query instead.
 */
async function reserveViaQuotaTable(
  sql: ReturnType<typeof getDb>,
  p: { id: string; userId: string | null; ip: string; bucket: QuotaBucket; endpoint: string; limit: number }
): Promise<boolean | null> {
  if (Date.now() < quotaTableMissingUntil) return null;
  try {
    const rows = (await sql`
      SELECT reserve_quota(${p.id}, ${p.userId}::text, ${p.ip}, ${p.bucket}, ${p.endpoint}, ${p.limit}::int) AS granted
    `) as Array<{ granted: boolean }>;
    return rows[0]?.granted === true;
  } catch (err: any) {
    if (err?.code === PG_UNDEFINED_FUNCTION || err?.code === PG_UNDEFINED_TABLE) {
      quotaTableMissingUntil = Date.now() + QUOTA_TABLE_RECHECK_MS;
      console.warn('[Quota] reserve_quota() not found (migration 0004 not applied); using SecurityLog counting');
      return null;
    }
    throw err;
  }
}

export const isPaidTier = (tier?: string | null) => tier === 'advanced' || tier === 'ultimate' || tier === 'pro';

/**
 * Atomically checks the caller's rolling-window usage and records one unit if under the limit, then (for callers
 * who are not signed in) counts it against the shared daily ceiling. Fails closed if the database is unavailable.
 *
 * Only GRANTED anonymous requests count against the ceiling. Before, every anonymous attempt was counted first,
 * including requests the per-IP limit then refused, so one address repeating a request could use up the whole day's
 * allowance for every signed-out user (about 25 minutes for generation at 12 requests a minute).
 */
export async function reserveQuota(params: {
  bucket: QuotaBucket;
  endpoint: string;
  user: AuthenticatedUser | null;
  ip: string;
}): Promise<QuotaReservation> {
  const { bucket, user } = params;
  if (user) return reserveForCaller(params);

  const key = anonymousDailyKey(bucket);
  const cap = anonymousDailyCap(bucket);
  const refused = (): QuotaReservation => ({
    bucket,
    limit: QUOTA_LIMITS[bucket].free,
    paid: false,
    resetMs: FIVE_HOURS_MS,
    allowed: false,
    unavailable: false,
    reservationId: null,
    reason: 'anonymous_daily_cap',
  });

  const used = await readAnonymousDaily(key);
  if (used !== null && used >= cap) return refused();

  const reservation = await reserveForCaller(params);
  if (!reservation.allowed) return reservation;

  const total = await countAnonymousDaily(key);
  if (total === null) return reservation;
  if (total > cap) {
    // Parallel requests passed the check together: the last ones over the ceiling are refused after all
    await uncountAnonymousDaily(key);
    await releaseQuota(reservation);
    return refused();
  }
  return { ...reservation, anonDailyKey: key };
}

/** The per-user / per-IP rolling-window reservation (reserve_quota() or the locked SecurityLog fallback). */
async function reserveForCaller(params: {
  bucket: QuotaBucket;
  endpoint: string;
  user: AuthenticatedUser | null;
  ip: string;
}): Promise<QuotaReservation> {
  const { bucket, endpoint, user, ip } = params;
  const paid = Boolean(user && !user.isGuest && isPaidTier(user.subscriptionTier));
  const limit = paid ? QUOTA_LIMITS[bucket].paid : QUOTA_LIMITS[bucket].free;
  const base = { bucket, limit, paid, resetMs: FIVE_HOURS_MS };

  // Local development guest (only issued for localhost hosts): no metering
  if (user?.isGuest) {
    return { ...base, allowed: true, unavailable: false, reservationId: null };
  }

  const eventType = QUOTA_EVENT[bucket];
  const id = `quota_${crypto.randomUUID()}`;
  const userId = user ? user.id : null;
  const ipAddress = (ip || 'unknown').slice(0, 64);

  try {
    const sql = getDb();
    const granted = await reserveViaQuotaTable(sql, { id, userId, ip: ipAddress, bucket, endpoint, limit });
    if (granted !== null) {
      return { ...base, allowed: granted, unavailable: false, reservationId: granted ? id : null, store: 'QuotaEvent' };
    }

    // Migration 0004 is not applied: count in "SecurityLog", under the same per-caller lock reserve_quota() takes.
    // Without the lock, parallel requests all read the same count and overshoot the limit. The lock must be its
    // own statement in a READ COMMITTED transaction: only then does the count see rows committed while it waited.
    const lockKey = user ? `u:${userId}:${bucket}` : `ip:${ipAddress}:${bucket}`;
    const results = await sql.transaction(
      [
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}::text, 0))`,
        user
          ? sql`
              INSERT INTO "SecurityLog" (id, user_id, event_type, severity, ip_address, endpoint, message, created_at)
              SELECT ${id}, ${userId}, ${eventType}, 'INFO', ${ipAddress}, ${endpoint}, 'AI usage (user)', NOW()
              WHERE (
                SELECT COUNT(*) FROM "SecurityLog"
                WHERE user_id = ${userId} AND event_type = ${eventType}
                  AND created_at >= NOW() - INTERVAL '5 hours'
              ) < ${limit}
              RETURNING id
            `
          : sql`
              INSERT INTO "SecurityLog" (id, user_id, event_type, severity, ip_address, endpoint, message, created_at)
              SELECT ${id}, NULL, ${eventType}, 'INFO', ${ipAddress}, ${endpoint}, 'AI usage (anonymous)', NOW()
              WHERE (
                SELECT COUNT(*) FROM "SecurityLog"
                WHERE user_id IS NULL AND ip_address = ${ipAddress} AND event_type = ${eventType}
                  AND created_at >= NOW() - INTERVAL '5 hours'
              ) < ${limit}
              RETURNING id
            `,
      ],
      { isolationLevel: 'ReadCommitted' }
    );
    const rows = results[1] as Array<{ id: string }>;

    const allowed = rows.length > 0;
    return { ...base, allowed, unavailable: false, reservationId: allowed ? id : null, store: 'SecurityLog' };
  } catch (err) {
    console.error('[Quota] Quota store unavailable, refusing request:', err);
    return { ...base, allowed: false, unavailable: true, reservationId: null };
  }
}

/** Refunds a reserved unit (call when the AI request ultimately failed). */
export async function releaseQuota(reservation: QuotaReservation | null | undefined): Promise<void> {
  if (!reservation?.reservationId) return;
  if (reservation.anonDailyKey) await uncountAnonymousDaily(reservation.anonDailyKey);
  try {
    const sql = getDb();
    if (reservation.store === 'QuotaEvent') {
      await sql`DELETE FROM "QuotaEvent" WHERE id = ${reservation.reservationId}`;
    } else {
      await sql`DELETE FROM "SecurityLog" WHERE id = ${reservation.reservationId}`;
    }
  } catch (err) {
    console.error('[Quota] Failed to release quota reservation:', err);
  }
}

/** Sends the standard 429 / 503 response for a refused reservation. */
export function sendQuotaDenied(res: VercelResponse, quota: QuotaReservation) {
  // Shared daily ceiling for callers who are not signed in: signing in (free) gives them their own limit
  if (quota.reason === 'anonymous_daily_cap') {
    return res.status(429).json({
      error: 'Sign In Required',
      code: 'ANONYMOUS_DAILY_LIMIT',
      message: 'Free use without an account is used up for today. Sign in (free) to keep generating.',
    });
  }
  if (quota.unavailable) {
    res.setHeader('Retry-After', '30');
    return res.status(503).json({
      error: 'Service Temporarily Unavailable',
      code: 'QUOTA_SERVICE_UNAVAILABLE',
      message: 'Usage limits could not be verified right now. Please try again shortly.',
    });
  }
  // Paid plans have higher limits, not unlimited ones, and the website has no own-key option any more (CHG-0086):
  // the messages say exactly that. A paid user at the limit is not told to upgrade or called "free tier".
  if (quota.bucket === 'generation') {
    return res.status(429).json({
      error: quota.paid ? 'Plan Limit Reached' : 'Free Tier Limit Reached',
      code: quota.paid ? 'PLAN_QUOTA_EXCEEDED' : 'FREE_TIER_QUOTA_EXCEEDED',
      message: quota.paid
        ? `You have reached your plan's limit of ${quota.limit} prompts per 5 hours. Please try again later.`
        : `Free accounts can generate up to ${quota.limit} prompts per 5 hours. Please try again later, or upgrade for a higher limit.`,
      sessionLimit: quota.limit,
      sessionPrompts: quota.limit,
      resetMs: quota.resetMs,
    });
  }
  return res.status(429).json({
    error: 'Usage Limit Reached',
    code: 'AI_USAGE_LIMIT_EXCEEDED',
    message: quota.paid
      ? `You have reached your plan's limit of ${quota.limit} AI requests per 5 hours. Please try again later.`
      : `You have reached the limit of ${quota.limit} AI requests per 5 hours. Please try again later, or upgrade for a higher limit.`,
    limit: quota.limit,
    resetMs: quota.resetMs,
  });
}

/**
 * Records execution trace in Neon PostgreSQL
 */
export async function recordExecutionTrace(params: {
  userId: string;
  nodeOrigin: string;
  modelTarget: string;
  tokensUsed: number;
  latencyMs: number;
  status: 'success' | 'error';
}) {
  try {
    const sql = getDb();
    const traceId = `TRC-${crypto.randomUUID()}`;

    await sql`
      INSERT INTO "Trace" (id, user_id, node_origin, model_target, tokens_used, latency_ms, status, created_at)
      VALUES (${traceId}, ${params.userId}, ${params.nodeOrigin}, ${params.modelTarget}, ${params.tokensUsed}, ${params.latencyMs}, ${params.status}, NOW())
    `;
  } catch (err) {
    console.error('[Trace] Failed to record trace in database:', err);
  }
}
