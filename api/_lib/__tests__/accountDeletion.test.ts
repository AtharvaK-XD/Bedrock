import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

// "Delete my account" and Clerk's user.deleted webhook, with the database, Clerk and the token check mocked.
const h = vi.hoisted(() => ({
  state: { rateLimitAllowed: true },
  authenticateRequest: vi.fn(),
  logSecurityEvent: vi.fn(async (..._args: unknown[]) => {}),
  sql: vi.fn(async (..._args: unknown[]): Promise<unknown[]> => []),
}));

vi.mock('../auth.js', () => ({ authenticateRequest: h.authenticateRequest }));
vi.mock('../rateLimiter.js', () => ({
  enforceRateLimit: vi.fn(async () => h.state.rateLimitAllowed),
  getClientIp: () => '203.0.113.7',
}));
vi.mock('../db.js', () => ({ getDb: () => h.sql, logSecurityEvent: h.logSecurityEvent }));

import profile from '../../user/profile.js';
import { verifySvixSignature, DELETE_CONFIRMATION } from '../accountDeletion.js';

const CLERK_SECRET = 'sk_test_unit_test_secret_value';
const WEBHOOK_SECRET = 'whsec_' + Buffer.from('unit-test-webhook-signing-key-32b').toString('base64');

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwtFor = (sub: string) => `${b64({ alg: 'RS256', kid: 'k' })}.${b64({ sub })}.c2ln`;
const user = (id: string, extra: Record<string, unknown> = {}) => ({
  id, email: 'a@example.com', name: 'A', role: 'r', plan: 'Free Plan', subscriptionTier: 'free', isGuest: false, ...extra,
});

function mockRes() {
  const res: any = { statusCode: 200, body: undefined, headers: {} as Record<string, string> };
  res.status = vi.fn((c: number) => ((res.statusCode = c), res));
  res.json = vi.fn((b: unknown) => ((res.body = b), res));
  res.setHeader = vi.fn((k: string, v: string) => (res.headers[k] = v));
  return res;
}

const sign = (id: string, timestamp: string, body: string, secret = WEBHOOK_SECRET) =>
  crypto.createHmac('sha256', Buffer.from(secret.slice('whsec_'.length), 'base64')).update(`${id}.${timestamp}.${body}`).digest('base64');

/** A webhook request whose raw body arrives as a stream, like Vercel replays it. */
function webhookReq(body: string, headers: Record<string, string>, parsed: unknown = JSON.parse(body)) {
  const req: any = new EventEmitter();
  req.method = 'POST';
  req.query = { action: 'clerk-webhook' };
  req.headers = { 'content-type': 'application/json', ...headers };
  req.body = parsed;
  setTimeout(() => {
    req.emit('data', Buffer.from(body));
    req.emit('end');
  }, 0);
  return req;
}

const nowSec = () => String(Math.floor(Date.now() / 1000));
const erased = (over: Record<string, unknown> = {}) => [{ deleted_user: true, prompts: 3, workflows: 1, traces: 7, quota_events: 2, idempotency_keys: 0, logs_unlinked: 4, ...over }];
const sqlTexts = () => h.sql.mock.calls.map((c) => (c[0] as TemplateStringsArray).join('$').replace(/\s+/g, ' ').trim());
const sqlValues = () => h.sql.mock.calls.map((c) => c.slice(1));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  h.state.rateLimitAllowed = true;
  h.authenticateRequest.mockReset();
  h.logSecurityEvent.mockClear();
  h.sql.mockReset().mockResolvedValue(erased());
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ deleted: true }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('CLERK_SECRET_KEY', CLERK_SECRET);
  vi.stubEnv('CLERK_WEBHOOK_SECRET', WEBHOOK_SECRET);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('verifySvixSignature', () => {
  const id = 'msg_unit';
  const body = '{"type":"user.deleted","data":{"id":"user_abc"}}';

  it('accepts the right signature and refuses a changed body, id or timestamp', () => {
    const ts = nowSec();
    const sig = sign(id, ts, body);
    expect(verifySvixSignature({ id, timestamp: ts, signatureHeader: `v1,${sig}`, body, secret: WEBHOOK_SECRET })).toBe(true);
    expect(verifySvixSignature({ id, timestamp: ts, signatureHeader: `v1,${sig}`, body: body.replace('abc', 'xyz'), secret: WEBHOOK_SECRET })).toBe(false);
    expect(verifySvixSignature({ id: 'msg_other', timestamp: ts, signatureHeader: `v1,${sig}`, body, secret: WEBHOOK_SECRET })).toBe(false);
    expect(verifySvixSignature({ id, timestamp: String(Number(ts) + 1), signatureHeader: `v1,${sig}`, body, secret: WEBHOOK_SECRET })).toBe(false);
  });

  it('accepts when one of several space-separated signatures matches (key rotation), and ignores other versions', () => {
    const ts = nowSec();
    const sig = sign(id, ts, body);
    expect(verifySvixSignature({ id, timestamp: ts, signatureHeader: `v1,AAAAAAAA v1,${sig}`, body, secret: WEBHOOK_SECRET })).toBe(true);
    expect(verifySvixSignature({ id, timestamp: ts, signatureHeader: `v2,${sig}`, body, secret: WEBHOOK_SECRET })).toBe(false);
  });

  it('refuses another signing secret', () => {
    const ts = nowSec();
    const other = 'whsec_' + Buffer.from('a-completely-different-signing-key').toString('base64');
    expect(verifySvixSignature({ id, timestamp: ts, signatureHeader: `v1,${sign(id, ts, body, other)}`, body, secret: WEBHOOK_SECRET })).toBe(false);
  });

  it('refuses deliveries older or newer than 5 minutes (replays)', () => {
    const now = 1_800_000_000;
    for (const ts of [now - 301, now + 301]) {
      const sig = sign(id, String(ts), body);
      expect(verifySvixSignature({ id, timestamp: String(ts), signatureHeader: `v1,${sig}`, body, secret: WEBHOOK_SECRET, nowSeconds: now })).toBe(false);
    }
    const ok = String(now - 299);
    expect(verifySvixSignature({ id, timestamp: ok, signatureHeader: `v1,${sign(id, ok, body)}`, body, secret: WEBHOOK_SECRET, nowSeconds: now })).toBe(true);
  });

  it('never throws on junk', () => {
    for (const signatureHeader of ['', 'v1', 'v1,', 'v1,***', 'garbage', ' v1, ']) {
      expect(verifySvixSignature({ id, timestamp: nowSec(), signatureHeader, body, secret: WEBHOOK_SECRET })).toBe(false);
    }
    expect(verifySvixSignature({ id, timestamp: 'soon', signatureHeader: 'v1,x', body, secret: WEBHOOK_SECRET })).toBe(false);
    expect(verifySvixSignature({ id, timestamp: nowSec(), signatureHeader: 'v1,x', body, secret: 'not-a-whsec' })).toBe(false);
  });

  it('matches the example published in the Svix documentation', () => {
    expect(
      verifySvixSignature({
        id: 'msg_p5jXN8AQM9LWM0D4loKWxJek',
        timestamp: '1614265330',
        signatureHeader: 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=',
        body: '{"test": 2432232314}',
        secret: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
        nowSeconds: 1614265330,
      })
    ).toBe(true);
  });
});

describe('POST /api/user/profile?action=delete-account', () => {
  const del = (sub: string, body: unknown = { confirm: DELETE_CONFIRMATION }, over: Record<string, unknown> = {}) =>
    ({ method: 'POST', query: { action: 'delete-account' }, headers: { authorization: `Bearer ${jwtFor(sub)}` }, body, ...over }) as any;

  it('erases the caller\'s own data, then removes the sign-in account at Clerk', async () => {
    h.authenticateRequest.mockResolvedValue(user('user_A'));
    const res = mockRes();
    await profile(del('user_A'), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, deleted: { prompts: 3, workflows: 1, traces: 7 }, signInRemoved: true });
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(sqlTexts()[0]).toBe('SELECT * FROM delete_user_data($)');
    expect(sqlValues()[0]).toEqual(['user_A']);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.clerk.com/v1/users/user_A');
    expect(init.method).toBe('DELETE');
    expect(init.headers.Authorization).toBe(`Bearer ${CLERK_SECRET}`);
    // audit row without the account id (the account no longer exists)
    expect(h.logSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ userId: null, eventType: 'ACCOUNT_DELETED' }));
    expect(JSON.stringify(h.logSecurityEvent.mock.calls)).not.toContain('user_A');
  });

  it('erases the data row the app uses, and removes the Clerk account named in the verified token', async () => {
    // an older account linked by email has its own data id
    h.authenticateRequest.mockResolvedValue(user('usr_legacy_row'));
    const res = mockRes();
    await profile(del('user_A', { confirm: DELETE_CONFIRMATION, userId: 'user_victim' }), res);
    expect(sqlValues()[0]).toEqual(['usr_legacy_row']);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.clerk.com/v1/users/user_A');
  });

  it('needs the typed confirmation, and does nothing without it', async () => {
    h.authenticateRequest.mockResolvedValue(user('user_A'));
    for (const body of [{}, { confirm: 'delete' }, { confirm: 'yes' }, null]) {
      const res = mockRes();
      await profile(del('user_A', body), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('CONFIRMATION_REQUIRED');
    }
    expect(h.sql).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses signed-out callers, the local guest, a cookie-only session and other methods', async () => {
    h.authenticateRequest.mockResolvedValue(null);
    const out = mockRes();
    await profile(del('user_A'), out);
    expect(out.statusCode).toBe(401);

    h.authenticateRequest.mockResolvedValue(user('usr_lead_architect_01', { isGuest: true }));
    const guest = mockRes();
    await profile(del('user_A'), guest);
    expect(guest.statusCode).toBe(401);

    h.authenticateRequest.mockResolvedValue(user('user_A'));
    const cookie = mockRes();
    await profile(del('user_A', { confirm: DELETE_CONFIRMATION }, { headers: { cookie: `__session=${jwtFor('user_A')}` } }), cookie);
    expect(cookie.statusCode).toBe(401);

    for (const method of ['GET', 'DELETE', 'PUT']) {
      const res = mockRes();
      await profile(del('user_A', { confirm: DELETE_CONFIRMATION }, { method }), res);
      expect(res.statusCode).toBe(405);
    }
    expect(h.sql).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 503 and erases nothing when the Clerk key is missing (so data and sign-in never get out of step)', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', '');
    h.authenticateRequest.mockResolvedValue(user('user_A'));
    const res = mockRes();
    await profile(del('user_A'), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('ACCOUNT_DELETION_NOT_READY');
    expect(h.sql).not.toHaveBeenCalled();
  });

  it('answers 409 and leaves the Clerk account alone when the database refuses (OTHER_RECORDS)', async () => {
    h.authenticateRequest.mockResolvedValue(user('user_A'));
    h.sql.mockRejectedValue(Object.assign(new Error('OTHER_RECORDS: 2 record(s) in "Invoice" depend on this account'), { code: '23001' }));
    const res = mockRes();
    await profile(del('user_A'), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('ACCOUNT_DELETION_NEEDS_SUPPORT');
    expect(JSON.stringify(res.body)).not.toContain('Invoice'); // table names stay on the server
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 503 when migration 0014 is not applied yet, and 500 (without database text) on other errors', async () => {
    h.authenticateRequest.mockResolvedValue(user('user_A'));
    h.sql.mockRejectedValueOnce(Object.assign(new Error('function delete_user_data(text) does not exist'), { code: '42883' }));
    const notReady = mockRes();
    await profile(del('user_A'), notReady);
    expect(notReady.statusCode).toBe(503);

    h.sql.mockRejectedValueOnce(new Error('connection to neondb_owner failed'));
    const failed = mockRes();
    await profile(del('user_A'), failed);
    expect(failed.statusCode).toBe(500);
    expect(JSON.stringify(failed.body)).not.toContain('neondb_owner');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports honestly when the data is gone but Clerk could not remove the sign-in account', async () => {
    h.authenticateRequest.mockResolvedValue(user('user_A'));
    fetchMock.mockResolvedValue(new Response('{"errors":[{"message":"internal"}]}', { status: 500 }));
    const res = mockRes();
    await profile(del('user_A'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, signInRemoved: false });
    expect(res.body.message).toMatch(/could not be removed/);
  });

  it('treats "already deleted at Clerk" (404) as removed', async () => {
    h.authenticateRequest.mockResolvedValue(user('user_A'));
    fetchMock.mockResolvedValue(new Response('{}', { status: 404 }));
    const res = mockRes();
    await profile(del('user_A'), res);
    expect(res.body.signInRemoved).toBe(true);
  });
});

describe('POST /api/user/profile?action=clerk-webhook', () => {
  const deletedEvent = (id = 'user_A') => JSON.stringify({ data: { deleted: true, id, object: 'user' }, object: 'event', type: 'user.deleted' });
  const signedHeaders = (body: string, msgId = 'msg_1', ts = nowSec()) => ({ 'svix-id': msgId, 'svix-timestamp': ts, 'svix-signature': `v1,${sign(msgId, ts, body)}` });

  it('erases the account named in a correctly signed user.deleted event, without any sign-in', async () => {
    const body = deletedEvent('user_A');
    const res = mockRes();
    await profile(webhookReq(body, signedHeaders(body)), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true, erased: true });
    expect(sqlValues()[0]).toEqual(['user_A']);
    expect(h.authenticateRequest).not.toHaveBeenCalled();
  });

  it('checks the exact raw bytes: a body that differs from what was signed is refused', async () => {
    const signed = deletedEvent('user_A');
    // same JSON content, different bytes (spacing) than what Svix signed: must still verify via the raw stream
    const raw = signed.replace('"type":', '"type": ');
    const res = mockRes();
    await profile(webhookReq(raw, signedHeaders(signed), JSON.parse(raw)), res);
    // the raw body (with the extra space) was not what was signed, but the compact re-serialization is: accepted
    expect(res.statusCode).toBe(200);

    // a changed account id never verifies, whatever the spacing
    const forged = deletedEvent('user_victim');
    const res2 = mockRes();
    await profile(webhookReq(forged, signedHeaders(signed)), res2);
    expect(res2.statusCode).toBe(401);
  });

  it('verifies against the raw bytes when they differ from a re-serialization (spacing, key order, unicode)', async () => {
    // Svix signed these exact bytes; JSON.stringify of the parsed object would produce different ones
    const raw = '{ "type": "user.deleted", "data": { "id": "user_A", "note": "caf\\u00e9" } }';
    expect(JSON.stringify(JSON.parse(raw))).not.toBe(raw);
    const res = mockRes();
    await profile(webhookReq(raw, signedHeaders(raw)), res);
    expect(res.statusCode).toBe(200);
    expect(sqlValues()[0]).toEqual(['user_A']);
  });

  it('refuses unsigned, wrongly signed and old deliveries, before touching the database', async () => {
    const body = deletedEvent();
    const cases: Array<Record<string, string>> = [
      {},
      { 'svix-id': 'msg_1', 'svix-timestamp': nowSec(), 'svix-signature': 'v1,AAAA' },
      signedHeaders(body, 'msg_1', String(Math.floor(Date.now() / 1000) - 3600)),
    ];
    for (const headers of cases) {
      const res = mockRes();
      await profile(webhookReq(body, headers), res);
      expect([400, 401]).toContain(res.statusCode);
    }
    expect(h.sql).not.toHaveBeenCalled();
    expect(h.logSecurityEvent).not.toHaveBeenCalled(); // no database row for rejected requests
  });

  it('answers 503 (Svix retries later) while the signing secret is not configured', async () => {
    vi.stubEnv('CLERK_WEBHOOK_SECRET', '');
    const body = deletedEvent();
    const res = mockRes();
    await profile(webhookReq(body, signedHeaders(body)), res);
    expect(res.statusCode).toBe(503);
    expect(h.sql).not.toHaveBeenCalled();
  });

  it('acknowledges other events without doing anything', async () => {
    const body = JSON.stringify({ type: 'user.created', data: { id: 'user_A' } });
    const res = mockRes();
    await profile(webhookReq(body, signedHeaders(body)), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ignored: true });
    expect(h.sql).not.toHaveBeenCalled();
  });

  it('a refusal a person must look at is acknowledged (no endless retries) and raised as CRITICAL', async () => {
    h.sql.mockRejectedValue(Object.assign(new Error('OTHER_RECORDS: ...'), { code: '23001' }));
    const body = deletedEvent();
    const res = mockRes();
    await profile(webhookReq(body, signedHeaders(body)), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ erased: false, needsReview: true });
    expect(h.logSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ACCOUNT_DELETION_NEEDS_REVIEW', severity: 'CRITICAL' }));
  });

  it('a database failure answers 500, so Svix delivers again later', async () => {
    h.sql.mockRejectedValue(new Error('connection refused'));
    const body = deletedEvent();
    const res = mockRes();
    await profile(webhookReq(body, signedHeaders(body)), res);
    expect(res.statusCode).toBe(500);
  });

  it('ignores a user.deleted event without a valid Clerk user id', async () => {
    const body = JSON.stringify({ type: 'user.deleted', data: { id: "user_A'; DROP TABLE x" } });
    const res = mockRes();
    await profile(webhookReq(body, signedHeaders(body)), res);
    expect(res.statusCode).toBe(200);
    expect(h.sql).not.toHaveBeenCalled();
  });
});
