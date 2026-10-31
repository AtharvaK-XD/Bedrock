import { neon } from '@neondatabase/serverless';

function getDatabaseUrl(): string {
  let url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || '';
  if (url.startsWith('"') && url.endsWith('"')) {
    url = url.slice(1, -1);
  }
  return url.trim();
}

let sqlInstance: ReturnType<typeof neon> | null = null;

export function getDb() {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error('DATABASE_URL is not configured in environment variables.');
  }
  if (!sqlInstance) {
    sqlInstance = neon(url);
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
    const id = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
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
