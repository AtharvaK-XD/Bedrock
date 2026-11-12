/**
 * Missions: six small goals that teach Branching by doing. Which ones are done is worked out from the canvas
 * (plus one event, "saved a workflow") and remembered in this browser only.
 */

export type MissionId = 'first_run' | 'connect_three' | 'if_else' | 'save_workflow' | 'sticky_note' | 'judge_80';

export interface Mission {
  id: MissionId;
  title: string;
  hint: string;
}

export const MISSIONS: Mission[] = [
  { id: 'first_run', title: 'Run your first node', hint: 'Open any node and press Run.' },
  { id: 'connect_three', title: 'Connect 3 nodes', hint: 'Drag from the dot on one node to the dot on the next.' },
  { id: 'if_else', title: 'Use an if / else', hint: 'Add an If / Else node, connect it and press Test.' },
  { id: 'save_workflow', title: 'Save a workflow', hint: 'Press Save in the toolbar.' },
  { id: 'sticky_note', title: 'Use a Sticky Note', hint: 'Add a Sticky Note from the palette.' },
  { id: 'judge_80', title: 'Get a Quality Judge score of 80+', hint: 'Connect a Quality Judge after a Prompt and run both.' },
];

export const MISSIONS_STORAGE_KEY = 'bedrock_branching_missions';

interface MissionNode {
  id: string;
  data?: { nodeType?: string; status?: string; conditionResult?: boolean; evalScore?: number };
}
interface MissionEdge {
  source: string;
  target: string;
}

/** Size of the largest group of nodes joined by wires (sticky notes do not count). */
export function largestConnectedGroup(nodes: MissionNode[], edges: MissionEdge[]): number {
  const ids = nodes.filter((n) => n.data?.nodeType !== 'note').map((n) => n.id);
  const idSet = new Set(ids);
  const parent = new Map<string, string>(ids.map((id) => [id, id]));
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    // path compression
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  for (const e of edges) {
    if (idSet.has(e.source) && idSet.has(e.target)) {
      const a = find(e.source);
      const b = find(e.target);
      if (a !== b) parent.set(a, b);
    }
  }
  const sizes = new Map<string, number>();
  for (const id of ids) sizes.set(find(id), (sizes.get(find(id)) ?? 0) + 1);
  return sizes.size === 0 ? 0 : Math.max(...Array.from(sizes.values()));
}

/**
 * Missions that the current canvas proves are done. "Save a workflow" and "Connect 3 nodes" are events instead:
 * a template that opens already wired must not finish the connecting mission for you.
 */
export function deriveMissions(nodes: MissionNode[], _edges: MissionEdge[]): MissionId[] {
  const done: MissionId[] = [];
  if (nodes.some((n) => n.data?.status === 'success')) done.push('first_run');
  if (nodes.some((n) => n.data?.nodeType === 'condition' && n.data.conditionResult !== undefined)) done.push('if_else');
  if (nodes.some((n) => n.data?.nodeType === 'note')) done.push('sticky_note');
  if (nodes.some((n) => n.data?.nodeType === 'evaluation' && typeof n.data.evalScore === 'number' && n.data.evalScore >= 80)) {
    done.push('judge_80');
  }
  return done;
}

const VALID = new Set<string>(MISSIONS.map((m) => m.id));

export function loadMissionProgress(): MissionId[] {
  try {
    const raw = localStorage.getItem(MISSIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed.filter((id) => typeof id === 'string' && VALID.has(id)) as MissionId[]) : [];
  } catch {
    return [];
  }
}

export function saveMissionProgress(done: MissionId[]): void {
  try {
    localStorage.setItem(MISSIONS_STORAGE_KEY, JSON.stringify(Array.from(new Set(done))));
  } catch {
    // progress is a convenience: a blocked or full storage must never break the page
  }
}

/** The missions in `next` that were not in `previous`. */
export function newlyCompleted(previous: MissionId[], next: MissionId[]): MissionId[] {
  const before = new Set(previous);
  return next.filter((id) => !before.has(id));
}
