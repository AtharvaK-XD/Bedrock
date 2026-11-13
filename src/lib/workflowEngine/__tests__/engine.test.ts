import { describe, it, expect, vi } from 'vitest';
import {
  runWorkflow, validateGraph, planRun, evaluateRule, evaluateGroup, evaluateLegacy, applyArrayOp, toList, getPath,
  applyLegacyTemplate, applyExtendedTemplate, detectKind, parseEvaluation, LEGACY_SKIP_TEXT, UPSTREAM_FAILED_SKIP_TEXT,
  type EngineDeps, type WorkflowEdge, type WorkflowGraph, type WorkflowNode, type WorkflowNodeData, type SafeRegexResult,
} from '../index';

// ---- helpers -------------------------------------------------------------------------------------------------

const regexTest = (p: string, t: string): SafeRegexResult => {
  if (/\([^)]*[+*]\)[+*]/.test(p)) return { ok: false, reason: 'unsafe' };
  try {
    return { ok: true, matched: new RegExp(p, 'i').test(t) };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
};

function deps(over: Partial<EngineDeps> = {}): EngineDeps & { calls: Array<{ model: string; system: string; prompt: string }> } {
  const calls: Array<{ model: string; system: string; prompt: string }> = [];
  return {
    calls,
    callAI: vi.fn(async (model: string, system: string, prompt: string, onToken?: (t: string) => void) => {
      calls.push({ model, system, prompt });
      onToken?.('tok');
      return `AI(${prompt.slice(0, 40)})`;
    }),
    runCode: vi.fn(async (script: string, input: string) => {
      // eslint-disable-next-line no-new-func
      return String(new Function('input', script)(input));
    }),
    regexTest,
    askInput: vi.fn(async () => 'my answer'),
    ...over,
  };
}

let seq = 0;
function n(nodeType: WorkflowNodeData['nodeType'], data: Partial<WorkflowNodeData> = {}, id?: string): WorkflowNode {
  seq++;
  return {
    id: id ?? `n${seq}`,
    type: 'genericNode',
    position: { x: seq * 10, y: 0 },
    data: { title: data.title ?? `Node ${seq}`, description: '', agentId: 'gemini', modelId: 'gemini-3.5-flash-lite', status: 'idle', nodeType, ...data },
  };
}
const e = (source: string, target: string, sourceHandle?: string): WorkflowEdge => ({ id: `${source}->${target}:${sourceHandle ?? ''}`, source, target, sourceHandle });

// ---- Reference: the page's original Run button (src/pages/BranchingChat.tsx handleRun), copied as-is -------------
// Used to prove the engine gives the same output for the 8 original node types.

async function legacyRun(nodeId: string, graph: WorkflowGraph, d: EngineDeps): Promise<{ output: string; conditionResult?: boolean; evalScore?: number; skipped?: boolean }> {
  const allNodes = graph.nodes;
  const data = allNodes.find((x) => x.id === nodeId)!.data;
  const incomingEdges = graph.edges.filter((x) => x.target === nodeId);
  const activeIncomingEdges = incomingEdges.filter((ed) => {
    const sourceNode = allNodes.find((x) => x.id === ed.source);
    if (!sourceNode || sourceNode.data.nodeType !== 'condition') return true;
    if (sourceNode.data.conditionResult === undefined) return true;
    if (ed.sourceHandle === 'true' && !sourceNode.data.conditionResult) return false;
    if (ed.sourceHandle === 'false' && sourceNode.data.conditionResult) return false;
    return true;
  });
  if (incomingEdges.length > 0 && activeIncomingEdges.length === 0) return { output: '[Branch Skipped: Condition criteria was not met]', skipped: true };
  const parentNodes = activeIncomingEdges.map((ed) => allNodes.find((x) => x.id === ed.source)).filter(Boolean) as WorkflowNode[];
  const sysNodes = parentNodes.filter((p) => p.data.nodeType === 'system');
  const nonSysNodes = parentNodes.filter((p) => p.data.nodeType !== 'system');
  const sysPrompt = sysNodes.map((p) => p.data.output || p.data.description).filter(Boolean).join('\n\n');
  const upstreamText = nonSysNodes.map((p) => p.data.output || p.data.description || p.data.title).filter(Boolean).join('\n\n');
  switch (data.nodeType) {
    case 'system': return { output: data.description || 'System persona active.' };
    case 'data': {
      const payload = (data.dataPayload || data.description) as string;
      try { return { output: JSON.stringify(JSON.parse(payload), null, 2) }; } catch { return { output: payload }; }
    }
    case 'code': return { output: await d.runCode(data.codeScript || 'return input;', upstreamText || data.description) };
    case 'condition': {
      const rule = data.conditionRule || 'contains';
      const targetVal = (data.conditionValue || '').trim().toLowerCase();
      const testText = (upstreamText || data.description).toLowerCase();
      let passed = false;
      if (rule === 'contains') passed = testText.includes(targetVal);
      else if (rule === 'not_contains') passed = !testText.includes(targetVal);
      else if (rule === 'length_gt') passed = testText.length > (parseInt(targetVal, 10) || 0);
      else if (rule === 'regex') { try { passed = new RegExp(targetVal, 'i').test(testText); } catch { passed = false; } }
      return { output: upstreamText || data.description || (passed ? 'Condition Passed' : 'Condition Failed'), conditionResult: passed };
    }
    case 'merge': {
      const strategy = data.mergeStrategy || 'concat';
      if (strategy === 'concat') return { output: nonSysNodes.map((p) => `--- Source: ${p.data.title} ---\n${p.data.output || p.data.description}`).join('\n\n') };
      if (strategy === 'bullets') return { output: nonSysNodes.map((p) => `• [${p.data.title}]: ${p.data.output || p.data.description}`).join('\n') };
      if (strategy === 'json') return { output: JSON.stringify(nonSysNodes.map((p) => ({ source: p.data.title, content: p.data.output || p.data.description })), null, 2) };
      const synthesisPrompt = `Synthesize and unify these ${nonSysNodes.length} workflow branches into a coherent output:\n\n${upstreamText}`;
      return { output: await d.callAI(data.modelId!, 'You are an expert synthesizer. Merge all context into a single coherent output.', synthesisPrompt) };
    }
    case 'evaluation': {
      const labels: Record<string, string> = { accuracy: 'Accuracy & Reliability', clarity: 'Clarity & Concise Tone', code_quality: 'Code Quality & Safety', guardrails: 'Policy & Guardrails' };
      const criteriaLabel = labels[data.evalCriteria as string] || 'Factual Accuracy & Reliability';
      const evalPrompt = `You are an expert AI Judge. Grade the following output strictly based on: "${criteriaLabel}".
Provide your evaluation in this EXACT format:
SCORE: [number between 0 and 100]
FEEDBACK: [1 to 2 sentences explaining the grade]

Content to evaluate:
${upstreamText || data.description}`;
      const rawEval = await d.callAI(data.modelId!, 'You are an objective AI evaluator.', evalPrompt);
      const scoreMatch = rawEval.match(/SCORE:\s*(\d+)/i);
      const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 88;
      const feedbackMatch = rawEval.match(/FEEDBACK:\s*([\s\S]+)/i);
      const critique = feedbackMatch ? feedbackMatch[1].trim() : rawEval;
      const evalScore = Math.min(100, Math.max(0, score));
      return { output: `Score: ${evalScore}/100\nFeedback: ${critique}`, evalScore };
    }
    case 'output': return { output: upstreamText || data.description || 'Terminal ready. Run upstream nodes to feed output.' };
    default: {
      let resolvedPrompt = data.description || data.title;
      for (const p of nonSysNodes) {
        const val = p.data.output || p.data.description || '';
        resolvedPrompt = resolvedPrompt.replace(new RegExp(`{{\\s*${p.id}\\s*}}`, 'gi'), val);
        const slug = p.data.title.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        resolvedPrompt = resolvedPrompt.replace(new RegExp(`{{\\s*${slug}\\s*}}`, 'gi'), val);
        p.data.title.split(/[\s_-]+/).forEach((word) => {
          if (word.length > 2) resolvedPrompt = resolvedPrompt.replace(new RegExp(`{{\\s*${word}\\s*}}`, 'gi'), val);
        });
      }
      let finalUserPrompt = resolvedPrompt;
      if (upstreamText && !data.description.includes('{{')) finalUserPrompt = `[Upstream Input Context]\n${upstreamText}\n\n[Instruction]\n${resolvedPrompt}`;
      return { output: await d.callAI(data.modelId!, sysPrompt, finalUserPrompt) };
    }
  }
}

/** Runs one node both ways and compares output and AI-call arguments. */
async function expectParity(graph: WorkflowGraph, nodeId: string, aiAnswer?: string) {
  const over = aiAnswer === undefined ? {} : {
    callAI: vi.fn(async function (this: unknown, model: string, system: string, prompt: string) {
      return `${aiAnswer}|${model}|${system}|${prompt}`;
    }),
  };
  const a = deps(over);
  const b = deps(over.callAI ? { callAI: vi.fn(over.callAI) } : {});
  const legacy = await legacyRun(nodeId, graph, a);
  const summary = await runWorkflow(graph, { deps: b, tier: 'free', only: nodeId });
  const r = summary.results[nodeId];
  expect(r.text).toBe(legacy.output);
  expect(b.calls).toEqual(a.calls);
  if (legacy.conditionResult !== undefined) expect(r.branch).toBe(String(legacy.conditionResult));
  if (legacy.skipped) expect(r.skipped).toBe(true);
  return r;
}

// ---- Parity with the original 8 node types -------------------------------------------------------------------

describe('parity with the original Run button', () => {
  const persona = n('system', { description: 'You are a reviewer.', output: 'You are a reviewer.' }, 'sys');
  const source = n('prompt', { title: 'Research Notes', description: 'x', output: 'Raft is a consensus algorithm.' }, 'src');
  const source2 = n('data', { title: 'Extra', description: 'd', output: '{"a": 1}' }, 'src2');

  it('system', async () => {
    await expectParity({ nodes: [n('system', { description: 'Be brief.' }, 's1')], edges: [] }, 's1');
    await expectParity({ nodes: [n('system', { description: '' }, 's2')], edges: [] }, 's2');
  });

  it('data: pretty-prints JSON, passes other text through', async () => {
    await expectParity({ nodes: [n('data', { dataPayload: '{"a":1,"b":[1,2]}' }, 'd1')], edges: [] }, 'd1');
    await expectParity({ nodes: [n('data', { dataPayload: 'not json' }, 'd2')], edges: [] }, 'd2');
    await expectParity({ nodes: [n('data', { description: 'fallback text' }, 'd3')], edges: [] }, 'd3');
  });

  it('code', async () => {
    const code = n('code', { codeScript: 'return input.toUpperCase();' }, 'c1');
    await expectParity({ nodes: [source, code], edges: [e('src', 'c1')] }, 'c1');
  });

  it('condition: all four original rules', async () => {
    for (const [rule, value] of [['contains', 'CONSENSUS'], ['not_contains', 'paxos'], ['length_gt', '10'], ['length_gt', 'abc'], ['regex', 'raft\\s+is'], ['regex', '([']] as const) {
      const cond = n('condition', { conditionRule: rule, conditionValue: value }, `cond-${rule}-${value}`);
      await expectParity({ nodes: [source, cond], edges: [e('src', cond.id)] }, cond.id);
    }
  });

  it('merge: concat, bullets, json, synthesize', async () => {
    for (const strategy of ['concat', 'bullets', 'json', 'synthesize'] as const) {
      const m = n('merge', { mergeStrategy: strategy }, `m-${strategy}`);
      await expectParity({ nodes: [persona, source, source2, m], edges: [e('sys', m.id), e('src', m.id), e('src2', m.id)] }, m.id);
    }
  });

  it('evaluation: same prompt; score parsed', async () => {
    const ev = n('evaluation', { evalCriteria: 'code_quality' }, 'ev');
    const d = deps({ callAI: vi.fn(async () => 'SCORE: 91\nFEEDBACK: Solid.') });
    const summary = await runWorkflow({ nodes: [source, ev], edges: [e('src', 'ev')] }, { deps: d, tier: 'free', only: 'ev' });
    const legacy = await legacyRun('ev', { nodes: [source, ev], edges: [e('src', 'ev')] }, deps({ callAI: vi.fn(async () => 'SCORE: 91\nFEEDBACK: Solid.') }));
    expect(summary.results.ev.text).toBe(legacy.output);
    expect(summary.results.ev.score).toBe(91);
    // Same prompt sent: the mock echoes it after a score, so equal text means equal model, system and prompt
    await expectParity({ nodes: [source, ev], edges: [e('src', 'ev')] }, 'ev', 'SCORE: 77\nFEEDBACK: ok');
  });

  it('evaluation: no made-up score when the judge gives none (intentional difference from the old 88)', async () => {
    const ev = n('evaluation', {}, 'ev2');
    const summary = await runWorkflow({ nodes: [source, ev], edges: [e('src', 'ev2')] }, { deps: deps({ callAI: vi.fn(async () => 'Looks fine.') }), tier: 'free', only: 'ev2' });
    expect(summary.results.ev2.score).toBeUndefined();
    expect(summary.results.ev2.text).toBe('Score: not given\nFeedback: Looks fine.');
  });

  it('output', async () => {
    await expectParity({ nodes: [source, n('output', {}, 'o1')], edges: [e('src', 'o1')] }, 'o1');
    await expectParity({ nodes: [n('output', {}, 'o2')], edges: [] }, 'o2');
  });

  it('prompt: persona, upstream context, and {{variables}}', async () => {
    const p1 = n('prompt', { description: 'Summarise this.' }, 'p1');
    await expectParity({ nodes: [persona, source, p1], edges: [e('sys', 'p1'), e('src', 'p1')] }, 'p1');
    const p2 = n('prompt', { description: 'Use {{research}} and {{src}} and {{research_notes}}.' }, 'p2');
    await expectParity({ nodes: [source, p2], edges: [e('src', 'p2')] }, 'p2');
    const p3 = n('prompt', { description: '', title: 'Just a title' }, 'p3');
    await expectParity({ nodes: [p3], edges: [] }, 'p3');
  });

  it('a path turned off by a stored condition result is skipped', async () => {
    const cond = n('condition', { conditionResult: false, output: 'x' }, 'cnd');
    const after = n('output', {}, 'aft');
    const r = await expectParity({ nodes: [cond, after], edges: [e('cnd', 'aft', 'true')] }, 'aft');
    expect(r.text).toBe(LEGACY_SKIP_TEXT);
  });
});

// ---- Whole-graph runs ---------------------------------------------------------------------------------------

describe('runWorkflow', () => {
  it('runs in order, passes outputs forward, and emits events', async () => {
    const data = n('data', { dataPayload: 'hello world' }, 'a');
    const code = n('code', { codeScript: 'return input.toUpperCase();' }, 'b');
    const out = n('output', {}, 'c');
    const events: string[] = [];
    const summary = await runWorkflow({ nodes: [out, code, data], edges: [e('a', 'b'), e('b', 'c')] }, {
      deps: deps(), tier: 'free', onEvent: (ev) => events.push(`${ev.type}${'nodeId' in ev ? `:${ev.nodeId}` : ''}`),
    });
    expect(summary.status).toBe('success');
    expect(summary.order).toEqual(['a', 'b', 'c']);
    expect(summary.results.c.text).toBe('HELLO WORLD');
    expect(events[0]).toBe('run-start');
    expect(events.at(-1)).toBe('run-done');
    expect(events).toContain('node-done:b');
  });

  it('if/else: only the TRUE path runs; the FALSE path is skipped with a reason', async () => {
    const src = n('data', { dataPayload: 'The review is positive' }, 'src');
    const cond = n('condition', { conditionRule: 'contains', conditionValue: 'positive' }, 'cond');
    const yes = n('output', { title: 'Yes' }, 'yes');
    const no = n('output', { title: 'No' }, 'no');
    const after = n('output', { title: 'After no' }, 'afterNo');
    const s = await runWorkflow({ nodes: [src, cond, yes, no, after], edges: [e('src', 'cond'), e('cond', 'yes', 'true'), e('cond', 'no', 'false'), e('no', 'afterNo')] }, { deps: deps(), tier: 'free' });
    expect(s.results.cond.branch).toBe('true');
    expect(s.results.cond.reason).toMatch(/^TRUE: the input contains "positive"/);
    expect(s.results.yes.text).toBe('The review is positive');
    expect(s.results.no.skipped).toBe(true);
    expect(s.results.afterNo.skipped).toBe(true); // nested: everything after a skipped step is skipped
    expect(s.status).toBe('success');
  });

  it('nested if/else with v2 rule groups on JSON fields', async () => {
    const src = n('data', { dataPayload: '{"order": {"total": 120, "country": "IN"}}' }, 'src');
    const big = n('condition', { conditionGroup: { mode: 'all', rules: [{ field: 'order.total', op: 'num_gt', value: '100' }] } }, 'big');
    const india = n('condition', { conditionGroup: { mode: 'any', rules: [{ field: 'order.country', op: 'equals', value: 'in' }, { field: 'order.country', op: 'equals', value: 'us' }] } }, 'india');
    const a = n('output', {}, 'bigIndia');
    const b = n('output', {}, 'bigOther');
    const c = n('output', {}, 'small');
    const s = await runWorkflow({
      nodes: [src, big, india, a, b, c],
      edges: [e('src', 'big'), e('big', 'india', 'true'), e('big', 'small', 'false'), e('india', 'bigIndia', 'true'), e('india', 'bigOther', 'false')],
    }, { deps: deps(), tier: 'free' });
    expect(s.results.big.reason).toContain('`order.total` is 120, which is more than 100');
    expect(s.results.bigIndia.skipped).toBeUndefined();
    expect(s.results.bigOther.skipped).toBe(true);
    expect(s.results.small.skipped).toBe(true);
  });

  it('switch: first matching case wins; default when none match', async () => {
    const make = (payload: string) => {
      const src = n('data', { dataPayload: payload }, 'src');
      const sw = n('switch', { switchField: 'mood', switchCases: [{ id: 'happy', label: 'Happy', op: 'equals', value: 'happy' }, { id: 'sad', label: 'Sad', op: 'equals', value: 'sad' }] }, 'sw');
      const h = n('output', {}, 'h');
      const sd = n('output', {}, 'sd');
      const df = n('output', {}, 'df');
      return { nodes: [src, sw, h, sd, df], edges: [e('src', 'sw'), e('sw', 'h', 'case:happy'), e('sw', 'sd', 'case:sad'), e('sw', 'df', 'default')] };
    };
    const s1 = await runWorkflow(make('{"mood":"sad"}'), { deps: deps(), tier: 'free' });
    expect(s1.results.sw.branch).toBe('case:sad');
    expect(s1.results.sd.skipped).toBeUndefined();
    expect(s1.results.h.skipped).toBe(true);
    expect(s1.results.df.skipped).toBe(true);
    const s2 = await runWorkflow(make('{"mood":"bored"}'), { deps: deps(), tier: 'free' });
    expect(s2.results.sw.branch).toBe('default');
    expect(s2.results.sw.reason).toMatch(/^Default: no case matched/);
    expect(s2.results.df.skipped).toBeUndefined();
  });

  it('For Each over 7 items on Free uses 5 and says so; AI mode calls once per item', async () => {
    const list = n('data', { dataPayload: '["a","b","c","d","e","f","g"]' }, 'list');
    const each = n('forEach', { forEachMode: 'template', forEachTemplate: 'Idea {{index}}: {{item}}' }, 'each');
    const s = await runWorkflow({ nodes: [list, each], edges: [e('list', 'each')] }, { deps: deps(), tier: 'free' });
    expect(JSON.parse(s.results.each.text)).toEqual(['Idea 1: a', 'Idea 2: b', 'Idea 3: c', 'Idea 4: d', 'Idea 5: e']);
    expect(s.results.each.kind).toBe('array');
    expect(s.results.each.meta.itemCount).toBe(5);
    expect(s.results.each.notes?.[0]).toMatch(/first 5 of 7.*plan's limit/);

    const d = deps();
    const ai = n('forEach', { forEachMode: 'ai', forEachTemplate: 'Write a tweet about {{item.name}}' }, 'ai');
    const people = n('data', { dataPayload: '[{"name":"Ada"},{"name":"Linus"}]' }, 'people');
    const s2 = await runWorkflow({ nodes: [people, ai], edges: [e('people', 'ai')] }, { deps: d, tier: 'pro' });
    expect(d.calls.map((c) => c.prompt)).toEqual(['Write a tweet about Ada', 'Write a tweet about Linus']);
    expect(s2.results.ai.meta.aiCalls).toBe(2);
  });

  it('For Each on text that is not a list item per line still works; a JSON object is refused', async () => {
    const text = n('data', { dataPayload: '- milk\n- eggs\n\n- bread' }, 't');
    const each = n('forEach', {}, 'fe');
    const s = await runWorkflow({ nodes: [text, each], edges: [e('t', 'fe')] }, { deps: deps(), tier: 'free' });
    expect(JSON.parse(s.results.fe.text)).toEqual(['milk', 'eggs', 'bread']);

    const obj = n('data', { dataPayload: '{"a":1,"b":2}' }, 'o');
    const fe2 = n('forEach', {}, 'fe2');
    const s2 = await runWorkflow({ nodes: [obj, fe2], edges: [e('o', 'fe2')] }, { deps: deps(), tier: 'free' });
    expect(s2.results.fe2.error?.code).toBe('NOT_A_LIST');
    expect(s2.status).toBe('partial');
  });

  it('List Tools, Pick from JSON, Variable and {{vars.x}}', async () => {
    const src = n('data', { dataPayload: '{"items":[{"t":"b","p":5},{"t":"a","p":30},{"t":"c","p":12}]}' }, 'src');
    const pluck = n('arrayTools', { arrayOp: 'pluck', arrayArg: 'p' }, 'pl');
    const filt = n('arrayTools', { arrayOp: 'filter', arrayArg: '> 10' }, 'fi');
    const sort = n('arrayTools', { arrayOp: 'sort', arrayArg: 'desc' }, 'so');
    const pick = n('jsonPick', { jsonPath: 'items[1].t' }, 'pk');
    const v = n('variable', { variableName: 'best' }, 'v');
    const p = n('prompt', { description: 'Tell me about {{vars.best}}.' }, 'p');
    const d = deps();
    const s = await runWorkflow({
      nodes: [src, pluck, filt, sort, pick, v, p],
      edges: [e('src', 'pl'), e('pl', 'fi'), e('fi', 'so'), e('src', 'pk'), e('pk', 'v'), e('v', 'p')],
    }, { deps: d, tier: 'free' });
    expect(JSON.parse(s.results.so.text)).toEqual([30, 12]);
    expect(s.results.pk.text).toBe('a');
    expect(s.vars.best).toBe('a');
    expect(d.calls[0].prompt).toBe('Tell me about a.');
  });

  it('Ask Me: the answer flows on; cancel stops the run', async () => {
    const ask = n('askInput', { askQuestion: 'Which topic?' }, 'ask');
    const out = n('output', {}, 'out');
    const s = await runWorkflow({ nodes: [ask, out], edges: [e('ask', 'out')] }, { deps: deps(), tier: 'free' });
    expect(s.results.out.text).toBe('my answer');
    const s2 = await runWorkflow({ nodes: [ask, out], edges: [e('ask', 'out')] }, { deps: deps({ askInput: vi.fn(async () => null) }), tier: 'free' });
    expect(s2.status).toBe('cancelled');
    expect(s2.results.out).toBeUndefined();
  });

  it('an error stops only the nodes below it', async () => {
    const good = n('data', { dataPayload: 'fine' }, 'good');
    const bad = n('jsonPick', { jsonPath: 'x' }, 'bad');
    const afterBad = n('output', {}, 'afterBad');
    const other = n('output', {}, 'other');
    const s = await runWorkflow({ nodes: [good, bad, afterBad, other], edges: [e('good', 'bad'), e('bad', 'afterBad'), e('good', 'other')] }, { deps: deps(), tier: 'free' });
    expect(s.results.bad.error?.code).toBe('NOT_JSON');
    expect(s.results.bad.error?.hint).toBeTruthy();
    expect(s.results.afterBad.skipped).toBe(true);
    expect(s.results.afterBad.text).toBe(UPSTREAM_FAILED_SKIP_TEXT);
    expect(s.results.other.text).toBe('fine');
    expect(s.status).toBe('partial');
  });

  it('caps AI calls per run, maps quota errors, and can be stopped', async () => {
    const list = n('data', { dataPayload: '[1,2,3,4,5]' }, 'l');
    const fe = n('forEach', { forEachMode: 'ai' }, 'fe');
    const s = await runWorkflow({ nodes: [list, fe], edges: [e('l', 'fe')] }, { deps: deps(), tier: 'free', limits: { maxAiCalls: 2 } });
    expect(s.results.fe.error?.code).toBe('AI_LIMIT_REACHED');
    expect(s.aiCalls).toBe(2);

    const quota = Object.assign(new Error('limit'), { code: 'FREE_TIER_QUOTA_EXCEEDED' });
    const p = n('prompt', { description: 'hi' }, 'p');
    const s2 = await runWorkflow({ nodes: [p], edges: [] }, { deps: deps({ callAI: vi.fn(async () => { throw quota; }) }), tier: 'free' });
    expect(s2.results.p.error?.code).toBe('QUOTA_EXCEEDED');
    expect(s2.status).toBe('error');

    const ctrl = new AbortController();
    ctrl.abort();
    const s3 = await runWorkflow({ nodes: [p], edges: [] }, { deps: deps(), tier: 'free', signal: ctrl.signal });
    expect(s3.status).toBe('cancelled');
  });

  it('a loop of wires stops the run before anything is called', async () => {
    const a = n('prompt', { description: 'a' }, 'a');
    const b = n('prompt', { description: 'b' }, 'b');
    const d = deps();
    const s = await runWorkflow({ nodes: [a, b], edges: [e('a', 'b'), e('b', 'a')] }, { deps: d, tier: 'free' });
    expect(s.status).toBe('error');
    expect(s.results.a.error?.code).toBe('CYCLE');
    expect(d.calls).toHaveLength(0);
  });

  it('notes never run; startFrom runs a node and everything after it', async () => {
    const note = n('note', { noteText: 'hello' }, 'note');
    const a = n('data', { dataPayload: 'A', output: 'OLD' }, 'a');
    const b = n('code', { codeScript: 'return input + "!";' }, 'b');
    const s = await runWorkflow({ nodes: [note, a, b], edges: [e('a', 'b')] }, { deps: deps(), tier: 'free', startFrom: 'b' });
    expect(s.order).toEqual(['b']);
    expect(s.results.b.text).toBe('OLD!');
    expect(s.results.note).toBeUndefined();
  });

  it('prompt with responseFormat json passes the option and notes invalid JSON', async () => {
    const d = deps({ callAI: vi.fn(async () => 'not json') });
    const p = n('prompt', { description: 'Give JSON', responseFormat: 'json' }, 'p');
    const s = await runWorkflow({ nodes: [p], edges: [] }, { deps: d, tier: 'free' });
    expect((d.callAI as any).mock.calls[0][4]).toEqual({ responseFormat: 'json' });
    expect(s.results.p.notes?.[0]).toMatch(/not valid JSON/);
  });

  it('score_gte reads the nearest Quality Judge above', async () => {
    const src = n('data', { dataPayload: 'text' }, 'src');
    const ev = n('evaluation', {}, 'ev');
    const cond = n('condition', { conditionGroup: { mode: 'all', rules: [{ op: 'score_gte', value: '80' }] } }, 'cond');
    const s = await runWorkflow({ nodes: [src, ev, cond], edges: [e('src', 'ev'), e('ev', 'cond')] }, { deps: deps({ callAI: vi.fn(async () => 'SCORE: 85\nFEEDBACK: ok') }), tier: 'free' });
    expect(s.results.cond.branch).toBe('true');
    expect(s.results.cond.reason).toContain('85');
  });
});

// ---- Pieces --------------------------------------------------------------------------------------------------

describe('conditions', () => {
  const ctx = { regexTest };
  it('every v2 operator', () => {
    const cases: Array<[string, Parameters<typeof evaluateRule>[0], boolean]> = [
      ['Hello World', { op: 'contains', value: 'world' }, true],
      ['Hello', { op: 'not_contains', value: 'x' }, true],
      [' Yes ', { op: 'equals', value: 'yes' }, true],
      ['no', { op: 'not_equals', value: 'yes' }, true],
      ['Error: x', { op: 'starts_with', value: 'error' }, true],
      ['file.json', { op: 'ends_with', value: '.JSON' }, true],
      ['abc123', { op: 'regex', value: '\\d{3}' }, true],
      ['aaaa', { op: 'regex', value: '(a+)+$' }, false],
      ['12345', { op: 'length_gt', value: '4' }, true],
      ['12', { op: 'length_lt', value: '4' }, true],
      ['   ', { op: 'is_empty' }, true],
      ['x', { op: 'not_empty' }, true],
      ['{"a":1}', { op: 'is_json' }, true],
      ['[1,2]', { op: 'is_array' }, true],
      ['42', { op: 'num_gt', value: '41' }, true],
      ['42', { op: 'num_gte', value: '42' }, true],
      ['42', { op: 'num_lt', value: '50' }, true],
      ['42', { op: 'num_lte', value: '42' }, true],
      ['42', { op: 'num_eq', value: '42.0' }, true],
      ['abc', { op: 'num_gt', value: '1' }, false],
      ['15', { op: 'between', value: '20,10' }, true],
      ['[1,2,3]', { op: 'array_length_gt', value: '2' }, true],
      ['a\nb', { op: 'array_length_lt', value: '3' }, true],
      ['["Red","Blue"]', { op: 'array_includes', value: 'blue' }, true],
      ['{"user":{"age":"30"}}', { field: 'user.age', op: 'num_gte', value: '18' }, true],
      ['{"user":{}}', { field: 'user.age', op: 'is_empty' }, true],
      ['not json', { field: 'a', op: 'equals', value: 'x' }, false],
    ];
    for (const [input, rule, expected] of cases) {
      const out = evaluateRule(rule, input, ctx);
      expect(out.passed, `${rule.op} on ${input}`).toBe(expected);
      expect(out.reason.length).toBeGreaterThan(0);
    }
    expect(evaluateRule({ op: 'regex', value: '(a+)+$' }, 'aaa', ctx).problem).toBe('REGEX_UNSAFE');
  });

  it('groups: all / any / empty', () => {
    expect(evaluateGroup({ mode: 'all', rules: [{ op: 'contains', value: 'a' }, { op: 'contains', value: 'z' }] }, 'abc', ctx).passed).toBe(false);
    expect(evaluateGroup({ mode: 'any', rules: [{ op: 'contains', value: 'a' }, { op: 'contains', value: 'z' }] }, 'abc', ctx).passed).toBe(true);
    expect(evaluateGroup({ mode: 'all', rules: [] }, 'abc', ctx).passed).toBe(true);
  });

  it('legacy rule treats an unsafe regex as false', () => {
    expect(evaluateLegacy('regex', '(a+)+$', 'aaaa', ctx)).toMatchObject({ passed: false, problem: 'REGEX_UNSAFE' });
  });
});

describe('lists, paths, templates, kinds', () => {
  it('toList and array ops', () => {
    expect(toList('1. one\n2. two')).toEqual(['one', 'two']);
    expect(toList('{"results":[1,2]}')).toEqual([1, 2]);
    expect(toList('```json\n[1, 2]\n```')).toEqual([1, 2]);
    expect(applyArrayOp('split_by', 'a; b ;c', ';')).toEqual({ ok: true, value: ['a', 'b', 'c'] });
    expect(applyArrayOp('sort', '[10, 9, 100]')).toEqual({ ok: true, value: [9, 10, 100] });
    expect(applyArrayOp('take', '[1,2,3,4]', '2')).toEqual({ ok: true, value: [1, 2] });
    expect(applyArrayOp('unique', '["a","a","b"]')).toEqual({ ok: true, value: ['a', 'b'] });
    expect(applyArrayOp('count', 'a\nb\nc')).toEqual({ ok: true, value: 3 });
    expect(applyArrayOp('join', '["a","b"]', ' + ')).toEqual({ ok: true, value: 'a + b' });
    expect(applyArrayOp('reverse', '[1,2]')).toEqual({ ok: true, value: [2, 1] });
    expect(applyArrayOp('filter', 'apple\nbanana\ncherry', '!an')).toEqual({ ok: true, value: ['apple', 'cherry'] });
    expect(applyArrayOp('count', '{"a":1,"b":2}')).toEqual({ ok: false, code: 'NOT_A_LIST' });
  });

  it('getPath is safe', () => {
    expect(getPath({ a: [{ b: 1 }] }, 'a[0].b')).toEqual({ found: true, value: 1 });
    expect(getPath({ a: 1 }, '$.a')).toEqual({ found: true, value: 1 });
    expect(getPath({}, '__proto__')).toEqual({ found: false, reason: 'bad_path' });
    expect(getPath({}, 'constructor.name')).toEqual({ found: false, reason: 'bad_path' });
    expect(getPath({}, 'toString')).toEqual({ found: false, reason: 'missing' });
    expect(getPath({}, Array(25).fill('a').join('.'))).toEqual({ found: false, reason: 'bad_path' });
  });

  it('templates: legacy names, v2 names, unknown left as written, $ patterns kept literally', () => {
    // "C++" is escaped, so it matches as written (the page code would throw on this title)
    expect(applyLegacyTemplate('{{c++}} {{notes}} {{other}}', [{ id: 'x', title: 'C++ notes', value: 'V$&' }])).toBe('V$& V$& {{other}}');
    expect(applyExtendedTemplate('{{vars.a}} {{vars.zz}} {{item.n}} #{{index}} {{node.x}}', { vars: { a: 'A' }, nodeText: (id) => (id === 'x' ? 'X' : undefined), item: { n: 'N' }, index: 2 }))
      .toBe('A {{vars.zz}} N #2 X');
  });

  it('detectKind', () => {
    expect(detectKind('').kind).toBe('empty');
    expect(detectKind('[1]').kind).toBe('array');
    expect(detectKind('{"a":1}').kind).toBe('json');
    expect(detectKind('42').kind).toBe('number');
    expect(detectKind('true').kind).toBe('boolean');
    expect(detectKind('hello').kind).toBe('text');
    expect(parseEvaluation('SCORE: 150\nFEEDBACK: wow').score).toBe(100);
  });
});

describe('planRun and validateGraph', () => {
  it('orders left to right and finds loops', () => {
    const a = n('data', {}, 'A');
    const b = n('data', {}, 'B');
    const c = n('output', {}, 'C');
    expect(planRun({ nodes: [c, b, a], edges: [e('A', 'C'), e('B', 'C')] })).toMatchObject({ order: ['A', 'B', 'C'], levels: [['A', 'B'], ['C']], cycles: [] });
    expect(planRun({ nodes: [a, b], edges: [e('A', 'B'), e('B', 'A')] }).cycles).toEqual([['A', 'B']]);
    expect(planRun({ nodes: [a], edges: [e('A', 'A')] }).cycles).toEqual([['A']]);
  });

  it('finds the common mistakes in plain English', () => {
    const p = n('prompt', { description: '' }, 'p');
    const o = n('output', {}, 'o');
    const cond = n('condition', {}, 'cond');
    const sw = n('switch', { switchCases: [] }, 'sw');
    const v1 = n('variable', { variableName: 'x' }, 'v1');
    const v2 = n('variable', { variableName: 'x' }, 'v2');
    const bad = n('variable', { variableName: '1 bad' }, 'v3');
    const tpl = n('prompt', { description: 'Use {{vars.missing}} and {{item}}' }, 'tpl');
    const codes = validateGraph({ nodes: [p, o, cond, sw, v1, v2, bad, tpl], edges: [e('p', 'cond')] }, { tier: 'free' }).map((i) => i.code);
    for (const code of ['PROMPT_EMPTY', 'OUTPUT_NO_INPUT', 'CONDITION_NO_PATHS', 'NO_CASES', 'DUPLICATE_VARIABLE', 'BAD_VARIABLE_NAME', 'UNKNOWN_VARIABLE', 'ITEM_OUTSIDE_FOREACH', 'PLAN_NODE_LIMIT', 'LONELY_NODE']) {
      expect(codes).toContain(code);
    }
    const issues = validateGraph({ nodes: [p, o, cond], edges: [] });
    expect(issues.every((i) => i.message && i.fix)).toBe(true);
    expect(validateGraph({ nodes: [], edges: [] })[0].code).toBe('EMPTY');
  });

  it('a clean 3-node free workflow has no errors or warnings', () => {
    const sys = n('system', { description: 'Be kind.' }, 's');
    const p = n('prompt', { description: 'Explain gravity like I am 5.' }, 'p');
    const o = n('output', {}, 'o');
    const issues = validateGraph({ nodes: [sys, p, o], edges: [e('s', 'p'), e('p', 'o')] }, { tier: 'free' });
    expect(issues.filter((i) => i.severity !== 'tip')).toEqual([]);
  });

  it('plan step limits: Free 5, Pro 10, Ultimate 20; notes do not count; desktop can lift the limit', () => {
    const chain = (count: number) => {
      const nodes = Array.from({ length: count }, (_, i) => n('data', { dataPayload: 'x' }, `s${i}`));
      const edges = nodes.slice(1).map((node, i) => e(`s${i}`, node.id));
      return { nodes, edges };
    };
    const over = (g: WorkflowGraph, opts: Parameters<typeof validateGraph>[1]) => validateGraph(g, opts).find((i) => i.code === 'PLAN_NODE_LIMIT');
    for (const [tier, limit] of [['free', 5], ['pro', 10], ['ultimate', 20]] as const) {
      expect(over(chain(limit), { tier }), `${tier} at ${limit}`).toBeUndefined();
      const issue = over(chain(limit + 1), { tier });
      expect(issue?.message).toContain(`up to ${limit}`);
      expect(issue?.message).not.toMatch(/unlimited/i);
    }
    const withNotes = chain(5);
    withNotes.nodes.push(n('note', { noteText: 'a' }, 'note1'), n('note', { noteText: 'b' }, 'note2'));
    expect(over(withNotes, { tier: 'free' })).toBeUndefined();
    expect(over(chain(40), { tier: 'free', limits: { maxNodes: Infinity } })).toBeUndefined();
  });
});
