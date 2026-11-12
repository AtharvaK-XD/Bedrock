/**
 * "Auto-arrange": lays the workflow out left to right by depth (how many steps a node is from the start).
 * Sticky notes are left where the person put them. Pure: returns new positions, changes nothing else.
 */

interface LayoutNode {
  id: string;
  position: { x: number; y: number };
  data?: { nodeType?: string };
}
interface LayoutEdge {
  source: string;
  target: string;
}

export const LAYOUT_GAP_X = 380;
export const LAYOUT_GAP_Y = 230;
const START_X = 80;
const START_Y = 80;

/** Depth of every node: the longest chain of wires leading into it. Cycles are tolerated (they just stop growing). */
export function computeDepths(ids: string[], edges: LayoutEdge[]): Map<string, number> {
  const depth = new Map<string, number>(ids.map((id) => [id, 0]));
  const idSet = new Set(ids);
  const usable = edges.filter((e) => idSet.has(e.source) && idSet.has(e.target) && e.source !== e.target);
  // Relax at most `n` times: enough for any chain, and it stops a cycle from looping forever
  for (let pass = 0; pass < ids.length; pass++) {
    let changed = false;
    for (const e of usable) {
      const next = (depth.get(e.source) ?? 0) + 1;
      if (next > (depth.get(e.target) ?? 0) && next < ids.length) {
        depth.set(e.target, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return depth;
}

export function autoArrange<N extends LayoutNode>(nodes: N[], edges: LayoutEdge[]): N[] {
  const movable = nodes.filter((n) => n.data?.nodeType !== 'note');
  if (movable.length === 0) return nodes;
  const depth = computeDepths(
    movable.map((n) => n.id),
    edges
  );

  // Group by depth, keep the current top-to-bottom order inside a column so the layout feels familiar
  const columns = new Map<number, N[]>();
  for (const node of movable) {
    const d = depth.get(node.id) ?? 0;
    columns.set(d, [...(columns.get(d) ?? []), node]);
  }
  const positions = new Map<string, { x: number; y: number }>();
  const tallest = Math.max(...Array.from(columns.values()).map((c) => c.length));
  for (const [d, column] of columns) {
    const ordered = [...column].sort((a, b) => a.position.y - b.position.y);
    // Centre shorter columns against the tallest one
    const offset = ((tallest - ordered.length) * LAYOUT_GAP_Y) / 2;
    ordered.forEach((node, i) => {
      positions.set(node.id, { x: START_X + d * LAYOUT_GAP_X, y: START_Y + offset + i * LAYOUT_GAP_Y });
    });
  }
  return nodes.map((n) => (positions.has(n.id) ? { ...n, position: positions.get(n.id)! } : n));
}
