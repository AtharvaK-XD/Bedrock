// Security tests for the auth email endpoint (api/auth/send-email.ts): signed-in users only,
// own origins only, never a wildcard CORS header. Database and auth are mocked; no email is sent.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ user: null as null | Record<string, any> }));

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

let ipCounter = 0;
function makeReq(method: string, body: any = {}, headers: Record<string, string> = {}) {
  ipCounter += 1;
  return {
    method,
    body,
    query: {},
    headers: { host: 'bedrock-steel.vercel.app', 'x-forwarded-for': `198.51.100.${ipCounter % 250}`, ...headers },
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
  });
});
