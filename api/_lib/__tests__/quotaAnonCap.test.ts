import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The shared daily ceiling for callers who are not signed in (security.ts). Redis and the database are faked.
const h = vi.hoisted(() => ({
  counters: new Map<string, number>(),
  redis: null as any,
  sqlCalls: 0,
}));

vi.mock('../rateLimiter.js', () => ({ getRedisClient: () => h.redis }));
vi.mock('../db.js', () => ({
  getDb: () => {
    const sql: any = async () => {
      h.sqlCalls += 1;
      return [{ granted: true }];
    };
    sql.transaction = async () => [[], [{ id: 'x' }]];
    return sql;
  },
  logSecurityEvent: vi.fn(),
}));

import { reserveQuota, sendQuotaDenied } from '../security.js';

const user = { id: 'user_S', email: 's@example.com', name: 'S', role: 'r', plan: 'Free Plan', subscriptionTier: 'free', isGuest: false } as any;
const anon = (bucket: 'generation' | 'assist' = 'generation') => reserveQuota({ bucket, endpoint: '/x', user: null, ip: '203.0.113.1' });

beforeEach(() => {
  h.counters.clear();
  h.sqlCalls = 0;
  h.redis = {
    incr: vi.fn(async (k: string) => {
      const n = (h.counters.get(k) || 0) + 1;
      h.counters.set(k, n);
      return n;
    }),
    expire: vi.fn(async () => 1),
  };
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('daily ceiling for callers who are not signed in', () => {
  it('stops anonymous use once the shared ceiling is reached, without touching the database', async () => {
    vi.stubEnv('ANON_AI_DAILY_CAP_GENERATION', '3');
    const results = [await anon(), await anon(), await anon(), await anon()];
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3]).toMatchObject({ reason: 'anonymous_daily_cap', unavailable: false, reservationId: null });
    expect(h.sqlCalls).toBe(3);
    expect(h.redis.expire).toHaveBeenCalledTimes(1); // the day's key expires on its own
  });

  it('never applies to signed-in users', async () => {
    vi.stubEnv('ANON_AI_DAILY_CAP_GENERATION', '0');
    expect((await reserveQuota({ bucket: 'generation', endpoint: '/x', user, ip: '203.0.113.1' })).allowed).toBe(true);
    expect(h.redis.incr).not.toHaveBeenCalled();
  });

  it('counts each bucket separately and uses safe defaults', async () => {
    vi.stubEnv('ANON_AI_DAILY_CAP_GENERATION', '1');
    vi.stubEnv('ANON_AI_DAILY_CAP_ASSIST', 'not-a-number'); // ignored: default (3000) applies
    expect((await anon('generation')).allowed).toBe(true);
    expect((await anon('generation')).allowed).toBe(false);
    expect((await anon('assist')).allowed).toBe(true);
    expect([...h.counters.keys()].every((k) => /^quota:anon-daily:(generation|assist):\d{4}-\d{2}-\d{2}$/.test(k))).toBe(true);
  });

  it('does not block anyone when Redis is missing or failing (per-IP limits still apply)', async () => {
    vi.stubEnv('ANON_AI_DAILY_CAP_GENERATION', '0');
    h.redis = null;
    expect((await anon()).allowed).toBe(true);
    h.redis = { incr: vi.fn(async () => { throw new Error('redis down'); }), expire: vi.fn() };
    expect((await anon()).allowed).toBe(true);
  });

  it('tells the caller to sign in', async () => {
    vi.stubEnv('ANON_AI_DAILY_CAP_GENERATION', '0');
    const q = await anon();
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res), setHeader: vi.fn() };
    sendQuotaDenied(res, q);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json.mock.calls[0][0]).toMatchObject({ code: 'ANONYMOUS_DAILY_LIMIT' });
  });
});
