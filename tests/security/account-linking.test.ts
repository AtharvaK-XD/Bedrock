// Account linking by email (api/_lib/auth.ts): a token may only be attached to an existing
// account with the same email when the token says the email is verified. Local JWKS on
// 127.0.0.1 and a mocked database only.
import http from 'node:http';
import crypto from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ selects: [] as unknown[][] }));

vi.mock('../../api/_lib/db.js', () => ({
  getDb: () => (strings: TemplateStringsArray, ...values: unknown[]) => {
    if (strings.join('?').includes('SELECT * FROM "User"')) h.selects.push(values);
    return Promise.resolve([]);
  },
  logSecurityEvent: async () => {},
}));

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(claims: Record<string, unknown>) {
  const head = b64({ alg: 'RS256', kid: 'k1', typ: 'JWT' });
  const body = b64(claims);
  return `${head}.${body}.${crypto.sign('RSA-SHA256', Buffer.from(`${head}.${body}`), privateKey).toString('base64url')}`;
}
const req = (token: string) => ({ headers: { authorization: `Bearer ${token}`, host: 'bedrock-steel.vercel.app' } }) as any;

let server: http.Server;
let issuer = '';

beforeAll(async () => {
  server = http.createServer((_q, r) => {
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
  h.selects.length = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const exp = () => Math.floor(Date.now() / 1000) + 300;

describe('account linking by email', () => {
  it('does not link by email when the token does not say the email is verified', async () => {
    const { authenticateRequest } = await import('../../api/_lib/auth.ts');
    const user = await authenticateRequest(req(sign({ sub: 'user_attacker', iss: issuer, exp: exp(), email: 'victim@example.com' })));
    expect(user?.id).toBe('user_attacker');
    expect(h.selects).toHaveLength(1);
    expect(h.selects[0]).not.toContain('victim@example.com');
  });

  it('links by email only for a verified email', async () => {
    const { authenticateRequest } = await import('../../api/_lib/auth.ts');
    await authenticateRequest(req(sign({ sub: 'user_legit', iss: issuer, exp: exp(), email: 'me@example.com', email_verified: true })));
    expect(h.selects[0]).toContain('me@example.com');
  });
});
