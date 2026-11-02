import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AuthenticatedUser } from './auth.js';
import { getDb, logSecurityEvent } from './db.js';
import { verifiedClerkSubject, CLERK_USER_ID_RE } from './desktopTicket.js';

/**
 * Account erasure (right to erasure), two ways in:
 *  1. POST /api/user/profile?action=delete-account: the signed-in user deletes their own account.
 *  2. POST /api/user/profile?action=clerk-webhook: Clerk tells us an account was deleted on Clerk's side
 *     ("user.deleted", signed by Svix). Also the retry path for (1): if our erase failed after Clerk deleted
 *     the sign-in account, Clerk's webhook (with Svix's own retries) erases the data later.
 * Both call delete_user_data(id) (migration 0014): one transaction, safe to run twice, refuses with
 * OTHER_RECORDS when an unexpected table still holds records for the account.
 * The function trusts the id it is given, so this file is the only place that decides WHOSE data is erased:
 * the caller's own account, or an id inside a correctly signed Clerk webhook.
 */

const CLERK_API = 'https://api.clerk.com/v1';
const CLERK_TIMEOUT_MS = 5000;
/** Svix's recommendation is "within your tolerance": 5 minutes either way, like Svix's own libraries. */
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
/** Typed by the user in the app before the request is sent: an accidental call cannot erase an account. */
export const DELETE_CONFIRMATION = 'DELETE';

const PG_UNDEFINED_FUNCTION = '42883';
const PG_RESTRICT_VIOLATION = '23001';

export interface ErasedCounts {
  deletedUser: boolean;
  prompts: number;
  workflows: number;
  traces: number;
}

export class ErasureError extends Error {
  /** OTHER_RECORDS: an unexpected table holds records (nothing deleted). NOT_READY: migration 0014 is not applied. */
  kind: 'OTHER_RECORDS' | 'NOT_READY';
  constructor(kind: 'OTHER_RECORDS' | 'NOT_READY', message: string) {
    super(message);
    this.name = 'ErasureError';
    this.kind = kind;
  }
}

/** Runs delete_user_data(id). Throws ErasureError for the two known refusals, the database error otherwise. */
export async function eraseAccountData(userId: string): Promise<ErasedCounts> {
  const sql = getDb();
  try {
    const [row] = (await sql`SELECT * FROM delete_user_data(${userId})`) as any[];
    return {
      deletedUser: row?.deleted_user === true,
      prompts: Number(row?.prompts) || 0,
      workflows: Number(row?.workflows) || 0,
      traces: Number(row?.traces) || 0,
    };
  } catch (err: any) {
    if (err?.code === PG_UNDEFINED_FUNCTION) {
      throw new ErasureError('NOT_READY', 'delete_user_data() not found: apply migration 0014 first');
    }
    if (err?.code === PG_RESTRICT_VIOLATION || String(err?.message ?? '').includes('OTHER_RECORDS')) {
      // The database's own message names the table; it goes to the server log only, never to the client
      throw new ErasureError('OTHER_RECORDS', String(err?.message ?? 'OTHER_RECORDS'));
    }
    throw err;
  }
}

/** Removes the sign-in account at Clerk. True when it is gone (also when Clerk says it was already gone). */
export async function deleteClerkUser(clerkUserId: string, secretKey: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLERK_TIMEOUT_MS);
  try {
    const res = await fetch(`${CLERK_API}/users/${encodeURIComponent(clerkUserId)}`, {
      method: 'DELETE',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (res.ok || res.status === 404) return true;
    console.error(`[AccountDeletion] Clerk answered ${res.status} when deleting a user`);
    return false;
  } catch (err: any) {
    console.error('[AccountDeletion] Clerk request failed:', err?.name === 'AbortError' ? 'timeout' : err?.message || err);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function clerkSecretKey(): string | null {
  const key = (process.env.CLERK_SECRET_KEY || '').trim();
  return key.startsWith('sk_') ? key : null;
}

/**
 * POST /api/user/profile?action=delete-account   body: { "confirm": "DELETE" }
 * Erases the caller's own data, then removes their sign-in account at Clerk. Bearer token only (a browser
 * cannot attach that header from another site, so this cannot be triggered by a link or a form elsewhere).
 */
export async function handleDeleteAccount(req: VercelRequest, res: VercelResponse, user: AuthenticatedUser) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const subject = user.isGuest ? null : verifiedClerkSubject(req);
  if (!subject) {
    return res.status(401).json({ error: 'Unauthorized: a signed-in session token is required.' });
  }
  if (req.body?.confirm !== DELETE_CONFIRMATION) {
    return res.status(400).json({
      error: 'Confirmation required',
      code: 'CONFIRMATION_REQUIRED',
      message: `Send { "confirm": "${DELETE_CONFIRMATION}" } to delete your account. This cannot be undone.`,
    });
  }

  // Checked first, so we never erase the data and then fail to remove the sign-in account for a missing key
  const secretKey = clerkSecretKey();
  if (!secretKey) {
    console.error('[AccountDeletion] CLERK_SECRET_KEY is not configured');
    return res.status(503).json({
      error: 'Account deletion is not available yet',
      code: 'ACCOUNT_DELETION_NOT_READY',
      message: 'Account deletion is not available right now. Please try again later or contact support.',
    });
  }

  let counts: ErasedCounts;
  try {
    // The data row the app actually uses (an older account linked by email can have its own id)
    counts = await eraseAccountData(user.id);
  } catch (err: any) {
    if (err instanceof ErasureError && err.kind === 'OTHER_RECORDS') {
      console.error('[AccountDeletion] Refused:', err.message);
      return res.status(409).json({
        error: 'Account needs a manual check',
        code: 'ACCOUNT_DELETION_NEEDS_SUPPORT',
        message: 'Some of your data needs a manual check before it can be deleted. Nothing was deleted. Please contact support.',
      });
    }
    if (err instanceof ErasureError && err.kind === 'NOT_READY') {
      console.error('[AccountDeletion]', err.message);
      return res.status(503).json({
        error: 'Account deletion is not available yet',
        code: 'ACCOUNT_DELETION_NOT_READY',
        message: 'Account deletion is not available right now. Please try again later or contact support.',
      });
    }
    console.error('[AccountDeletion] Erase failed:', err?.code || err?.message || err);
    return res.status(500).json({ error: 'Account deletion failed', message: 'Something went wrong on our side. Nothing was deleted. Please try again.' });
  }

  const signInRemoved = await deleteClerkUser(subject, secretKey);

  // No account id in the log row: the account no longer exists (and the user_id column points at accounts)
  try {
    await logSecurityEvent({
      userId: null,
      eventType: 'ACCOUNT_DELETED',
      severity: 'INFO',
      message: `Account deleted by its owner (prompts ${counts.prompts}, workflows ${counts.workflows}, traces ${counts.traces}; sign-in removed: ${signInRemoved})`,
    });
  } catch {
    // ignore
  }

  return res.status(200).json({
    success: true,
    deleted: { prompts: counts.prompts, workflows: counts.workflows, traces: counts.traces },
    signInRemoved,
    message: signInRemoved
      ? 'Your account and all your data were deleted.'
      : 'Your data was deleted. Your sign-in account could not be removed right now: try again in a few minutes, or contact support.',
  });
}

// ---------------------------------------------------------------- Clerk webhook (Svix)

/**
 * Svix signature check (docs.svix.com "Verifying payloads manually"): HMAC-SHA256 over "<id>.<timestamp>.<raw body>"
 * with the base64 part of the "whsec_..." secret; the header holds one or more space-separated "v1,<base64>" entries.
 * Constant-time comparison; the timestamp must be within 5 minutes (stops replays of old deliveries).
 */
export function verifySvixSignature(params: {
  id: string;
  timestamp: string;
  signatureHeader: string;
  body: string;
  secret: string;
  nowSeconds?: number;
}): boolean {
  const { id, timestamp, signatureHeader, body, secret } = params;
  if (!id || !timestamp || !signatureHeader || !secret.startsWith('whsec_')) return false;
  if (!/^\d{1,12}$/.test(timestamp)) return false;
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > WEBHOOK_TOLERANCE_SECONDS) return false;

  let key: Buffer;
  try {
    key = Buffer.from(secret.slice('whsec_'.length), 'base64');
  } catch {
    return false;
  }
  if (key.length === 0) return false;

  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();
  for (const entry of signatureHeader.split(' ')) {
    const [version, sig] = entry.split(',');
    if (version !== 'v1' || !sig) continue;
    let given: Buffer;
    try {
      given = Buffer.from(sig, 'base64');
    } catch {
      continue;
    }
    if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) return true;
  }
  return false;
}

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

/**
 * The exact bytes Clerk sent (the signature covers them). Vercel's helpers read the body once and replay it to
 * "data"/"end" listeners (restoreBody in @vercel/node), so it can still be read here. Gives up after 3 s or 256 KB.
 */
function readRawBody(req: VercelRequest): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof (req as any).on !== 'function') return resolve(null);
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const done = (value: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => done(null), 3000);
    req.on('data', (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buf.length;
      if (size > MAX_WEBHOOK_BODY_BYTES) return done(null);
      chunks.push(buf);
    });
    req.on('end', () => done(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => done(null));
  });
}

const header = (req: VercelRequest, ...names: string[]): string => {
  for (const name of names) {
    const v = req.headers[name];
    const value = Array.isArray(v) ? v[0] : v;
    if (typeof value === 'string' && value) return value;
  }
  return '';
};

/**
 * POST /api/user/profile?action=clerk-webhook   (the URL to enter in Clerk > Webhooks, event "user.deleted")
 * Needs CLERK_WEBHOOK_SECRET (the "whsec_..." signing secret Clerk shows for that endpoint).
 * Non-2xx answers make Svix retry later, so: bad signature 401, not configured 503, database error 500;
 * events we do not handle and refusals a human must look at answer 200 (retrying would not help).
 */
export async function handleClerkWebhook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = (process.env.CLERK_WEBHOOK_SECRET || '').trim();
  if (!secret.startsWith('whsec_')) {
    console.error('[ClerkWebhook] CLERK_WEBHOOK_SECRET is not configured');
    return res.status(503).json({ error: 'Webhook not configured' });
  }

  const id = header(req, 'svix-id', 'webhook-id');
  const timestamp = header(req, 'svix-timestamp', 'webhook-timestamp');
  const signatureHeader = header(req, 'svix-signature', 'webhook-signature');
  if (!id || !timestamp || !signatureHeader) {
    return res.status(400).json({ error: 'Missing webhook signature headers' });
  }

  // Raw bytes first (what Svix signed); a compact re-serialization only as a fallback. Either way the
  // signature must match, so the fallback cannot let an unsigned request through.
  const raw = await readRawBody(req);
  const candidates = [raw, req.body !== undefined && typeof req.body === 'object' ? JSON.stringify(req.body) : typeof req.body === 'string' ? req.body : null]
    .filter((b): b is string => typeof b === 'string' && b.length > 0);
  const verifiedBody = candidates.find((body) => verifySvixSignature({ id, timestamp, signatureHeader, body, secret }));
  if (!verifiedBody) {
    // Log only, no database row: this runs before any check and must not be a cheap way to fill a table
    console.warn('[ClerkWebhook] Rejected a request with an invalid or expired signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event: any;
  try {
    event = JSON.parse(verifiedBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (event?.type !== 'user.deleted') {
    return res.status(200).json({ received: true, ignored: true });
  }
  const clerkUserId = event?.data?.id;
  if (typeof clerkUserId !== 'string' || !CLERK_USER_ID_RE.test(clerkUserId)) {
    console.warn('[ClerkWebhook] user.deleted without a valid user id');
    return res.status(200).json({ received: true, ignored: true });
  }

  try {
    const counts = await eraseAccountData(clerkUserId);
    try {
      await logSecurityEvent({
        userId: null,
        eventType: 'ACCOUNT_DELETED',
        severity: 'INFO',
        message: `Account deleted through Clerk (data found: ${counts.deletedUser}; prompts ${counts.prompts}, workflows ${counts.workflows}, traces ${counts.traces})`,
      });
    } catch {
      // ignore
    }
    return res.status(200).json({ received: true, erased: counts.deletedUser });
  } catch (err: any) {
    if (err instanceof ErasureError && err.kind === 'OTHER_RECORDS') {
      // Retrying cannot fix this: a person must decide. Alert, and tell Svix the event was received.
      console.error('[ClerkWebhook] Erasure refused, needs a manual decision:', err.message);
      try {
        await logSecurityEvent({
          userId: null,
          eventType: 'ACCOUNT_DELETION_NEEDS_REVIEW',
          severity: 'CRITICAL',
          message: 'A Clerk account was deleted but its data could not be erased automatically (OTHER_RECORDS). Check the server log.',
        });
      } catch {
        // ignore
      }
      return res.status(200).json({ received: true, erased: false, needsReview: true });
    }
    if (err instanceof ErasureError && err.kind === 'NOT_READY') {
      console.error('[ClerkWebhook]', err.message);
      return res.status(503).json({ error: 'Not ready' });
    }
    console.error('[ClerkWebhook] Erase failed, Svix will retry:', err?.code || err?.message || err);
    return res.status(500).json({ error: 'Erase failed' });
  }
}
