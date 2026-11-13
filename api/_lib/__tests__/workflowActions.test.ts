import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Branching v2 actions on /api/workflows with a mocked database, sign-in, rate limiter, quota and AI.
const h = vi.hoisted(() => {
  const state = {
    calls: [] as Array<{ text: string; values: unknown[] }>,
    responder: (_text: string, _values: unknown[]): unknown => [],
    user: { id: 'user_A', email: 'a@example.com', name: 'Alice', role: 'Architect', plan: 'Free Plan', subscriptionTier: 'free', isGuest: false } as any,
    aiText: '',
    aiError: null as any,
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
  return {
    state,
    sql,
    authenticateRequest: vi.fn(async () => state.user),
    enforceRateLimit: vi.fn(async () => true),
    reserveQuota: vi.fn(async () => ({ allowed: true, reservationId: 'q1', bucket: 'assist', limit: 100, resetMs: 0, unavailable: false })),
    releaseQuota: vi.fn(async () => {}),
    executeAiCompletion: vi.fn(async () => {
      if (state.aiError) throw state.aiError;
      return { text: state.aiText, model: 'test-model' };
    }),
  };
});

vi.mock('../auth.js', () => ({ authenticateRequest: h.authenticateRequest }));
vi.mock('../rateLimiter.js', () => ({ enforceRateLimit: h.enforceRateLimit, getClientIp: () => '203.0.113.7', getRedisClient: () => null }));
vi.mock('../db.js', () => ({ getDb: () => h.sql }));
vi.mock('../ai.js', async (orig) => ({ ...(await orig<any>()), executeAiCompletion: h.executeAiCompletion }));
vi.mock('../security.js', async (orig) => ({
  ...(await orig<any>()),
  reserveQuota: h.reserveQuota,
  releaseQuota: h.releaseQuota,
  checkPromptInjection: vi.fn(() => false),
}));

import workflows from '../../workflows/index.js';
import { serverRowId } from '../dataHttp.js';
import { VERSIONS_KEPT } from '../workflowActions.js';
import { buildGeneratedWorkflow, buildGenerateSystemPrompt, parseAiJson } from '../workflowAi.js';
import { checkGraph, nodeLimitForJson, PLAN_NODE_LIMIT, stripForShare, tierOf } from '../workflowGraph.js';

function mockReq(method: string, query: Record<string, string> = {}, body: Record<string, unknown> = {}) {
  return { method, body, query, headers: {} } as any;
}
function mockRes() {
  const res: any = { statusCode: 200, body: undefined, headers: {} as Record<string, string> };
  res.status = vi.fn((c: number) => ((res.statusCode = c), res));
  res.json = vi.fn((b: unknown) => ((res.body = b), res));
  res.setHeader = vi.fn((k: string, v: string) => (res.headers[k] = v));
  res.on = vi.fn();
  return res;
}
const texts = () => h.state.calls.map((c) => c.text);
const missingTable = () => Object.assign(new Error('relation "WorkflowShare" does not exist'), { code: '42P01' });

const TOKEN = 'A'.repeat(43);

beforeEach(() => {
  h.state.calls = [];
  h.state.responder = () => [];
  h.state.user = { id: 'user_A', email: 'a@example.com', name: 'Alice', role: 'Architect', plan: 'Free Plan', subscriptionTier: 'free', isGuest: false };
  h.state.aiText = '';
  h.state.aiError = null;
  h.authenticateRequest.mockClear();
  h.enforceRateLimit.mockClear();
  h.reserveQuota.mockClear();
  h.releaseQuota.mockClear();
  h.executeAiCompletion.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('GET /api/workflows/shared (public)', () => {
  it('needs no sign-in, strips outputs, results, sample data and owner, and marks code', async () => {
    const nodes = [
      { id: 'a', type: 'genericNode', position: { x: 1, y: 2 }, data: { title: 'Data', description: 'd', nodeType: 'data', dataPayload: '{"secret":1}', output: 'secret output', status: 'success', user_id: 'user_A' } },
      { id: 'b', type: 'genericNode', position: { x: 3, y: 4 }, data: { title: 'Code', description: '', nodeType: 'code', codeScript: 'return input;', result: { text: 'x' }, evalScore: 9 } },
    ];
    h.state.responder = (t) => (t.startsWith('WITH opened AS') ? [{ title: 'Shared!', nodes: JSON.stringify(nodes), edges: JSON.stringify([{ id: 'e', source: 'a', target: 'b', style: { x: 1 }, extra: 'drop' }]), shared_at: '2026-11-12' }] : []);
    const res = mockRes();
    await workflows(mockReq('GET', { action: 'shared', token: TOKEN }), res);
    expect(res.statusCode).toBe(200);
    expect(h.authenticateRequest).not.toHaveBeenCalled();
    expect(h.enforceRateLimit).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'workflowPublic', '203.0.113.7');
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('secret');
    expect(body).not.toContain('user_A');
    expect(body).not.toContain('evalScore');
    expect(res.body.hasCode).toBe(true);
    expect(res.body.nodes[0].data.dataPayload).toBe('');
    expect(res.body.nodes[0].data.status).toBe('idle');
    expect(res.body.edges[0]).toEqual({ id: 'e', source: 'a', target: 'b' });
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body.sharedAt).toBe('2026-11-12');
    expect(h.state.calls[0].text).toContain('b.user_id = opened.user_id');
  });

  it('answers the same 404 for malformed, unknown and revoked tokens', async () => {
    const bad = mockRes();
    await workflows(mockReq('GET', { action: 'shared', token: 'short' }), bad);
    expect(bad.statusCode).toBe(404);
    expect(h.state.calls).toHaveLength(0);
    const unknown = mockRes();
    await workflows(mockReq('GET', { action: 'shared', token: TOKEN }), unknown);
    expect(unknown.statusCode).toBe(404);
    expect(unknown.body.code).toBe('SHARE_NOT_FOUND');
    expect(h.state.calls[0].text).toContain('revoked_at IS NULL');
  });

  it('503 FEATURE_NOT_READY before migration 0021', async () => {
    h.state.responder = () => { throw missingTable(); };
    const res = mockRes();
    await workflows(mockReq('GET', { action: 'shared', token: TOKEN }), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('FEATURE_NOT_READY');
  });
});

describe('signed-in actions', () => {
  it('need sign-in', async () => {
    h.state.user = null;
    const res = mockRes();
    await workflows(mockReq('GET', { action: 'stats' }), res);
    expect(res.statusCode).toBe(401);
  });

  it('unknown action is a 400, not a list', async () => {
    const res = mockRes();
    await workflows(mockReq('GET', { action: 'nope' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('UNKNOWN_ACTION');
  });

  it('validate: stats, plan limit for free, loops', async () => {
    const node = (id: string, nodeType = 'prompt') => ({ id, data: { nodeType, title: id, description: 'x' } });
    const res = mockRes();
    await workflows(mockReq('POST', { action: 'validate' }, {
      nodes: [node('a'), node('b'), node('c', 'code'), node('d'), node('e'), node('f'), node('n', 'note')],
      edges: [{ id: '1', source: 'a', target: 'b' }, { id: '2', source: 'b', target: 'a' }],
    }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.stats).toMatchObject({ nodeCount: 6, aiNodeCount: 5, planNodeLimit: 5, overLimit: true, hasCode: true });
    const codes = res.body.issues.map((i: any) => i.code);
    expect(codes).toContain('CYCLE');
    expect(codes).toContain('PLAN_NODE_LIMIT');
    expect(h.state.calls).toHaveLength(0);
  });

  it("versions: another account's workflow is a 404; own workflow lists newest first", async () => {
    const missing = mockRes();
    await workflows(mockReq('GET', { action: 'versions', id: 'wf_of_B' }), missing);
    expect(missing.statusCode).toBe(404);
    expect(h.state.calls[0].values).toContain('user_A');
    expect(h.state.calls[0].values).toContain(serverRowId('user_A', 'wf_of_B'));

    h.state.calls = [];
    h.state.responder = (t) => {
      if (t.startsWith('SELECT id FROM "BranchingTree"')) return [{ id: 'wf1' }];
      if (t.includes('FROM "WorkflowVersion"')) return [{ version: 3, title: 'T', node_count: 2, created_at: 'now' }];
      return [];
    };
    const ok = mockRes();
    await workflows(mockReq('GET', { action: 'versions', id: 'wf1' }), ok);
    expect(ok.body).toEqual({ id: 'wf1', versions: [{ version: 3, title: 'T', nodeCount: 2, createdAt: 'now' }] });
    expect(h.state.calls[1].values).toContain(VERSIONS_KEPT);
  });

  it('restore: keeps the current state as a version, then puts the old one back', async () => {
    h.state.responder = (t) => {
      if (t.startsWith('SELECT id FROM "BranchingTree"')) return [{ id: 'wf1' }];
      if (t.startsWith('SELECT title, nodes, edges FROM "WorkflowVersion"')) return [{ title: 'Old', nodes: '[{"id":"x"}]', edges: '[]' }];
      if (t.startsWith('SELECT title, nodes, edges FROM "BranchingTree"')) return [{ title: 'Now', nodes: '[]', edges: '[]' }];
      return [];
    };
    const res = mockRes();
    await workflows(mockReq('POST', { action: 'restore' }, { id: 'wf1', version: 2 }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ id: 'wf1', title: 'Old', nodes: [{ id: 'x' }], restoredVersion: 2 });
    const order = texts().map((t) => t.split(' ').slice(0, 3).join(' '));
    const firstSnapshot = order.findIndex((t) => t.startsWith('WITH latest'));
    const update = order.findIndex((t) => t.startsWith('UPDATE "BranchingTree"'));
    expect(firstSnapshot).toBeGreaterThan(-1);
    expect(firstSnapshot).toBeLessThan(update);
  });

  it('share: creates a 43-character token once, returns the same link again, and can be turned off', async () => {
    let stored: string | null = null;
    h.state.responder = (t, v) => {
      if (t.startsWith('SELECT id FROM "BranchingTree"')) return [{ id: 'wf1' }];
      if (t.startsWith('WITH created AS')) {
        if (!stored) stored = v[0] as string; // first click creates; later ones get the active link back
        return [{ token: stored }];
      }
      if (t.startsWith('UPDATE "WorkflowShare" SET revoked_at')) return stored ? [{ token: stored }] : [];
      return [];
    };
    const first = mockRes();
    await workflows(mockReq('POST', { action: 'share' }, { id: 'wf1' }), first);
    expect(first.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.body.url).toBe(`/app/branching?shared=${first.body.token}`);
    expect(h.enforceRateLimit).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'workflowShare', 'user_A');
    const second = mockRes();
    await workflows(mockReq('POST', { action: 'share' }, { id: 'wf1' }), second);
    expect(second.body.token).toBe(first.body.token);
    expect(texts().filter((t) => t.startsWith('WITH created AS'))).toHaveLength(2);
    const off = mockRes();
    await workflows(mockReq('POST', { action: 'share' }, { id: 'wf1', revoke: true }), off);
    expect(off.body).toMatchObject({ revoked: true, success: true });
  });

  it('runs: checks status, clamps numbers, keeps only known step types, and trims old history', async () => {
    const bad = mockRes();
    await workflows(mockReq('POST', { action: 'runs' }, { status: 'great' }), bad);
    expect(bad.statusCode).toBe(400);

    h.state.responder = (t) => (t.startsWith('SELECT id FROM "BranchingTree"') ? [] : []);
    const res = mockRes();
    await workflows(mockReq('POST', { action: 'runs' }, {
      workflowId: 'wf_of_B', status: 'success', nodeCount: 3, aiCalls: -5, durationMs: 99_999_999, errorCount: 'x',
      nodeTypes: ['prompt', 'prompt', 'evil', 'condition', 42],
    }), res);
    expect(res.statusCode).toBe(200);
    const insert = h.state.calls.find((c) => c.text.startsWith('INSERT INTO "WorkflowRun"'))!;
    expect(insert.values.slice(1)).toEqual(['user_A', null, 'success', 3, 0, 3_600_000, 0, ['prompt', 'condition']]);
    expect(texts().some((t) => t.startsWith('DELETE FROM "WorkflowRun" WHERE user_id'))).toBe(true);
  });

  it('stats: one statement (db/PAGING.md run_stats) mapped to the answer', async () => {
    h.state.responder = (t) => (t.startsWith('WITH runs AS') ? [{ total_runs: 7, success_runs: 5, runs_today: 2, streak_days: 3, node_types_used: ['condition', 'prompt'], first_run_at: '2026-11-01' }] : []);
    const res = mockRes();
    await workflows(mockReq('GET', { action: 'stats' }), res);
    expect(res.body).toEqual({ totalRuns: 7, successRuns: 5, runsToday: 2, streakDays: 3, nodeTypesUsed: ['condition', 'prompt'], firstRunAt: '2026-11-01' });
    expect(h.state.calls).toHaveLength(1);
    expect(h.state.calls[0].values).toEqual(['user_A', null]);
    expect(h.state.calls[0].text).toContain("AT TIME ZONE 'Asia/Kolkata'");
  });

  it('maps the database refusals from migration 0021', async () => {
    h.state.responder = (t) => {
      if (t.startsWith('INSERT INTO "WorkflowRun"')) throw Object.assign(new Error('DAILY_RUN_LIMIT: at most 2000 run records in 24 hours'), { code: '23514' });
      return [];
    };
    const busy = mockRes();
    await workflows(mockReq('POST', { action: 'runs' }, { status: 'success' }), busy);
    expect(busy.statusCode).toBe(429);
    expect(busy.body.code).toBe('DAILY_RUN_LIMIT');

    h.state.responder = (t) => {
      if (t.startsWith('INSERT INTO "WorkflowRun"')) throw Object.assign(new Error('new row violates check constraint "WorkflowRun_counts_chk"'), { code: '23514' });
      return [];
    };
    const bad = mockRes();
    await workflows(mockReq('POST', { action: 'runs' }, { status: 'success' }), bad);
    expect(bad.statusCode).toBe(400);

    h.state.responder = (t) => {
      if (t.startsWith('SELECT id FROM "BranchingTree"')) return [{ id: 'wf1' }];
      if (t.startsWith('WITH created AS')) throw Object.assign(new Error('WORKFLOW_NOT_OWNED'), { code: '23503' });
      return [];
    };
    const notMine = mockRes();
    await workflows(mockReq('POST', { action: 'share' }, { id: 'wf1' }), notMine);
    expect(notMine.statusCode).toBe(404);
  });

  it('every table action answers 503 FEATURE_NOT_READY before migration 0021', async () => {
    h.state.responder = (t) => {
      if (t.startsWith('SELECT id FROM "BranchingTree"')) return [{ id: 'wf1' }];
      throw missingTable();
    };
    for (const [method, query, body] of [
      ['GET', { action: 'versions', id: 'wf1' }, {}],
      ['POST', { action: 'share' }, { id: 'wf1' }],
      ['POST', { action: 'runs' }, { status: 'success' }],
      ['GET', { action: 'stats' }, {}],
    ] as const) {
      const res = mockRes();
      await workflows(mockReq(method, query, body as any), res);
      expect(res.statusCode, String(query.action)).toBe(503);
      expect(res.body.code).toBe('FEATURE_NOT_READY');
    }
  });
});

describe('saving keeps a version, and never fails because of it', () => {
  it('snapshots after a successful save', async () => {
    h.state.responder = (t) => (t.startsWith('INSERT INTO "BranchingTree"') ? [{ id: 'x' }] : []);
    const res = mockRes();
    await workflows(mockReq('POST', {}, { title: 'x', nodes: [{ id: 'a', data: { nodeType: 'prompt' } }], edges: [] }), res);
    expect(res.statusCode).toBe(200);
    expect(texts().some((t) => t.startsWith('WITH latest AS') && t.includes('INSERT INTO "WorkflowVersion"'))).toBe(true);
    expect(texts().some((t) => t.startsWith('DELETE FROM "WorkflowVersion"'))).toBe(true);
  });

  it('a missing version table does not break the save', async () => {
    h.state.responder = (t) => {
      if (t.startsWith('UPDATE "BranchingTree"')) return [{ id: 'wf1' }];
      if (t.includes('"WorkflowVersion"')) throw missingTable();
      return [];
    };
    const res = mockRes();
    await workflows(mockReq('POST', {}, { id: 'wf1', title: 'x', nodes: [], edges: [] }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ id: 'wf1', success: true });
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('Build it for me (generate)', () => {
  const proposal = {
    title: 'Mood router',
    explanation: 'Asks how you feel and answers kindly.',
    nodes: [
      { key: 'ask', type: 'askInput', title: 'How do you feel?', askQuestion: 'How do you feel today?' },
      { key: 'check', type: 'condition', title: 'Happy?', conditionGroup: { mode: 'any', rules: [{ op: 'contains', value: 'happy' }, { op: 'bogus' }] } },
      { key: 'yay', type: 'prompt', title: 'Celebrate', description: 'Celebrate with them.' },
      { key: 'hug', type: 'prompt', title: 'Comfort', description: 'Comfort them.' },
      { key: 'js', type: 'code', title: 'Script', codeScript: 'fetch("https://evil")' },
      { key: 'tip', type: 'note', title: 'Note', noteText: 'Try typing "happy"!' },
      { key: 'out1', type: 'output', title: 'Show celebration' },
      { key: 'out2', type: 'output', title: 'Show comfort' },
    ],
    edges: [
      { from: 'ask', to: 'check' },
      { from: 'check', to: 'yay', path: 'true' },
      { from: 'check', to: 'hug', path: 'false' },
      { from: 'hug', to: 'js' },
      { from: 'yay', to: 'out1' },
      { from: 'hug', to: 'out2' },
    ],
  };

  it('builds real nodes, removes code, keeps the free 5-step limit, and lays them out', async () => {
    h.state.aiText = '```json\n' + JSON.stringify(proposal) + '\n```';
    const res = mockRes();
    await workflows(mockReq('POST', { action: 'generate' }, { description: 'route by mood' }), res);
    expect(res.statusCode).toBe(200);
    const types = res.body.nodes.map((n: any) => n.data.nodeType);
    expect(types).not.toContain('code');
    expect(types.filter((t: string) => t !== 'note')).toHaveLength(5);
    expect(types).toContain('note');
    expect(res.body.notes.join(' ')).toMatch(/Code step was left out/);
    expect(res.body.notes.join(' ')).toMatch(/allows 5 steps, so the design was cut to its first 5/);
    const cond = res.body.nodes.find((n: any) => n.data.nodeType === 'condition');
    expect(cond.data.conditionGroup.rules).toEqual([{ op: 'contains', value: 'happy' }]);
    expect(res.body.edges.find((e: any) => e.source === cond.id).sourceHandle).toBe('true');
    expect(res.body.planNodeLimit).toBe(5);
    expect(h.reserveQuota).toHaveBeenCalledWith(expect.objectContaining({ bucket: 'assist', endpoint: 'workflows/generate' }));
    expect(h.enforceRateLimit).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'workflowAi', 'user_A', false);
  });

  it('gives the quota unit back when no AI answered, but not for an unusable answer', async () => {
    h.state.aiError = Object.assign(new Error('all failed'), { code: 'AI_ALL_PROVIDERS_FAILED' });
    const failed = mockRes();
    await workflows(mockReq('POST', { action: 'generate' }, { description: 'x' }), failed);
    expect(h.releaseQuota).toHaveBeenCalledTimes(1);

    h.state.aiError = null;
    h.state.aiText = 'Sorry, I cannot.';
    const unusable = mockRes();
    await workflows(mockReq('POST', { action: 'generate' }, { description: 'x' }), unusable);
    expect(unusable.statusCode).toBe(502);
    expect(unusable.body.code).toBe('GENERATE_UNUSABLE');
    expect(h.releaseQuota).toHaveBeenCalledTimes(1);
  });

  it('refuses an empty or oversized description without calling the AI', async () => {
    for (const description of ['', 'x'.repeat(2_001)]) {
      const res = mockRes();
      await workflows(mockReq('POST', { action: 'generate' }, { description }), res);
      expect(res.statusCode).toBe(400);
    }
    expect(h.executeAiCompletion).not.toHaveBeenCalled();
    expect(h.reserveQuota).not.toHaveBeenCalled();
  });

  it('switch cases get their own paths; loops are removed; pro allows more steps', () => {
    const wf = buildGeneratedWorkflow({
      nodes: [
        { key: 'a', type: 'data', dataPayload: { mood: 'sad' } },
        { key: 's', type: 'switch', switchField: 'mood', switchCases: [{ id: 'sad!', label: 'Sad', op: 'equals', value: 'sad' }] },
        { key: 'b', type: 'output' },
        { key: 'c', type: 'output' },
      ],
      edges: [{ from: 'a', to: 's' }, { from: 's', to: 'b', path: 'case:sad' }, { from: 's', to: 'c', path: 'default' }, { from: 'c', to: 's' }],
    }, 'pro')!;
    expect(wf.nodes).toHaveLength(4);
    const handles = wf.edges.filter((e) => e.source === 'gen-2').map((e) => e.sourceHandle).sort();
    expect(handles).toEqual(['case:sad', 'default']);
    expect(wf.edges.some((e) => e.source === 'gen-4' && e.target === 'gen-2')).toBe(false); // only the loop wire went
    expect(wf.edges).toHaveLength(3);
    expect(wf.notes.join(' ')).toMatch(/loop was removed/);
    expect(wf.nodes[0].data.dataPayload).toBe('{"mood":"sad"}');
  });
});

describe('Explain this workflow', () => {
  it('returns a summary and steps for real node ids only', async () => {
    h.state.aiText = JSON.stringify({ summary: 'It says hi.', steps: [{ nodeId: 'a', text: 'Says hi.' }, { nodeId: 'ghost', text: 'x' }] });
    const res = mockRes();
    await workflows(mockReq('POST', { action: 'explain' }, { nodes: [{ id: 'a', data: { nodeType: 'prompt', title: 'Hi', description: 'Say hi', output: 'SECRET OUTPUT' } }], edges: [] }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ summary: 'It says hi.', steps: [{ nodeId: 'a', text: 'Says hi.' }] });
    const sentPrompt = (h.executeAiCompletion.mock.calls[0] as unknown[])[0] as string;
    expect(sentPrompt).not.toContain('SECRET OUTPUT');
  });
});

describe('helpers', () => {
  it('tierOf, checkGraph, stripForShare, parseAiJson', () => {
    expect(tierOf({ subscriptionTier: 'ultimate' })).toBe('ultimate');
    expect(tierOf({ subscriptionTier: 'advanced' })).toBe('pro');
    expect(tierOf({ subscriptionTier: 'pro', isGuest: true })).toBe('free');
    expect(checkGraph([{ id: 'a', data: { nodeType: 'weird' } }], [], 'free').issues[0].code).toBe('UNKNOWN_NODE');
    const polluted = JSON.parse('{"id":"a","data":{"nodeType":"prompt","conditionGroup":{"__proto__":{"x":1},"mode":"all"}}}');
    const out = stripForShare([polluted], []);
    expect(Object.prototype.hasOwnProperty.call((out.nodes[0] as any).data.conditionGroup, '__proto__')).toBe(false);
    expect(parseAiJson('Here: [1,2]')).toEqual({ ok: true, value: [1, 2] });
    expect(parseAiJson('no').ok).toBe(false);
  });
});

describe('plan node limits: Free 5, Pro 10 (Advanced = Pro), Ultimate 20 (2026-11-13)', () => {
  const chain = (n: number) => ({
    nodes: Array.from({ length: n }, (_, i) => ({ key: `k${i}`, type: 'prompt', title: `Step ${i + 1}`, description: 'x' })),
    edges: Array.from({ length: n - 1 }, (_, i) => ({ from: `k${i}`, to: `k${i + 1}` })),
  });

  it('PLAN_NODE_LIMIT and tierOf', () => {
    expect(PLAN_NODE_LIMIT).toEqual({ free: 5, pro: 10, ultimate: 20 });
    expect(tierOf({ subscriptionTier: 'free' })).toBe('free');
    expect(tierOf({ subscriptionTier: 'advanced' })).toBe('pro');
    expect(PLAN_NODE_LIMIT[tierOf({ subscriptionTier: 'advanced' })]).toBe(10);
    expect(nodeLimitForJson('ultimate')).toBe(20);
  });

  it('Build it for me trims to each plan', () => {
    for (const [tier, limit] of [['free', 5], ['pro', 10], ['ultimate', 20]] as const) {
      const wf = buildGeneratedWorkflow(chain(25), tier)!;
      expect(wf.nodes, tier).toHaveLength(limit);
      expect(wf.notes.join(' ')).toContain(`allows ${limit} steps`);
      const exact = buildGeneratedWorkflow(chain(limit), tier)!;
      expect(exact.nodes).toHaveLength(limit);
      expect(exact.notes).toEqual([]);
    }
  });

  it('server check: over the limit only above 5 / 10 / 20, and the message names the number', () => {
    const nodes = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `n${i}`, data: { nodeType: 'prompt' } }));
    for (const [tier, limit] of [['free', 5], ['pro', 10], ['ultimate', 20]] as const) {
      expect(checkGraph(nodes(limit), [], tier).stats.overLimit, `${tier} at ${limit}`).toBe(false);
      const over = checkGraph(nodes(limit + 1), [], tier);
      expect(over.stats.overLimit).toBe(true);
      expect(over.issues.find((i) => i.code === 'PLAN_NODE_LIMIT')!.message).toContain(`up to ${limit}`);
      expect(JSON.stringify(over)).not.toMatch(/unlimited/i);
    }
  });

  it('the generate prompt tells the AI the plan limit', () => {
    expect(buildGenerateSystemPrompt(PLAN_NODE_LIMIT.free)).toContain('at most 5 steps');
    expect(buildGenerateSystemPrompt(PLAN_NODE_LIMIT.ultimate)).toContain('at most 20 steps');
  });
});