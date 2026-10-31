import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Daily log cleanup job with a mocked database: no real queries run.
const h = vi.hoisted(() => {
  const state = {
    calls: [] as string[],
    responder: (_text: string): unknown => [],
  };
  const sql = (strings: TemplateStringsArray, ..._values: unknown[]) => {
    const text = strings.join('$').replace(/\s+/g, ' ').trim();
    state.calls.push(text);
    try {
      return Promise.resolve(state.responder(text));
    } catch (err) {
      return Promise.reject(err);
    }
  };
  return { state, sql };
});

vi.mock('../db.js', () => ({ getDb: () => h.sql }));

import tracesHandler from '../../traces/index.js';

const SECRET = 'test-cron-secret-value';

function mockReq(method: string, authorization?: string) {
  return { method, headers: authorization ? { authorization } : {}, query: { action: 'purge-logs' }, body: {} } as any;
}

function mockRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((c: number) => {
    res.statusCode = c;
    return res;
  });
  res.json = vi.fn((b: unknown) => {
    res.body = b;
    return res;
  });
  return res;
}

const batch = (q: number, s: number, t: number, i: number) => [{ quota_events: q, security_logs: s, traces: t, idempotency_keys: i }];

beforeEach(() => {
  h.state.calls = [];
  h.state.responder = () => batch(0, 0, 0, 0);
  vi.stubEnv('CRON_SECRET', SECRET);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('GET /api/cron/purge-logs (via /api/traces?action=purge-logs)', () => {
  it('refuses callers without the cron secret, and everyone when CRON_SECRET is not set', async () => {
    for (const auth of [undefined, 'Bearer wrong', `Bearer ${SECRET}x`, SECRET]) {
      const res = mockRes();
      await tracesHandler(mockReq('GET', auth), res);
      expect(res.statusCode).toBe(401);
    }

    vi.stubEnv('CRON_SECRET', '');
    const unset = mockRes();
    await tracesHandler(mockReq('GET', 'Bearer '), unset);
    expect(unset.statusCode).toBe(401);
    expect(h.state.calls).toHaveLength(0);
  });

  it('only answers GET (the method Vercel Cron uses)', async () => {
    const res = mockRes();
    await tracesHandler(mockReq('POST', `Bearer ${SECRET}`), res);
    expect(res.statusCode).toBe(405);
    expect(h.state.calls).toHaveLength(0);
  });

  it('calls purge_old_logs() until nothing is left and reports the totals', async () => {
    const rounds = [batch(5000, 120, 3, 0), batch(10, 0, 0, 0), batch(0, 0, 0, 0)];
    h.state.responder = () => rounds.shift();
    const res = mockRes();
    await tracesHandler(mockReq('GET', `Bearer ${SECRET}`), res);

    expect(res.statusCode).toBe(200);
    expect(h.state.calls).toEqual(Array(3).fill('SELECT * FROM purge_old_logs()'));
    expect(res.body).toEqual({
      success: true,
      rounds: 3,
      finished: true,
      deleted: { quota_events: 5010, security_logs: 120, traces: 3, idempotency_keys: 0 },
    });
  });

  it('keeps going well past 20 rounds on a big backlog, up to the 500-round safety stop', async () => {
    h.state.responder = () => batch(5000, 0, 0, 0);
    const res = mockRes();
    await tracesHandler(mockReq('GET', `Bearer ${SECRET}`), res);
    expect(h.state.calls).toHaveLength(500);
    expect(res.body).toMatchObject({ rounds: 500, finished: false, deleted: { quota_events: 2_500_000 } });
  });

  it('stops when the 45 s time budget is used up, inside the 60 s function limit', async () => {
    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    h.state.responder = () => {
      now += 10_000; // each round takes 10 s
      return batch(5000, 0, 0, 0);
    };
    const res = mockRes();
    await tracesHandler(mockReq('GET', `Bearer ${SECRET}`), res);
    expect(h.state.calls).toHaveLength(5); // started at 0, 10, 20, 30, 40 s; not at 50 s
    expect(res.body).toMatchObject({ rounds: 5, finished: false });
  });

  it('answers 503 (not 500) when migration 0004 is not applied yet, without leaking database text', async () => {
    h.state.responder = () => {
      throw Object.assign(new Error('function purge_old_logs() does not exist'), { code: '42883' });
    };
    const res = mockRes();
    await tracesHandler(mockReq('GET', `Bearer ${SECRET}`), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('MIGRATION_NOT_APPLIED');

    h.state.responder = () => {
      throw new Error('password authentication failed for user neondb_owner');
    };
    const failed = mockRes();
    await tracesHandler(mockReq('GET', `Bearer ${SECRET}`), failed);
    expect(failed.statusCode).toBe(500);
    expect(JSON.stringify(failed.body)).not.toContain('neondb_owner');
  });
});
