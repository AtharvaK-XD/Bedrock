import { Easing } from 'remotion';

// ============================================================================
// 🎬 MOTION TOKENS & DESIGN CONSTANTS (1920x1080 @ 60 FPS)
// ============================================================================

export const FPS = 60;
export const TOTAL_FRAMES = 3600; // 60.0 Seconds
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Color Palette - Locked: Near-black, mint-green accent, mono code cards, bold white
export const COLORS = {
  bg: '#05080a',
  bgCard: 'rgba(10, 14, 18, 0.78)',
  bgCardGlass: 'linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.02) 100%)',
  mint: '#10b981',
  mintGlow: 'rgba(16, 185, 129, 0.45)',
  mintBorder: 'rgba(16, 185, 129, 0.28)',
  mintText: '#34d399',
  white: '#ffffff',
  textMuted: 'rgba(255, 255, 255, 0.55)',
  textDim: 'rgba(255, 255, 255, 0.38)',
  borderMuted: 'rgba(255, 255, 255, 0.07)',
  cardBorder: '1px solid rgba(255, 255, 255, 0.08)',
  errorRed: '#f43f5e',
};

// 5.0 Easing Tokens
export const EASINGS = {
  OUT_EXPO: Easing.bezier(0.16, 1, 0.3, 1),
  IN_OUT: Easing.bezier(0.65, 0, 0.35, 1),
  BACK_OUT: Easing.bezier(0.34, 1.56, 0.64, 1),
  SNAP: Easing.bezier(0.7, 0, 0.2, 1),
  IN_EXPO: Easing.bezier(0.7, 0, 0.84, 0),
};

// 5.0 Spring Presets (60 fps calibrated)
export const SPRINGS = {
  UI: { stiffness: 180, damping: 20 },
  HEAVY: { stiffness: 120, damping: 22 },
  SNAPPY: { stiffness: 260, damping: 24 },
};

// Precise Hit Frames (+/- 2 frames at 60 fps)
export const HIT_FRAMES = {
  HIT_1: 680,   // 11.33 s (Logo resolve / slam)
  HIT_2: 2598,  // 43.30 s (Arena head-to-head collision)
  HIT_3: 3120,  // 52.00 s ("Stop guessing." crash zoom)
  HIT_4: 3225,  // 53.75 s ("Start engineering." crash zoom)
  HIT_5: 3317,  // 55.28 s (End card logo slam)
};

// 4.1 Zone Definitions
export const LAYOUT_ZONES = {
  margins: { x: 120, bottom: 50 },
  progressRail: { x: 1884, width: 3, top: 120, bottom: 960 },
  eyebrow: { top: 56, height: 32, fontSize: 22 },
  headline: { top: 100, height: 80, fontSize: 64, maxWidth: 1500 },
  diagram: { x1: 160, x2: 1760, y1: 230, y2: 830 },
  pillRow: { top: 875, y: 875, height: 48 },
  caption: { top: 940, y: 940, height: 90, fontSize: 40, maxWidth: 1200 },
};

// 3. Locked Copy and Scene Boundaries
export interface SceneTiming {
  id: number;
  startFrame: number;
  endFrame: number;
  headline: string;
  eyebrow: string;
  captions?: string[];
  keyWord?: string;
}

export const SCENE_TIMINGS: SceneTiming[] = [
  {
    id: 1,
    startFrame: 0,
    endFrame: 336, // 0.0 - 5.6s
    eyebrow: 'PROMPT ARCHITECTURE',
    headline: 'AI development is broken.',
    captions: [
      'The modern software landscape is a labyrinth.',
      'We chain prompts, we wrangle context, we pray for coherence.',
    ],
    keyWord: 'broken.',
  },
  {
    id: 2,
    startFrame: 336,
    endFrame: 600, // 5.6 - 10.0s
    eyebrow: 'DETERMINISTIC COMPILATION',
    headline: 'What if prompts had compiler rigor?',
    captions: [
      'We chain prompts, we wrangle context, we pray for coherence.',
      'The result? Fragile abstractions built on shifting sands.',
    ],
    keyWord: 'compiler rigor?',
  },
  {
    id: 3,
    startFrame: 600,
    endFrame: 708, // 10.0 - 11.8s
    eyebrow: 'ENTERPRISE WORKSTATION',
    headline: 'BEDROCK WORKSTATION',
    captions: ['The enterprise prompt engineering workstation.'],
    keyWord: 'WORKSTATION',
  },
  {
    id: 4,
    startFrame: 708,
    endFrame: 798, // 11.8 - 13.3s
    eyebrow: 'CORE RUNTIME',
    headline: 'Meet Bedrock.',
    captions: ['Meet Bedrock.'],
    keyWord: 'Bedrock.',
  },
  {
    id: 5,
    startFrame: 798,
    endFrame: 1050, // 13.3 - 17.5s
    eyebrow: 'FRONTIER INTELLIGENCE',
    headline: 'The premier engineering workstation.',
    captions: ['The premier engineering workstation built for frontier intelligence.'],
    keyWord: 'workstation.',
  },
  {
    id: 6,
    startFrame: 1050,
    endFrame: 1230, // 17.5 - 20.5s
    eyebrow: 'UNIFIED MODEL MATRIX',
    headline: '10 frontier models. One engine.',
    captions: ['Ten frontier models.'],
    keyWord: 'One engine.',
  },
  {
    id: 7,
    startFrame: 1230,
    endFrame: 1320, // 20.5 - 22.0s
    eyebrow: 'PORTABLE ARCHITECTURE',
    headline: 'Zero vendor lock-in.',
    captions: ['Zero lock-in.'],
    keyWord: 'lock-in.',
  },
  {
    id: 8,
    startFrame: 1320,
    endFrame: 1428, // 22.0 - 23.8s
    eyebrow: 'LIVE TELEMETRY',
    headline: 'Real-time observability.',
    captions: ['Real-time telemetry.'],
    keyWord: 'observability.',
  },
  {
    id: 9,
    startFrame: 1428,
    endFrame: 1560, // 23.8 - 26.0s
    eyebrow: 'NEURAL DIRECTIVES',
    headline: 'Zero-shot to production.',
    captions: ['From zero-shot to production-grade directives in milliseconds.'],
    keyWord: 'production.',
  },
  {
    id: 10,
    startFrame: 1560,
    endFrame: 1920, // 26.0 - 32.0s
    eyebrow: 'VERIFICATION SYNTHESIS',
    headline: 'Multi-pass reasoning.',
    captions: ['Multi-pass reasoning, strict schema validation, and zero-coding archetypes.'],
    keyWord: 'Multi-pass',
  },
  {
    id: 11,
    startFrame: 1920,
    endFrame: 2220, // 32.0 - 37.0s
    eyebrow: 'VISUAL ORCHESTRATION',
    headline: 'Agentic reasoning paths.',
    captions: ['Architect complex agentic reasoning on an infinite DAG canvas.'],
    keyWord: 'paths.',
  },
  {
    id: 12,
    startFrame: 2220,
    endFrame: 2598, // 37.0 - 43.3s
    eyebrow: 'TACTILE PHYSICS',
    headline: 'Sub-millisecond pruning.',
    captions: ['Branch workflows, run parallel evaluations, and prune dead paths with sub-millisecond tactile physics.'],
    keyWord: 'pruning.',
  },
  {
    id: 13,
    startFrame: 2598,
    endFrame: 2820, // 43.3 - 47.0s
    eyebrow: 'ARENA BENCHMARK',
    headline: 'Frontier head-to-head.',
    captions: ['Pit frontier LLMs head-to-head in the Arena.'],
    keyWord: 'head-to-head.',
  },
  {
    id: 14,
    startFrame: 2820,
    endFrame: 3114, // 47.0 - 51.9s
    eyebrow: 'RUNTIME COMPATIBILITY',
    headline: '15 export frameworks.',
    captions: ['Then export hardened system directives across fifteen production frameworks.'],
    keyWord: 'frameworks.',
  },
  {
    id: 15,
    startFrame: 3114,
    endFrame: 3204, // 51.9 - 53.4s
    eyebrow: 'THE PAST',
    headline: 'Stop guessing.',
    captions: ['Stop guessing.'],
    keyWord: 'Stop',
  },
  {
    id: 16,
    startFrame: 3204,
    endFrame: 3317, // 53.4 - 55.3s
    eyebrow: 'THE FUTURE',
    headline: 'Start engineering.',
    captions: ['Start engineering.'],
    keyWord: 'engineering.',
  },
  {
    id: 17,
    startFrame: 3317,
    endFrame: 3600, // 55.3 - 60.0s
    eyebrow: 'PRODUCTION RELEASE',
    headline: 'Bedrock',
    captions: ['The bedrock of intelligent software.'],
    keyWord: 'Bedrock',
  },
];
