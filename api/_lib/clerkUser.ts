import type { VercelRequest } from '@vercel/node';

/**
 * Who is really behind a verified Clerk session, asked of Clerk itself (not of the browser).
 * Used where an email is sent on a user's behalf, so a caller cannot pick the recipient or the
 * wording. Needs CLERK_SECRET_KEY, the same key as the desktop sign-in ticket.
 */

const CLERK_USERS_URL = 'https://api.clerk.com/v1/users/';
const CLERK_TIMEOUT_MS = 5000;
/** Clerk user ids look like "user_2abc...". Anything else is never sent to Clerk. */
const CLERK_USER_ID_RE = /^user_[A-Za-z0-9]{1,64}$/;

export interface ClerkIdentity {
  /** Primary email address, only when Clerk has verified it. */
  email: string;
  /** Display name from Clerk, or null when the account has none. */
  name: string | null;
}

/**
 * Reads `sub` from the request's session token (Bearer header, else the __session cookie). Call it
 * only after authenticateRequest() accepted the same request: that call checked the signature,
 * expiry and issuer, this only reads the claim.
 */
export function sessionSubject(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  const cookie = typeof req.headers.cookie === 'string' ? req.headers.cookie.match(/__session=([^;]+)/)?.[1] : undefined;
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : cookie;
  const parts = (token || '').split('.');
  if (parts.length !== 3) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof claims?.sub === 'string' && CLERK_USER_ID_RE.test(claims.sub) ? claims.sub : null;
  } catch {
    return null;
  }
}

export type ClerkIdentityResult =
  | { ok: true; identity: ClerkIdentity }
  | { ok: false; reason: 'not_configured' | 'unavailable' | 'no_verified_email' };

/** Asks Clerk for the user's verified primary email and name. Never logs the response. */
export async function fetchClerkIdentity(userId: string): Promise<ClerkIdentityResult> {
  const secretKey = (process.env.CLERK_SECRET_KEY || '').trim();
  if (!secretKey.startsWith('sk_')) return { ok: false, reason: 'not_configured' };
  if (!CLERK_USER_ID_RE.test(userId)) return { ok: false, reason: 'unavailable' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLERK_TIMEOUT_MS);
  try {
    const res = await fetch(`${CLERK_USERS_URL}${userId}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${secretKey}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      console.error(`[ClerkUser] Clerk answered ${res.status} for the user lookup`);
      return { ok: false, reason: 'unavailable' };
    }
    const user = (await res.json()) as {
      primary_email_address_id?: unknown;
      email_addresses?: Array<{ id?: unknown; email_address?: unknown; verification?: { status?: unknown } | null }>;
      first_name?: unknown;
      last_name?: unknown;
    };

    const primary = Array.isArray(user?.email_addresses)
      ? user.email_addresses.find((e) => e?.id === user.primary_email_address_id)
      : undefined;
    const email = typeof primary?.email_address === 'string' ? primary.email_address.toLowerCase().trim() : '';
    if (!email || primary?.verification?.status !== 'verified') return { ok: false, reason: 'no_verified_email' };

    const first = typeof user.first_name === 'string' ? user.first_name : '';
    const last = typeof user.last_name === 'string' ? user.last_name : '';
    const name = `${first} ${last}`.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 60) || null;
    return { ok: true, identity: { email, name } };
  } catch (err: any) {
    console.error('[ClerkUser] Clerk lookup failed:', err?.name === 'AbortError' ? 'timeout' : err?.name || 'error');
    return { ok: false, reason: 'unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}
