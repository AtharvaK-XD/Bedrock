// Security tests for the auth email endpoint (api/auth/send-email.ts): signed-in users only,
// own origins only, never a wildcard CORS header. Database and auth are mocked; no email is sent.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  user: null as null | Record<string, any>,
  sent: [] as Array<{ to: string; subject: string; html: string }>,
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: async (mail: { to: string; subject: string; html: string }) => {
        h.sent.push(mail);
        return { messageId: 'test-id' };
      },
    }),
  },
}));

vi.mock('../../api/_lib/db.js', () => ({
  getDb: () => () => Promise.resolve([]),
  logSecurityEvent: vi.fn(async () => {}),
}));

vi.mock('../../api/_lib/auth.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/_lib/auth.ts')>();
  return { ...actual, authenticateRequest: vi.fn(async () => h.user) };
});

import sendEmailHandler from '../../api/auth/send-email.ts';

const USER = { id: 'user_a', email: 'a@example.com', name: 'A', role: 'r', subscriptionTier: 'free', plan: 'Free Plan', isGuest: false };

// A session token as the route sees it: authenticateRequest is mocked, so only the sub claim matters
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const BEARER = `Bearer ${b64({ alg: 'RS256' })}.${b64({ sub: 'user_abc123' })}.sig`;

/** Fake Clerk user lookup. `verified: false` simulates an unverified primary email. */
function mockClerk(user: { email?: string; first?: string; last?: string; verified?: boolean } | 'down') {
  const fetchMock = vi.fn(async () => {
    if (user === 'down') return new Response('{}', { status: 500 });
    return new Response(JSON.stringify({
      primary_email_address_id: 'idn_1',
      email_addresses: [{ id: 'idn_1', email_address: user.email ?? 'a@example.com', verification: { status: user.verified === false ? 'unverified' : 'verified' } }],
      first_name: user.first ?? 'Ada',
      last_name: user.last ?? 'Lovelace',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

let ipCounter = 0;
function makeReq(method: string, body: any = {}, headers: Record<string, string> = {}) {
  ipCounter += 1;
  return {
    method,
    body,
    query: {},
    headers: { host: 'bedrock-steel.vercel.app', authorization: BEARER, 'x-forwarded-for': `198.51.100.${ipCounter % 250}`, ...headers },
    socket: { remoteAddress: '10.0.0.1' },
  } as any;
}

function makeRes() {
  const res: any = { statusCode: 200, headers: {} as Record<string, string>, body: undefined as any };
  res.setHeader = (k: string, v: string) => { res.headers[k.toLowerCase()] = v; return res; };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  res.end = () => res;
  return res;
}

beforeEach(() => {
  h.user = USER;
  h.sent.length = 0;
  process.env.CLERK_SECRET_KEY = 'sk_test_unit_test_not_real';
  process.env.GMAIL_APP_PASSWORD = 'unittestnotreal';
  mockClerk({});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('auth email endpoint', () => {
  const emailReq = (headers: Record<string, string> = {}) =>
    makeReq('POST', { email: 'a@example.com', type: 'signin' }, headers);

  it('requires a signed-in user', async () => {
    h.user = null;
    const res = makeRes();
    await sendEmailHandler(emailReq(), res);
    expect(res.statusCode).toBe(401);
  });

  it('refuses other websites and never sends a wildcard CORS header', async () => {
    const res = makeRes();
    await sendEmailHandler(emailReq({ origin: 'https://evil.example' }), res);
    expect(res.statusCode).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();

    const pre = makeRes();
    await sendEmailHandler(makeReq('OPTIONS', {}, { origin: 'https://evil.example' }), pre);
    expect(pre.statusCode).toBe(403);
    expect(pre.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows our own site, preview deployments of itself and the desktop app origin', async () => {
    for (const [origin, host] of [
      ['https://bedrock-steel.vercel.app', 'bedrock-steel.vercel.app'],
      ['https://bedrock-git-feature.vercel.app', 'bedrock-git-feature.vercel.app'],
      ['http://127.0.0.1:54321', 'bedrock-steel.vercel.app'],
    ]) {
      const pre = makeRes();
      await sendEmailHandler(makeReq('OPTIONS', {}, { origin, host }), pre);
      expect(pre.statusCode).toBe(204);
      expect(pre.headers['access-control-allow-origin']).toBe(origin);
    }
  });

  it('only lets a user notify their own address', async () => {
    const res = makeRes();
    await sendEmailHandler(makeReq('POST', { email: 'victim@example.com', type: 'signin' }), res);
    expect(res.statusCode).toBe(403);
    expect(h.sent).toHaveLength(0);
  });

  it('sends to the verified Clerk address and uses Clerk\'s name, not the request\'s', async () => {
    // The account has the @clerk.user placeholder email in the database: the old own-address rule was skipped for it
    h.user = { ...USER, email: 'user_abc123@clerk.user' };
    const res = makeRes();
    await sendEmailHandler(makeReq('POST', { email: 'victim@example.com', name: 'Your account was hacked, click here', type: 'signin' }), res);
    expect(res.statusCode).toBe(403);
    expect(h.sent).toHaveLength(0);

    const ok = makeRes();
    await sendEmailHandler(makeReq('POST', { name: 'Click http://evil.example now', type: 'signup' }), ok);
    expect(ok.statusCode).toBe(200);
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].to).toBe('a@example.com');
    expect(h.sent[0].html).toContain('Ada Lovelace');
    expect(h.sent[0].html).not.toContain('evil.example');
  });

  it('sends nothing when the account has no verified email', async () => {
    mockClerk({ verified: false });
    const res = makeRes();
    await sendEmailHandler(makeReq('POST', { type: 'signin' }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(h.sent).toHaveLength(0);
  });

  it('sends nothing when Clerk cannot be asked (not configured or down)', async () => {
    mockClerk('down');
    const down = makeRes();
    await sendEmailHandler(makeReq('POST', { email: 'a@example.com', type: 'signin' }), down);
    expect(down.statusCode).toBe(503);

    delete process.env.CLERK_SECRET_KEY;
    const missing = makeRes();
    await sendEmailHandler(makeReq('POST', { email: 'a@example.com', type: 'signin' }), missing);
    expect(missing.statusCode).toBe(503);
    expect(h.sent).toHaveLength(0);
  });

  it('only asks Clerk about the account in the session token, and never for a forged id', async () => {
    const fetchMock = mockClerk({});
    await sendEmailHandler(makeReq('POST', { type: 'signin' }), makeRes());
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.clerk.com/v1/users/user_abc123');

    const evil = `Bearer ${b64({ alg: 'RS256' })}.${b64({ sub: 'user_x/../../organizations' })}.sig`;
    const res = makeRes();
    await sendEmailHandler(makeReq('POST', { type: 'signin' }, { authorization: evil }), res);
    expect(res.statusCode).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
