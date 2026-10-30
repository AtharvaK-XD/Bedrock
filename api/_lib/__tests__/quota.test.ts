import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Usage quota (security.ts) with a mocked database: no real queries run.
const h = vi.hoisted(() => {
  const state = {
    calls: [] as Array<{ text: string; values: unknown[] }>,
    responder: (_text: string, _values: unknown[]): unknown => [],
  };
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('$').replace(/\s+/g, ' ').trim();
    state.calls.push({ text, values });
    try {
      return Promise.resolve(state.responder(text, values));
    } catch (err) {
      return Promise.reject(err);
    }
  };
  return { state, sql };
});

vi.mock('../db.js', () => ({ getDb: () => h.sql, logSecurityEvent: vi.fn() }));

const freeUser = { id: 'user_A', email: 'a@example.com', name: 'A', role: 'r', plan: 'Free Plan', subscriptionTier: 'free' } as any;

async function loadSecurity() {
  vi.resetModules();
  return import('../security.js');
}

const notApplied = () => Object.assign(new Error('function reserve_quota(...) does not exist'), { code: '42883' });

beforeEach(() => {
  h.state.calls = [];
  h.state.responder = () => [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('reserveQuota with migration 0004 applied', () => {
  it('reserves through reserve_quota() only, with the caller, bucket and limit', async () => {
    const { reserveQuota } = await loadSecurity();
    h.state.responder = () => [{ granted: true }];
    const q = await reserveQuota({ bucket: 'generation', endpoint: '/api/ai/synthesize', user: freeUser, ip: '203.0.113.7' });

    expect(q).toMatchObject({ allowed: true, unavailable: false, store: 'QuotaEvent' });
    expect(q.reservationId).toMatch(/^quota_/);
    expect(h.state.calls).toHaveLength(1);
    expect(h.state.calls[0].text).toContain('reserve_quota(');
    expect(h.state.calls[0].values).toEqual([q.reservationId, 'user_A', '203.0.113.7', 'generation', '/api/ai/synthesize', 10]);
  });

  it('refuses at the limit without falling back to the old counting', async () => {
    const { reserveQuota } = await loadSecurity();
    h.state.responder = () => [{ granted: false }];
    const q = await reserveQuota({ bucket: 'assist', endpoint: '/api/ai/refine', user: null, ip: '203.0.113.7' });

    expect(q).toMatchObject({ allowed: false, unavailable: false, reservationId: null });
    expect(h.state.calls).toHaveLength(1);
    expect(h.state.calls[0].values[1]).toBeNull();
  });

  it('fails closed when the database errors for another reason', async () => {
    const { reserveQuota } = await loadSecurity();
    h.state.responder = () => {
      throw Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
    };
    const q = await reserveQuota({ bucket: 'generation', endpoint: '/x', user: freeUser, ip: '1.2.3.4' });
    expect(q).toMatchObject({ allowed: false, unavailable: true });
  });

  it('refunds from QuotaEvent', async () => {
    const { releaseQuota } = await loadSecurity();
    await releaseQuota({ allowed: true, unavailable: false, bucket: 'generation', limit: 10, resetMs: 1, reservationId: 'quota_1', store: 'QuotaEvent' });
    expect(h.state.calls[0].text).toBe('DELETE FROM "QuotaEvent" WHERE id = $');
    expect(h.state.calls[0].values).toEqual(['quota_1']);
  });
});

describe('reserveQuota before migration 0004 is applied', () => {
  it('falls back to SecurityLog counting and refunds from SecurityLog', async () => {
    const { reserveQuota, releaseQuota } = await loadSecurity();
    h.state.responder = (text) => {
      if (text.includes('reserve_quota(')) throw notApplied();
      return [{ id: 'x' }];
    };
    const q = await reserveQuota({ bucket: 'generation', endpoint: '/x', user: freeUser, ip: '1.2.3.4' });

    expect(q).toMatchObject({ allowed: true, unavailable: false, store: 'SecurityLog' });
    expect(h.state.calls.map((c) => c.text.split(' ')[0])).toEqual(['SELECT', 'INSERT']);
    expect(h.state.calls[1].text).toContain('INSERT INTO "SecurityLog"');

    h.state.calls = [];
    await releaseQuota(q);
    expect(h.state.calls[0].text).toBe('DELETE FROM "SecurityLog" WHERE id = $');
  });

  it('does not retry reserve_quota() on every request, but checks again after 5 minutes', async () => {
    const { reserveQuota } = await loadSecurity();
    vi.useFakeTimers();
    h.state.responder = (text) => {
      if (text.includes('reserve_quota(')) throw notApplied();
      return [{ id: 'x' }];
    };
    const reserve = () => reserveQuota({ bucket: 'assist', endpoint: '/x', user: freeUser, ip: '1.2.3.4' });
    const probes = () => h.state.calls.filter((c) => c.text.includes('reserve_quota(')).length;

    await reserve();
    await reserve();
    expect(probes()).toBe(1);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    h.state.responder = () => [{ granted: true }];
    const q = await reserve();
    expect(probes()).toBe(2);
    expect(q.store).toBe('QuotaEvent');
  });
});
