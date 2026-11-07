// CSRF guard on the cookie sign-in path (api/_lib/auth.ts): the Clerk "__session" cookie only counts for a
// state-changing request that comes from Bedrock's own pages. Local JWKS mock on 127.0.0.1: no network, no database.
import http from 'node:http';
import crypto from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
let server: http.Server;
let issuer = '';

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(claims: Record<string, unknown>) {
  const h = b64({ alg: 'RS256', kid: 'k1', typ: 'JWT' });
  const p = b64(claims);
  return `${h}.${p}.${crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url')}`;
}
const now = () => Math.floor(Date.now() / 1000);
const HOST = 'bedrockxai.com';
const token = () => sign({ sub: 'user_cookie', iss: issuer, exp: now() + 300 });
const cookieReq = (method: string, extra: Record<string, string> = {}, cookie = `theme=dark; __session=${token()}`) =>
  ({ method, headers: { cookie, host: HOST, ...extra } }) as any;

async function loadAuth() {
  vi.resetModules();
  process.env.CLERK_ISSUER = issuer;
  delete process.env.CLERK_AUTHORIZED_PARTIES;
  return import('../../api/_lib/auth.ts');
}

beforeAll(async () => {
  server = http.createServer((_q, r) => {
    r.writeHead(200, { 'Content-Type': 'application/json' });
    r.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
  issuer = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(() => server.close());
beforeEach(() => {
  for (const k of ['DATABASE_URL', 'NEON_DATABASE_URL', 'DATABASE_URL_UNPOOLED', 'CLERK_JWT_KEY', 'CLERK_PEM_PUBLIC_KEY', 'VITE_CLERK_PUBLISHABLE_KEY', 'CLERK_PUBLISHABLE_KEY', 'VERCEL_ENV']) {
    delete process.env[k];
  }
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('session cookie: CSRF guard', () => {
  it('accepts the cookie on reads, and on writes from Bedrock itself', async () => {
    const { authenticateRequest } = await loadAuth();
    expect((await authenticateRequest(cookieReq('GET')))?.id).toBe('user_cookie');
    expect((await authenticateRequest(cookieReq('POST', { origin: 'https://bedrockxai.com' })))?.id).toBe('user_cookie');
    expect((await authenticateRequest(cookieReq('PUT', { referer: 'https://bedrockxai.com/app/profile' })))?.id).toBe('user_cookie');
  });

  it('ignores the cookie on writes triggered by another site, or with no origin at all', async () => {
    const { authenticateRequest } = await loadAuth();
    for (const extra of [{ origin: 'https://evil.example' }, { origin: 'null' }, { referer: 'https://evil.example/x' }, {}]) {
      for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
        expect(await authenticateRequest(cookieReq(method, extra))).toBeNull();
      }
    }
  });

  it('a Bearer token is unaffected (the app and the desktop app send one)', async () => {
    const { authenticateRequest } = await loadAuth();
    const req = { method: 'POST', headers: { authorization: `Bearer ${token()}`, origin: 'https://evil.example', host: HOST } } as any;
    expect((await authenticateRequest(req))?.id).toBe('user_cookie');
  });

  it('only the real "__session" cookie counts, not one whose name merely ends with it', async () => {
    const { authenticateRequest } = await loadAuth();
    expect(await authenticateRequest(cookieReq('GET', {}, `x__session=${token()}`))).toBeNull();
  });
});
