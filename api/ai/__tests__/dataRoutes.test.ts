import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Data routes (prompts, workflows, traces, profile, health) with a mocked database: no real queries run.
const h = vi.hoisted(() => {
  const state = {
    calls: [] as Array<{ text: string; values: unknown[] }>,
    responder: (_text: string, _values: unknown[]): unknown => [],
    user: { id: 'user_A', email: 'a@example.com', name: 'Alice', role: 'Architect', plan: 'Free Plan' } as any,
    redis: null as any,
    rateLimitAllowed: true,
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
  return { state, sql, authenticateRequest: vi.fn(async () => state.user) };
});

vi.mock('../../_lib/auth.js', () => ({ authenticateRequest: h.authenticateRequest }));
vi.mock('../../_lib/rateLimiter.js', () => ({
  enforceRateLimit: vi.fn(async () => h.state.rateLimitAllowed),
  getRedisClient: () => h.state.redis,
  getClientIp: () => '203.0.113.7',
}));
vi.mock('../../_lib/db.js', () => ({ getDb: () => h.sql }));

import prompts from '../../prompts/index.js';
import workflows from '../../workflows/index.js';
import traces from '../../traces/index.js';
import profile from '../../user/profile.js';

function mockReq(method: string, body: Record<string, unknown> = {}, query: Record<string, string> = {}) {
  return { method, body, query, headers: {} } as any;
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
  res.setHeader = vi.fn();
  return res;
}

const sqlTexts = () => h.state.calls.map((c) => c.text);

beforeEach(() => {
  h.state.calls = [];
  h.state.responder = () => [];
  h.state.user = { id: 'user_A', email: 'a@example.com', name: 'Alice', role: 'Architect', plan: 'Free Plan' };
  h.state.redis = null;
  h.state.rateLimitAllowed = true;
  h.authenticateRequest.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('POST /api/prompts', () => {
  it("never overwrites another user's prompt: the update is scoped to the caller and a foreign id gives 409", async () => {
    h.state.responder = (text) => (text.startsWith('SELECT COUNT') ? [{ count: 3 }] : []);
    const res = mockRes();
    await prompts(mockReq('POST', { id: 'prm_owned_by_B', title: 't', content: 'hijacked' }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('PROMPT_ID_CONFLICT');
    const update = h.state.calls.find((c) => c.text.startsWith('UPDATE'))!;
    expect(update.text).toContain('WHERE id = $ AND user_id = $');
    expect(update.values).toContain('user_A');
    expect(sqlTexts().some((t) => t.includes('DO UPDATE'))).toBe(false);
    expect(sqlTexts().find((t) => t.startsWith('INSERT'))).toContain('ON CONFLICT (id) DO NOTHING');
  });

  it('updates a prompt the caller owns without inserting', async () => {
    h.state.responder = (text) => (text.startsWith('UPDATE') ? [{ id: 'prm_mine' }] : []);
    const res = mockRes();
    await prompts(mockReq('POST', { id: 'prm_mine', title: 't', content: 'new text' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ id: 'prm_mine', success: true });
    expect(sqlTexts().some((t) => t.startsWith('INSERT'))).toBe(false);
  });

  it('inserts a new prompt (no id sent) without an update attempt', async () => {
    h.state.responder = (text) => (text.startsWith('INSERT') ? [{ id: 'x' }] : []);
    const res = mockRes();
    await prompts(mockReq('POST', { title: 't', content: 'c', tags: ['Coding'] }), res);
    expect(res.statusCode).toBe(200);
    expect(sqlTexts().some((t) => t.startsWith('UPDATE'))).toBe(false);
  });

  it('refuses a new prompt once the user has 2,000 saved', async () => {
    h.state.responder = (text) => (text.startsWith('SELECT COUNT') ? [{ count: 2000 }] : []);
    const res = mockRes();
    await prompts(mockReq('POST', { title: 't', content: 'c' }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('PROMPT_LIMIT_REACHED');
    expect(h.state.calls.find((c) => c.text.startsWith('INSERT'))!.values).toContain(2000);
  });

  it('rejects over-long content and a non-string id before touching the database', async () => {
    const long = mockRes();
    await prompts(mockReq('POST', { title: 't', content: 'a'.repeat(50_001) }), long);
    expect(long.statusCode).toBe(400);

    const badId = mockRes();
    await prompts(mockReq('POST', { id: { $ne: 1 }, content: 'c' }), badId);
    expect(badId.statusCode).toBe(400);
    expect(h.state.calls).toHaveLength(0);
  });

  it("maps the database's own limits (migration 0003) to clear answers instead of 500", async () => {
    h.state.responder = () => {
      throw Object.assign(new Error('ROW_LIMIT_EXCEEDED: Prompt allows at most 2000 rows per user'), { code: '23514' });
    };
    const full = mockRes();
    await prompts(mockReq('POST', { title: 't', content: 'c' }), full);
    expect(full.statusCode).toBe(409);
    expect(full.body.code).toBe('PROMPT_LIMIT_REACHED');

    h.state.responder = () => {
      throw Object.assign(new Error('new row for relation "Prompt" violates check constraint "Prompt_size_chk"'), { code: '23514' });
    };
    const big = mockRes();
    await prompts(mockReq('POST', { title: 't', content: 'c' }), big);
    expect(big.statusCode).toBe(400);
    expect(big.body.code).toBe('PROMPT_TOO_LARGE');
    expect(JSON.stringify(big.body)).not.toContain('Prompt_size_chk');
  });

  it('rejects ids longer than the database allows (100)', async () => {
    const res = mockRes();
    await prompts(mockReq('POST', { id: 'p'.repeat(101), content: 'c' }), res);
    expect(res.statusCode).toBe(400);
    expect(h.state.calls).toHaveLength(0);
  });

  it('returns a generic message when the database fails', async () => {
    h.state.responder = () => {
      throw new Error('relation "Prompt" column full_content violates constraint xyz');
    };
    const res = mockRes();
    await prompts(mockReq('GET'), res);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('full_content');
  });
});

describe('POST /api/workflows', () => {
  it("never overwrites another user's workflow", async () => {
    h.state.responder = (text) => (text.startsWith('SELECT COUNT') ? [{ count: 1 }] : []);
    const res = mockRes();
    await workflows(mockReq('POST', { id: 'wf_owned_by_B', title: 'x', nodes: [], edges: [] }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('WORKFLOW_ID_CONFLICT');
    expect(h.state.calls.find((c) => c.text.startsWith('UPDATE'))!.values).toContain('user_A');
    expect(sqlTexts().some((t) => t.includes('DO UPDATE'))).toBe(false);
  });

  it('rejects non-array nodes and oversized workflows', async () => {
    const bad = mockRes();
    await workflows(mockReq('POST', { title: 'x', nodes: 'nope' }), bad);
    expect(bad.statusCode).toBe(400);

    const big = mockRes();
    await workflows(mockReq('POST', { title: 'x', nodes: [{ data: 'a'.repeat(500_001) }], edges: [] }), big);
    expect(big.statusCode).toBe(400);
    expect(h.state.calls).toHaveLength(0);
  });

  it('refuses a new workflow once the user has 200 saved', async () => {
    h.state.responder = (text) => (text.startsWith('SELECT COUNT') ? [{ count: 200 }] : []);
    const res = mockRes();
    await workflows(mockReq('POST', { title: 'x', nodes: [], edges: [] }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('WORKFLOW_LIMIT_REACHED');
  });

  it("maps the database's own limits (migration 0003) to clear answers instead of 500", async () => {
    h.state.responder = () => {
      throw Object.assign(new Error('ROW_LIMIT_EXCEEDED: BranchingTree allows at most 500 rows per user'), { code: '23514' });
    };
    const full = mockRes();
    await workflows(mockReq('POST', { title: 'x', nodes: [], edges: [] }), full);
    expect(full.statusCode).toBe(409);
    expect(full.body.code).toBe('WORKFLOW_LIMIT_REACHED');

    h.state.responder = () => {
      throw Object.assign(new Error('violates check constraint "BranchingTree_size_chk"'), { code: '23514' });
    };
    const big = mockRes();
    await workflows(mockReq('POST', { title: 'x', nodes: [], edges: [] }), big);
    expect(big.statusCode).toBe(400);
    expect(big.body.code).toBe('WORKFLOW_TOO_LARGE');
  });
});

describe('/api/traces', () => {
  const traceRows = () => [
    { id: '1', created_at: '2026-10-30T10:00:00Z', status: 'success', tokens_used: 10, latency_ms: 100, model_target: 'm' },
    { id: '2', created_at: '2026-10-30T10:01:00Z', status: 'error', tokens_used: 0, latency_ms: 50, model_target: 'm' },
  ];
  const totalsCalls = () => h.state.calls.filter((c) => c.text.includes('trace_totals('));

  // Order matters below: a "function missing" answer pauses trace_totals() for 5 minutes (module state).
  it('takes the totals over ALL traces from trace_totals() (migration 0010), while the list stays the last 100', async () => {
    h.state.responder = (text) =>
      text.includes('trace_totals(')
        ? [{ total_inferences: 250, total_tokens: '123456789012', avg_latency: 321, p99_latency: 999, reliability: '97.5', active_models: ['a', 'b', 'c'] }]
        : traceRows();
    const res = mockRes();
    await traces(mockReq('GET'), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      totalInferences: 250,
      totalTokens: 123456789012,
      avgLatency: 321,
      p99Latency: 999,
      reliability: 97.5,
      activeModels: ['a', 'b', 'c'],
      activeModelsCount: 3,
    });
    expect(res.body.traces).toHaveLength(2);
    expect(totalsCalls()[0].values).toEqual(['user_A']);
    expect(h.state.calls.find((c) => c.text.includes('FROM "Trace"'))!.text).toContain('LIMIT 100');
  });

  it('falls back to the 100-row totals when trace_totals() fails for another reason, and tries it again next time', async () => {
    h.state.responder = (text) => {
      if (text.includes('trace_totals(')) throw Object.assign(new Error('statement timeout'), { code: '57014' });
      return traceRows();
    };
    const res = mockRes();
    await traces(mockReq('GET'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ totalInferences: 2, totalTokens: 10, reliability: 50, activeModelsCount: 1 });

    await traces(mockReq('GET'), mockRes());
    expect(totalsCalls()).toHaveLength(2);
  });

  it("reports server-recorded 'success' / 'error' traces as OK / ERR, and uses the 100-row totals until migration 0010 exists", async () => {
    let now = 5_000_000_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    h.state.responder = (text) => {
      if (text.includes('trace_totals(')) throw Object.assign(new Error('function trace_totals(text) does not exist'), { code: '42883' });
      return traceRows();
    };
    const res = mockRes();
    await traces(mockReq('GET'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.traces.map((t: any) => t.status)).toEqual(['OK', 'ERR']);
    expect(res.body.reliability).toBe(50);
    expect(res.body.totalInferences).toBe(2);

    // Not asked again on every request ...
    await traces(mockReq('GET'), mockRes());
    expect(totalsCalls()).toHaveLength(1);
    // ... but checked again after 5 minutes
    now += 5 * 60 * 1000 + 1;
    await traces(mockReq('GET'), mockRes());
    expect(totalsCalls()).toHaveLength(2);
  });

  it('keeps client-reported numbers within bounds', async () => {
    const res = mockRes();
    await traces(mockReq('POST', { node: 'n', model: 'm', tokens: -5, latency: 1e12 }), res);
    expect(res.statusCode).toBe(200);
    const insert = h.state.calls.find((c) => c.text.startsWith('INSERT'))!;
    expect(insert.values).toContain(0);
    expect(insert.values).toContain(600_000);
  });

  it('rejects over-long labels', async () => {
    const res = mockRes();
    await traces(mockReq('POST', { node: 'n'.repeat(201) }), res);
    expect(res.statusCode).toBe(400);
    expect(h.state.calls).toHaveLength(0);
  });

  it('is rate limited before authentication or any query', async () => {
    h.state.rateLimitAllowed = false;
    const res = mockRes();
    await traces(mockReq('GET'), res);
    expect(h.authenticateRequest).not.toHaveBeenCalled();
    expect(h.state.calls).toHaveLength(0);
  });
});

describe('GET /api/user/profile', () => {
  it('reads only the columns it returns, never the password hash', async () => {
    h.state.responder = () => [{ id: 'user_A', name: 'Alice', email: 'a@example.com', username: 'alice', created_at: '2026-10-01T00:00:00Z' }];
    const res = mockRes();
    await profile(mockReq('GET'), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ id: 'user_A', name: 'Alice', username: 'alice' });
    const select = h.state.calls[0].text;
    expect(select).not.toContain('SELECT *');
    expect(select).not.toContain('password_hash');
    for (const column of ['username', 'bio', 'github', 'website', 'subscription_tier', 'joined_date']) {
      expect(select).toContain(column);
    }
  });
});

describe('PUT /api/user/profile', () => {
  it('rejects links that would run code, including obfuscated ones', async () => {
    for (const website of ['javascript:alert(1)', ' JaVa\tScript:alert(1)', 'data:text/html,<b>x</b>']) {
      const res = mockRes();
      await profile(mockReq('PUT', { website }), res);
      expect(res.statusCode).toBe(400);
    }
    expect(h.state.calls).toHaveLength(0);
  });

  it('accepts normal links and handles', async () => {
    const res = mockRes();
    await profile(mockReq('PUT', { website: 'https://example.dev', github: 'octocat', huggingface: 'huggingface.co/someone' }), res);
    expect(res.statusCode).toBe(200);
  });

  it('rejects over-long fields', async () => {
    const res = mockRes();
    await profile(mockReq('PUT', { bio: 'b'.repeat(1001) }), res);
    expect(res.statusCode).toBe(400);
  });

  it('answers 409 instead of 500 when the username is already taken', async () => {
    h.state.responder = () => {
      throw Object.assign(new Error('duplicate key value violates unique constraint "User_username_key"'), { code: '23505' });
    };
    const res = mockRes();
    await profile(mockReq('PUT', { username: 'taken' }), res);
    expect(res.statusCode).toBe(409);
    expect(JSON.stringify(res.body)).not.toContain('User_username_key');
  });

  it('is rate limited', async () => {
    h.state.rateLimitAllowed = false;
    await profile(mockReq('GET'), mockRes());
    expect(h.authenticateRequest).not.toHaveBeenCalled();
  });
});

describe('GET /api/health', () => {
  async function loadHealth() {
    vi.resetModules();
    return (await import('../../health.js')).default;
  }

  it('stops when rate limited: no database or Redis probe', async () => {
    const health = await loadHealth();
    h.state.rateLimitAllowed = false;
    const res = mockRes();
    await health(mockReq('GET'), res);
    expect(h.state.calls).toHaveLength(0);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('returns only up/down status, never error text or provider details', async () => {
    const health = await loadHealth();
    h.state.responder = () => {
      throw new Error('password authentication failed for user neondb_owner');
    };
    h.state.redis = { ping: vi.fn(async () => 'PONG') };
    const res = mockRes();
    await health(mockReq('GET'), res);

    expect(res.statusCode).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['database', 'redis', 'status', 'timestamp']);
    expect(res.body).toMatchObject({ status: 'degraded', database: { status: 'error' }, redis: { status: 'connected' } });
    expect(JSON.stringify(res.body)).not.toContain('neondb_owner');
  });

  it('reuses one result for 10 seconds', async () => {
    const health = await loadHealth();
    h.state.responder = () => [{ alive: 1 }];
    vi.useFakeTimers();
    await health(mockReq('GET'), mockRes());
    await health(mockReq('GET'), mockRes());
    expect(h.state.calls).toHaveLength(1);

    vi.advanceTimersByTime(10_001);
    const res = mockRes();
    await health(mockReq('GET'), res);
    expect(h.state.calls).toHaveLength(2);
    expect(res.body).toMatchObject({ status: 'ok', database: { status: 'connected' }, redis: { status: 'unconfigured' } });
  });
});
