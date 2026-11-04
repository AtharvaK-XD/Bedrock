import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isAllowedAppOrigin, type AuthenticatedUser } from './auth.js';
import { logSecurityEvent } from './db.js';
import { enforceRateLimit, getClientIp } from './rateLimiter.js';

/**
 * Desktop sign-in ticket.
 *
 * The desktop app never holds a Clerk session of its own: it only receives a copy of a session JWT
 * (about 60 s of life), so after a minute its API calls arrive without a valid token and are metered
 * per IP. This hands the signed-in browser a one-time Clerk sign-in ticket for its own account. The
 * desktop redeems it with Clerk (signIn strategy "ticket") and gets a real session that Clerk keeps
 * refreshing.
 *
 * Who can ask: only a request that carries a Clerk JWT that authenticateRequest() already verified
 * (signature, expiry and the CLERK_ISSUER allow-list). The ticket is always for that token's own
 * account, never for an id sent in the request.
 *
 * A ticket opens a NEW long-lived session, so a short-lived session token must not be enough on its own:
 * Clerk is asked whether the token's session is still active. A token copied before the user signed out
 * (it stays valid for up to about a minute) cannot be traded for a fresh login. Clerk enforces that a
 * ticket works once and expires after TICKET_TTL_SECONDS. No CSRF token is needed: only an explicit
 * Authorization header is accepted, never a cookie, so another website has nothing to ride on.
 */

const CLERK_SIGN_IN_TOKENS_URL = 'https://api.clerk.com/v1/sign_in_tokens';
const CLERK_SESSIONS_URL = 'https://api.clerk.com/v1/sessions/';
const TICKET_TTL_SECONDS = 120;
const CLERK_TIMEOUT_MS = 8000; // both Clerk calls together
/** Clerk user ids look like "user_2abc...". Anything else is not passed to Clerk. */
export const CLERK_USER_ID_RE = /^user_[A-Za-z0-9]{1,64}$/;
/** Clerk session ids look like "sess_2abc...". Anything else is not passed to Clerk. */
const CLERK_SESSION_ID_RE = /^sess_[A-Za-z0-9]{1,64}$/;

// Best-effort brake on top of the route's general rate limit (per instance only: serverless instances do not share memory).
const MAX_TICKETS_PER_WINDOW = 6;
const TICKET_WINDOW_MS = 60 * 1000;
const recentTickets = new Map<string, number[]>();

function overTicketLimit(userId: string, now = Date.now()): boolean {
  const recent = (recentTickets.get(userId) || []).filter((t) => now - t < TICKET_WINDOW_MS);
  if (recent.length >= MAX_TICKETS_PER_WINDOW) {
    recentTickets.set(userId, recent);
    return true;
  }
  recent.push(now);
  recentTickets.set(userId, recent);
  if (recentTickets.size > 1000) {
    for (const [id, times] of recentTickets) {
      if (times.every((t) => now - t >= TICKET_WINDOW_MS)) recentTickets.delete(id);
    }
  }
  return false;
}

/**
 * Reads `sub` from the Bearer token. The signature was already verified by authenticateRequest()
 * for this same header; this only reads the claim, so a cookie session or a guest never gets here.
 * Only call it AFTER authenticateRequest() returned a non-guest user for this request.
 */
export function verifiedClerkSubject(req: VercelRequest): string | null {
  const sub = bearerClaims(req)?.sub;
  return typeof sub === 'string' && CLERK_USER_ID_RE.test(sub) ? sub : null;
}

function bearerClaims(req: VercelRequest): Record<string, unknown> | null {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  const parts = header.slice(7).trim().split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/** Is this session still active at Clerk, and does it belong to this user? Throws when Clerk cannot answer. */
async function isSessionActive(sessionId: string, userId: string, secretKey: string, signal: AbortSignal): Promise<boolean> {
  const res = await fetch(`${CLERK_SESSIONS_URL}${sessionId}`, {
    signal,
    headers: { Authorization: `Bearer ${secretKey}`, Accept: 'application/json' },
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Clerk answered ${res.status} for the session check`);
  const session = (await res.json()) as { status?: unknown; user_id?: unknown };
  return session?.status === 'active' && session?.user_id === userId;
}

export async function handleDesktopTicket(req: VercelRequest, res: VercelResponse, user: AuthenticatedUser) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // A ticket is a login credential: signed-in Bearer token only (no cookie session, no local guest)
  const subject = user.isGuest ? null : verifiedClerkSubject(req);
  if (!subject) {
    return res.status(401).json({ error: 'Unauthorized: a signed-in session token is required.' });
  }

  // A browser names the page that sent the request: only Bedrock's own pages may ask (no Origin = not a browser page)
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin && !isAllowedAppOrigin(origin, req.headers.host)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  const sessionId = bearerClaims(req)?.sid;
  if (typeof sessionId !== 'string' || !CLERK_SESSION_ID_RE.test(sessionId)) {
    return res.status(401).json({ error: 'Unauthorized: a signed-in session token is required.' });
  }

  const secretKey = (process.env.CLERK_SECRET_KEY || '').trim();
  if (!secretKey.startsWith('sk_')) {
    console.error('[DesktopTicket] CLERK_SECRET_KEY is not configured');
    return res.status(503).json({ error: 'Desktop sign-in is not available yet', code: 'DESKTOP_TICKET_NOT_CONFIGURED' });
  }

  // Shared between all server copies (Redis); the brake below is per copy and stays as a second line
  if (!(await enforceRateLimit(req, res, 'desktopTicket', subject))) return;

  if (overTicketLimit(subject)) {
    res.setHeader('Retry-After', String(Math.ceil(TICKET_WINDOW_MS / 1000)));
    return res.status(429).json({ error: 'Too many sign-in requests. Please wait a minute and try again.', code: 'DESKTOP_TICKET_RATE_LIMITED' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLERK_TIMEOUT_MS);
  try {
    if (!(await isSessionActive(sessionId, subject, secretKey, controller.signal))) {
      await logSecurityEvent({
        userId: user.id,
        eventType: 'DESKTOP_TICKET_SESSION_ENDED',
        severity: 'WARN',
        ipAddress: getClientIp(req),
        endpoint: '/api/user/profile?action=desktop-ticket',
        message: 'Desktop ticket refused: the session token belongs to a session that is no longer active',
      }).catch(() => {});
      return res.status(401).json({ error: 'Your session has ended. Please sign in again.', code: 'DESKTOP_TICKET_SESSION_ENDED' });
    }

    const clerkRes = await fetch(CLERK_SIGN_IN_TOKENS_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: subject, expires_in_seconds: TICKET_TTL_SECONDS }),
    });

    if (!clerkRes.ok) {
      // Status only: the response body and the secret key are never logged
      console.error(`[DesktopTicket] Clerk answered ${clerkRes.status} for sign_in_tokens`);
      return res.status(502).json({ error: 'Could not start desktop sign-in', code: 'DESKTOP_TICKET_FAILED' });
    }

    const data = (await clerkRes.json()) as { token?: unknown };
    if (typeof data?.token !== 'string' || !data.token) {
      console.error('[DesktopTicket] Clerk answer had no ticket');
      return res.status(502).json({ error: 'Could not start desktop sign-in', code: 'DESKTOP_TICKET_FAILED' });
    }

    // Audit row: who asked and from where, never the ticket itself. A failed write must not block sign-in.
    try {
      await logSecurityEvent({
        userId: user.id,
        eventType: 'DESKTOP_TICKET_ISSUED',
        severity: 'INFO',
        ipAddress: getClientIp(req),
        endpoint: '/api/user/profile?action=desktop-ticket',
        message: `Desktop sign-in ticket issued (valid ${TICKET_TTL_SECONDS}s)`,
      });
    } catch {
      // ignore
    }

    return res.status(200).json({ ticket: data.token, expiresInSeconds: TICKET_TTL_SECONDS });
  } catch (err: any) {
    // Fails closed: when Clerk cannot confirm the session, no ticket is issued
    console.error('[DesktopTicket] Clerk request failed:', err?.name === 'AbortError' ? 'timeout' : err?.message || err);
    return res.status(502).json({ error: 'Could not start desktop sign-in', code: 'DESKTOP_TICKET_FAILED' });
  } finally {
    clearTimeout(timeout);
  }
}
