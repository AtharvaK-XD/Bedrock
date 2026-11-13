import { useEffect, useState } from 'react';
import { workflowApi, type WorkflowStats } from '../../lib/workflowApi';

/** Helpers for the server-backed Branching panels (CloudPanels.tsx). Kept apart so that file only exports components. */

export interface CanvasWorkflow {
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodes: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  edges: any[];
}

/** Makes sanitized nodes and wires look like the ones the canvas creates (node and edge types, wire colour). */
export function toCanvas(nodes: { id: string; type?: string; position: { x: number; y: number }; data: Record<string, unknown> }[], edges: { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }[]) {
  return {
    nodes: nodes.map((n) => ({ ...n, type: 'genericNode', data: { ...n.data, status: 'idle' } })),
    edges: edges.map((e) => ({ ...e, type: 'deletableEdge', animated: true, style: { stroke: '#ff9b71', strokeWidth: 2 } })),
  };
}

export const BUILD_IDEAS = [
  'Give me 5 startup names for a dog-walking app and pick the best one',
  'Rewrite an angry email so it sounds calm and polite',
  'Turn meeting notes into a list of tasks with owners',
  'Write a blog post outline, then check it with a quality judge',
  'Sort customer messages into bug, billing or praise and reply to each',
];

/** The link people open: the Branching page with ?shared=, so it works with today's routes (sign-in needed). */
export function shareLinkFor(token: string, origin: string): string {
  return `${origin}/app/branching?${new URLSearchParams({ shared: token }).toString()}`;
}

export interface Badge {
  id: string;
  label: string;
  earned: boolean;
  hint: string;
}

export function badgesFor(stats: WorkflowStats): Badge[] {
  const types = new Set(stats.nodeTypesUsed.filter((t) => t !== 'note'));
  return [
    { id: 'first_run', label: 'First run', earned: stats.totalRuns >= 1, hint: 'Press Run all once' },
    { id: 'ten_runs', label: '10 runs', earned: stats.totalRuns >= 10, hint: `${Math.min(stats.totalRuns, 10)}/10 runs` },
    { id: 'streak3', label: '3-day streak', earned: stats.streakDays >= 3, hint: 'Run a workflow 3 days in a row' },
    { id: 'explorer', label: 'Explorer', earned: types.size >= 8, hint: `${Math.min(types.size, 8)}/8 kinds of step used` },
    { id: 'all_steps', label: 'Every step', earned: types.size >= 14, hint: `${Math.min(types.size, 14)}/14 kinds of step used` },
  ];
}

export function useWorkflowStats(enabled: boolean, version: number): WorkflowStats | null {
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    workflowApi.stats().then((res) => {
      if (alive && res.ok) setStats(res.data);
    });
    return () => {
      alive = false;
    };
  }, [enabled, version]);
  return stats;
}
