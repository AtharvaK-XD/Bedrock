/**
 * Server-side checks for Branching workflows (Branching v2, BRANCHING_PROMPTS.md 0.6).
 * The full "pipeline doctor" lives in the app (src/lib/workflowEngine/validate.ts); the server only needs the parts it
 * must not trust the browser with: known node types, sizes, loops, plan limits, and what a shared copy may contain.
 */
import crypto from 'node:crypto';

export const KNOWN_NODE_TYPES = [
  'system', 'prompt', 'output', 'data', 'condition', 'code', 'merge', 'evaluation',
  'switch', 'forEach', 'arrayTools', 'jsonPick', 'variable', 'askInput', 'note',
] as const;
export type KnownNodeType = (typeof KNOWN_NODE_TYPES)[number];
const KNOWN = new Set<string>(KNOWN_NODE_TYPES);
const AI_TYPES = new Set(['prompt', 'evaluation']);

export type PlanTier = 'free' | 'pro' | 'ultimate';

/**
 * Steps a plan may add (notes not counted). Same numbers as TIER_LIMITS.dagNodeLimit (src/lib/subscriptionTiers.ts)
 * and ENGINE_LIMITS in the app engine: Free 5, Pro 10 (Advanced counts as Pro), Ultimate 20 (decided 2026-11-13).
 */
export const PLAN_NODE_LIMIT: Record<PlanTier, number> = { free: 5, pro: 10, ultimate: 20 };

export function tierOf(user: { subscriptionTier?: string | null; isGuest?: boolean } | null | undefined): PlanTier {
  const t = String(user?.subscriptionTier || '').toLowerCase();
  if (!user || user.isGuest) return 'free';
  if (t.includes('ultimate')) return 'ultimate';
  if (t.includes('pro') || t.includes('advanced')) return 'pro';
  return 'free';
}

/** The plan's step limit for an API answer (every plan has a number today; null would mean no limit). */
export function nodeLimitForJson(tier: PlanTier): number | null {
  const n = PLAN_NODE_LIMIT[tier];
  return Number.isFinite(n) ? n : null;
}

type AnyNode = { id?: unknown; data?: Record<string, unknown> | null } & Record<string, unknown>;
type AnyEdge = { id?: unknown; source?: unknown; target?: unknown; sourceHandle?: unknown } & Record<string, unknown>;

const nodeTypeOf = (n: AnyNode): string => String((n?.data as Record<string, unknown> | undefined)?.nodeType ?? 'prompt');

export interface GraphStats {
  nodeCount: number;
  aiNodeCount: number;
  planNodeLimit: number | null;
  overLimit: boolean;
  hasCode: boolean;
  nodeTypes: string[];
}

export interface ServerIssue {
  severity: 'error' | 'warning';
  code: string;
  nodeId?: string;
  message: string;
}

export function graphStats(nodes: AnyNode[], tier: PlanTier): GraphStats {
  const runnable = nodes.filter((n) => nodeTypeOf(n) !== 'note');
  const types = runnable.map(nodeTypeOf);
  const aiNodeCount = runnable.filter((n) => {
    const t = nodeTypeOf(n);
    const d = (n.data ?? {}) as Record<string, unknown>;
    return AI_TYPES.has(t) || (t === 'merge' && d.mergeStrategy === 'synthesize') || (t === 'forEach' && d.forEachMode === 'ai');
  }).length;
  return {
    nodeCount: runnable.length,
    aiNodeCount,
    planNodeLimit: nodeLimitForJson(tier),
    overLimit: runnable.length > PLAN_NODE_LIMIT[tier],
    hasCode: types.includes('code'),
    nodeTypes: [...new Set(types)].sort(),
  };
}

/** Nodes caught in a loop of wires (Kahn's algorithm: whatever cannot be ordered). Notes are ignored. */
export function nodesInLoops(nodes: AnyNode[], edges: AnyEdge[]): string[] {
  const ids = new Set(nodes.filter((n) => nodeTypeOf(n) !== 'note').map((n) => String(n.id)));
  const indeg = new Map([...ids].map((id) => [id, 0]));
  const out = new Map<string, string[]>([...ids].map((id) => [id, []]));
  for (const e of edges) {
    const s = String(e.source);
    const t = String(e.target);
    if (!ids.has(s) || !ids.has(t)) continue;
    if (s === t) return [s];
    indeg.set(t, (indeg.get(t) ?? 0) + 1);
    out.get(s)!.push(t);
  }
  const queue = [...ids].filter((id) => indeg.get(id) === 0);
  let seen = 0;
  while (queue.length) {
    const id = queue.shift()!;
    seen++;
    for (const t of out.get(id)!) {
      indeg.set(t, indeg.get(t)! - 1);
      if (indeg.get(t) === 0) queue.push(t);
    }
  }
  return seen === ids.size ? [] : [...ids].filter((id) => (indeg.get(id) ?? 0) > 0);
}

/** What the server checks on POST /api/workflows/validate. Nothing here blocks a normal save. */
export function checkGraph(nodes: AnyNode[], edges: AnyEdge[], tier: PlanTier): { issues: ServerIssue[]; stats: GraphStats } {
  const issues: ServerIssue[] = [];
  const ids = new Set<string>();
  for (const n of nodes) {
    const id = typeof n?.id === 'string' ? n.id : '';
    if (!id) {
      issues.push({ severity: 'error', code: 'NODE_WITHOUT_ID', message: 'A step has no id.' });
      continue;
    }
    if (ids.has(id)) issues.push({ severity: 'error', code: 'DUPLICATE_NODE_ID', nodeId: id, message: 'Two steps share the same id.' });
    ids.add(id);
    if (!KNOWN.has(nodeTypeOf(n))) {
      issues.push({ severity: 'error', code: 'UNKNOWN_NODE', nodeId: id, message: `"${nodeTypeOf(n).slice(0, 40)}" is not a known kind of step.` });
    }
  }
  for (const e of edges) {
    if (!ids.has(String(e?.source)) || !ids.has(String(e?.target))) {
      issues.push({ severity: 'warning', code: 'DANGLING_EDGE', message: 'A wire points to a step that does not exist.' });
    }
  }
  const loop = nodesInLoops(nodes, edges);
  if (loop.length) issues.push({ severity: 'error', code: 'CYCLE', nodeId: loop[0], message: 'Some steps are wired in a loop, so there is no place to start.' });
  const stats = graphStats(nodes, tier);
  if (stats.overLimit) {
    issues.push({ severity: 'warning', code: 'PLAN_NODE_LIMIT', message: `This workflow has ${stats.nodeCount} steps; your plan allows adding up to ${stats.planNodeLimit}.` });
  }
  return { issues, stats };
}

// ---- Shared (public) copies -------------------------------------------------------------------------------------

/** Node data fields a shared copy keeps. Outputs, results, run state and sample data values are left out. */
const SHARE_DATA_FIELDS = new Set([
  'title', 'description', 'agentId', 'modelId', 'nodeType', 'systemPersona', 'dataMode', 'conditionRule', 'conditionValue',
  'codeScript', 'mergeStrategy', 'evalCriteria', 'outputFormat', 'conditionGroup', 'switchField', 'switchCases',
  'forEachMode', 'forEachTemplate', 'forEachMaxItems', 'arrayOp', 'arrayArg', 'jsonPath', 'jsonFallback',
  'variableName', 'askQuestion', 'askDefault', 'noteText', 'noteColor', 'responseFormat',
]);
const EDGE_FIELDS = ['id', 'source', 'target', 'sourceHandle', 'targetHandle', 'type', 'animated'] as const;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Deep copy of plain JSON with dangerous keys removed. */
function cleanJson(value: unknown, depth = 0): unknown {
  if (depth > 20) return null;
  if (Array.isArray(value)) return value.map((v) => cleanJson(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (!FORBIDDEN_KEYS.has(k)) out[k] = cleanJson(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** The read-only copy anyone with the link sees. `dataPayload` is replaced by an empty value of the same mode. */
export function stripForShare(nodes: AnyNode[], edges: AnyEdge[]): { nodes: unknown[]; edges: unknown[]; hasCode: boolean } {
  let hasCode = false;
  const outNodes = nodes.map((n) => {
    const data = (n.data ?? {}) as Record<string, unknown>;
    const keep: Record<string, unknown> = { status: 'idle' };
    for (const [k, v] of Object.entries(data)) {
      if (SHARE_DATA_FIELDS.has(k)) keep[k] = cleanJson(v);
    }
    if (keep.nodeType === 'code') hasCode = true;
    if (keep.nodeType === 'data') keep.dataPayload = '';
    const pos = n.position as { x?: unknown; y?: unknown } | undefined;
    return {
      id: String(n.id ?? ''),
      type: typeof n.type === 'string' ? n.type : 'genericNode',
      position: { x: Number(pos?.x) || 0, y: Number(pos?.y) || 0 },
      data: keep,
    };
  });
  const outEdges = edges.map((e) => {
    const keep: Record<string, unknown> = {};
    for (const k of EDGE_FIELDS) if (e[k] !== undefined && e[k] !== null) keep[k] = e[k];
    return keep;
  });
  return { nodes: outNodes, edges: outEdges, hasCode };
}

/** A share token: 32 random bytes, URL-safe (43 characters). */
export function newShareToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

/** Parses stored nodes/edges text; a damaged value gives an empty list rather than an error. */
export function readJsonArray(raw: unknown): AnyNode[] {
  if (Array.isArray(raw)) return raw as AnyNode[];
  if (typeof raw !== 'string') return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
