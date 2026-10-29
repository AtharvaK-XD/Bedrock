import React, { type CSSProperties } from 'react';
import { useCurrentFrame } from 'remotion';
import { C, EASE, FONT, tween } from '../theme';

/**
 * Masked word-by-word reveal. Pass `timings` (local frames per word, from
 * sceneCues().words) to lock each word to the moment it is spoken.
 */
export const WordReveal: React.FC<{
  text: string;
  at?: number;
  stagger?: number;
  dur?: number;
  timings?: number[];
  exitAt?: number;
  exitDur?: number;
  style?: CSSProperties;
  wordStyle?: (index: number, word: string) => CSSProperties;
  from?: 'below' | 'above';
}> = ({ text, at = 0, stagger = 4, dur = 26, timings, exitAt, exitDur = 16, style, wordStyle, from = 'below' }) => {
  const frame = useCurrentFrame();
  const words = text.split(' ');
  const dir = from === 'below' ? 1 : -1;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '0.24em', ...style }}>
      {words.map((w, i) => {
        const s = timings?.[i] ?? at + i * stagger;
        const p = tween(frame, [s, s + dur], [0, 1], EASE.outExpo);
        const e = exitAt === undefined ? 0 : tween(frame, [exitAt + i * 2, exitAt + i * 2 + exitDur], [0, 1], EASE.inExpo);
        return (
          <span
            key={i}
            style={{ display: 'inline-block', overflow: 'hidden', padding: '0.12em 0.04em', margin: '-0.12em -0.04em' }}
          >
            <span
              style={{
                display: 'inline-block',
                transform: `translateY(${dir * (1 - p) * 108 - dir * e * 108}%)`,
                filter: `blur(${(1 - p) * 10 + e * 8}px)`,
                opacity: Math.min(1, p * 1.4) * (1 - e),
                ...wordStyle?.(i, w),
              }}
            >
              {w}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/** Single word/line that slams in from scale with a blur trail. */
export const Slam: React.FC<{
  at: number;
  children: React.ReactNode;
  style?: CSSProperties;
  exitAt?: number;
  fromScale?: number;
}> = ({ at, children, style, exitAt, fromScale = 1.9 }) => {
  const frame = useCurrentFrame();
  const p = tween(frame, [at, at + 14], [0, 1], EASE.outExpo);
  const e = exitAt === undefined ? 0 : tween(frame, [exitAt, exitAt + 12], [0, 1], EASE.inExpo);
  if (frame < at) return null;
  return (
    <div
      style={{
        transform: `scale(${fromScale - (fromScale - 1) * p - e * 0.15})`,
        filter: `blur(${(1 - p) * 14 + e * 10}px)`,
        opacity: Math.min(1, p * 2) * (1 - e),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Small mono eyebrow label with a teal tick, e.g. "02 — GENERATOR". */
export const Eyebrow: React.FC<{ at: number; label: string; index?: string; style?: CSSProperties; exitAt?: number }> = ({
  at,
  label,
  index,
  style,
  exitAt,
}) => {
  const frame = useCurrentFrame();
  const p = tween(frame, [at, at + 22]);
  const e = exitAt === undefined ? 0 : tween(frame, [exitAt, exitAt + 12], [0, 1], EASE.inExpo);
  const chars = Math.round(label.length * tween(frame, [at + 4, at + 30], [0, 1], EASE.outQuart));
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        fontFamily: FONT.mono,
        fontSize: 18,
        letterSpacing: '0.22em',
        color: C.tealLight,
        opacity: p * (1 - e),
        ...style,
      }}
    >
      <span style={{ width: 34 * p, height: 2, background: C.teal, boxShadow: `0 0 12px ${C.teal}` }} />
      {index && <span style={{ color: C.dim }}>{index}</span>}
      <span>{label.slice(0, chars)}</span>
    </div>
  );
};

/** Counts from `from` to `to` between frames — for stats and metrics. */
export const Counter: React.FC<{
  at: number;
  dur?: number;
  from?: number;
  to: number;
  decimals?: number;
  suffix?: string;
  style?: CSSProperties;
}> = ({ at, dur = 40, from = 0, to, decimals = 0, suffix = '', style }) => {
  const frame = useCurrentFrame();
  const v = tween(frame, [at, at + dur], [from, to], EASE.outQuart);
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
};
