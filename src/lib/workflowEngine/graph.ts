import type { RunPlan, WorkflowEdge, WorkflowGraph, WorkflowNode } from './types';

/** Notes never run and are never part of the flow. */
export function isRunnable(node: WorkflowNode | undefined): node is WorkflowNode {
  return Boolean(node && node.data && node.data.nodeType !== 'note');
}

/** Edges between two runnable nodes that both exist. */
export function liveEdges(graph: WorkflowGraph): WorkflowEdge[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  return (graph.edges || []).filter((e) => e && isRunnable(byId.get(e.source)) && isRunnable(byId.get(e.target)) && e.source !== e.target);
}

/** Self-loops (a wire from a node back to itself) count as a cycle. */
function selfLoops(graph: WorkflowGraph): string[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  return [...new Set((graph.edges || []).filter((e) => e && e.source === e.target && isRunnable(byId.get(e.source))).map((e) => e.source))];
}

/**
 * Order to run the nodes in (Kahn's algorithm, stable by canvas position: left to right, then top to bottom),
 * the groups that could run side by side (levels), and any loops of wires (cycles), each naming its nodes.
 */
export function planRun(graph: WorkflowGraph): RunPlan {
  const nodes = (graph.nodes || []).filter(isRunnable);
  const edges = liveEdges(graph);
  const pos = (n: WorkflowNode) => n.position ?? { x: 0, y: 0 };
  const rank = new Map(
    [...nodes]
      .map((n, i) => ({ n, i }))
      .sort((a, b) => pos(a.n).x - pos(b.n).x || pos(a.n).y - pos(b.n).y || a.i - b.i)
      .map(({ n }, i) => [n.id, i])
  );
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  const out = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    out.get(e.source)!.push(e.target);
  }
  const byRank = (a: string, b: string) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0);
  let frontier = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id).sort(byRank);
  const order: string[] = [];
  const levels: string[][] = [];
  while (frontier.length) {
    levels.push(frontier);
    const next: string[] = [];
    for (const id of frontier) {
      order.push(id);
      for (const t of out.get(id)!) {
        const d = (indeg.get(t) ?? 0) - 1;
        indeg.set(t, d);
        if (d === 0) next.push(t);
      }
    }
    frontier = [...new Set(next)].sort(byRank);
  }

  const leftover = new Set(nodes.map((n) => n.id).filter((id) => !order.includes(id)));
  const cycles = findCycles(leftover, edges);
  for (const id of selfLoops(graph)) {
    if (!cycles.some((c) => c.includes(id))) cycles.push([id]);
  }
  return { order, levels, cycles };
}

/** Strongly connected groups (Tarjan) among nodes that could not be ordered; each group of 2+ is a loop. */
function findCycles(ids: Set<string>, edges: WorkflowEdge[]): string[][] {
  if (ids.size === 0) return [];
  const adj = new Map<string, string[]>([...ids].map((id) => [id, []]));
  for (const e of edges) if (ids.has(e.source) && ids.has(e.target)) adj.get(e.source)!.push(e.target);
  let index = 0;
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const result: string[][] = [];
  const visit = (v: string) => {
    idx.set(v, index);
    low.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v)!) {
      if (!idx.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, idx.get(w)!));
      }
    }
    if (low.get(v) === idx.get(v)) {
      const comp: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      if (comp.length > 1) result.push(comp.reverse());
    }
  };
  for (const id of ids) if (!idx.has(id)) visit(id);
  return result;
}

/** Every node reachable from `start` following wires forward (start included). */
export function downstreamOf(graph: WorkflowGraph, start: string): Set<string> {
  const edges = liveEdges(graph);
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const id = queue.shift()!;
    for (const e of edges) {
      if (e.source === id && !seen.has(e.target)) {
        seen.add(e.target);
        queue.push(e.target);
      }
    }
  }
  return seen;
}

/** Every node `start` depends on, nearest first (start excluded). */
export function upstreamOf(graph: WorkflowGraph, start: string): string[] {
  const edges = liveEdges(graph);
  const seen = new Set<string>([start]);
  const order: string[] = [];
  const queue = [start];
  while (queue.length) {
    const id = queue.shift()!;
    for (const e of edges) {
      if (e.target === id && !seen.has(e.source)) {
        seen.add(e.source);
        order.push(e.source);
        queue.push(e.source);
      }
    }
  }
  return order;
}
