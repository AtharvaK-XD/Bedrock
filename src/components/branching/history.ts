/**
 * Undo / redo for the Branching canvas. Pure functions: the editor keeps the state, these only compute it.
 * A step is recorded when the *structure* of the workflow changes (nodes, their settings, their positions,
 * the wires). Run results and streaming text are not structure, so running a node never fills the undo list.
 */

export const HISTORY_LIMIT = 50;

export interface GraphSnapshot<N, E> {
  nodes: N[];
  edges: E[];
}

export interface HistoryState<N, E> {
  past: GraphSnapshot<N, E>[];
  future: GraphSnapshot<N, E>[];
}

export function emptyHistory<N, E>(): HistoryState<N, E> {
  return { past: [], future: [] };
}

/** Record `previous` as an undo step (call it when the graph changed away from `previous`). */
export function recordStep<N, E>(state: HistoryState<N, E>, previous: GraphSnapshot<N, E>): HistoryState<N, E> {
  const past = [...state.past, previous];
  return { past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past, future: [] };
}

export function undoStep<N, E>(
  state: HistoryState<N, E>,
  current: GraphSnapshot<N, E>
): { state: HistoryState<N, E>; restored: GraphSnapshot<N, E> | null } {
  if (state.past.length === 0) return { state, restored: null };
  const restored = state.past[state.past.length - 1];
  return {
    state: { past: state.past.slice(0, -1), future: [...state.future, current] },
    restored,
  };
}

export function redoStep<N, E>(
  state: HistoryState<N, E>,
  current: GraphSnapshot<N, E>
): { state: HistoryState<N, E>; restored: GraphSnapshot<N, E> | null } {
  if (state.future.length === 0) return { state, restored: null };
  const restored = state.future[state.future.length - 1];
  const past = [...state.past, current];
  return {
    state: { past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past, future: state.future.slice(0, -1) },
    restored,
  };
}

// Fields a run writes onto a node. They are left out of the structure key on purpose.
const RUNTIME_FIELDS = new Set(['status', 'output', 'result', 'conditionResult', 'evalScore', 'evalCritique']);

interface KeyNode {
  id: string;
  position?: { x: number; y: number };
  data?: Record<string, unknown>;
}
interface KeyEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/** A string that changes only when the workflow's structure changes (not when a node runs). */
export function structureKey(nodes: KeyNode[], edges: KeyEdge[]): string {
  const n = nodes.map((node) => {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node.data || {})) {
      if (!RUNTIME_FIELDS.has(k)) data[k] = v;
    }
    return [node.id, Math.round(node.position?.x ?? 0), Math.round(node.position?.y ?? 0), data];
  });
  const e = edges.map((edge) => [edge.id, edge.source, edge.target, edge.sourceHandle ?? null, edge.targetHandle ?? null]);
  return JSON.stringify([n, e]);
}

/**
 * When an undo or redo brings back an older version of the nodes, keep what each node has produced since
 * (its output, status and scores): undoing an edit should not wipe the results of a run.
 */
export function carryRuntimeFields<N extends { id: string; data?: Record<string, unknown> }>(restored: N[], current: N[]): N[] {
  const byId = new Map(current.map((n) => [n.id, n]));
  return restored.map((node) => {
    const live = byId.get(node.id);
    if (!live) return node;
    const data: Record<string, unknown> = { ...(node.data || {}) };
    for (const field of RUNTIME_FIELDS) {
      if (live.data && field in live.data) data[field] = live.data[field];
      else delete data[field];
    }
    return { ...node, data };
  });
}
