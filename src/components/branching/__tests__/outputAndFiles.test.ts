import { describe, it, expect } from 'vitest';
import { explainNodeError } from '../friendlyError';
import { buildDownload, describeKind, parseOutput, toTable } from '../resultFormat';
import { IMPORT_ENABLED, buildWorkflowFile, parseWorkflowFile, workflowFileName } from '../workflowFile';

describe('friendly node errors', () => {
  it('explains a key problem and points to Settings', () => {
    const e = explainNodeError('Invalid API key provided (401)', 'prompt');
    expect(e.title).toMatch(/key/i);
    expect(e.fix).toMatch(/Settings/);
  });

  it('explains usage limits and suggests another model', () => {
    const e = explainNodeError('Free accounts can generate up to 10 prompts per 5 hours. 429', 'prompt');
    expect(e.title).toMatch(/limit/i);
    expect(e.fix).toMatch(/model/i);
  });

  it('explains a declined custom-code prompt', () => {
    const e = explainNodeError('Code node was not run because you chose not to allow custom code.', 'code');
    expect(e.title).toMatch(/not allowed/i);
    expect(e.fix).toMatch(/trust/i);
  });

  it('explains script errors', () => {
    const e = explainNodeError('Code execution error: foo is not defined', 'code');
    expect(e.title).toMatch(/script/i);
    expect(e.fix).toMatch(/return/);
  });

  it('falls back to the node type\'s own fix line', () => {
    const e = explainNodeError('Something odd happened', 'condition');
    expect(e.fix).toMatch(/Run the step before it first/);
    expect(e.message).toBe('Something odd happened');
  });

  it('copes with an empty message and cuts very long ones', () => {
    expect(explainNodeError('', 'output').message).toBeTruthy();
    expect(explainNodeError('x'.repeat(2000), 'prompt').message.length).toBeLessThanOrEqual(220);
  });

  it('keeps only the first line and drops a trailing JSON blob', () => {
    const e = explainNodeError('Provider said no {"error":{"code":42,"detail":"long"}}\nstack trace line', 'prompt');
    expect(e.message).toBe('Provider said no');
  });
});

describe('result viewer helpers', () => {
  it('recognises the kinds the plan lists', () => {
    expect(parseOutput('').kind).toBe('empty');
    expect(parseOutput('   ').kind).toBe('empty');
    expect(parseOutput('hello there').kind).toBe('text');
    expect(parseOutput('42').kind).toBe('number');
    expect(parseOutput('-3.5').kind).toBe('number');
    expect(parseOutput('true').kind).toBe('boolean');
    expect(parseOutput('[1,2,3]').kind).toBe('array');
    expect(parseOutput('{"a":1}').kind).toBe('json');
    expect(parseOutput('{not json').kind).toBe('text');
    expect(parseOutput(undefined).kind).toBe('empty');
  });

  it('labels outputs for the badge', () => {
    expect(describeKind(parseOutput('[1,2,3,4,5,6,7]'))).toBe('List (7)');
    expect(describeKind(parseOutput('{"a":1}'))).toBe('JSON');
    expect(describeKind(parseOutput('false'))).toBe('Yes/No');
    expect(describeKind(parseOutput('7'))).toBe('Number');
    expect(describeKind(parseOutput('words'))).toBe('Text');
  });

  it('builds a table only from a list of objects', () => {
    const table = toTable([{ id: 1, name: 'A' }, { id: 2, name: 'B', extra: { x: 1 } }]);
    expect(table?.columns).toEqual(['id', 'name', 'extra']);
    expect(table?.rows[1]).toEqual(['2', 'B', '{"x":1}']);
    expect(table?.rows[0]).toEqual(['1', 'A', '']);
    expect(toTable([1, 2, 3])).toBeNull();
    expect(toTable([])).toBeNull();
    expect(toTable({ a: 1 })).toBeNull();
    expect(toTable([{ a: 1 }, 'x'])).toBeNull();
  });

  it('prepares downloads with safe file names', () => {
    const txt = buildDownload('hello', 'txt', 'My Result / 1');
    expect(txt).toEqual({ filename: 'My-Result-1.txt', mime: 'text/plain', content: 'hello' });
    const json = buildDownload('[1,2]', 'json', 'list');
    expect(json.filename).toBe('list.json');
    expect(JSON.parse(json.content)).toEqual([1, 2]);
    // plain text is wrapped so the .json file is still valid JSON
    expect(JSON.parse(buildDownload('just words', 'json').content)).toEqual({ text: 'just words' });
    expect(buildDownload('x', 'txt', '///').filename).toBe('bedrock-output.txt');
  });
});

describe('workflow files', () => {
  const nodes = [
    { id: 'a', type: 'genericNode', position: { x: 1, y: 2 }, selected: true, data: { nodeType: 'prompt', title: 'A', description: 'hi', status: 'success', output: 'secret result', evalScore: 90 } },
    { id: 'b', type: 'genericNode', position: { x: 3, y: 4 }, data: { nodeType: 'output', title: 'B', description: '' } },
  ];
  const edges = [{ id: 'e1', source: 'a', target: 'b' }];

  it('exports the workflow without any run results', () => {
    const file = buildWorkflowFile('My flow', nodes, edges);
    const text = JSON.stringify(file);
    expect(text).not.toContain('secret result');
    expect(text).not.toContain('evalScore');
    expect(file.kind).toBe('bedrock-workflow');
    expect((file.nodes[0] as { data: { status: string } }).data.status).toBe('idle');
    expect((file.nodes[0] as { selected?: boolean }).selected).toBeUndefined();
    expect(file.edges).toEqual(edges);
  });

  it('does not change the nodes it was given', () => {
    buildWorkflowFile('My flow', nodes, edges);
    expect(nodes[0].data.output).toBe('secret result');
  });

  it('reads back a file it wrote', () => {
    const parsed = parseWorkflowFile(JSON.stringify(buildWorkflowFile('My flow', nodes, edges)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.file.title).toBe('My flow');
      expect(parsed.file.nodes).toHaveLength(2);
    }
  });

  it('rejects files that are not workflows, with a plain message', () => {
    for (const bad of ['', '{not json', '{}', '[]', '{"kind":"other"}', '{"kind":"bedrock-workflow"}']) {
      const r = parseWorkflowFile(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message.length).toBeGreaterThan(5);
    }
    const noType = parseWorkflowFile(JSON.stringify({ kind: 'bedrock-workflow', nodes: [{ id: 'x', data: {} }], edges: [] }));
    expect(noType.ok).toBe(false);
    const dup = parseWorkflowFile(JSON.stringify({ kind: 'bedrock-workflow', nodes: [{ id: 'x', data: { nodeType: 'prompt' } }, { id: 'x', data: { nodeType: 'prompt' } }], edges: [] }));
    expect(dup.ok).toBe(false);
  });

  it('rejects oversized files and too many nodes', () => {
    expect(parseWorkflowFile('x'.repeat(1_000_001)).ok).toBe(false);
    const many = Array.from({ length: 201 }, (_, i) => ({ id: `n${i}`, data: { nodeType: 'prompt' } }));
    expect(parseWorkflowFile(JSON.stringify({ kind: 'bedrock-workflow', nodes: many, edges: [] })).ok).toBe(false);
  });

  it('keeps Import switched off until Security\'s sanitizeWorkflow is merged', () => {
    expect(IMPORT_ENABLED).toBe(false);
  });

  it('makes a safe file name', () => {
    expect(workflowFileName('My Flow / v2')).toBe('My-Flow-v2.bedrock-workflow.json');
    expect(workflowFileName('')).toBe('workflow.bedrock-workflow.json');
  });
});
