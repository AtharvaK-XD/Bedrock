import crypto from 'node:crypto';
import type { VercelResponse } from '@vercel/node';
import { getDb, logSecurityEvent } from './db.js';
import type { AuthenticatedUser } from './auth.js';

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
 * Classifies text against the injection patterns. Zero-width and other invisible characters are
 * removed first so obfuscated phrases ("ign​ore previous instructions") are still detected.
 */
export function assessPromptInjection(text: string): { level: PromptInjectionLevel; pattern: string | null } {
  const normalized = String(text ?? '').replace(/[​-‏⁠-⁤﻿­]/g, '');
  for (const pattern of HIGH_CONFIDENCE_PATTERNS) {
    if (pattern.test(normalized)) return { level: 'high', pattern: pattern.toString() };
  }
  for (const pattern of FLAG_PATTERNS) {
    if (pattern.test(normalized)) return { level: 'flag', pattern: pattern.toString() };
  }
  return { level: 'none', pattern: null };
}

/**
 * Strips invisible unicode escapes and delimits user input safely
 */
export function sanitizeAndDelimitPrompt(rawText: string): string {
  const cleaned = rawText
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/<\/?(UNTRUSTED_USER_INPUT|SYSTEM_INSTRUCTION|PROMPT_OVERRIDE)>/gi, '')
    .trim();

  return `<UNTRUSTED_USER_INPUT>\n${cleaned}\n</UNTRUSTED_USER_INPUT>`;
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
 * Usage is recorded in "SecurityLog", which no API lets users modify or delete
 * (unlike "Trace", which users can clear via DELETE /api/traces). Anonymous
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
  resetMs: number;
  /** SecurityLog row holding this unit of usage; null when nothing was recorded */
  reservationId: string | null;
}

export const isPaidTier = (tier?: string | null) => tier === 'advanced' || tier === 'ultimate' || tier === 'pro';

/**
 * Atomically checks the caller's rolling-window usage and records one unit if
 * under the limit. Fails closed if the database is unavailable.
 */
export async function reserveQuota(params: {
  bucket: QuotaBucket;
  endpoint: string;
  user: AuthenticatedUser | null;
  ip: string;
}): Promise<QuotaReservation> {
  const { bucket, endpoint, user, ip } = params;
  const paid = Boolean(user && !user.isGuest && isPaidTier(user.subscriptionTier));
  const limit = paid ? QUOTA_LIMITS[bucket].paid : QUOTA_LIMITS[bucket].free;
  const base = { bucket, limit, resetMs: FIVE_HOURS_MS };

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
    const rows = (user
      ? await sql`
          INSERT INTO "SecurityLog" (id, user_id, event_type, severity, ip_address, endpoint, message, created_at)
          SELECT ${id}, ${userId}, ${eventType}, 'INFO', ${ipAddress}, ${endpoint}, 'AI usage (user)', NOW()
          WHERE (
            SELECT COUNT(*) FROM "SecurityLog"
            WHERE user_id = ${userId} AND event_type = ${eventType}
              AND created_at >= NOW() - INTERVAL '5 hours'
          ) < ${limit}
          RETURNING id
        `
      : await sql`
          INSERT INTO "SecurityLog" (id, user_id, event_type, severity, ip_address, endpoint, message, created_at)
          SELECT ${id}, NULL, ${eventType}, 'INFO', ${ipAddress}, ${endpoint}, 'AI usage (anonymous)', NOW()
          WHERE (
            SELECT COUNT(*) FROM "SecurityLog"
            WHERE user_id IS NULL AND ip_address = ${ipAddress} AND event_type = ${eventType}
              AND created_at >= NOW() - INTERVAL '5 hours'
          ) < ${limit}
          RETURNING id
        `) as Array<{ id: string }>;

    const allowed = rows.length > 0;
    return { ...base, allowed, unavailable: false, reservationId: allowed ? id : null };
  } catch (err) {
    console.error('[Quota] Quota store unavailable, refusing request:', err);
    return { ...base, allowed: false, unavailable: true, reservationId: null };
  }
}

/** Refunds a reserved unit (call when the AI request ultimately failed). */
export async function releaseQuota(reservation: QuotaReservation | null | undefined): Promise<void> {
  if (!reservation?.reservationId) return;
  try {
    const sql = getDb();
    await sql`DELETE FROM "SecurityLog" WHERE id = ${reservation.reservationId}`;
  } catch (err) {
    console.error('[Quota] Failed to release quota reservation:', err);
  }
}

/** Sends the standard 429 / 503 response for a refused reservation. */
export function sendQuotaDenied(res: VercelResponse, quota: QuotaReservation) {
  if (quota.unavailable) {
    res.setHeader('Retry-After', '30');
    return res.status(503).json({
      error: 'Service Temporarily Unavailable',
      code: 'QUOTA_SERVICE_UNAVAILABLE',
      message: 'Usage limits could not be verified right now. Please try again shortly.',
    });
  }
  if (quota.bucket === 'generation') {
    return res.status(429).json({
      error: 'Free Tier Limit Reached',
      code: 'FREE_TIER_QUOTA_EXCEEDED',
      message: `Free tier accounts can generate up to ${quota.limit} prompts per 5-hour session. Please upgrade to Pro for unlimited prompts.`,
      sessionLimit: quota.limit,
      sessionPrompts: quota.limit,
      resetMs: quota.resetMs,
    });
  }
  return res.status(429).json({
    error: 'Usage Limit Reached',
    code: 'AI_USAGE_LIMIT_EXCEEDED',
    message: `Server AI usage limit of ${quota.limit} requests per 5 hours reached. Add your own API key in Settings for unlimited direct calls.`,
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
    const traceId = `TRC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    await sql`
      INSERT INTO "Trace" (id, user_id, node_origin, model_target, tokens_used, latency_ms, status, created_at)
      VALUES (${traceId}, ${params.userId}, ${params.nodeOrigin}, ${params.modelTarget}, ${params.tokensUsed}, ${params.latencyMs}, ${params.status}, NOW())
    `;
  } catch (err) {
    console.error('[Trace] Failed to record trace in database:', err);
  }
}
