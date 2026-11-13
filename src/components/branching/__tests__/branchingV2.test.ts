import { describe, it, expect } from 'vitest';
import { planRun, runWorkflow, validateGraph, type EngineDeps, type EngineEvent, type NodeResult, type RunSummary, type WorkflowGraph } from '../../../lib/workflowEngine';
import { safeRegexTest } from '../../../lib/workflowEngine/safeRegex';
import { RECIPE_TEMPLATES, levelOf, planFit, stepCount } from '../recipeTemplates';
import { BEGINNER_TEMPLATES } from '../beginnerTemplates';
import { CASE_COLORS, V2_NODE_TYPES, engineTierFor, isV2NodeType, listJsonPaths, needsEngine, summarizeV2, usesAI, v2Defaults } from '../nodeTypesV2';
import { describeRun, explainStep, patchForEvent, visualForEvent } from '../runMapping';
import { layoutThumb } from '../thumbLayout';
import { badgesFor, shareLinkFor } from '../cloudHelpers';

const FREE_MODEL = 'gemini-3.5-flash-lite';

/** A pretend AI that answers each recipe's prompts in the shape the recipe expects. */
function fakeAI(): EngineDeps['callAI'] {
  return async (_model, system, prompt, onToken, opts) => {
    const wantsJson = opts?.responseFormat === 'json' || /JSON only/i.test(system);
    let answer: string;
    if (/objective AI evaluator/i.test(system)) answer = 'SCORE: 82\nFEEDBACK: Clear and useful.';
    else if (wantsJson && /"issues"/.test(prompt)) answer = JSON.stringify({ issues: [{ severity: 'high', text: 'SQL injection: use a parameter' }, { severity: 'low', text: 'Name the handler' }] });
    else if (wantsJson && /"steps"/.test(prompt)) answer = JSON.stringify({ title: 'Double charge', severity: 'high', steps: ['Open checkout', 'Pay by card', 'Refresh'] });
    else if (wantsJson) answer = JSON.stringify([{ task: 'Onboarding emails', owner: 'Aisha', due: 'Thursday' }, { task: 'Signup bug', owner: 'Marco', due: 'Wednesday' }]);
    else if (/Label this customer message/i.test(prompt)) answer = 'billing';
    else answer = 'First idea\nSecond idea\nThird idea\nFourth idea\nFifth idea\nSixth idea';
    onToken?.(answer);
    return answer;
  };
}

function depsFor(): EngineDeps {
  return {
    callAI: fakeAI(),
    runCode: async (_s, input) => input,
    regexTest: safeRegexTest,
    askInput: async (n) => n.default ?? 'a test answer',
  };
}

const asGraph = (tpl: { nodes: unknown[]; edges: unknown[] }) => tpl as unknown as WorkflowGraph;

describe('recipes', () => {
  it('has 10 to 15 recipes with unique ids, free models and known node types', () => {
    expect(RECIPE_TEMPLATES.length).toBeGreaterThanOrEqual(10);
    expect(RECIPE_TEMPLATES.length).toBeLessThanOrEqual(15);
    const ids = new Set([...RECIPE_TEMPLATES, ...BEGINNER_TEMPLATES].map((t) => t.id));
    expect(ids.size).toBe(RECIPE_TEMPLATES.length + BEGINNER_TEMPLATES.length);
    for (const tpl of RECIPE_TEMPLATES) {
      const nodeIds = new Set(tpl.nodes.map((n) => n.id));
      expect(nodeIds.size).toBe(tpl.nodes.length);
      for (const n of tpl.nodes) {
        expect(n.data.modelId).toBe(FREE_MODEL);
        expect(n.data.status).toBe('idle');
      }
    }
  });

  it('keeps Simple recipes within 5 steps and every recipe within 10 (Free 5, Pro 10)', () => {
    for (const tpl of RECIPE_TEMPLATES) {
      const steps = stepCount(tpl);
      if (tpl.level === 'Simple') expect(steps, tpl.title).toBeLessThanOrEqual(5);
      expect(steps, tpl.title).toBeLessThanOrEqual(10);
      expect(tpl.archetypes, tpl.title).toHaveLength(steps);
    }
    expect(RECIPE_TEMPLATES.filter((t) => t.level === 'Simple').length).toBeGreaterThanOrEqual(5);
    expect(RECIPE_TEMPLATES.filter((t) => t.level === 'Advanced').length).toBeGreaterThanOrEqual(4);
  });

  it('wires only to nodes that exist, using real handle names', () => {
    for (const tpl of RECIPE_TEMPLATES) {
      const byId = new Map(tpl.nodes.map((n) => [n.id, n]));
      for (const e of tpl.edges) {
        expect(byId.has(e.source), `${tpl.id}: ${e.id} source`).toBe(true);
        expect(byId.has(e.target), `${tpl.id}: ${e.id} target`).toBe(true);
        const src = byId.get(e.source)!;
        const handle = (e as { sourceHandle?: string }).sourceHandle;
        if (src.data.nodeType === 'condition') expect(['true', 'false']).toContain(handle);
        if (src.data.nodeType === 'switch') {
          const cases = (src.data.switchCases as { id: string }[]).map((c) => `case:${c.id}`);
          expect([...cases, 'default'], `${tpl.id}: ${e.id}`).toContain(handle);
          expect(cases.length).toBeLessThanOrEqual(CASE_COLORS.length);
        }
      }
    }
  });

  it('passes the Pipeline doctor with no errors and has no loops', () => {
    for (const tpl of RECIPE_TEMPLATES) {
      const issues = validateGraph(asGraph(tpl), { tier: 'ultimate' });
      expect(issues.filter((i) => i.severity === 'error'), tpl.title).toEqual([]);
      expect(planRun(asGraph(tpl)).cycles, tpl.title).toEqual([]);
    }
  });

  it('runs every recipe from start to finish with Run all', async () => {
    for (const tpl of RECIPE_TEMPLATES) {
      const summary = await runWorkflow(asGraph(tpl), { tier: 'pro', deps: depsFor() });
      const errors = Object.values(summary.results).filter((r) => r.error);
      expect(errors.map((r) => `${r.meta.nodeId}: ${r.error?.code}`), tpl.title).toEqual([]);
      expect(summary.status, tpl.title).toBe('success');
      // at least one Output step shows something
      const outputs = tpl.nodes.filter((n) => n.data.nodeType === 'output').map((n) => summary.results[n.id]).filter((r) => r && !r.skipped);
      expect(outputs.length, tpl.title).toBeGreaterThan(0);
      expect(outputs.every((r) => r.text.trim().length > 0), tpl.title).toBe(true);
    }
  });

  it('takes the expected paths in the routing recipes', async () => {
    const run = (id: string) => runWorkflow(asGraph(RECIPE_TEMPLATES.find((t) => t.id === id)!), { tier: 'pro', deps: depsFor() });
    const support = await run('recipe-support-triage');
    expect(support.results['st-billing'].skipped).toBeFalsy();
    expect(support.results['st-bug'].skipped).toBe(true);
    expect(support.results['st-other'].skipped).toBe(true);

    const price = await run('recipe-pick-the-price');
    expect(price.results['price-pick'].text).toBe('24');
    expect(price.results['price-deal'].skipped).toBeFalsy();
    expect(price.results['price-wait'].skipped).toBe(true);

    const blog = await run('recipe-blog-quality-gate');
    expect(blog.results['bq-gate'].branch).toBe('true'); // fake judge gives 82
    expect(blog.results['bq-edit'].skipped).toBe(true);

    const fridge = await run('recipe-fridge-taste-test');
    expect(fridge.results['fr-switch'].branch).toBe('case:okay'); // 82: not 85+, but 60+

    const review = await run('recipe-code-review-gate');
    expect(review.results['cr-gate'].branch).toBe('true');
    expect(review.results['cr-fixes'].text).toContain('SQL injection');

    const tasks = await run('recipe-meeting-tasks');
    expect(tasks.results['mt-count'].text).toBe('2');
    expect(tasks.results['mt-lines'].text).toContain('Onboarding emails: Aisha (Thursday)');

    const names = await run('recipe-name-my-startup');
    expect(names.results['name-each'].text).toContain('1. First idea');
  });

  it('labels levels and plan fit for the gallery', () => {
    const limits = { free: 5, pro: 10, ultimate: 20 };
    expect(planFit(4, 'free', limits)).toEqual({ fits: true });
    expect(planFit(6, 'free', limits)).toEqual({ fits: false, needs: 'Pro' });
    expect(planFit(12, 'free', limits)).toEqual({ fits: false, needs: 'Ultimate' });
    expect(planFit(12, 'pro', limits)).toEqual({ fits: false, needs: 'Ultimate' });
    expect(planFit(3, 'free', { free: 3, pro: 15, ultimate: Infinity })).toEqual({ fits: true });
    expect(levelOf(BEGINNER_TEMPLATES[0])).toBe('Starter');
    expect(levelOf(RECIPE_TEMPLATES[0])).toBe('Simple');
  });
});

describe('new node types', () => {
  it('starts every new node with settings that pass the doctor', () => {
    for (const type of V2_NODE_TYPES) {
      const data = { agentId: 'gemini', modelId: FREE_MODEL, status: 'idle', nodeType: type, ...v2Defaults(type) };
      const graph = { nodes: [{ id: 'a', position: { x: 0, y: 0 }, data }], edges: [] } as unknown as WorkflowGraph;
      const errors = validateGraph(graph, { tier: 'free' }).filter((i) => i.severity === 'error');
      expect(errors, type).toEqual([]);
      expect(summarizeV2(data as never).length, type).toBeGreaterThan(0);
      expect(isV2NodeType(type)).toBe(true);
    }
    expect(isV2NodeType('prompt')).toBe(false);
  });

  it('gives every switch case its own id', () => {
    const a = v2Defaults('switch').switchCases!;
    const b = v2Defaults('switch').switchCases!;
    expect(new Set([...a, ...b].map((c) => c.id)).size).toBe(4);
  });

  it('knows which nodes must run through the engine and which call the AI', () => {
    expect(needsEngine({ nodeType: 'forEach' })).toBe(true);
    expect(needsEngine({ nodeType: 'condition' })).toBe(false);
    expect(needsEngine({ nodeType: 'condition', conditionGroup: { mode: 'all', rules: [] } })).toBe(false);
    expect(needsEngine({ nodeType: 'condition', conditionGroup: { mode: 'all', rules: [{ op: 'num_gt', value: '3' }] } })).toBe(true);
    expect(needsEngine({ nodeType: 'prompt', responseFormat: 'json' })).toBe(true);
    expect(needsEngine({ nodeType: 'prompt' })).toBe(false);
    expect(usesAI({ nodeType: 'prompt' })).toBe(true);
    expect(usesAI({ nodeType: 'merge', mergeStrategy: 'concat' })).toBe(false);
    expect(usesAI({ nodeType: 'merge', mergeStrategy: 'synthesize' })).toBe(true);
    expect(usesAI({ nodeType: 'forEach', forEachMode: 'template' })).toBe(false);
    expect(usesAI({ nodeType: 'forEach', forEachMode: 'ai' })).toBe(true);
  });

  it('maps plans to engine tiers (desktop runs as ultimate)', () => {
    expect(engineTierFor('free', false)).toBe('free');
    expect(engineTierFor('advanced', false)).toBe('pro');
    expect(engineTierFor('pro', false)).toBe('pro');
    expect(engineTierFor('ultimate', false)).toBe('ultimate');
    expect(engineTierFor('free', true)).toBe('ultimate');
  });

  it('lists clickable JSON paths, two levels deep', () => {
    expect(listJsonPaths('{"title":"a","items":[{"name":"x","price":3}]}')).toEqual(['title', 'items', 'items[0]', 'items[0].name', 'items[0].price']);
    expect(listJsonPaths('not json')).toEqual([]);
    expect(listJsonPaths('{"weird key":1,"ok":2}')).toEqual(['ok']);
    expect(listJsonPaths(JSON.stringify(Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i])))).length).toBe(14);
  });
});

const result = (extra: Partial<NodeResult> = {}): NodeResult => ({
  kind: 'text',
  text: 'hello',
  meta: { nodeId: 'n', nodeType: 'prompt', startedAt: '2026-11-13T00:00:00.000Z', durationMs: 1200, aiCalls: 1 },
  ...extra,
});

describe('run mapping', () => {
  it('writes the result fields the page reads', () => {
    expect(patchForEvent({ type: 'node-start', nodeId: 'n' }, 'prompt')).toEqual({ status: 'running', output: undefined, result: undefined });
    expect(patchForEvent({ type: 'node-token', nodeId: 'n', token: 'lo' }, 'prompt', 'hel')).toEqual({ output: 'hello' });
    const done = patchForEvent({ type: 'node-done', nodeId: 'n', result: result() }, 'prompt')!;
    expect(done).toMatchObject({ status: 'success', output: 'hello' });
    expect(done.result).toBeDefined();
    expect(patchForEvent({ type: 'node-done', nodeId: 'n', result: result({ branch: 'true' }) }, 'condition')).toMatchObject({ conditionResult: true });
    expect(patchForEvent({ type: 'node-done', nodeId: 'n', result: result({ branch: 'false' }) }, 'condition')).toMatchObject({ conditionResult: false });
    expect(patchForEvent({ type: 'node-done', nodeId: 'n', result: result({ text: 'Score: 91/100\nFeedback: Nice.', score: 91 }) }, 'evaluation')).toMatchObject({ evalScore: 91, evalCritique: 'Nice.' });
    const skipped = patchForEvent({ type: 'node-skipped', nodeId: 'n', result: result({ skipped: true, text: '[Branch Skipped: Condition criteria was not met]' }) }, 'prompt');
    expect(skipped).toMatchObject({ status: 'idle', output: '[Branch Skipped: Condition criteria was not met]' });
    const err = patchForEvent({ type: 'node-error', nodeId: 'n', result: result({ error: { code: 'NOT_JSON', message: 'The input is not JSON.', hint: 'Turn on Answer as JSON.' } }) }, 'jsonPick');
    expect(err).toMatchObject({ status: 'error', output: 'The input is not JSON.' });
    expect(patchForEvent({ type: 'run-start', order: [] }, 'prompt')).toBeNull();
  });

  it('turns events into node rings', () => {
    const cases: [EngineEvent, string | null][] = [
      [{ type: 'node-start', nodeId: 'n' }, 'running'],
      [{ type: 'node-done', nodeId: 'n', result: result() }, 'done'],
      [{ type: 'node-skipped', nodeId: 'n', result: result({ skipped: true }) }, 'skipped'],
      [{ type: 'node-error', nodeId: 'n', result: result({ error: { code: 'X', message: 'x' } }) }, 'error'],
      [{ type: 'node-token', nodeId: 'n', token: 'x' }, null],
    ];
    for (const [e, ring] of cases) expect(visualForEvent(e)).toBe(ring);
  });

  it('describes a finished run in one sentence', () => {
    const summary = (status: RunSummary['status'], results: Record<string, NodeResult>): RunSummary => ({ status, order: Object.keys(results), results, aiCalls: 2, durationMs: 3400, vars: {} });
    expect(describeRun(summary('success', { a: result(), b: result(), c: result({ skipped: true }) }))).toEqual({ text: 'Done: 2 steps in 3.4s, 2 AI calls, 1 skipped by a decision.', tone: 'success' });
    expect(describeRun(summary('partial', { a: result(), b: result({ error: { code: 'AI_FAILED', message: 'x' } }) })).tone).toBe('error');
    expect(describeRun(summary('cancelled', { a: result() })).text).toContain('Stopped');
  });

  it('explains each step in plain words', () => {
    expect(explainStep(result({ reason: 'TRUE: the answer contains "yes"' }), 'Check')).toBe('Check: TRUE: the answer contains "yes"');
    expect(explainStep(result({ kind: 'array', value: [1, 2, 3] }), 'Split')).toContain('list of 3 items');
    expect(explainStep(result({ skipped: true, text: '[Branch Skipped: Condition criteria was not met]' }), 'Reply')).toContain('turned off by a decision');
    expect(explainStep(result({ error: { code: 'NOT_JSON', message: 'Not JSON.', hint: 'Use JSON.' } }), 'Pick')).toBe('Pick failed: Not JSON. Use JSON.');
  });
});

describe('gallery and sharing helpers', () => {
  it('draws thumbnails inside their box', () => {
    for (const tpl of RECIPE_TEMPLATES) {
      const { boxes, wires } = layoutThumb(tpl.nodes, tpl.edges, 240, 84);
      expect(boxes).toHaveLength(tpl.nodes.length);
      expect(wires).toHaveLength(tpl.edges.length);
      for (const b of boxes) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x).toBeLessThanOrEqual(240);
        expect(b.y).toBeLessThanOrEqual(84);
      }
    }
    expect(layoutThumb([], [], 100, 50)).toEqual({ boxes: [], wires: [] });
  });

  it('builds a share link on the Branching page', () => {
    expect(shareLinkFor('ab c/1', 'https://bedrock.example')).toBe('https://bedrock.example/app/branching?shared=ab+c%2F1');
  });

  it('awards badges from run stats', () => {
    const none = badgesFor({ totalRuns: 0, successRuns: 0, runsToday: 0, streakDays: 0, nodeTypesUsed: [], firstRunAt: null });
    expect(none.every((b) => !b.earned)).toBe(true);
    const lots = badgesFor({
      totalRuns: 12,
      successRuns: 10,
      runsToday: 2,
      streakDays: 3,
      nodeTypesUsed: ['system', 'prompt', 'output', 'data', 'condition', 'code', 'merge', 'evaluation', 'note'],
      firstRunAt: '2026-11-01T00:00:00.000Z',
    });
    expect(lots.filter((b) => b.earned).map((b) => b.id)).toEqual(['first_run', 'ten_runs', 'streak3', 'explorer']);
  });
});
