import { TOTAL_FRAMES } from './constants';
import { SCENES, cue, cueWords } from './timeline';

// ============================================================================
// Sound-design beats in absolute frames. Node-safe (no fonts / DOM), so the
// score builder exports these via scripts/launch-video/export-cues.mts.
// Derived beats (shatter, logo impact) are also imported by the scenes, so
// picture and sound always hit the same frame.
// ============================================================================

export type HitKind =
  | 'click'
  | 'tick'
  | 'pop'
  | 'whoosh'
  | 'whooshHeavy'
  | 'glitch'
  | 'alarm'
  | 'impactSoft'
  | 'impact'
  | 'boom'
  | 'shatter'
  | 'chime'
  | 'riser'
  | 'stamp';

export interface Hit {
  f: number;
  kind: HitKind;
  gain?: number;
  len?: number; // frames, for risers
}

const problemAlarm = cue('problem', 'And production', 0.86);
export const PROBLEM_SHATTER = Math.min(
  Math.max(cue('problem', 'breaks', 0.95) + 2, problemAlarm + 20),
  SCENES.problem.from + SCENES.problem.dur - 34,
);
export const REVEAL_IMPACT = Math.max(SCENES.reveal.from + 30, cue('reveal', 'Bedrock', 0.25));

const sceneEnd = (id: keyof typeof SCENES) => SCENES[id].from + SCENES[id].dur;

const generator = () => {
  const asks = cue('generator', 'asks the right questions', 0.2);
  const hits: Hit[] = [
    { f: SCENES.generator.from + 2, kind: 'whooshHeavy', gain: 0.8 },
    { f: asks - 8, kind: 'click' },
    ...[0, 1, 2].map((i) => ({ f: asks + 10 + i * 9 + 20 + i * 6, kind: 'tick' as const, gain: 0.7 })),
    { f: cue('generator', 'then synthesizes', 0.4), kind: 'whoosh', gain: 0.45 },
    ...[0, 1, 2, 3].map((i) => ({ f: cue('generator', 'then synthesizes', 0.4) + 8 + i * 13, kind: 'tick' as const, gain: 0.5 })),
    { f: cue('generator', 'Structured', 0.72), kind: 'impactSoft' },
    { f: cue('generator', 'Constrained', 0.82), kind: 'impactSoft' },
    { f: cue('generator', 'Ready to ship', 0.9), kind: 'stamp' },
    { f: sceneEnd('generator') - 20, kind: 'whoosh', gain: 0.8 },
  ];
  return hits;
};

const branching = () => {
  const chain = cue('branching', 'Chain prompts', 0);
  const route = cue('branching', 'Route conditions', 0.45);
  const merge = cue('branching', 'merge consensus', 0.62);
  const orch = cue('branching', 'orchestrate', 0.78);
  const pops = [Math.max(SCENES.branching.from + 4, chain - 10), chain + 10, route - 6, route + 8, route + 14, merge - 4];
  return [
    ...pops.map((f) => ({ f, kind: 'pop' as const, gain: 0.8 })),
    { f: orch - 40, kind: 'riser' as const, len: 40, gain: 0.5 },
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ f: orch + 8 + i * 9 + 16, kind: 'tick' as const, gain: 0.55 })),
    { f: sceneEnd('branching') - 20, kind: 'whoosh' as const, gain: 0.8 },
  ];
};

const arena = () => {
  const bench = cue('arena', 'Benchmark side by side', 0.2);
  const ten = cue('arena', 'ten frontier models', 0.45);
  return [
    { f: cue('arena', 'Then prove it', 0), kind: 'impact' as const, gain: 0.8 },
    ...[0, 1, 2, 3].map((i) => ({ f: bench + i * 5, kind: 'whoosh' as const, gain: 0.3 })),
    { f: ten, kind: 'chime' as const, gain: 0.7 },
    ...Array.from({ length: 10 }, (_, i) => ({ f: ten - 8 + i * 3, kind: 'pop' as const, gain: 0.45 })),
    { f: cue('arena', 'live latency', 0.7), kind: 'tick' as const, gain: 0.6 },
    { f: sceneEnd('arena') - 20, kind: 'whooshHeavy' as const, gain: 0.7 },
  ];
};

const exportHits = () => {
  const named = ['Cursor', 'Claude Code', 'Windsurf', 'Copilot', 'Vercel AI SDK'];
  const more = cue('export', 'and more', 0.7);
  return [
    { f: cue('export', 'Export in one click', 0) - 6, kind: 'click' as const },
    ...named.map((w, i) => ({ f: cue('export', w, 0.15 + i * 0.1), kind: 'pop' as const, gain: 0.9 })),
    ...Array.from({ length: 10 }, (_, i) => ({ f: more + i * 3, kind: 'tick' as const, gain: 0.5 })),
    { f: cue('export', 'Fifteen formats', 0.86), kind: 'impact' as const },
    { f: sceneEnd('export') - 6, kind: 'whooshHeavy' as const, gain: 0.7 },
  ];
};

const cta = () => {
  const start = cueWords('cta', 'Start engineering.', 0.3)[0];
  const slam = cue('cta', 'Bedrock', 0.55);
  return [
    { f: cue('cta', 'Stop guessing', 0), kind: 'impactSoft' as const, gain: 0.7 },
    { f: start, kind: 'impact' as const },
    { f: slam - 46, kind: 'riser' as const, len: 46, gain: 0.8 },
    { f: slam, kind: 'boom' as const },
    { f: slam, kind: 'chime' as const, gain: 0.8 },
    { f: cue('cta', 'Download free', 0.7) - 12, kind: 'whoosh' as const, gain: 0.5 },
  ];
};

export const HITS: Hit[] = [
  // 01 problem
  { f: cue('problem', 'and a hope', 0.45) - 2, kind: 'click' },
  { f: cue('problem', 'and a hope', 0.45) + 2, kind: 'whoosh', gain: 0.55 },
  { f: cue('problem', 'Then the model updates', 0.58) + 4, kind: 'glitch', gain: 0.7 },
  { f: cue('problem', 'The output drifts', 0.72) + 8, kind: 'glitch' },
  { f: problemAlarm, kind: 'alarm' },
  { f: problemAlarm, kind: 'impactSoft', gain: 0.8 },
  { f: PROBLEM_SHATTER, kind: 'shatter' },
  // 02 reveal — riser out of the silence into the logo slam
  { f: REVEAL_IMPACT - 54, kind: 'riser', len: 54, gain: 0.9 },
  { f: REVEAL_IMPACT, kind: 'boom' },
  { f: REVEAL_IMPACT, kind: 'chime' },
  { f: cue('reveal', 'Intelligence', 0.45) - 4, kind: 'whoosh', gain: 0.35 },
  { f: sceneEnd('reveal') - 24, kind: 'whooshHeavy', gain: 0.8 },
  ...generator(),
  ...branching(),
  ...arena(),
  ...exportHits(),
  ...cta(),
].filter((h) => h.f >= 0 && h.f < TOTAL_FRAMES);

/** Music structure markers (absolute frames). */
export const MUSIC = {
  tensionEnd: PROBLEM_SHATTER,
  drop: REVEAL_IMPACT,
  arenaBreak: cue('arena', 'Then prove it', 0),
  finalSlam: cue('cta', 'Bedrock', 0.55),
};
