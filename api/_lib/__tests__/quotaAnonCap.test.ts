import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The shared daily ceiling for callers who are not signed in (security.ts). Redis and the database are faked.
const h = vi.hoisted(() => ({
  counters: new Map<string, number>(),
  redis: null as any,
  sqlCalls: 0,
  /** what the per-IP quota (database) answers */
  perIpGranted: true,
  deletes: 0,
}));

vi.mock('../rateLimiter.js', () => ({ getRedisClient: () => h.redis }));
vi.mock('../db.js', () => ({
  getDb: () => {
    const sql: any = async (strings: TemplateStringsArray) => {
      h.sqlCalls += 1;
      if (strings.join('').startsWith('DELETE')) {
        h.deletes += 1;
        return [];
      }
      return [{ granted: h.perIpGranted }];
    };
    sql.transaction = async () => [[], [{ id: 'x' }]];
    return sql;
  },
  logSecurityEvent: vi.fn(),
}));

import { reserveQuota, releaseQuota, sendQuotaDenied } from '../security.js';

const user = { id: 'user_S', email: 's@example.com', name: 'S', role: 'r', plan: 'Free Plan', subscriptionTier: 'free', isGuest: false } as any;
const anon = (bucket: 'generation' | 'assist' = 'generation') => reserveQuota({ bucket, endpoint: '/x', user: null, ip: '203.0.113.1' });

beforeEach(() => {
  h.counters.clear();
  h.sqlCalls = 0;
  h.perIpGranted = true;
  h.deletes = 0;
  h.redis = {
    get: vi.fn(async (k: string) => (h.counters.has(k) ? String(h.counters.get(k)) : null)),
    decr: vi.fn(async (k: string) => {
      const n = (h.counters.get(k) || 0) - 1;
      h.counters.set(k, n);
      return n;
    }),
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
    const down = vi.fn(async () => { throw new Error('redis down'); });
    h.redis = { get: down, incr: down, decr: down, expire: vi.fn() };
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

  it('requests the per-IP limit refuses do NOT use up the shared allowance (one address could lock everyone out)', async () => {
    vi.stubEnv('ANON_AI_DAILY_CAP_GENERATION', '3');
    h.perIpGranted = false; // this address is over its own limit
    for (let i = 0; i < 50; i++) expect((await anon()).allowed).toBe(false);
    expect([...h.counters.values()].reduce((a, b) => a + b, 0)).toBe(0);
    // everybody else still gets the full allowance
    h.perIpGranted = true;
    expect([await anon(), await anon(), await anon()].map((r) => r.allowed)).toEqual([true, true, true]);
    expect((await anon()).allowed).toBe(false);
  });

  it('a refunded request (no provider answered) gives its unit back', async () => {
    vi.stubEnv('ANON_AI_DAILY_CAP_GENERATION', '1');
    const first = await anon();
    expect(first.allowed).toBe(true);
    expect((await anon()).allowed).toBe(false);
    await releaseQuota(first);
    expect(h.deletes).toBe(1);
    expect((await anon()).allowed).toBe(true);
  });

  it('parallel requests that pass the check together cannot overshoot: the extra one is refused and refunded', async () => {
    vi.stubEnv('ANON_AI_DAILY_CAP_GENERATION', '1');
    // both read 0 before either counts
    h.redis.get = vi.fn(async () => '0');
    const results = await Promise.all([anon(), anon()]);
    expect(results.map((r) => r.allowed).sort()).toEqual([false, true]);
    expect(results.find((r) => !r.allowed)).toMatchObject({ reason: 'anonymous_daily_cap' });
    expect(h.deletes).toBe(1); // the refused one's per-IP unit was given back
    expect([...h.counters.values()][0]).toBe(1);
  });
});
