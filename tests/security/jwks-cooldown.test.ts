// Clerk's key list must not be downloaded again for every token with an unknown key id (api/_lib/auth.ts).
// A local key server on 127.0.0.1 counts the requests; the database is mocked. No real network.
import http from 'node:http';
import crypto from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/db.js', () => ({
  getDb: () => () => Promise.resolve([]),
  logSecurityEvent: async () => {},
}));

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

let server: http.Server;
let issuer = '';
let hits = 0;
let respondWith = 200;

function token(kid: string, sub = 'user_cooldown') {
  const head = b64({ alg: 'RS256', kid, typ: 'JWT' });
  const body = b64({ sub, iss: issuer, exp: Math.floor(Date.now() / 1000) + 300 });
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${body}`), privateKey).toString('base64url');
  return `${head}.${body}.${sig}`;
}
const req = (t: string) => ({ headers: { authorization: `Bearer ${t}`, host: 'bedrock-steel.vercel.app' } }) as any;

/** A fresh copy of auth.ts, so its key cache and cooldown start empty in every test. */
async function freshAuth() {
  vi.resetModules();
  return (await import('../../api/_lib/auth.ts')).authenticateRequest;
}

beforeAll(async () => {
  server = http.createServer((_q, r) => {
    hits += 1;
    if (respondWith !== 200) {
      r.writeHead(respondWith);
      return r.end('{}');
    }
    r.writeHead(200, { 'Content-Type': 'application/json' });
    r.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
  issuer = `http://127.0.0.1:${(server.address() as any).port}`;
  process.env.CLERK_ISSUER = issuer;
  delete process.env.CLERK_AUTHORIZED_PARTIES;
});
afterAll(() => {
  server.close();
  delete process.env.CLERK_ISSUER;
});

beforeEach(() => {
  hits = 0;
  respondWith = 200;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

describe('Clerk key list downloads', () => {
  it('is downloaded once for a flood of tokens with unknown key ids', async () => {
    const authenticate = await freshAuth();
    for (let i = 0; i < 25; i++) {
      expect(await authenticate(req(token(`ghost-${i}`)))).toBeNull(); // refused: not a signed-in user
    }
    expect(hits).toBe(1);
  });

  it('still accepts real tokens during and after such a flood', async () => {
    const authenticate = await freshAuth();
    for (let i = 0; i < 5; i++) await authenticate(req(token(`ghost-${i}`)));
    const user = await authenticate(req(token('k1', 'user_real')));
    expect(user?.id).toBe('user_real');
    expect(user?.isGuest).toBe(false);
    expect(hits).toBe(1);
  });

  it('is downloaded once when many first requests arrive at the same moment', async () => {
    const authenticate = await freshAuth();
    const users = await Promise.all(Array.from({ length: 12 }, (_, i) => authenticate(req(token('k1', `user_p${i}`)))));
    expect(users.every((u) => u?.isGuest === false)).toBe(true);
    expect(hits).toBe(1);
  });

  it('is asked again after a minute (key rotation still works)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const authenticate = await freshAuth();
    await authenticate(req(token('ghost-a')));
    expect(hits).toBe(1);
    vi.setSystemTime(Date.now() + 61_000);
    await authenticate(req(token('ghost-b')));
    expect(hits).toBe(2);
  });

  it('is retried after 10 s when Clerk was unreachable, not on every request', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    respondWith = 500;
    const authenticate = await freshAuth();
    for (let i = 0; i < 5; i++) await authenticate(req(token('k1')));
    expect(hits).toBe(1);

    respondWith = 200;
    vi.setSystemTime(Date.now() + 11_000);
    expect((await authenticate(req(token('k1', 'user_back'))))?.id).toBe('user_back');
    expect(hits).toBe(2);
  });
});
