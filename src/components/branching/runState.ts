import { createContext, useContext } from 'react';

/** Where each node is in a "Run all" (or step-by-step) run. Kept outside the node data, so it is never saved. */
export type NodeRunState = 'waiting' | 'running' | 'done' | 'skipped' | 'error';

export interface RunVisualState {
  /** nodeId -> state, only for nodes in the current or last run */
  nodes: Record<string, NodeRunState>;
  /** True while a run is going */
  active: boolean;
  /** The node the step-by-step mode will run next */
  nextStepId: string | null;
}

export const EMPTY_RUN_STATE: RunVisualState = { nodes: {}, active: false, nextStepId: null };

export const RunStateContext = createContext<RunVisualState>(EMPTY_RUN_STATE);

export function useRunState(): RunVisualState {
  return useContext(RunStateContext);
}

/** Event a node uses to ask the editor to run it (or everything from it) through the engine. */
export const ENGINE_RUN_EVENT = 'bedrock_branching_engine_run';

export function requestEngineRun(nodeId: string, mode: 'only' | 'from'): void {
  window.dispatchEvent(new CustomEvent(ENGINE_RUN_EVENT, { detail: { nodeId, mode } }));
}
