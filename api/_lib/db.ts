import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

function getDatabaseUrl(): string {
  let url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || '';
  if (url.startsWith('"') && url.endsWith('"')) {
    url = url.slice(1, -1);
  }
  return url.trim();
}

/**
 * Longest one database round trip may take (sending the query and reading the answer). Neon's HTTP driver has no time
 * limit of its own: a stuck connection (for example a compute that does not wake up) held each request until Vercel
 * stopped the function at 60 s, which answers with a non-JSON 504 and, on the AI routes, could lose an answer that was
 * already paid for. The app role's own statement_timeout (20 s, db/roles.sql) only covers a query the database is
 * actually running. 15 s is far above any query here (a purge round takes ~73 ms, CHG-0015) and leaves room inside the
 * 60 s function limit. DB_QUERY_TIMEOUT_MS (milliseconds, 100 to 55,000) overrides it.
 */
export const DB_QUERY_TIMEOUT_MS = 15_000;

export function dbQueryTimeoutMs(): number {
  const raw = process.env.DB_QUERY_TIMEOUT_MS;
  const n = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 100 && n <= 55_000 ? Math.floor(n) : DB_QUERY_TIMEOUT_MS;
}

/**
 * Options the driver merges into every request it sends. `signal` is a getter on purpose: @neondatabase/serverless
 * spreads these options into each fetch (`{ ...fetchOptions }`), so every query and every transaction batch gets its
 * own fresh time limit, instead of one shared signal that would run out once for all of them.
 */
export function dbFetchOptions(): Record<string, unknown> {
  return {
    get signal() {
      return AbortSignal.timeout(dbQueryTimeoutMs());
    },
  };
}

let sqlInstance: ReturnType<typeof neon> | null = null;

export function getDb() {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error('DATABASE_URL is not configured in environment variables.');
  }
  if (!sqlInstance) {
    sqlInstance = neon(url, { fetchOptions: dbFetchOptions() });
  }
  return sqlInstance;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  avatar_initials: string | null;
  plan: string;
  role: string;
  bio: string | null;
  location: string | null;
  organization: string | null;
  github: string | null;
  huggingface: string | null;
  website: string | null;
  joined_date: string | null;
  email_verified: boolean;
  mfa_enabled: boolean;
  subscription_tier: string;
  /** Onboarding answers (migration 0018). Optional: absent while that migration is not applied yet. */
  birth_date?: string | null;
  referral_source?: string | null;
  /** When the paid plan stops (migration 0020). NULL = no end date. Optional: absent before 0020 is applied. */
  plan_expires_at?: Date | string | null;
  created_at: Date;
  updated_at: Date;
}

/** Column limits of "SecurityLog" (migration 0005 `SecurityLog_size_chk`): longer values would make the insert fail. */
export const SECURITY_LOG_LIMITS = { message: 2000, ipAddress: 64, eventType: 100, endpoint: 200 } as const;

const cut = (value: string | null | undefined, max: number): string | null =>
  typeof value === 'string' && value ? value.slice(0, max) : null;

export async function logSecurityEvent(params: {
  userId?: string | null;
  eventType: string;
  severity?: 'INFO' | 'WARN' | 'CRITICAL';
  ipAddress?: string | null;
  endpoint?: string | null;
  message: string;
}) {
  try {
    const sql = getDb();
    const id = `sec_${crypto.randomUUID()}`;
    const eventType = cut(params.eventType, SECURITY_LOG_LIMITS.eventType) || 'UNKNOWN';
    const message = cut(String(params.message ?? ''), SECURITY_LOG_LIMITS.message) || '';
    await sql`
      INSERT INTO "SecurityLog" (id, user_id, event_type, severity, ip_address, endpoint, message, created_at)
      VALUES (${id}, ${params.userId || null}, ${eventType}, ${params.severity || 'INFO'}, ${cut(params.ipAddress, SECURITY_LOG_LIMITS.ipAddress)}, ${cut(params.endpoint, SECURITY_LOG_LIMITS.endpoint)}, ${message}, NOW())
    `;
  } catch (err) {
    console.error('[SecurityLog] Failed to record security event:', err);
  }
}
