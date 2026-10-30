// Security tests for Clerk JWT verification (api/_lib/auth.ts).
// Uses a local JWKS mock on 127.0.0.1 only: no network, no database.
import http from 'node:http';
import crypto from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const attacker = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };

let server: http.Server;
let issuer = '';

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(claims: Record<string, unknown>, key: crypto.KeyObject = privateKey) {
  const h = b64({ alg: 'RS256', kid: 'k1', typ: 'JWT' });
  const p = b64(claims);
  return `${h}.${p}.${crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), key).toString('base64url')}`;
}
const req = (token: string) => ({ headers: { authorization: `Bearer ${token}`, host: 'bedrock-steel.vercel.app' } }) as any;
const now = () => Math.floor(Date.now() / 1000);

async function loadAuth(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
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
  for (const k of ['DATABASE_URL', 'NEON_DATABASE_URL', 'DATABASE_URL_UNPOOLED', 'CLERK_JWT_KEY', 'CLERK_PEM_PUBLIC_KEY', 'CLERK_PUBLISHABLE_KEY', 'VITE_CLERK_PUBLISHABLE_KEY', 'CLERK_JWT_ISSUER']) {
    delete process.env[k];
  }
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('issuer, expiry and signature', () => {
  it('rejects a validly signed token from an issuer that is not allow-listed', async () => {
    const { authenticateRequest } = await loadAuth({ CLERK_ISSUER: 'https://example-clerk.invalid', CLERK_AUTHORIZED_PARTIES: undefined });
    expect(await authenticateRequest(req(sign({ sub: 'user_victim', iss: issuer, exp: now() + 300 })))).toBeNull();
  });

  it('accepts a correctly signed token from the trusted issuer', async () => {
    const { authenticateRequest } = await loadAuth({ CLERK_ISSUER: issuer, CLERK_AUTHORIZED_PARTIES: undefined });
    const user = await authenticateRequest(req(sign({ sub: 'user_ok', iss: issuer, exp: now() + 300 })));
    expect(user?.id).toBe('user_ok');
  });

  it('rejects tokens without exp, expired tokens, wrong-key and tampered tokens', async () => {
    const { authenticateRequest } = await loadAuth({ CLERK_ISSUER: issuer, CLERK_AUTHORIZED_PARTIES: undefined });
    expect(await authenticateRequest(req(sign({ sub: 'u', iss: issuer })))).toBeNull();
    expect(await authenticateRequest(req(sign({ sub: 'u', iss: issuer, exp: now() - 3600 })))).toBeNull();
    expect(await authenticateRequest(req(sign({ sub: 'u', iss: issuer, exp: now() + 300 }, attacker.privateKey)))).toBeNull();
    const parts = sign({ sub: 'user_ok', iss: issuer, exp: now() + 300 }).split('.');
    parts[1] = b64({ sub: 'user_admin', iss: issuer, exp: now() + 300 });
    expect(await authenticateRequest(req(parts.join('.')))).toBeNull();
  });

  it('rejects non-RS256 algorithms (alg pinning)', async () => {
    const { authenticateRequest } = await loadAuth({ CLERK_ISSUER: issuer, CLERK_AUTHORIZED_PARTIES: undefined });
    const h = b64({ alg: 'none', kid: 'k1' });
    const p = b64({ sub: 'user_x', iss: issuer, exp: now() + 300 });
    expect(await authenticateRequest(req(`${h}.${p}.`))).toBeNull();
  });
});

describe('authorized party (azp)', () => {
  it('is not enforced when CLERK_AUTHORIZED_PARTIES is unset', async () => {
    const { authenticateRequest } = await loadAuth({ CLERK_ISSUER: issuer, CLERK_AUTHORIZED_PARTIES: undefined });
    const user = await authenticateRequest(req(sign({ sub: 'user_a', iss: issuer, exp: now() + 300, azp: 'https://anything.example' })));
    expect(user?.id).toBe('user_a');
  });

  it('enforces the allow-list when set, always allowing loopback and tokens without azp', async () => {
    const { authenticateRequest } = await loadAuth({ CLERK_ISSUER: issuer, CLERK_AUTHORIZED_PARTIES: 'https://bedrock-steel.vercel.app, https://app.example' });
    const tok = (azp?: string) => sign({ sub: 'user_b', iss: issuer, exp: now() + 300, ...(azp === undefined ? {} : { azp }) });
    expect((await authenticateRequest(req(tok('https://bedrock-steel.vercel.app'))))?.id).toBe('user_b');
    expect((await authenticateRequest(req(tok('https://app.example/'))))?.id).toBe('user_b');
    expect((await authenticateRequest(req(tok('http://127.0.0.1:53211'))))?.id).toBe('user_b');
    expect((await authenticateRequest(req(tok('http://localhost:5173'))))?.id).toBe('user_b');
    expect((await authenticateRequest(req(tok(undefined))))?.id).toBe('user_b');
    expect(await authenticateRequest(req(tok('https://evil.example')))).toBeNull();
    expect(await authenticateRequest(req(tok('https://bedrock-steel.vercel.app.evil.example')))).toBeNull();
  });
});
