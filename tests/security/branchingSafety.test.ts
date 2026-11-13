// Branching v2 safety pieces (Security, Wave 1):
//  - src/lib/workflowEngine/safeRegex.ts   : patterns that can freeze the page are refused before they run
//  - src/lib/workflowEngine/importGuard.ts : imported / shared / AI-written workflows are cleaned
//  - src/lib/sandboxedCode.ts + public/sandbox/code-runner.js : 3 s timeout, size caps, JSON output, line numbers
// The browser sandbox itself (opaque origin, CSP) cannot run in Node: the config is checked here and the live
// behaviour was checked in Electron 43 / Chromium 150 (see the HANDOFF entry for the results).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SAFE_REGEX_LIMITS,
  checkRegexPattern,
  explainRegexProblem,
  safeRegexTest,
} from '../../src/lib/workflowEngine/safeRegex';
import { IMPORT_LIMITS, KNOWN_NODE_TYPES, sanitizeWorkflow } from '../../src/lib/workflowEngine/importGuard';

const ROOT = path.resolve(__dirname, '../..');

// ---------------------------------------------------------------------------------------------------------------------
describe('safeRegexTest', () => {
  const REDOS = [
    String.raw`(a+)+$`,
    String.raw`(.*)*x`,
    String.raw`(\w+\s?)*$`,
    String.raw`^(a|aa)+$`,
    String.raw`(a|)*b`,
    String.raw`(\w|\d)+!`,
    String.raw`((a)\2)*b`,
    String.raw`(a{1,3}){10}b`,
    String.raw`.*.*.*=.*`,
    String.raw`\d+\d+$`,
    String.raw`\w+\s*\w+!`,
    String.raw`.*a.*b.*c.*d`,
    String.raw`(.*a){3}`,
    String.raw`.*(.*)x`,
    String.raw`([a-z]+)*=`,
  ];
  const EVIL_TEXT = 'a'.repeat(SAFE_REGEX_LIMITS.textChars) + '!';

  it.each(REDOS)('refuses %s as unsafe in under 50 ms, without running it', (pattern) => {
    const t0 = performance.now();
    const result = safeRegexTest(pattern, EVIL_TEXT);
    const ms = performance.now() - t0;
    expect(result).toEqual({ ok: false, reason: 'unsafe' });
    expect(ms).toBeLessThan(50);
  });

  const COMMON = [
    [String.raw`^\w+@\w+\.\w+$`, 'me@example.com', true],
    [String.raw`(\d{1,3}\.){3}\d{1,3}`, 'ip 10.0.0.1 here', true],
    ['(foo|bar)+', 'xxbarfoo', true],
    [String.raw`\bcat\b`, 'concatenate', false],
    [String.raw`[a-z]+\d+`, 'abc123', true],
    ['^(yes|no)$', 'YES', true],
    ['colou?r', 'Colour', true],
    [String.raw`(?<year>\d{4})-\d{2}`, '2026-11', true],
    [String.raw`\s+$`, 'trailing   ', true],
    ['foo.*bar', 'foo and bar', true],
    ['[^,]+,[^,]+', 'a,b', true],
    ['x{2,3', 'x{2,3', true],
  ] as const;

  it.each(COMMON)('runs the everyday pattern %s', (pattern, text, matched) => {
    expect(checkRegexPattern(pattern)).toEqual({ ok: true });
    expect(safeRegexTest(pattern, text)).toEqual({ ok: true, matched });
  });

  it('stays fast for everyday patterns on the longest allowed text', () => {
    const long = 'word '.repeat(SAFE_REGEX_LIMITS.textChars / 5) + '!';
    for (const [pattern] of COMMON) {
      if (pattern === 'foo.*bar' || pattern === '[^,]+,[^,]+') continue; // one open "almost anything" repeat: below
      const t0 = performance.now();
      safeRegexTest(pattern, long);
      expect(performance.now() - t0, pattern).toBeLessThan(250);
    }
  });

  it('accepted worst case: one open "almost anything" repeat on 50,000 characters is slow but finishes (about 1 s)', () => {
    // Known limit, documented in safeRegex.ts: a backtracking engine is quadratic here. It is a pause, not a freeze.
    const long = 'word '.repeat(SAFE_REGEX_LIMITS.textChars / 5);
    for (const pattern of ['[^,]+,[^,]+', '.*x', 'a.*b.*c']) {
      const t0 = performance.now();
      expect(safeRegexTest(pattern, long).ok).toBe(true);
      expect(performance.now() - t0, pattern).toBeLessThan(10000);
    }
  }, 20000);

  it('is always case-insensitive', () => {
    expect(safeRegexTest('HELLO', 'say hello')).toEqual({ ok: true, matched: true });
    expect(safeRegexTest('[A-Z]+', 'abc')).toEqual({ ok: true, matched: true });
  });

  it('checks at most 50,000 characters of text', () => {
    const text = 'a'.repeat(SAFE_REGEX_LIMITS.textChars) + 'needle';
    expect(safeRegexTest('needle', text)).toEqual({ ok: true, matched: false });
    expect(safeRegexTest('needle', 'a'.repeat(100) + 'needle')).toEqual({ ok: true, matched: true });
  });

  it('refuses patterns over 200 characters and broken patterns', () => {
    expect(safeRegexTest('a'.repeat(SAFE_REGEX_LIMITS.patternChars + 1), 'a')).toEqual({ ok: false, reason: 'too_long' });
    expect(safeRegexTest('a'.repeat(SAFE_REGEX_LIMITS.patternChars), 'a'.repeat(200))).toEqual({ ok: true, matched: true });
    for (const bad of ['(', '[a-', '*a', 'a{2}{3}', '(?<n>a)\\k<m>']) {
      expect(safeRegexTest(bad, 'a'), bad).toEqual({ ok: false, reason: 'invalid' });
    }
    expect(safeRegexTest(42 as unknown as string, 'a')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('does not keep state between calls (no lastIndex surprises)', () => {
    for (let i = 0; i < 3; i += 1) expect(safeRegexTest('abc', 'xxabc')).toEqual({ ok: true, matched: true });
  });

  it('explains every refusal in plain English', () => {
    expect(explainRegexProblem('unsafe')).toBe('This pattern could freeze the page. Try a simpler one.');
    expect(explainRegexProblem('too_long')).toMatch(/too long.*200/);
    expect(explainRegexProblem('invalid')).toMatch(/not valid/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
const node = (id: string, nodeType: string, data: Record<string, unknown> = {}) => ({
  id,
  type: 'genericNode',
  position: { x: 10, y: 20 },
  data: { title: `${nodeType} step`, description: 'hello', nodeType, status: 'success', ...data },
});
const edge = (id: string, source: string, target: string, extra: Record<string, unknown> = {}) => ({
  id, source, target, type: 'deletableEdge', animated: true, style: { stroke: '#ff9b71', strokeWidth: 2 }, ...extra,
});

function allKeys(value: unknown, out: string[] = []): string[] {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      out.push(key);
      allKeys((value as Record<string, unknown>)[key], out);
    }
  }
  return out;
}

describe('sanitizeWorkflow', () => {
  afterEach(() => {
    delete (Object.prototype as Record<string, unknown>).polluted;
  });

  it('keeps an ordinary saved workflow intact', () => {
    const raw = {
      nodes: [
        node('node-sys', 'system', { systemPersona: 'Be brief', agentId: 'a1', modelId: 'groq/llama' }),
        node('node-p', 'prompt', { responseFormat: 'json' }),
        node('node-c', 'condition', { conditionRule: 'regex', conditionValue: 'yes|no' }),
        node('node-o', 'output', { outputFormat: 'markdown' }),
      ],
      edges: [edge('e1', 'node-sys', 'node-p'), edge('e2', 'node-p', 'node-c'), edge('e3', 'node-c', 'node-o', { sourceHandle: 'true' })],
    };
    const r = sanitizeWorkflow(raw, { source: 'file' });
    expect(r.ok).toBe(true);
    expect(r.dropped).toBe(0);
    expect(r.warnings).toEqual([]);
    expect(r.hasCode).toBe(false);
    expect(r.nodes.map((n) => n.id)).toEqual(['node-sys', 'node-p', 'node-c', 'node-o']);
    expect(r.nodes[0]).toEqual({
      id: 'node-sys',
      type: 'genericNode',
      position: { x: 10, y: 20 },
      data: { nodeType: 'system', status: 'idle', title: 'system step', description: 'hello', agentId: 'a1', modelId: 'groq/llama', systemPersona: 'Be brief' },
    });
    expect(r.nodes[2].data).toMatchObject({ conditionRule: 'regex', conditionValue: 'yes|no' });
    expect(r.edges[2]).toEqual({ id: 'e3', source: 'node-c', target: 'node-o', sourceHandle: 'true', type: 'deletableEdge', animated: true, style: { stroke: '#ff9b71', strokeWidth: 2 } });
  });

  it('accepts all 15 node types and the new v2 fields', () => {
    expect(KNOWN_NODE_TYPES).toHaveLength(15);
    const raw = {
      nodes: [
        node('s', 'switch', { switchField: 'kind', switchCases: [{ id: 'a', label: 'A', op: 'equals', value: 'x' }, { id: 'a', label: 'dupe', op: 'equals' }, { id: 'b', op: 'drop_table' }] }),
        node('f', 'forEach', { forEachMode: 'template', forEachTemplate: '- {{item}}', forEachMaxItems: 5000 }),
        node('l', 'arrayTools', { arrayOp: 'split_lines', arrayArg: '\n' }),
        node('j', 'jsonPick', { jsonPath: 'items[0].title', jsonFallback: 'none' }),
        node('v', 'variable', { variableName: 'topic_1' }),
        node('bad-var', 'variable', { variableName: '__proto__.x' }),
        node('ask', 'askInput', { askQuestion: 'Which topic?', askDefault: 'AI' }),
        node('n', 'note', { noteText: 'remember', noteColor: 'pink' }),
        node('c2', 'condition', { conditionGroup: { mode: 'any', rules: [{ field: 'a.b', op: 'num_gt', value: '3' }, { op: 'eval' }] } }),
      ],
      edges: [],
    };
    const r = sanitizeWorkflow(raw, { source: 'file' });
    expect(r.ok).toBe(true);
    const byId = Object.fromEntries(r.nodes.map((n) => [n.id, n.data]));
    expect(byId.s.switchCases).toEqual([{ id: 'a', label: 'A', op: 'equals', value: 'x' }]);
    expect(byId.f.forEachMaxItems).toBe(1000);
    expect(byId.v.variableName).toBe('topic_1');
    expect(byId['bad-var'].variableName).toBeUndefined();
    expect(byId.n).toMatchObject({ noteText: 'remember', noteColor: 'pink' });
    expect(byId.c2.conditionGroup).toEqual({ mode: 'any', rules: [{ field: 'a.b', op: 'num_gt', value: '3' }] });
    expect(r.warnings.some((w) => /not allowed/.test(w))).toBe(true);
  });

  it('removes __proto__, constructor and prototype keys at any depth (JSON text and objects)', () => {
    const text = JSON.stringify({
      nodes: [node('a', 'prompt'), node('b', 'output')],
      edges: [edge('e', 'a', 'b')],
    })
      .replace('"nodes":', '"__proto__":{"polluted":"top"},"constructor":{"prototype":{"polluted":"ctor"}},"nodes":')
      .replace('"title":', '"__proto__":{"polluted":"data"},"title":')
      .replace('"position":', '"prototype":{"polluted":1},"position":')
      .replace('"style":', '"__proto__":{"polluted":"edge"},"style":');
    expect(text.match(/__proto__/g)?.length).toBe(3);
    const r = sanitizeWorkflow(text, { source: 'share' });
    expect(r.ok).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(allKeys(r)).not.toEqual(expect.arrayContaining(['__proto__']));
    expect(allKeys(r).filter((k) => k === '__proto__' || k === 'constructor' || k === 'prototype')).toEqual([]);
    for (const n of r.nodes) {
      expect(Object.getPrototypeOf(n)).toBe(Object.prototype);
      expect(Object.getPrototypeOf(n.data)).toBe(Object.prototype);
    }
    expect(r.warnings.join(' ')).toMatch(/hidden fields/);
    // Also when the caller passes an already-parsed object with an own "__proto__" key
    const parsed = JSON.parse('{"nodes":[{"id":"x","data":{"nodeType":"prompt","__proto__":{"polluted":true}}}],"edges":[]}');
    const r2 = sanitizeWorkflow(parsed, { source: 'file' });
    expect(r2.nodes[0].data).not.toHaveProperty('polluted');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('drops Code nodes (and their connections) from AI-written workflows', () => {
    const raw = {
      nodes: [node('p', 'prompt'), node('code1', 'code', { codeScript: 'return fetch("https://evil.example")' }), node('o', 'output')],
      edges: [edge('e1', 'p', 'code1'), edge('e2', 'code1', 'o'), edge('e3', 'p', 'o')],
    };
    const r = sanitizeWorkflow(raw, { source: 'ai' });
    expect(r.ok).toBe(true);
    expect(r.nodes.map((n) => n.data.nodeType)).toEqual(['prompt', 'output']);
    expect(r.edges.map((e) => e.id)).toEqual(['e3']);
    expect(r.hasCode).toBe(false);
    expect(r.dropped).toBe(3);
    expect(r.warnings.join(' ')).toMatch(/Code node.*never include custom code/);
    expect(JSON.stringify(r)).not.toContain('evil.example');
  });

  it('keeps Code nodes from a share link or file but flags hasCode', () => {
    const raw = { nodes: [node('code1', 'code', { codeScript: 'return input;' })], edges: [] };
    const shared = sanitizeWorkflow(raw, { source: 'share' });
    expect(shared.hasCode).toBe(true);
    expect(shared.nodes[0].data.codeScript).toBe('return input;');
    expect(shared.warnings.join(' ')).toMatch(/custom code from someone else/);
    expect(sanitizeWorkflow(raw, { source: 'file' }).hasCode).toBe(true);
    // An unknown source is treated like AI (the strictest)
    expect(sanitizeWorkflow(raw, { source: 'other' as never }).hasCode).toBe(false);
  });

  it('drops unknown node types and non-object entries with a warning', () => {
    const raw = { nodes: [node('a', 'prompt'), node('b', 'shellExec'), null, 'x', [1], { id: 'c' }], edges: [edge('e', 'a', 'b')] };
    const r = sanitizeWorkflow(raw, { source: 'file' });
    expect(r.nodes.map((n) => n.id)).toEqual(['a']);
    expect(r.edges).toEqual([]);
    expect(r.dropped).toBe(6);
    expect(r.warnings.join(' ')).toMatch(/unknown type \("shellExec"\)/);
  });

  it('makes ids unique, caps them at 100 characters and removes connections to missing nodes', () => {
    const longId = 'n'.repeat(300);
    const raw = {
      nodes: [node('dup', 'prompt'), node('dup', 'output'), node(longId, 'data'), { ...node('', 'note'), id: undefined }],
      edges: [edge('e', 'dup', longId), edge('e', 'dup', 'ghost'), edge('e2', 'ghost', 'dup')],
    };
    const r = sanitizeWorkflow(raw, { source: 'file' });
    const ids = r.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['dup', 'dup-2', 'n'.repeat(100), 'node-imported-4']);
    expect(ids.every((id) => id.length <= IMPORT_LIMITS.idChars)).toBe(true);
    expect(r.edges).toEqual([expect.objectContaining({ id: 'e', source: 'dup', target: 'n'.repeat(100) })]);
  });

  it('keeps only known data fields, with the right types', () => {
    const raw = {
      nodes: [node('a', 'prompt', {
        dangerouslySetInnerHTML: { __html: '<img src=x onerror=alert(1)>' },
        onClick: 'alert(1)',
        modelId: { toString: 'x' },
        mergeStrategy: 'rm -rf',
        title: 7,
      })],
      edges: [edge('e', 'a', 'a', { sourceHandle: '"><script>', style: { stroke: 'url(javascript:alert(1))', strokeWidth: 999 }, data: { x: 1 } })],
    };
    const r = sanitizeWorkflow(raw, { source: 'file' });
    expect(Object.keys(r.nodes[0].data).sort()).toEqual(['description', 'nodeType', 'status', 'title']);
    expect(r.nodes[0].data.title).toBe('prompt');
    expect(r.edges[0]).toEqual({ id: 'e', source: 'a', target: 'a', type: 'deletableEdge', animated: true, style: { strokeWidth: 20 } });
  });

  it('resets run results for shared and AI graphs, keeps them for your own file', () => {
    const raw = { nodes: [node('a', 'evaluation', { output: 'secret answer', evalScore: 9, evalCritique: 'ok', conditionResult: true, result: { value: 1 } })], edges: [] };
    const shared = sanitizeWorkflow(raw, { source: 'share' }).nodes[0].data;
    expect(shared).not.toHaveProperty('output');
    expect(shared).not.toHaveProperty('evalScore');
    expect(shared).not.toHaveProperty('result');
    expect(shared.status).toBe('idle');
    const own = sanitizeWorkflow(raw, { source: 'file' }).nodes[0].data;
    expect(own).toMatchObject({ output: 'secret answer', evalScore: 9, evalCritique: 'ok', conditionResult: true, status: 'idle' });
    expect(own).not.toHaveProperty('result');
  });

  it('caps description and codeScript at 20,000 and dataPayload at 100,000 characters', () => {
    const raw = {
      nodes: [node('a', 'code', { description: 'd'.repeat(30_000), codeScript: 'c'.repeat(30_000) }), node('b', 'data', { dataPayload: 'p'.repeat(150_000) })],
      edges: [],
    };
    const r = sanitizeWorkflow(raw, { source: 'file' });
    expect(r.ok).toBe(true);
    expect((r.nodes[0].data.description as string).length).toBe(20_000);
    expect((r.nodes[0].data.codeScript as string).length).toBe(20_000);
    expect((r.nodes[1].data.dataPayload as string).length).toBe(100_000);
    expect(r.warnings.join(' ')).toMatch(/Shortened text/);
  });

  it('refuses a graph over 500,000 characters', () => {
    const nodes = Array.from({ length: 6 }, (_, i) => node(`d${i}`, 'data', { dataPayload: 'x'.repeat(99_000) }));
    const r = sanitizeWorkflow({ nodes, edges: [] }, { source: 'file' });
    expect(r.ok).toBe(false);
    expect(r.nodes).toEqual([]);
    expect(r.edges).toEqual([]);
    expect(r.warnings[0]).toMatch(/too large/);
    // Just under the limit is fine
    expect(sanitizeWorkflow({ nodes: nodes.slice(0, 4), edges: [] }, { source: 'file' }).ok).toBe(true);
  });

  it('refuses huge files, too many nodes and things that are not a workflow, without throwing', () => {
    expect(sanitizeWorkflow('x'.repeat(IMPORT_LIMITS.rawTextChars + 1), { source: 'file' }).ok).toBe(false);
    const many = { nodes: Array.from({ length: IMPORT_LIMITS.maxNodes + 1 }, (_, i) => node(`n${i}`, 'note')), edges: [] };
    expect(sanitizeWorkflow(many, { source: 'file' }).ok).toBe(false);
    for (const bad of [null, undefined, 42, 'not json', '[]', [], { nodes: 'x' }, { nodes: [], edges: {} }]) {
      const r = sanitizeWorkflow(bad, { source: 'file' });
      expect(r.ok).toBe(false);
      expect(r.warnings).toHaveLength(1);
    }
  });

  it('survives deeply nested junk', () => {
    let deep: Record<string, unknown> = { end: true };
    for (let i = 0; i < 5000; i += 1) deep = { d: deep };
    const r = sanitizeWorkflow({ nodes: [{ ...node('a', 'prompt'), junk: deep }], edges: [] }, { source: 'file' });
    expect(r.ok).toBe(true);
    expect(r.nodes[0]).not.toHaveProperty('junk');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// public/sandbox/code-runner.js, the script inside the sandboxed iframe

const runnerSource = fs.readFileSync(path.join(ROOT, 'public/sandbox/code-runner.js'), 'utf-8');

function loadRunner(extra: Record<string, unknown> = {}) {
  const posted: any[] = [];
  let handler: ((e: any) => void) | null = null;
  const parent = { postMessage: (msg: any) => posted.push(msg) };
  const win: any = { parent, addEventListener: (_t: string, fn: any) => { handler = fn; } };
  vm.runInNewContext(runnerSource, { window: win, JSON, String, ...extra });
  const run = (id: string, script: string, input: unknown = '') => handler!({ source: parent, data: { type: 'bedrock-code-run', id, script, input } });
  return { posted, run };
}

/** Fake Worker for the vm: runs the worker source in its own context, like a real worker would. */
function workerEnv(opts: { blocked?: boolean } = {}) {
  const blobs: string[] = [];
  const workers: any[] = [];
  class FakeWorker {
    onmessage: ((e: any) => void) | null = null;
    onerror: ((e: any) => void) | null = null;
    terminated = false;
    constructor(public url: string) { workers.push(this); }
    terminate() { this.terminated = true; }
    postMessage(data: any) {
      if (opts.blocked) {
        this.onerror?.({ message: 'Refused to create a worker (CSP)', preventDefault() {} });
        return;
      }
      const self: any = { postMessage: (reply: any) => this.onmessage?.({ data: reply }) };
      vm.runInNewContext(blobs[0], { self, JSON, String });
      self.onmessage({ data });
    }
  }
  const env = {
    Worker: FakeWorker,
    Blob: class { constructor(parts: string[]) { blobs.push(parts.join('')); } },
    URL: { createObjectURL: () => 'blob:null/1' },
  };
  return { env, workers, blobs };
}

describe('sandbox runner (inside the frame)', () => {
  it('returns arrays, objects and numbers as JSON text, strings unchanged', () => {
    const { posted, run } = loadRunner();
    run('a', 'return input.split(",");', 'x,y');
    run('b', 'return { n: 1 };');
    run('c', 'return 42;');
    run('d', 'return true;');
    run('e', 'return "plain";');
    expect(posted.map((p) => p.output)).toEqual([JSON.stringify(['x', 'y'], null, 2), JSON.stringify({ n: 1 }, null, 2), '42', 'true', 'plain']);
    for (const out of posted.slice(0, 4)) expect(() => JSON.parse(out.output)).not.toThrow();
  });

  it('cuts output at 100,000 characters', () => {
    const { posted, run } = loadRunner();
    run('big', 'return "x".repeat(250000);');
    expect(posted[0].ok).toBe(true);
    expect(posted[0].output.length).toBe(100_000);
    expect(posted[0].output).toMatch(/\[Output cut: it was longer than 100,000 characters\]$/);
  });

  it('reports the line number of a runtime error, and syntax errors by name', () => {
    const { posted, run } = loadRunner();
    run('l3', 'var a = 1;\nvar b = 2;\nnotDefinedHere();');
    run('l1', 'throw new Error("boom")');
    run('syn', 'return (;');
    expect(posted[0]).toMatchObject({ ok: false, error: 'notDefinedHere is not defined', errorName: 'ReferenceError', line: 3 });
    expect(posted[1]).toMatchObject({ ok: false, error: 'boom', line: 1 });
    expect(posted[2]).toMatchObject({ ok: false, errorName: 'SyntaxError' });
  });

  it('runs each script in its own worker when the CSP allows it, and the worker code stands alone', () => {
    const { env, workers, blobs } = workerEnv();
    const { posted, run } = loadRunner(env);
    run('w1', 'return input * 2;', 21);
    run('w2', 'var x = 1;\nthrow new TypeError("bad");');
    expect(workers).toHaveLength(2);
    expect(workers.every((w) => w.terminated)).toBe(true);
    expect(blobs).toHaveLength(1); // one blob URL, reused
    expect(posted[0]).toMatchObject({ id: 'w1', ok: true, output: '42' });
    expect(posted[1]).toMatchObject({ id: 'w2', ok: false, error: 'bad', errorName: 'TypeError', line: 2 });
  });

  it('falls back to running in the frame when the CSP blocks the worker (the script runs exactly once)', () => {
    const { env, workers } = workerEnv({ blocked: true });
    const { posted, run } = loadRunner(env);
    run('f1', 'return "ran";');
    run('f2', 'return "again";');
    expect(posted.map((p) => p.output)).toEqual(['ran', 'again']);
    expect(workers).toHaveLength(1); // after the first refusal it stops trying
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// src/lib/sandboxedCode.ts, the page side, with a small fake DOM

function fakeDom() {
  const frames: any[] = [];
  const listeners: ((e: any) => void)[] = [];
  const win: any = {
    location: { origin: 'https://bedrockxai.com' },
    addEventListener: (type: string, fn: any) => { if (type === 'message') listeners.push(fn); },
  };
  const doc: any = {
    createElement: () => {
      const handlers: Record<string, (() => void)[]> = {};
      const el: any = {
        attrs: {} as Record<string, string>,
        style: {},
        posted: [] as any[],
        removed: false,
        setAttribute(k: string, v: string) { this.attrs[k] = v; },
        addEventListener(t: string, fn: () => void) { (handlers[t] ||= []).push(fn); },
        fire(t: string) { (handlers[t] || []).splice(0).forEach((fn) => fn()); },
        remove() { this.removed = true; },
      };
      el.contentWindow = { postMessage: (m: any, origin: string) => el.posted.push({ m, origin }) };
      frames.push(el);
      return el;
    },
    body: { appendChild: () => undefined },
  };
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  const reply = (frame: any, data: any, source = frame.contentWindow) => listeners.forEach((fn) => fn({ source, data }));
  return { frames, reply };
}

async function loadSandbox() {
  vi.resetModules();
  return import('../../src/lib/sandboxedCode');
}

function track<T>(p: Promise<T>) {
  const state: { settled: boolean; value?: T; error?: Error } = { settled: false };
  p.then((v) => { state.settled = true; state.value = v; }, (e) => { state.settled = true; state.error = e; });
  return state;
}

describe('sandboxedCode.ts (page side)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('uses an opaque-origin frame (sandbox="allow-scripts" only) and sends only the script and its input', async () => {
    vi.useFakeTimers();
    const { frames, reply } = fakeDom();
    const { runSandboxedCode } = await loadSandbox();
    const job = track(runSandboxedCode('return input;', 'hi'));
    expect(frames[0].attrs.sandbox).toBe('allow-scripts');
    expect(frames[0].src).toBe('https://bedrockxai.com/sandbox/code-runner.html');
    frames[0].fire('load');
    await vi.advanceTimersByTimeAsync(0);
    expect(frames[0].posted).toHaveLength(1);
    const { m, origin } = frames[0].posted[0];
    expect(Object.keys(m).sort()).toEqual(['id', 'input', 'script', 'type']);
    expect(m).toMatchObject({ type: 'bedrock-code-run', script: 'return input;', input: 'hi' });
    expect(m.id).toMatch(/^[0-9a-f]{16}$/);
    expect(origin).toBe('*');
    // A reply from anything other than the frame is ignored
    reply(frames[0], { type: 'bedrock-code-result', id: m.id, ok: true, output: 'forged' }, { postMessage() {} });
    await vi.advanceTimersByTimeAsync(0);
    expect(job.settled).toBe(false);
    reply(frames[0], { type: 'bedrock-code-result', id: m.id, ok: true, output: 'hi' });
    await vi.advanceTimersByTimeAsync(0);
    expect(job.value).toBe('hi');
  });

  it('stops a script after 3 seconds, removes the frame and starts a fresh one for the next run', async () => {
    vi.useFakeTimers();
    const { frames, reply } = fakeDom();
    const { runSandboxedCode, SANDBOX_LIMITS } = await loadSandbox();
    expect(SANDBOX_LIMITS.timeoutMs).toBe(3000);
    const stuck = track(runSandboxedCode('while (true) {}', ''));
    frames[0].fire('load');
    await vi.advanceTimersByTimeAsync(2999);
    expect(stuck.settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(stuck.error?.message).toBe('Your script took longer than 3 seconds and was stopped.');
    expect(frames[0].removed).toBe(true);

    const next = track(runSandboxedCode('return 1', ''));
    expect(frames).toHaveLength(2);
    frames[1].fire('load');
    await vi.advanceTimersByTimeAsync(0);
    reply(frames[1], { type: 'bedrock-code-result', id: frames[1].posted[0].m.id, ok: true, output: '1' });
    await vi.advanceTimersByTimeAsync(0);
    expect(next.value).toBe('1');
  });

  it('does not wait forever when the frame never loads (a stuck earlier script)', async () => {
    vi.useFakeTimers();
    const { frames } = fakeDom();
    const { runSandboxedCode } = await loadSandbox();
    const job = track(runSandboxedCode('return 1', ''));
    await vi.advanceTimersByTimeAsync(3000);
    expect(job.error?.message).toMatch(/did not start.*Reload the page/);
    expect(frames[0].removed).toBe(true);
  });

  it('rejects other runs that were waiting on a removed frame instead of leaving them hanging', async () => {
    vi.useFakeTimers();
    const { frames } = fakeDom();
    const { runSandboxedCode } = await loadSandbox();
    const first = track(runSandboxedCode('while (true) {}', ''));
    frames[0].fire('load');
    await vi.advanceTimersByTimeAsync(1000);
    const second = track(runSandboxedCode('return 2', '', 10_000));
    await vi.advanceTimersByTimeAsync(2000);
    expect(first.error?.message).toMatch(/longer than 3 seconds/);
    expect(second.error?.message).toMatch(/another script took too long/);
  });

  it('refuses input over 200,000 characters before starting the sandbox', async () => {
    const { frames } = fakeDom();
    const { runSandboxedCode } = await loadSandbox();
    await expect(runSandboxedCode('return input', 'x'.repeat(200_001))).rejects.toThrow(/too long/);
    await expect(runSandboxedCode('return input', { big: 'x'.repeat(200_001) })).rejects.toThrow(/too long/);
    expect(frames).toHaveLength(0);
  });

  it('cuts output at 100,000 characters and adds the line number to errors', async () => {
    vi.useFakeTimers();
    const { frames, reply } = fakeDom();
    const { runSandboxedCode } = await loadSandbox();
    const big = track(runSandboxedCode('a', ''));
    const err = track(runSandboxedCode('b', ''));
    const syn = track(runSandboxedCode('c', ''));
    frames[0].fire('load');
    await vi.advanceTimersByTimeAsync(0);
    const [a, b, c] = frames[0].posted.map((p: any) => p.m.id);
    reply(frames[0], { type: 'bedrock-code-result', id: a, ok: true, output: 'y'.repeat(300_000) });
    reply(frames[0], { type: 'bedrock-code-result', id: b, ok: false, error: 'x is not defined', line: 3 });
    reply(frames[0], { type: 'bedrock-code-result', id: c, ok: false, error: 'Unexpected token', errorName: 'SyntaxError' });
    await vi.advanceTimersByTimeAsync(0);
    expect(big.value?.length).toBe(100_000);
    expect(err.error?.message).toBe('x is not defined (line 3 of your script)');
    expect(syn.error?.message).toBe('Syntax error: Unexpected token');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('sandbox isolation config', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf-8'));
  const sandboxRule = vercel.headers.find((h: any) => h.source === '/sandbox/(.*)');
  const csp: string = sandboxRule.headers.find((h: any) => h.key === 'Content-Security-Policy').value;
  const directives = Object.fromEntries(csp.split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));

  it('the website sandbox CSP blocks all network and frames', () => {
    expect(directives['default-src']).toEqual(["'none'"]);
    for (const d of ['connect-src', 'img-src', 'form-action', 'frame-src', 'child-src', 'media-src', 'font-src', 'style-src']) {
      expect(directives[d], d).toBeUndefined(); // falls back to default-src 'none' (form-action is not needed: no allow-forms)
    }
    expect(directives['script-src']).toEqual(["'self'", "'unsafe-eval'"]);
    expect(directives['worker-src'] ?? ["blob:"]).toEqual(['blob:']); // only blob workers, if any
    // The site-wide rule (with Clerk, API hosts) does not apply to /sandbox/
    expect(vercel.headers[0].source).toBe('/((?!sandbox/).*)');
  });

  it('the desktop app serves the sandbox with default-src none too', () => {
    const main = fs.readFileSync(path.join(ROOT, 'dist-electron/main.js'), 'utf-8');
    expect(main).toMatch(/pathname\.startsWith\("\/sandbox\/"\)[\s\S]{0,300}return `default-src 'none'; script-src \$\{own\} 'unsafe-eval'/);
  });

  it('the frame is never given allow-same-origin, and only the runner script is loaded', () => {
    const lib = fs.readFileSync(path.join(ROOT, 'src/lib/sandboxedCode.ts'), 'utf-8');
    expect(lib).toContain("el.setAttribute('sandbox', 'allow-scripts');");
    expect(lib).not.toMatch(/allow-same-origin|allow-top-navigation|allow-popups|allow-forms/);
    const html = fs.readFileSync(path.join(ROOT, 'public/sandbox/code-runner.html'), 'utf-8');
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html).toContain('<script src="/sandbox/code-runner.js"></script>');
    expect(runnerSource).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB|fetch\(|XMLHttpRequest/);
  });
});
