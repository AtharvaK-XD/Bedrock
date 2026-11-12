import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  HISTORY_LIMIT,
  carryRuntimeFields,
  emptyHistory,
  recordStep,
  redoStep,
  structureKey,
  undoStep,
  type GraphSnapshot,
} from '../history';
import { autoArrange, computeDepths } from '../layout';
import { MISSIONS, deriveMissions, largestConnectedGroup, loadMissionProgress, newlyCompleted, saveMissionProgress } from '../missionList';

type TestNode = { id: string; position: { x: number; y: number }; data: Record<string, unknown> };
const node = (id: string, x = 0, y = 0, data: Record<string, unknown> = {}): TestNode => ({ id, position: { x, y }, data: { nodeType: 'prompt', title: id, ...data } });
const edge = (id: string, source: string, target: string) => ({ id, source, target });

describe('undo / redo history', () => {
  const snap = (n: number): GraphSnapshot<string, string> => ({ nodes: [`n${n}`], edges: [] });

  it('undoes and redoes in order', () => {
    let state = emptyHistory<string, string>();
    state = recordStep(state, snap(1));
    state = recordStep(state, snap(2));
    const undone = undoStep(state, snap(3));
    expect(undone.restored).toEqual(snap(2));
    const again = undoStep(undone.state, snap(2));
    expect(again.restored).toEqual(snap(1));
    const redone = redoStep(again.state, snap(1));
    expect(redone.restored).toEqual(snap(2));
  });

  it('does nothing when there is nothing to undo or redo', () => {
    const state = emptyHistory<string, string>();
    expect(undoStep(state, snap(1)).restored).toBeNull();
    expect(redoStep(state, snap(1)).restored).toBeNull();
  });

  it('a new change after undo clears the redo list', () => {
    let state = recordStep(emptyHistory<string, string>(), snap(1));
    state = undoStep(state, snap(2)).state;
    expect(state.future).toHaveLength(1);
    state = recordStep(state, snap(3));
    expect(state.future).toHaveLength(0);
  });

  it('keeps only the last 50 steps', () => {
    let state = emptyHistory<string, string>();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) state = recordStep(state, snap(i));
    expect(state.past).toHaveLength(HISTORY_LIMIT);
    expect(state.past[0]).toEqual(snap(20));
  });

  it('ignores run results when deciding whether the workflow changed', () => {
    const before = structureKey([node('a', 10, 20)], [edge('e1', 'a', 'b')]);
    const afterRun = structureKey([node('a', 10, 20, { status: 'success', output: 'hello', evalScore: 90, conditionResult: true })], [edge('e1', 'a', 'b')]);
    expect(afterRun).toBe(before);
  });

  it('notices a moved node, an edited setting and a changed wire', () => {
    const base = structureKey([node('a', 10, 20)], [edge('e1', 'a', 'b')]);
    expect(structureKey([node('a', 300, 20)], [edge('e1', 'a', 'b')])).not.toBe(base);
    expect(structureKey([node('a', 10, 20, { description: 'new text' })], [edge('e1', 'a', 'b')])).not.toBe(base);
    expect(structureKey([node('a', 10, 20)], [edge('e1', 'a', 'c')])).not.toBe(base);
    expect(structureKey([node('a', 10, 20)], [])).not.toBe(base);
  });

  it('keeps results a node has produced when an older version is restored', () => {
    const restored = [node('a', 0, 0, { description: 'old text' })];
    const current = [node('a', 0, 0, { description: 'new text', status: 'success', output: 'result' })];
    const merged = carryRuntimeFields(restored, current);
    expect(merged[0].data.description).toBe('old text');
    expect(merged[0].data.output).toBe('result');
    expect(merged[0].data.status).toBe('success');
  });

  it('leaves nodes that did not exist before untouched', () => {
    const merged = carryRuntimeFields([node('z', 5, 5, { output: 'from snapshot' })], []);
    expect(merged[0].data.output).toBe('from snapshot');
  });
});

describe('auto-arrange', () => {
  it('computes depth as the longest chain of wires', () => {
    const depth = computeDepths(['a', 'b', 'c', 'd'], [edge('1', 'a', 'b'), edge('2', 'b', 'c'), edge('3', 'a', 'c'), edge('4', 'a', 'd')]);
    expect(depth.get('a')).toBe(0);
    expect(depth.get('b')).toBe(1);
    expect(depth.get('c')).toBe(2);
    expect(depth.get('d')).toBe(1);
  });

  it('stops on a loop instead of running forever', () => {
    const depth = computeDepths(['a', 'b'], [edge('1', 'a', 'b'), edge('2', 'b', 'a')]);
    expect(depth.size).toBe(2);
  });

  it('lays nodes out left to right and leaves sticky notes where they are', () => {
    const nodes = [node('a', 900, 900), node('b', 5, 5), node('c', 700, 10), node('n', 123, 456, { nodeType: 'note' })];
    const out = autoArrange(nodes, [edge('1', 'a', 'b'), edge('2', 'b', 'c')]);
    const x = (id: string) => out.find((n) => n.id === id)!.position.x;
    expect(x('a')).toBeLessThan(x('b'));
    expect(x('b')).toBeLessThan(x('c'));
    expect(out.find((n) => n.id === 'n')!.position).toEqual({ x: 123, y: 456 });
  });

  it('puts nodes of the same depth in one column, without overlapping', () => {
    const out = autoArrange([node('a', 0, 0), node('b', 0, 50), node('c', 0, 100)], [edge('1', 'a', 'b'), edge('2', 'a', 'c')]);
    const b = out.find((n) => n.id === 'b')!.position;
    const c = out.find((n) => n.id === 'c')!.position;
    expect(b.x).toBe(c.x);
    expect(b.y).not.toBe(c.y);
  });
});

describe('missions', () => {
  it('has the six missions from the plan', () => {
    expect(MISSIONS.map((m) => m.id)).toEqual(['first_run', 'connect_three', 'if_else', 'save_workflow', 'sticky_note', 'judge_80']);
  });

  it('counts the biggest connected group, ignoring sticky notes', () => {
    const nodes = [node('a'), node('b'), node('c'), node('d'), node('n', 0, 0, { nodeType: 'note' })];
    expect(largestConnectedGroup(nodes, [edge('1', 'a', 'b')])).toBe(2);
    expect(largestConnectedGroup(nodes, [edge('1', 'a', 'b'), edge('2', 'b', 'c')])).toBe(3);
    expect(largestConnectedGroup(nodes, [edge('1', 'a', 'n'), edge('2', 'n', 'b')])).toBe(1);
    expect(largestConnectedGroup([], [])).toBe(0);
  });

  it('works out which missions the canvas proves', () => {
    expect(deriveMissions([node('a')], [])).toEqual([]);
    expect(deriveMissions([node('a', 0, 0, { status: 'success' })], [])).toEqual(['first_run']);
    // connecting is an event (see largestConnectedGroup), so an already-wired canvas does not finish it
    expect(deriveMissions([node('a'), node('b'), node('c')], [edge('1', 'a', 'b'), edge('2', 'b', 'c')])).toEqual([]);
    expect(deriveMissions([node('c', 0, 0, { nodeType: 'condition', conditionResult: false })], [])).toEqual(['if_else']);
    expect(deriveMissions([node('c', 0, 0, { nodeType: 'condition' })], [])).toEqual([]);
    expect(deriveMissions([node('n', 0, 0, { nodeType: 'note' })], [])).toEqual(['sticky_note']);
  });

  it('needs a Quality Judge score of 80 or more', () => {
    expect(deriveMissions([node('j', 0, 0, { nodeType: 'evaluation', evalScore: 79 })], [])).toEqual([]);
    expect(deriveMissions([node('j', 0, 0, { nodeType: 'evaluation', evalScore: 80 })], [])).toEqual(['judge_80']);
  });

  it('reports only the missions that are new', () => {
    expect(newlyCompleted(['first_run'], ['first_run', 'if_else'])).toEqual(['if_else']);
    expect(newlyCompleted([], [])).toEqual([]);
  });

  describe('saved progress', () => {
    let store: Record<string, string>;
    beforeEach(() => {
      store = {};
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => void (store[k] = v),
      });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('round-trips and drops unknown ids', () => {
      saveMissionProgress(['first_run', 'sticky_note', 'first_run']);
      expect(loadMissionProgress()).toEqual(['first_run', 'sticky_note']);
      store['bedrock_branching_missions'] = JSON.stringify(['first_run', 'hacked', 7]);
      expect(loadMissionProgress()).toEqual(['first_run']);
    });

    it('survives corrupt or blocked storage', () => {
      store['bedrock_branching_missions'] = '{not json';
      expect(loadMissionProgress()).toEqual([]);
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      });
      expect(loadMissionProgress()).toEqual([]);
      expect(() => saveMissionProgress(['first_run'])).not.toThrow();
    });
  });
});
