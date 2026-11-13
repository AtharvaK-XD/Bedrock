import { useCallback, useEffect, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import {
  planRun,
  runWorkflow,
  type EngineDeps,
  type EngineEvent,
  type EngineLimits,
  type EngineTier,
  type NodeResult,
  type RunSummary,
  type WorkflowGraph,
} from '../../lib/workflowEngine';
import { EMPTY_RUN_STATE, type RunVisualState } from './runState';
import { explainStep, patchForEvent, visualForEvent } from './runMapping';

export type RunMode = 'all' | 'only' | 'from' | 'step';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = Node<any>;

interface RunnerOptions {
  getGraph: () => { nodes: AnyNode[]; edges: Edge[] };
  setNodes: (updater: (nodes: AnyNode[]) => AnyNode[]) => void;
  tier: EngineTier;
  deps: EngineDeps;
  limits?: Partial<EngineLimits>;
  /** Gets the ids that are about to run; false cancels (missing key, plan model, code not allowed) */
  preflight: (ids: string[]) => boolean;
  onFinished?: (summary: RunSummary, mode: RunMode) => void;
  /** Called when the person stops a run, so a question window can close */
  onStop?: () => void;
}

export interface StepState {
  order: string[];
  index: number;
  lastMessage: string | null;
  lastTone: 'ok' | 'skip' | 'error' | null;
}

const toGraph = (g: { nodes: AnyNode[]; edges: Edge[] }): WorkflowGraph => g as unknown as WorkflowGraph;

/**
 * Runs the canvas through the workflow engine and keeps the canvas in step with it:
 * rings on each node (waiting, running, done, skipped, error), streamed text, and the result envelope saved on
 * the node. Also step-by-step mode, which runs one node at a time in the engine's order.
 */
export function useWorkflowRunner(opts: RunnerOptions) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const [visual, setVisual] = useState<RunVisualState>(EMPTY_RUN_STATE);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [step, setStep] = useState<StepState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (clearTimer.current) clearTimeout(clearTimer.current);
    },
    []
  );

  const applyEvent = useCallback((e: EngineEvent) => {
    if (e.type === 'run-start') {
      setVisual((v) => {
        const nodes = { ...v.nodes };
        for (const id of e.order) nodes[id] = 'waiting';
        return { ...v, nodes, active: true };
      });
      return;
    }
    if (e.type === 'run-done') return;
    const nodeId = e.nodeId;
    optsRef.current.setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeId) return n;
        const patch = patchForEvent(e, n.data?.nodeType, n.data?.output);
        return patch ? { ...n, data: { ...n.data, ...patch } } : n;
      })
    );
    const ring = visualForEvent(e);
    if (ring) setVisual((v) => ({ ...v, nodes: { ...v.nodes, [nodeId]: ring } }));
  }, []);

  const execute = useCallback(
    async (mode: RunMode, nodeId?: string): Promise<RunSummary | null> => {
      if (runningRef.current) return null;
      const o = optsRef.current;
      const graph = toGraph(o.getGraph());
      const plan = planRun(graph);
      let ids: string[];
      if (mode === 'all') ids = plan.order;
      else if (mode === 'from' && nodeId) {
        const idx = plan.order.indexOf(nodeId);
        ids = idx >= 0 ? plan.order.slice(idx) : [nodeId];
      } else ids = nodeId ? [nodeId] : [];
      if (plan.cycles.length === 0 && ids.length === 0) return null;
      if (!o.preflight(ids)) return null;

      if (clearTimer.current) clearTimeout(clearTimer.current);
      runningRef.current = true;
      setRunning(true);
      setStopping(false);
      if (mode !== 'step') setVisual({ nodes: {}, active: true, nextStepId: null });
      const controller = new AbortController();
      abortRef.current = controller;
      let summary: RunSummary | null = null;
      try {
        summary = await runWorkflow(graph, {
          deps: o.deps,
          tier: o.tier,
          limits: o.limits,
          signal: controller.signal,
          ...(mode === 'only' || mode === 'step' ? { only: nodeId } : mode === 'from' ? { startFrom: nodeId } : {}),
          onEvent: applyEvent,
        });
      } finally {
        runningRef.current = false;
        abortRef.current = null;
        setRunning(false);
        setStopping(false);
        setVisual((v) => ({ ...v, active: false }));
      }
      if (summary) o.onFinished?.(summary, mode);
      if (mode !== 'step') {
        clearTimer.current = setTimeout(() => setVisual((v) => (v.active ? v : EMPTY_RUN_STATE)), 6000);
      }
      return summary;
    },
    [applyEvent]
  );

  const runAll = useCallback(() => execute('all'), [execute]);
  const runOnly = useCallback((id: string) => execute('only', id), [execute]);
  const runFrom = useCallback((id: string) => execute('from', id), [execute]);

  const stop = useCallback(() => {
    if (!abortRef.current) return;
    setStopping(true);
    abortRef.current.abort();
    optsRef.current.onStop?.();
  }, []);

  // ---- Step-by-step
  const startSteps = useCallback(() => {
    if (runningRef.current) return;
    if (clearTimer.current) clearTimeout(clearTimer.current);
    const plan = planRun(toGraph(optsRef.current.getGraph()));
    if (plan.order.length === 0) return;
    const nodes: RunVisualState['nodes'] = {};
    for (const id of plan.order) nodes[id] = 'waiting';
    setVisual({ nodes, active: false, nextStepId: plan.order[0] });
    setStep({ order: plan.order, index: 0, lastMessage: null, lastTone: null });
  }, []);

  const exitSteps = useCallback(() => {
    setStep(null);
    setVisual(EMPTY_RUN_STATE);
  }, []);

  const nextStep = useCallback(async () => {
    const s = step;
    if (!s || s.index >= s.order.length || runningRef.current) return;
    const id = s.order[s.index];
    const exists = optsRef.current.getGraph().nodes.some((n) => n.id === id);
    let message: string;
    let tone: StepState['lastTone'];
    if (!exists) {
      message = 'That step was deleted, so it was passed over.';
      tone = 'skip';
    } else {
      const summary = await execute('step', id);
      if (!summary) return;
      const result: NodeResult | undefined = summary.results[id];
      const title = optsRef.current.getGraph().nodes.find((n) => n.id === id)?.data?.title || 'This step';
      message = explainStep(result, title);
      tone = result?.error ? 'error' : result?.skipped ? 'skip' : 'ok';
    }
    const nextIndex = s.index + 1;
    setStep({ ...s, index: nextIndex, lastMessage: message, lastTone: tone });
    setVisual((v) => ({ ...v, nextStepId: s.order[nextIndex] ?? null }));
  }, [step, execute]);

  return { visual, running, stopping, runAll, runOnly, runFrom, stop, step, startSteps, nextStep, exitSteps };
}
