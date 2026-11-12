/**
 * AI helpers for Branching v2: "Build it for me" (a workflow from a description) and "Explain this workflow".
 * The AI only proposes; the server builds the real nodes from a fixed list of allowed fields, so the answer can
 * never add a Code node, unknown fields, or more steps than the person's plan allows.
 */
import { PLAN_NODE_LIMIT, type PlanTier, readJsonArray } from './workflowGraph.js';

export const GENERATE_DEFAULT_MODEL = 'gemini-3.5-flash-lite';
export const WORKFLOW_AI_LIMITS = { description: 2_000, explainGraphChars: 60_000 } as const;

/** Node types "Build it for me" may use. No `code`: AI-written scripts must never run without a person writing them. */
const GENERATABLE = ['system', 'prompt', 'output', 'data', 'condition', 'switch', 'forEach', 'arrayTools', 'jsonPick', 'variable', 'askInput', 'merge', 'evaluation', 'note'] as const;
type GenType = (typeof GENERATABLE)[number];
const GEN_SET = new Set<string>(GENERATABLE);

const CONDITION_OPS = new Set([
  'contains', 'not_contains', 'equals', 'not_equals', 'starts_with', 'ends_with', 'regex', 'length_gt', 'length_lt',
  'is_empty', 'not_empty', 'is_json', 'is_array', 'num_gt', 'num_gte', 'num_lt', 'num_lte', 'num_eq', 'between',
  'array_length_gt', 'array_length_lt', 'array_includes', 'score_gte', 'score_lt',
]);
const ARRAY_OPS = new Set(['split_lines', 'split_by', 'filter', 'sort', 'take', 'unique', 'count', 'join', 'pluck', 'reverse']);

export function buildGenerateSystemPrompt(maxSteps: number | null): string {
  const limit = maxSteps === null ? 'at most 12 steps' : `at most ${maxSteps} steps (not counting notes)`;
  return `You design small AI workflows for Bedrock's visual "Branching" canvas. Answer with ONE JSON object only, no prose, no code fences.

Shape:
{"title": string (max 60 chars), "explanation": string (2-4 short plain-English sentences for a beginner),
 "nodes": [{"key": "n1", "type": <type>, "title": string, ...fields}],
 "edges": [{"from": "n1", "to": "n2", "path"?: "true" | "false" | "case:<caseId>" | "default"}]}

Use ${limit}. Keep it as simple as possible. Steps run left to right along the edges.
Types and their fields:
- "system": persona for the AI steps it connects to. fields: description (the persona).
- "prompt": one AI call. fields: description (the instruction; it automatically receives the connected steps' output), responseFormat? ("json").
- "output": shows the final result. no fields.
- "data": fixed sample input. fields: dataPayload (text or JSON as a string).
- "askInput": asks the person a question when the workflow runs. fields: askQuestion.
- "condition": if/else. fields: conditionGroup {"mode": "all"|"any", "rules": [{"field"?: json path, "op": op, "value"?: string}]}.
  Edges leaving it MUST use "path": "true" or "false".
- "switch": many paths. fields: switchField? (json path), switchCases [{"id": short id, "label": string, "op": op, "value": string}].
  Edges leaving it use "path": "case:<id>" or "default".
- "forEach": repeat over a list. fields: forEachMode ("template"|"ai"), forEachTemplate (use {{item}} and {{index}}).
- "arrayTools": list operations. fields: arrayOp (split_lines|split_by|filter|sort|take|unique|count|join|pluck|reverse), arrayArg.
- "jsonPick": read one JSON field. fields: jsonPath (e.g. items[0].title), jsonFallback?.
- "variable": remember a value as {{vars.<name>}}. fields: variableName.
- "merge": combine several paths. fields: mergeStrategy (concat|bullets|json|synthesize).
- "evaluation": AI quality score 0-100. fields: evalCriteria (accuracy|clarity|code_quality|guardrails).
- "note": a sticky note explaining something. fields: noteText. Notes have no edges.
ops: contains, not_contains, equals, not_equals, starts_with, ends_with, length_gt, length_lt, is_empty, not_empty, is_json, is_array, num_gt, num_gte, num_lt, num_lte, num_eq, between ("a,b"), array_length_gt, array_length_lt, array_includes, score_gte, score_lt.
Never use a "code" type. End every path with an "output" step when the step limit allows.`;
}

export interface GeneratedWorkflow {
  title: string;
  explanation: string;
  nodes: Array<{ id: string; type: 'genericNode'; position: { x: number; y: number }; data: Record<string, unknown> }>;
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string; type: 'deletableEdge'; animated: true; style: { stroke: string; strokeWidth: number } }>;
  notes: string[];
}

/** Reads a JSON object from an AI answer (plain, or inside a ``` fence, or the first {...} block). */
export function parseAiJsonObject(text: string): Record<string, unknown> | null {
  const attempts = [text.trim()];
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/i);
  if (fenced) attempts.push(fenced[1].trim());
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) attempts.push(text.slice(first, last + 1));
  for (const a of attempts) {
    try {
      const v = JSON.parse(a);
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {
      // try the next form
    }
  }
  return null;
}

/** Instruction added to the system prompt when a caller asks for a JSON answer (POST /api/ai/test responseFormat). */
export const JSON_ANSWER_INSTRUCTION = 'Answer with valid JSON only: no explanations before or after it, and no code fences.';

/** Any JSON value from an AI answer (object or array; plain, fenced, or the outermost {...} / [...] block). */
export function parseAiJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const attempts = [text.trim()];
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/i);
  if (fenced) attempts.push(fenced[1].trim());
  for (const [open, close] of [['{', '}'], ['[', ']']] as const) {
    const first = text.indexOf(open);
    const last = text.lastIndexOf(close);
    if (first >= 0 && last > first) attempts.push(text.slice(first, last + 1));
  }
  for (const a of attempts) {
    try {
      const v = JSON.parse(a);
      if (v !== null && typeof v === 'object') return { ok: true, value: v };
    } catch {
      // try the next form
    }
  }
  return { ok: false, error: 'The answer is not valid JSON.' };
}

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : typeof v === 'number' ? String(v).slice(0, max) : '');
const pick = <T extends string>(v: unknown, allowed: ReadonlySet<string>, fallback: T): T => (typeof v === 'string' && allowed.has(v) ? (v as T) : fallback);

function cleanRule(r: unknown): { field?: string; op: string; value?: string } | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  if (typeof o.op !== 'string' || !CONDITION_OPS.has(o.op)) return null;
  const field = str(o.field, 200);
  const value = str(o.value, 500);
  return { op: o.op, ...(field ? { field } : {}), ...(value !== '' ? { value } : {}) };
}

/** Only the fields each type may have, length-capped. */
function dataFor(type: GenType, raw: Record<string, unknown>): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  switch (type) {
    case 'system':
    case 'prompt':
      d.description = str(raw.description, 4_000);
      if (type === 'prompt' && raw.responseFormat === 'json') d.responseFormat = 'json';
      break;
    case 'output':
      d.description = '';
      d.outputFormat = 'markdown';
      break;
    case 'data':
      d.dataPayload = typeof raw.dataPayload === 'string' ? raw.dataPayload.slice(0, 10_000) : raw.dataPayload !== undefined ? JSON.stringify(raw.dataPayload).slice(0, 10_000) : '';
      d.dataMode = 'json';
      d.description = 'Sample input';
      break;
    case 'askInput':
      d.askQuestion = str(raw.askQuestion, 300) || 'Your answer';
      if (raw.askDefault) d.askDefault = str(raw.askDefault, 300);
      d.description = '';
      break;
    case 'condition': {
      const g = raw.conditionGroup as Record<string, unknown> | undefined;
      const rules = Array.isArray(g?.rules) ? (g!.rules as unknown[]).map(cleanRule).filter(Boolean).slice(0, 8) : [];
      if (rules.length) d.conditionGroup = { mode: g?.mode === 'any' ? 'any' : 'all', rules };
      else {
        d.conditionRule = 'contains';
        d.conditionValue = str(raw.conditionValue, 200);
      }
      d.description = '';
      break;
    }
    case 'switch': {
      const cases = Array.isArray(raw.switchCases) ? (raw.switchCases as unknown[]) : [];
      const seen = new Set<string>();
      d.switchCases = cases
        .map((c, i) => {
          const rule = cleanRule(c);
          if (!rule) return null;
          const o = c as Record<string, unknown>;
          let id = str(o.id, 30).replace(/[^A-Za-z0-9_-]/g, '') || `c${i + 1}`;
          while (seen.has(id)) id = `${id}_${i}`;
          seen.add(id);
          return { id, label: str(o.label, 60) || id, op: rule.op, ...(rule.value !== undefined ? { value: rule.value } : {}) };
        })
        .filter(Boolean)
        .slice(0, 8);
      const field = str(raw.switchField, 200);
      if (field) d.switchField = field;
      d.description = '';
      break;
    }
    case 'forEach':
      d.forEachMode = raw.forEachMode === 'ai' ? 'ai' : 'template';
      d.forEachTemplate = str(raw.forEachTemplate, 2_000) || '{{item}}';
      d.description = '';
      break;
    case 'arrayTools':
      d.arrayOp = pick(raw.arrayOp, ARRAY_OPS, 'split_lines');
      d.arrayArg = str(raw.arrayArg, 200);
      d.description = '';
      break;
    case 'jsonPick':
      d.jsonPath = str(raw.jsonPath, 200);
      if (raw.jsonFallback !== undefined) d.jsonFallback = str(raw.jsonFallback, 500);
      d.description = '';
      break;
    case 'variable':
      d.variableName = str(raw.variableName, 40).replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1') || 'value';
      d.description = '';
      break;
    case 'merge':
      d.mergeStrategy = pick(raw.mergeStrategy, new Set(['concat', 'bullets', 'json', 'synthesize']), 'concat');
      d.description = '';
      break;
    case 'evaluation':
      d.evalCriteria = pick(raw.evalCriteria, new Set(['accuracy', 'clarity', 'code_quality', 'guardrails']), 'accuracy');
      d.description = '';
      break;
    case 'note':
      d.noteText = str(raw.noteText, 1_000) || str(raw.description, 1_000);
      d.noteColor = 'yellow';
      d.description = '';
      break;
  }
  return d;
}

/**
 * Turns the AI's proposal into real canvas nodes and edges. Returns null when there is nothing usable.
 * Steps beyond the plan limit are dropped (in run order) and the explanation says so.
 */
export function buildGeneratedWorkflow(proposal: Record<string, unknown>, tier: PlanTier): GeneratedWorkflow | null {
  const rawNodes = Array.isArray(proposal.nodes) ? (proposal.nodes as unknown[]) : [];
  const rawEdges = Array.isArray(proposal.edges) ? (proposal.edges as unknown[]) : [];
  const notes: string[] = [];
  const keyToId = new Map<string, string>();
  const built: GeneratedWorkflow['nodes'] = [];
  let droppedCode = 0;
  for (const [i, r] of rawNodes.slice(0, 40).entries()) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const type = String(o.type ?? '');
    if (type === 'code') {
      droppedCode++;
      continue;
    }
    if (!GEN_SET.has(type)) continue;
    const key = str(o.key ?? o.id, 40) || `n${i + 1}`;
    if (keyToId.has(key)) continue;
    const id = `gen-${i + 1}`;
    keyToId.set(key, id);
    built.push({
      id,
      type: 'genericNode',
      position: { x: 0, y: 0 },
      data: {
        title: str(o.title, 80) || type,
        agentId: 'gemini',
        modelId: GENERATE_DEFAULT_MODEL,
        nodeType: type,
        status: 'idle',
        ...dataFor(type as GenType, o),
      },
    });
  }
  if (droppedCode) notes.push('A Code step was left out: Bedrock never adds AI-written code. Add one yourself if you need it.');

  const nodeType = new Map(built.map((n) => [n.id, String(n.data.nodeType)]));
  const caseIds = new Map(built.filter((n) => n.data.nodeType === 'switch').map((n) => [n.id, new Set(((n.data.switchCases as Array<{ id: string }>) ?? []).map((c) => c.id))]));
  let edges: GeneratedWorkflow['edges'] = [];
  const seenEdges = new Set<string>();
  for (const r of rawEdges.slice(0, 80)) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const source = keyToId.get(str(o.from ?? o.source, 40));
    const target = keyToId.get(str(o.to ?? o.target, 40));
    if (!source || !target || source === target) continue;
    if (nodeType.get(source) === 'note' || nodeType.get(target) === 'note') continue;
    const path = str(o.path ?? o.sourceHandle, 40);
    let sourceHandle: string | undefined;
    if (nodeType.get(source) === 'condition') sourceHandle = path === 'false' ? 'false' : 'true';
    else if (nodeType.get(source) === 'switch') {
      const caseId = path.startsWith('case:') ? path.slice(5) : '';
      sourceHandle = caseId && caseIds.get(source)?.has(caseId) ? `case:${caseId}` : 'default';
    }
    const key = `${source}>${target}>${sourceHandle ?? ''}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    edges.push({ id: `gen-e-${edges.length + 1}`, source, target, ...(sourceHandle ? { sourceHandle } : {}), type: 'deletableEdge', animated: true, style: { stroke: '#ff9b71', strokeWidth: 2 } });
  }

  // Remove only the wires that close a loop (depth-first, in the AI's own step order); the rest stay
  const runnable = built.filter((n) => n.data.nodeType !== 'note');
  {
    const state = new Map<string, 1 | 2>(); // 1 = on the current path, 2 = done
    const loopEdges = new Set<string>();
    const visit = (id: string) => {
      state.set(id, 1);
      for (const e of edges.filter((x) => x.source === id)) {
        const s = state.get(e.target);
        if (s === 1) loopEdges.add(e.id);
        else if (s === undefined) visit(e.target);
      }
      state.set(id, 2);
    };
    for (const n of runnable) if (!state.has(n.id)) visit(n.id);
    if (loopEdges.size) {
      edges = edges.filter((e) => !loopEdges.has(e.id));
      notes.push('A wire that made a loop was removed.');
    }
  }

  // Order by depth, then lay out left to right
  const depth = new Map<string, number>();
  const indeg = new Map(runnable.map((n) => [n.id, 0]));
  for (const e of edges) indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  const queue = runnable.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  queue.forEach((id) => depth.set(id, 0));
  const ordered: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    ordered.push(id);
    for (const e of edges.filter((x) => x.source === id)) {
      depth.set(e.target, Math.max(depth.get(e.target) ?? 0, (depth.get(id) ?? 0) + 1));
      indeg.set(e.target, indeg.get(e.target)! - 1);
      if (indeg.get(e.target) === 0) queue.push(e.target);
    }
  }

  const limit = PLAN_NODE_LIMIT[tier];
  let keepIds = new Set(ordered);
  if (ordered.length > limit) {
    keepIds = new Set(ordered.slice(0, limit));
    notes.push(`Your plan allows ${limit} steps, so the design was cut to its first ${limit}.`);
  }
  const finalNodes = built.filter((n) => n.data.nodeType === 'note' || keepIds.has(n.id)).slice(0, 60);
  if (finalNodes.filter((n) => n.data.nodeType !== 'note').length === 0) return null;
  const finalIds = new Set(finalNodes.map((n) => n.id));
  edges = edges.filter((e) => finalIds.has(e.source) && finalIds.has(e.target));

  const rowAt = new Map<number, number>();
  for (const n of finalNodes) {
    const col = n.data.nodeType === 'note' ? -1 : depth.get(n.id) ?? 0;
    const row = rowAt.get(col) ?? 0;
    rowAt.set(col, row + 1);
    n.position = col < 0 ? { x: 80 + row * 320, y: -180 } : { x: 80 + col * 360, y: 120 + row * 240 };
  }

  return {
    title: str(proposal.title, 80) || 'My workflow',
    explanation: str(proposal.explanation, 1_200),
    nodes: finalNodes,
    edges,
    notes,
  };
}

// ---- Explain ------------------------------------------------------------------------------------------------

export const EXPLAIN_SYSTEM_PROMPT = `You explain AI workflows to beginners. You get a workflow as JSON (steps and wires).
Answer with ONE JSON object only: {"summary": "2-3 friendly plain-English sentences: what this workflow does and what comes out",
"steps": [{"nodeId": "<id>", "text": "one short sentence: what this step does, in plain words"}]}.
Cover every step except notes, in the order they run. No jargon, no code fences.`;

/** A compact description of the graph for the explain prompt (no outputs, no sample data values). */
export function describeGraphForAi(nodesRaw: unknown, edgesRaw: unknown): { text: string; nodeIds: Set<string> } {
  const nodes = readJsonArray(nodesRaw);
  const edges = readJsonArray(edgesRaw);
  const nodeIds = new Set<string>();
  const steps = nodes.slice(0, 80).map((n) => {
    const d = (n.data ?? {}) as Record<string, unknown>;
    const id = String(n.id ?? '');
    nodeIds.add(id);
    const brief: Record<string, unknown> = { id, type: d.nodeType ?? 'prompt', title: str(d.title, 80) };
    for (const k of ['description', 'conditionRule', 'conditionValue', 'conditionGroup', 'switchField', 'switchCases', 'forEachMode', 'forEachTemplate', 'arrayOp', 'arrayArg', 'jsonPath', 'variableName', 'askQuestion', 'mergeStrategy', 'evalCriteria', 'noteText', 'codeScript']) {
      if (d[k] !== undefined && d[k] !== '') brief[k] = typeof d[k] === 'string' ? str(d[k], 600) : d[k];
    }
    return brief;
  });
  const wires = edges.slice(0, 160).map((e) => ({ from: (e as Record<string, unknown>).source, to: (e as Record<string, unknown>).target, ...((e as Record<string, unknown>).sourceHandle ? { path: (e as Record<string, unknown>).sourceHandle } : {}) }));
  return { text: JSON.stringify({ steps, wires }).slice(0, WORKFLOW_AI_LIMITS.explainGraphChars), nodeIds };
}

export function readExplanation(proposal: Record<string, unknown>, nodeIds: Set<string>): { summary: string; steps: Array<{ nodeId: string; text: string }> } | null {
  const summary = str(proposal.summary, 1_200);
  const steps = (Array.isArray(proposal.steps) ? (proposal.steps as unknown[]) : [])
    .map((s) => (s && typeof s === 'object' ? (s as Record<string, unknown>) : null))
    .filter((s): s is Record<string, unknown> => Boolean(s && nodeIds.has(String(s.nodeId))))
    .map((s) => ({ nodeId: String(s.nodeId), text: str(s.text, 400) }))
    .filter((s) => s.text)
    .slice(0, 80);
  if (!summary && steps.length === 0) return null;
  return { summary, steps };
}
