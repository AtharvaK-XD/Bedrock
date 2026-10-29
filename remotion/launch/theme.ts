import { Easing, interpolate, spring } from 'remotion';
import { loadFont as loadSpaceGrotesk } from '@remotion/google-fonts/SpaceGrotesk';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadFiraCode } from '@remotion/google-fonts/FiraCode';
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay';
import { FPS } from './constants';

// ============================================================================
// Bedrock Launch Film — design tokens
// All layout is authored in a 1920x1080 design space; <Stage> scales it to the
// composition size (2560x1440 for the 2K master).
// ============================================================================

export { FPS, TOTAL_FRAMES, DESIGN_W, DESIGN_H } from './constants';

// Same font stack as the Bedrock app (tailwind.config.js)
const display = loadSpaceGrotesk('normal', { weights: ['500', '600', '700'], subsets: ['latin'] });
const sans = loadInter('normal', { weights: ['300', '400', '500', '600', '700'], subsets: ['latin'] });
const mono = loadFiraCode('normal', { weights: ['400', '500'], subsets: ['latin'] });
const serif = loadPlayfair('normal', { weights: ['500', '700'], subsets: ['latin'] });
loadPlayfair('italic', { weights: ['500', '700'], subsets: ['latin'] });

export const FONT = {
  display: display.fontFamily,
  sans: sans.fontFamily,
  mono: mono.fontFamily,
  serif: serif.fontFamily,
};

// #2C9A8B is the app's copper-500 — the primary accent for the whole film
export const C = {
  teal: '#2C9A8B',
  tealLight: '#7CDBCB',
  tealMid: '#4FB0A1',
  tealDeep: '#1F7A6E',
  tealDark: '#103F3A',
  tealInk: '#082522',
  logoMint: '#87D6B6',
  bg: '#030405',
  basalt900: '#15181b',
  basalt800: '#1C2024',
  basalt700: '#20242B',
  text: '#F4F7F6',
  heroGray: '#9CA3AF',
  muted: 'rgba(232, 240, 238, 0.6)',
  dim: 'rgba(232, 240, 238, 0.36)',
  line: 'rgba(255, 255, 255, 0.08)',
  lineStrong: 'rgba(255, 255, 255, 0.14)',
  glass: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 100%)',
  card: 'rgba(12, 15, 17, 0.86)',
  red: '#F0525F',
  amber: '#E8A33D',
  violet: '#A78BFA',
  blue: '#5B9DF5',
};

export const tealA = (a: number) => `rgba(44, 154, 139, ${a})`;
export const whiteA = (a: number) => `rgba(255, 255, 255, ${a})`;

export const EASE = {
  outExpo: Easing.bezier(0.16, 1, 0.3, 1),
  outQuart: Easing.bezier(0.25, 1, 0.5, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  inExpo: Easing.bezier(0.7, 0, 0.84, 0),
  backOut: Easing.bezier(0.34, 1.56, 0.64, 1),
  snap: Easing.bezier(0.7, 0, 0.2, 1),
};

export const SPRING = {
  ui: { stiffness: 180, damping: 20, mass: 1 },
  snappy: { stiffness: 320, damping: 26, mass: 0.9 },
  heavy: { stiffness: 110, damping: 18, mass: 1.4 },
  bouncy: { stiffness: 220, damping: 12, mass: 0.8 },
};

/** Clamped interpolate with an easing — the workhorse of every scene. */
export const tween = (
  frame: number,
  range: [number, number],
  out: [number, number] = [0, 1],
  easing: (t: number) => number = EASE.outExpo,
) =>
  interpolate(frame, range, out, {
    easing,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/** Spring that starts at `delay` frames. */
export const springAt = (
  frame: number,
  delay: number,
  config: { stiffness: number; damping: number; mass: number } = SPRING.ui,
) => spring({ frame: frame - delay, fps: FPS, config });

/** Deterministic pseudo-random in [0,1) from an integer seed. */
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
