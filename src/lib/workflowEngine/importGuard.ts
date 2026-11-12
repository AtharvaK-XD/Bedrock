/**
 * Cleans a workflow that came from outside this editor before it is shown or run:
 *  - 'file'  : a JSON file the user imported
 *  - 'share' : a read-only copy opened from a share link (someone else's workflow)
 *  - 'ai'    : a graph written by "Build it for me" (AI output is untrusted text)
 *
 * Only known node types and known fields survive; every value is type-checked and size-capped. Objects are rebuilt
 * from scratch, so "__proto__", "constructor" and "prototype" keys never reach React Flow, the engine or the server.
 * AI-written graphs never keep Code nodes. `hasCode` tells the UI to show "This workflow contains custom code from
 * someone else" before the first Code run.
 *
 * It never throws. A graph that cannot be used comes back with `ok: false`, empty lists and a plain-English warning.
 */

export type ImportSource = 'file' | 'share' | 'ai';

export interface SanitizedNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface SanitizedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  animated?: boolean;
  label?: string;
  style?: { stroke?: string; strokeWidth?: number };
}

export interface SanitizeResult {
  /** false when the whole graph was refused (not a workflow, or too large). nodes and edges are then empty. */
  ok: boolean;
  nodes: SanitizedNode[];
  edges: SanitizedEdge[];
  /** Plain-English notes about what was removed or changed. */
  warnings: string[];
  /** true when at least one Code node (custom JavaScript) is in the result. */
  hasCode: boolean;
  /** How many nodes and edges were removed. */
  dropped: number;
}

export const IMPORT_LIMITS = {
  /** Same as the server's DATA_LIMITS.workflowJsonChars: JSON of nodes + edges. */
  graphChars: 500_000,
  /** A text file larger than this is refused before it is parsed. */
  rawTextChars: 2_000_000,
  idChars: 100,
  maxNodes: 1_000,
  maxEdges: 5_000,
  maxDepth: 64,
} as const;

export const EXISTING_NODE_TYPES = ['system', 'prompt', 'output', 'data', 'condition', 'code', 'merge', 'evaluation'] as const;
export const NEW_NODE_TYPES = ['switch', 'forEach', 'arrayTools', 'jsonPick', 'variable', 'askInput', 'note'] as const;
export const KNOWN_NODE_TYPES: readonly string[] = [...EXISTING_NODE_TYPES, ...NEW_NODE_TYPES];

const CONDITION_OPS = [
  'contains', 'not_contains', 'equals', 'not_equals', 'starts_with', 'ends_with', 'regex',
  'length_gt', 'length_lt', 'is_empty', 'not_empty', 'is_json', 'is_array',
  'num_gt', 'num_gte', 'num_lt', 'num_lte', 'num_eq', 'between',
  'array_length_gt', 'array_length_lt', 'array_includes',
  'score_gte', 'score_lt',
] as const;

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// ---------------------------------------------------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * Deep copy that keeps only JSON values and drops dangerous keys at any depth. Anything nested deeper than maxDepth
 * is dropped. Counts the dangerous keys it removed.
 */
function deepClean(value: unknown, depth: number, stats: { unsafeKeys: number; tooDeep: boolean }): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (depth > IMPORT_LIMITS.maxDepth) {
    stats.tooDeep = true;
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((v) => deepClean(v, depth + 1, stats));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      if (DANGEROUS_KEYS.has(key)) {
        stats.unsafeKeys += 1;
        continue;
      }
      const v = deepClean(value[key], depth + 1, stats);
      if (v !== undefined) out[key] = v;
    }
    return out;
  }
  return undefined; // functions, class instances, symbols, bigint: not JSON
}

const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' ? (v.length > max ? v.slice(0, max) : v) : undefined);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
const finite = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined;

/** Text field limits (characters). description, codeScript and dataPayload come from the Branching v2 contract. */
const TEXT_LIMITS = {
  title: 200,
  description: 20_000,
  codeScript: 20_000,
  dataPayload: 100_000,
  systemPersona: 20_000,
  agentId: 100,
  modelId: 200,
  conditionValue: 2_000,
  evalCriteria: 2_000,
  evalCritique: 20_000,
  output: 100_000,
  switchField: 200,
  forEachTemplate: 20_000,
  arrayArg: 2_000,
  jsonPath: 500,
  jsonFallback: 20_000,
  askQuestion: 500,
  askDefault: 20_000,
  noteText: 20_000,
} as const;

type Notes = { truncated: Set<string>; removedFields: number };

function capText(data: Record<string, unknown>, out: Record<string, unknown>, field: keyof typeof TEXT_LIMITS, notes: Notes) {
  const v = data[field];
  if (v === undefined) return;
  if (typeof v !== 'string') {
    notes.removedFields += 1;
    return;
  }
  const max = TEXT_LIMITS[field];
  if (v.length > max) notes.truncated.add(field);
  out[field] = str(v, max);
}

function cleanRules(v: unknown, notes: Notes) {
  if (!Array.isArray(v)) return undefined;
  const rules = v
    .filter(isPlainObject)
    .slice(0, 20)
    .map((r) => {
      const op = oneOf(r.op, CONDITION_OPS);
      if (!op) return null;
      const rule: Record<string, unknown> = { op };
      const field = str(r.field, 200);
      const value = str(r.value, TEXT_LIMITS.conditionValue);
      if (field !== undefined) rule.field = field;
      if (value !== undefined) rule.value = value;
      return rule;
    })
    .filter((r): r is Record<string, unknown> => r !== null);
  if (rules.length !== v.length) notes.removedFields += 1;
  return rules;
}

function cleanSwitchCases(v: unknown, notes: Notes) {
  if (!Array.isArray(v)) return undefined;
  const seen = new Set<string>();
  const cases = v
    .filter(isPlainObject)
    .slice(0, 20)
    .map((c) => {
      const op = oneOf(c.op, CONDITION_OPS);
      const id = str(c.id, IMPORT_LIMITS.idChars);
      if (!op || !id || !/^[\w-]+$/.test(id) || seen.has(id)) return null;
      seen.add(id);
      const out: Record<string, unknown> = { id, label: str(c.label, 100) ?? id, op };
      const value = str(c.value, TEXT_LIMITS.conditionValue);
      if (value !== undefined) out.value = value;
      return out;
    })
    .filter((c): c is Record<string, unknown> => c !== null);
  if (cases.length !== v.length) notes.removedFields += 1;
  return cases;
}

/** Keeps only fields a node of this type may have, with the right types and sizes. */
function cleanNodeData(data: Record<string, unknown>, nodeType: string, source: ImportSource, notes: Notes): Record<string, unknown> {
  const out: Record<string, unknown> = { nodeType, status: 'idle' };
  for (const f of ['title', 'description', 'agentId', 'modelId', 'systemPersona', 'codeScript', 'dataPayload',
    'conditionValue', 'evalCriteria', 'switchField', 'forEachTemplate', 'arrayArg', 'jsonPath', 'jsonFallback',
    'askQuestion', 'askDefault', 'noteText'] as const) {
    capText(data, out, f, notes);
  }
  if (out.title === undefined) out.title = nodeType;
  if (out.description === undefined) out.description = '';

  const enums: [string, readonly string[]][] = [
    ['dataMode', ['json', 'kv']],
    ['conditionRule', ['contains', 'not_contains', 'length_gt', 'regex']],
    ['mergeStrategy', ['concat', 'bullets', 'json', 'synthesize']],
    ['outputFormat', ['markdown', 'text', 'json']],
    ['responseFormat', ['text', 'json']],
    ['forEachMode', ['template', 'ai']],
    ['arrayOp', ['split_lines', 'split_by', 'filter', 'sort', 'take', 'unique', 'count', 'join', 'pluck', 'reverse']],
    ['noteColor', ['yellow', 'blue', 'green', 'pink']],
  ];
  for (const [field, allowed] of enums) {
    if (data[field] === undefined) continue;
    const v = oneOf(data[field], allowed);
    if (v) out[field] = v;
    else notes.removedFields += 1;
  }

  if (data.variableName !== undefined) {
    if (typeof data.variableName === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(data.variableName)) out.variableName = data.variableName;
    else notes.removedFields += 1;
  }
  const maxItems = finite(data.forEachMaxItems, 1, 1000);
  if (maxItems !== undefined) out.forEachMaxItems = Math.floor(maxItems);

  if (isPlainObject(data.conditionGroup)) {
    const mode = oneOf(data.conditionGroup.mode, ['all', 'any'] as const);
    const rules = cleanRules(data.conditionGroup.rules, notes);
    if (mode && rules) out.conditionGroup = { mode, rules };
    else notes.removedFields += 1;
  }
  const cases = cleanSwitchCases(data.switchCases, notes);
  if (cases) out.switchCases = cases;

  // Results of an earlier run: only kept from the user's own file. A shared or AI-written graph starts clean.
  if (source === 'file') {
    capText(data, out, 'output', notes);
    capText(data, out, 'evalCritique', notes);
    if (typeof data.conditionResult === 'boolean') out.conditionResult = data.conditionResult;
    const score = finite(data.evalScore, 0, 100);
    if (score !== undefined) out.evalScore = score;
  }
  return out;
}

function safeId(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) v = String(v);
  if (typeof v !== 'string') return null;
  const id = v.trim().slice(0, IMPORT_LIMITS.idChars);
  return id.length > 0 ? id : null;
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  for (let n = 2; used.has(id); n += 1) {
    const suffix = `-${n}`;
    id = base.slice(0, IMPORT_LIMITS.idChars - suffix.length) + suffix;
  }
  used.add(id);
  return id;
}

const HANDLE_RE = /^[\w:-]{1,100}$/;
const IDENT_RE = /^[A-Za-z][\w-]{0,39}$/;
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

function refused(warning: string, dropped = 0): SanitizeResult {
  return { ok: false, nodes: [], edges: [], warnings: [warning], hasCode: false, dropped };
}

// ---------------------------------------------------------------------------------------------------------------------

export function sanitizeWorkflow(raw: unknown, opts: { source: ImportSource }): SanitizeResult {
  const source: ImportSource = opts?.source === 'file' || opts?.source === 'share' ? opts.source : 'ai'; // unknown = strictest
  let input = raw;
  if (typeof input === 'string') {
    if (input.length > IMPORT_LIMITS.rawTextChars) return refused('This workflow file is too large to open.');
    try {
      input = JSON.parse(input);
    } catch {
      return refused('This file is not a valid workflow (it is not JSON).');
    }
  }
  if (!isPlainObject(input) || !Array.isArray(input.nodes) || (input.edges !== undefined && !Array.isArray(input.edges))) {
    return refused('This is not a workflow: it needs a list of nodes and a list of connections.');
  }
  const rawNodes = input.nodes as unknown[];
  const rawEdges = (input.edges ?? []) as unknown[];
  if (rawNodes.length > IMPORT_LIMITS.maxNodes || rawEdges.length > IMPORT_LIMITS.maxEdges) {
    return refused(`This workflow is too large: at most ${IMPORT_LIMITS.maxNodes} nodes and ${IMPORT_LIMITS.maxEdges} connections.`);
  }

  const stats = { unsafeKeys: 0, tooDeep: false };
  const notes: Notes = { truncated: new Set(), removedFields: 0 };
  const warnings: string[] = [];
  let dropped = 0;
  let notObjects = 0;
  const unknownTypes = new Map<string, number>();
  let removedCode = 0;

  const usedNodeIds = new Set<string>();
  const idMap = new Map<string, string>(); // first node with an original id -> its final id
  const nodes: SanitizedNode[] = [];

  rawNodes.forEach((rawNode, index) => {
    const node = deepClean(rawNode, 0, stats);
    if (!isPlainObject(node)) {
      notObjects += 1;
      dropped += 1;
      return;
    }
    const data = isPlainObject(node.data) ? node.data : {};
    const nodeType = typeof data.nodeType === 'string' ? data.nodeType : '';
    if (!KNOWN_NODE_TYPES.includes(nodeType)) {
      const label = nodeType ? nodeType.slice(0, 40) : '(none)';
      unknownTypes.set(label, (unknownTypes.get(label) ?? 0) + 1);
      dropped += 1;
      return;
    }
    if (source === 'ai' && nodeType === 'code') {
      removedCode += 1;
      dropped += 1;
      return;
    }
    const original = safeId(node.id);
    const id = uniqueId(original ?? `node-imported-${index + 1}`, usedNodeIds);
    if (original !== null && !idMap.has(original)) idMap.set(original, id);
    const pos = isPlainObject(node.position) ? node.position : {};
    nodes.push({
      id,
      type: typeof node.type === 'string' && IDENT_RE.test(node.type) ? node.type : 'genericNode',
      position: { x: finite(pos.x, -1e6, 1e6) ?? index * 40, y: finite(pos.y, -1e6, 1e6) ?? index * 40 },
      data: cleanNodeData(data, nodeType, source, notes),
    });
  });

  const usedEdgeIds = new Set<string>();
  const edges: SanitizedEdge[] = [];
  let badEdges = 0;
  rawEdges.forEach((rawEdge, index) => {
    const edge = deepClean(rawEdge, 0, stats);
    if (!isPlainObject(edge)) {
      badEdges += 1;
      return;
    }
    const src = safeId(edge.source);
    const tgt = safeId(edge.target);
    const sourceId = src === null ? undefined : idMap.get(src);
    const targetId = tgt === null ? undefined : idMap.get(tgt);
    if (!sourceId || !targetId) {
      badEdges += 1;
      return;
    }
    const out: SanitizedEdge = {
      id: uniqueId(safeId(edge.id) ?? `edge-imported-${index + 1}`, usedEdgeIds),
      source: sourceId,
      target: targetId,
    };
    for (const h of ['sourceHandle', 'targetHandle'] as const) {
      if (edge[h] === null) out[h] = null;
      else if (typeof edge[h] === 'string' && HANDLE_RE.test(edge[h] as string)) out[h] = edge[h] as string;
    }
    if (typeof edge.type === 'string' && IDENT_RE.test(edge.type)) out.type = edge.type;
    if (typeof edge.animated === 'boolean') out.animated = edge.animated;
    const label = str(edge.label, 100);
    if (label !== undefined) out.label = label;
    if (isPlainObject(edge.style)) {
      const style: { stroke?: string; strokeWidth?: number } = {};
      if (typeof edge.style.stroke === 'string' && COLOR_RE.test(edge.style.stroke)) style.stroke = edge.style.stroke;
      const width = finite(edge.style.strokeWidth, 0, 20);
      if (width !== undefined) style.strokeWidth = width;
      out.style = style;
    }
    edges.push(out);
  });
  dropped += badEdges;

  if (notObjects) warnings.push(`Removed ${notObjects} broken ${notObjects === 1 ? 'entry' : 'entries'} that ${notObjects === 1 ? 'was' : 'were'} not a node.`);
  for (const [type, count] of unknownTypes) {
    warnings.push(`Removed ${count} ${count === 1 ? 'node' : 'nodes'} of an unknown type (${JSON.stringify(type)}).`);
  }
  if (removedCode) warnings.push(`Removed ${removedCode} Code ${removedCode === 1 ? 'node' : 'nodes'}: workflows built by AI never include custom code.`);
  if (badEdges) warnings.push(`Removed ${badEdges} ${badEdges === 1 ? 'connection' : 'connections'} that pointed to a missing node.`);
  if (stats.unsafeKeys) warnings.push('Removed hidden fields that are not allowed in a workflow (__proto__, constructor or prototype).');
  if (stats.tooDeep) warnings.push('Removed data that was nested too deeply.');
  if (notes.truncated.size) warnings.push(`Shortened text that was too long (${[...notes.truncated].join(', ')}).`);
  if (notes.removedFields) warnings.push(`Removed ${notes.removedFields} ${notes.removedFields === 1 ? 'setting' : 'settings'} with a value that is not allowed.`);

  const size = JSON.stringify(nodes).length + JSON.stringify(edges).length;
  if (size > IMPORT_LIMITS.graphChars) {
    return refused(`This workflow is too large to open (more than ${IMPORT_LIMITS.graphChars.toLocaleString('en-US')} characters).`, dropped);
  }

  const hasCode = nodes.some((n) => n.data.nodeType === 'code');
  if (hasCode && source !== 'file') warnings.push('This workflow contains custom code from someone else. Read it before you run it.');
  return { ok: true, nodes, edges, warnings, hasCode, dropped };
}
