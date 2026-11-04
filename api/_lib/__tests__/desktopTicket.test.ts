import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Desktop sign-in ticket (POST /api/user/profile?action=desktop-ticket) with Clerk, the database and
// the token check mocked: no real Clerk request is made.
const h = vi.hoisted(() => ({
  state: { user: null as any, rateLimitAllowed: true, ticketLimitAllowed: true, limits: [] as Array<[string, unknown]> },
  authenticateRequest: vi.fn(),
  logSecurityEvent: vi.fn(async () => {}),
  sql: vi.fn(async () => []),
}));

vi.mock('../auth.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth.js')>()),
  authenticateRequest: h.authenticateRequest,
}));
vi.mock('../rateLimiter.js', () => ({
  enforceRateLimit: vi.fn(async (_req: unknown, _res: unknown, preset: string, id: unknown) => {
    h.state.limits.push([preset, id]);
    return preset === 'desktopTicket' ? h.state.ticketLimitAllowed : h.state.rateLimitAllowed;
  }),
  getClientIp: () => '203.0.113.7',
}));
vi.mock('../db.js', () => ({ getDb: () => h.sql, logSecurityEvent: h.logSecurityEvent }));

import profile from '../../user/profile.js';

const SECRET = 'sk_test_unit_test_secret_value';
const TICKET = 'ticket_value_from_clerk';

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
// The session id is derived from the user id, so the fake Clerk below can answer for any user
const sidFor = (sub: unknown) => `sess_${String(sub).replace(/[^A-Za-z0-9]/g, '')}`;
const jwtFor = (sub: unknown, claims: Record<string, unknown> = { sid: sidFor(sub) }) =>
  `${b64({ alg: 'RS256', kid: 'k' })}.${b64({ sub, ...claims })}.c2ln`;

let counter = 0;
const freshSub = () => `user_unit${++counter}`; // the per-user brake is module state: one id per test

function signedInUser(id: string, extra: Record<string, unknown> = {}) {
  return { id, email: 'a@example.com', name: 'A', role: 'r', plan: 'Free Plan', subscriptionTier: 'free', isGuest: false, ...extra };
}

function mockReq(sub: string, over: { method?: string; headers?: Record<string, string>; query?: Record<string, string>; body?: unknown } = {}) {
  return {
    method: over.method ?? 'POST',
    headers: { authorization: `Bearer ${jwtFor(sub)}`, ...(over.headers ?? {}) },
    query: { action: 'desktop-ticket', ...(over.query ?? {}) },
    body: over.body ?? {},
  } as any;
}

function mockRes() {
  const res: any = { statusCode: 200, body: undefined, headers: {} as Record<string, string> };
  res.status = vi.fn((c: number) => {
    res.statusCode = c;
    return res;
  });
  res.json = vi.fn((b: unknown) => {
    res.body = b;
    return res;
  });
  res.setHeader = vi.fn((k: string, v: string) => {
    res.headers[k] = v;
  });
  return res;
}

const clerkOk = () => new Response(JSON.stringify({ id: 'sit_1', token: TICKET, status: 'pending' }), { status: 200 });

let fetchMock: ReturnType<typeof vi.fn>;
/** The call that creates the ticket (POST sign_in_tokens). */
let mintMock: any;
/** Clerk's answer about a session; default: active and owned by the token's user. */
let sessionMock: any;

beforeEach(() => {
  h.state.rateLimitAllowed = true;
  h.state.ticketLimitAllowed = true;
  h.state.limits = [];
  h.authenticateRequest.mockReset();
  h.logSecurityEvent.mockClear();
  mintMock = vi.fn(async (..._a: unknown[]) => clerkOk());
  sessionMock = vi.fn(async (sid: string, _init?: unknown) =>
    new Response(JSON.stringify({ id: sid, status: 'active', user_id: 'user_' + sid.slice('sess_user'.length) }), { status: 200 })
  );
  fetchMock = vi.fn(async (url: string, init?: any) =>
    String(url).startsWith('https://api.clerk.com/v1/sessions/')
      ? sessionMock(String(url).split('/').pop() as string, init)
      : mintMock(url, init)
  );
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('CLERK_SECRET_KEY', SECRET);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/user/profile?action=desktop-ticket', () => {
  it('gives a signed-in user a ticket for their own Clerk account and never exposes the secret key', async () => {
    const sub = freshSub();
    h.authenticateRequest.mockResolvedValue(signedInUser(sub));
    const res = mockRes();
    await profile(mockReq(sub), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ticket: TICKET, expiresInSeconds: 120 });
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(JSON.stringify(res.body)).not.toContain(SECRET);

    expect(mintMock).toHaveBeenCalledTimes(1);
    const [url, init] = mintMock.mock.calls[0] as [string, any];
    expect(url).toBe('https://api.clerk.com/v1/sign_in_tokens');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${SECRET}`);
    expect(JSON.parse(init.body)).toEqual({ user_id: sub, expires_in_seconds: 120 });
  });

  it('takes the account from the verified token, not from the request body, query or the database row id', async () => {
    const sub = freshSub();
    // The database row can carry an older id (account linked by email); the ticket must follow the token.
    h.authenticateRequest.mockResolvedValue(signedInUser('usr_legacy_row_id'));
    const res = mockRes();
    await profile(mockReq(sub, { body: { user_id: 'user_victim', userId: 'user_victim' }, query: { user_id: 'user_victim' } }), res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse((mintMock.mock.calls[0] as any[])[1].body).user_id).toBe(sub);
  });

  it('refuses everyone who is not a verified, signed-in Bearer user, and never calls Clerk for them', async () => {
    const sub = freshSub();
    const cases: Array<[string, () => Promise<any>]> = [
      ['no valid session', async () => (h.authenticateRequest.mockResolvedValue(null), mockRes())],
      ['local guest', async () => (h.authenticateRequest.mockResolvedValue(signedInUser('usr_lead_architect_01', { isGuest: true })), mockRes())],
    ];
    for (const [, setup] of cases) {
      const res = await setup();
      await profile(mockReq(sub), res);
      expect(res.statusCode).toBe(401);
    }

    // Cookie session only (no Authorization header): a ticket is a login credential, so Bearer only
    h.authenticateRequest.mockResolvedValue(signedInUser(sub));
    const cookieOnly = mockRes();
    const req = mockReq(sub);
    delete req.headers.authorization;
    req.headers.cookie = `__session=${jwtFor(sub)}`;
    await profile(req, cookieOnly);
    expect(cookieOnly.statusCode).toBe(401);

    // A subject that is not a Clerk user id is never passed to Clerk
    for (const badSub of ['usr_lead_architect_01', 'user_', 'user_a b', undefined, 42]) {
      const bad = mockRes();
      await profile(mockReq(sub, { headers: { authorization: `Bearer ${jwtFor(badSub)}` } }), bad);
      expect(bad.statusCode).toBe(401);
    }
    const garbage = mockRes();
    await profile(mockReq(sub, { headers: { authorization: 'Bearer not.a.jwt' } }), garbage);
    expect(garbage.statusCode).toBe(401);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.logSecurityEvent).not.toHaveBeenCalled();
  });

  it('only answers POST', async () => {
    const sub = freshSub();
    h.authenticateRequest.mockResolvedValue(signedInUser(sub));
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const res = mockRes();
      await profile(mockReq(sub, { method }), res);
      expect(res.statusCode).toBe(405);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 503 (not a crash) when CLERK_SECRET_KEY is missing or not a secret key', async () => {
    const sub = freshSub();
    h.authenticateRequest.mockResolvedValue(signedInUser(sub));
    for (const value of ['', 'pk_test_publishable_not_secret']) {
      vi.stubEnv('CLERK_SECRET_KEY', value);
      const res = mockRes();
      await profile(mockReq(sub), res);
      expect(res.statusCode).toBe(503);
      expect(res.body.code).toBe('DESKTOP_TICKET_NOT_CONFIGURED');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 502 without leaking Clerk text when Clerk fails, times out or sends no ticket', async () => {
    const sub = freshSub();
    h.authenticateRequest.mockResolvedValue(signedInUser(sub));

    mintMock.mockResolvedValueOnce(new Response('{"errors":[{"message":"secret internal detail"}]}', { status: 422 }));
    const rejected = mockRes();
    await profile(mockReq(sub), rejected);
    expect(rejected.statusCode).toBe(502);
    expect(JSON.stringify(rejected.body)).not.toContain('secret internal detail');

    mintMock.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const timedOut = mockRes();
    await profile(mockReq(sub), timedOut);
    expect(timedOut.statusCode).toBe(502);

    mintMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'sit_1' }), { status: 200 }));
    const noTicket = mockRes();
    await profile(mockReq(sub), noTicket);
    expect(noTicket.statusCode).toBe(502);

    expect(h.logSecurityEvent).not.toHaveBeenCalled();
    const logged = (console.error as any).mock.calls.flat().join(' ');
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain('secret internal detail');
  });

  it('writes an audit row without the ticket, and still signs in when that write fails', async () => {
    const sub = freshSub();
    h.authenticateRequest.mockResolvedValue(signedInUser(sub));
    await profile(mockReq(sub), mockRes());

    expect(h.logSecurityEvent).toHaveBeenCalledTimes(1);
    const row = (h.logSecurityEvent.mock.calls[0] as any[])[0];
    expect(row).toMatchObject({ userId: sub, eventType: 'DESKTOP_TICKET_ISSUED', severity: 'INFO', ipAddress: '203.0.113.7' });
    expect(JSON.stringify(row)).not.toContain(TICKET);

    h.logSecurityEvent.mockRejectedValueOnce(new Error('db down'));
    const res = mockRes();
    await profile(mockReq(sub), res);
    expect(res.statusCode).toBe(200);
  });

  it('stops one user from asking for tickets in a loop', async () => {
    const sub = freshSub();
    h.authenticateRequest.mockResolvedValue(signedInUser(sub));
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) {
      const res = mockRes();
      await profile(mockReq(sub), res);
      codes.push(res.statusCode);
    }
    expect(codes).toEqual([200, 200, 200, 200, 200, 200, 429, 429]);
    expect(mintMock).toHaveBeenCalledTimes(6);

    // Someone else is not affected
    const other = freshSub();
    h.authenticateRequest.mockResolvedValue(signedInUser(other));
    const res = mockRes();
    await profile(mockReq(other), res);
    expect(res.statusCode).toBe(200);
  });

  describe('a session token alone is not enough to open a new login', () => {
    it('asks Clerk about the session from the token before creating a ticket', async () => {
      const sub = freshSub();
      h.authenticateRequest.mockResolvedValue(signedInUser(sub));
      await profile(mockReq(sub), mockRes());

      expect(sessionMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0][0])).toBe(`https://api.clerk.com/v1/sessions/${sidFor(sub)}`);
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${SECRET}`);
      expect(String(fetchMock.mock.calls[1][0])).toBe('https://api.clerk.com/v1/sign_in_tokens');
    });

    it('refuses a token whose session has ended (signed out, revoked, expired): no ticket is created', async () => {
      for (const status of ['ended', 'revoked', 'removed', 'expired', 'abandoned', 'replaced', 'pending']) {
        const sub = freshSub();
        h.authenticateRequest.mockResolvedValue(signedInUser(sub));
        sessionMock.mockResolvedValueOnce(new Response(JSON.stringify({ status, user_id: sub }), { status: 200 }));
        const res = mockRes();
        await profile(mockReq(sub), res);
        expect(res.statusCode, status).toBe(401);
        expect(res.body.code).toBe('DESKTOP_TICKET_SESSION_ENDED');
      }
      expect(mintMock).not.toHaveBeenCalled();
      expect((h.logSecurityEvent.mock.calls[0] as any[])[0]).toMatchObject({ eventType: 'DESKTOP_TICKET_SESSION_ENDED', severity: 'WARN' });
    });

    it('refuses a session Clerk does not know, or one that belongs to someone else', async () => {
      const sub = freshSub();
      h.authenticateRequest.mockResolvedValue(signedInUser(sub));
      sessionMock.mockResolvedValueOnce(new Response('{}', { status: 404 }));
      const unknown = mockRes();
      await profile(mockReq(sub), unknown);
      expect(unknown.statusCode).toBe(401);

      sessionMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: 'active', user_id: 'user_someoneelse' }), { status: 200 }));
      const foreign = mockRes();
      await profile(mockReq(sub), foreign);
      expect(foreign.statusCode).toBe(401);
      expect(mintMock).not.toHaveBeenCalled();
    });

    it('creates no ticket when Clerk cannot answer about the session (fails closed)', async () => {
      const sub = freshSub();
      h.authenticateRequest.mockResolvedValue(signedInUser(sub));
      sessionMock.mockResolvedValueOnce(new Response('{}', { status: 500 }));
      const broken = mockRes();
      await profile(mockReq(sub), broken);
      expect(broken.statusCode).toBe(502);

      sessionMock.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      const timedOut = mockRes();
      await profile(mockReq(sub), timedOut);
      expect(timedOut.statusCode).toBe(502);
      expect(mintMock).not.toHaveBeenCalled();
    });

    it('refuses a token without a usable session id, and never sends a strange id to Clerk', async () => {
      const sub = freshSub();
      h.authenticateRequest.mockResolvedValue(signedInUser(sub));
      for (const claims of [{}, { sid: 42 }, { sid: 'sess_' }, { sid: 'sess_a/../../users' }, { sid: 'other_abc' }]) {
        const res = mockRes();
        await profile(mockReq(sub, { headers: { authorization: `Bearer ${jwtFor(sub, claims)}` } }), res);
        expect(res.statusCode).toBe(401);
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("refuses other websites; Bedrock's own pages and non-browser callers pass", async () => {
    const sub = freshSub();
    h.authenticateRequest.mockResolvedValue(signedInUser(sub));
    for (const origin of ['https://evil.example', 'https://bedrock-steel.vercel.app.evil.example', 'null']) {
      const res = mockRes();
      await profile(mockReq(sub, { headers: { origin, host: 'bedrock-steel.vercel.app' } }), res);
      expect(res.statusCode, origin).toBe(403);
    }
    expect(fetchMock).not.toHaveBeenCalled();

    for (const origin of ['https://bedrock-steel.vercel.app', 'http://127.0.0.1:54321']) {
      const res = mockRes();
      await profile(mockReq(sub, { headers: { origin, host: 'bedrock-steel.vercel.app' } }), res);
      expect(res.statusCode, origin).toBe(200);
    }
    const noOrigin = mockRes();
    await profile(mockReq(sub), noOrigin);
    expect(noOrigin.statusCode).toBe(200);
  });

  it('applies the shared per-account limit before calling Clerk', async () => {
    const sub = freshSub();
    h.authenticateRequest.mockResolvedValue(signedInUser(sub));
    h.state.ticketLimitAllowed = false;
    await profile(mockReq(sub), mockRes());
    expect(h.state.limits).toContainEqual(['desktopTicket', sub]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the normal profile routes unchanged when no action is sent', async () => {
    const sub = freshSub();
    h.authenticateRequest.mockResolvedValue(signedInUser(sub));
    h.sql.mockResolvedValueOnce([] as never);
    const res = mockRes();
    const req = mockReq(sub, { method: 'GET' });
    req.query = {};
    await profile(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBe('a@example.com');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
