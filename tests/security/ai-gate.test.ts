// Every AI route counts the visitor BEFORE it checks the token and looks the user up, so a flood of junk
// tokens is stopped by one cheap counter and never reaches token verification or the database.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ calls: [] as string[], gateOpen: true }));

vi.mock('../../api/_lib/auth.js', () => ({
  authenticateRequest: vi.fn(async () => {
    h.calls.push('authenticate');
    return { id: 'usr_test_1', isPaid: false };
  }),
}));
vi.mock('../../api/_lib/rateLimiter.js', () => ({
  getClientIp: () => '203.0.113.7',
  getRedisClient: () => null,
  enforceRateLimit: vi.fn(async (_req: unknown, res: any, preset: string) => {
    h.calls.push(`limit:${preset}`);
    if (preset === 'aiGate' && !h.gateOpen) {
      res.status(429).json({ error: 'Too Many Requests' });
      return false;
    }
    return true;
  }),
}));

import synthesize from '../../api/ai/synthesize.ts';
import refine from '../../api/ai/refine.ts';
import testEndpoint from '../../api/ai/test.ts';
import generateQuestions from '../../api/ai/generate-questions.ts';

const ROUTES = { synthesize, refine, test: testEndpoint, 'generate-questions': generateQuestions } as const;

function makeRes() {
  const res: any = { statusCode: 200, body: undefined as any, headersSent: false };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  res.setHeader = () => res;
  return res;
}
const makeReq = () => ({ method: 'POST', body: {}, query: {}, headers: { authorization: 'Bearer junk.junk.junk' } }) as any;

beforeEach(() => {
  h.calls.length = 0;
  h.gateOpen = true;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe.each(Object.entries(ROUTES))('/api/ai/%s', (_name, handler) => {
  it('stops an over-limit visitor before the token is checked', async () => {
    h.gateOpen = false;
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res.statusCode).toBe(429);
    expect(h.calls).toEqual(['limit:aiGate']);
  });

  it('counts the visitor first, then checks the token, then applies the per-user limit', async () => {
    await handler(makeReq(), makeRes());
    expect(h.calls.slice(0, 3)).toEqual(['limit:aiGate', 'authenticate', expect.stringMatching(/^limit:(?!aiGate)/)]);
  });
});
