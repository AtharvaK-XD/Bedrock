import { useCallback, useEffect, useRef, useState } from 'react';
import { showToast } from '../../lib/notify';
import { MISSIONS, deriveMissions, loadMissionProgress, newlyCompleted, saveMissionProgress, type MissionId } from './missionList';

interface GraphNode {
  id: string;
  data?: { nodeType?: string; status?: string; conditionResult?: boolean; evalScore?: number };
}
interface GraphEdge {
  source: string;
  target: string;
}

/**
 * Tracks mission progress from the canvas. The first look at the canvas after the page opens is silent
 * (opening an old workflow that already ran should not set off confetti); after that, each newly finished mission
 * shows a toast and a short burst of confetti.
 */
export function useMissions(nodes: GraphNode[], edges: GraphEdge[]) {
  const [done, setDone] = useState<MissionId[]>(() => loadMissionProgress());
  const [burst, setBurst] = useState(0);
  const firstLook = useRef(true);
  const doneRef = useRef(done);
  doneRef.current = done;

  const complete = useCallback((ids: MissionId[], celebrate: boolean) => {
    const fresh = newlyCompleted(doneRef.current, ids);
    if (fresh.length === 0) return;
    const next = [...doneRef.current, ...fresh];
    doneRef.current = next;
    setDone(next);
    saveMissionProgress(next);
    if (celebrate) {
      setBurst((b) => b + 1);
      const titles = fresh.map((id) => MISSIONS.find((m) => m.id === id)?.title).filter(Boolean);
      showToast(`Mission complete: ${titles.join(', ')}`, 'success');
    }
  }, []);

  useEffect(() => {
    const derived = deriveMissions(nodes, edges);
    complete(derived, !firstLook.current);
    firstLook.current = false;
  }, [nodes, edges, complete]);

  /** For missions that are an event rather than a canvas fact (saving). */
  const markDone = useCallback((id: MissionId) => complete([id], true), [complete]);

  return { done, burst, markDone };
}
