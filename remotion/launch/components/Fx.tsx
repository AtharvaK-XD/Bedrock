import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, EASE, FPS, hash, tealA, tween } from '../theme';

/** Expanding teal rings from a point — used on every impact. */
export const Shockwave: React.FC<{ at: number; x: number; y: number; rings?: number; maxR?: number; color?: string }> = ({
  at,
  x,
  y,
  rings = 3,
  maxR = 900,
  color = C.teal,
}) => {
  const frame = useCurrentFrame();
  if (frame < at || frame > at + 80) return null;
  return (
    <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }} width={1920} height={1080}>
      {Array.from({ length: rings }).map((_, k) => {
        const d = k * 6;
        const p = tween(frame, [at + d, at + d + 56], [0, 1], EASE.outQuart);
        if (p <= 0) return null;
        return (
          <circle
            key={k}
            cx={x}
            cy={y}
            r={40 + p * (maxR - k * 140)}
            fill="none"
            stroke={k === 0 ? '#ffffff' : color}
            strokeOpacity={(1 - p) * (k === 0 ? 0.7 : 0.55)}
            strokeWidth={(1 - p) * (k === 0 ? 5 : 3) + 0.5}
          />
        );
      })}
    </svg>
  );
};

/** Full-frame light flash that decays quickly. */
export const Flash: React.FC<{ at: number; strength?: number; dur?: number; color?: string }> = ({
  at,
  strength = 0.8,
  dur = 16,
  color = '#dff7f2',
}) => {
  const frame = useCurrentFrame();
  if (frame < at - 2 || frame > at + dur) return null;
  const o = tween(frame, [at - 2, at], [0, strength], EASE.outQuart) * tween(frame, [at, at + dur], [1, 0], EASE.outQuart);
  return <AbsoluteFill style={{ background: color, opacity: o, mixBlendMode: 'screen', pointerEvents: 'none' }} />;
};

/** Diagonal light bar sweeping across frame — transition accent. */
export const LightSweep: React.FC<{ at: number; dur?: number; angle?: number; strength?: number }> = ({
  at,
  dur = 30,
  angle = -18,
  strength = 1,
}) => {
  const frame = useCurrentFrame();
  if (frame < at || frame > at + dur) return null;
  const p = tween(frame, [at, at + dur], [0, 1], EASE.inOut);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden', mixBlendMode: 'screen' }}>
      <div
        style={{
          position: 'absolute',
          top: -600,
          bottom: -600,
          width: 520,
          left: -700 + p * 3400,
          transform: `rotate(${angle}deg)`,
          background: `linear-gradient(90deg, transparent 0%, ${tealA(0.22 * strength)} 35%, rgba(230,255,250,${0.5 * strength}) 50%, ${tealA(0.22 * strength)} 65%, transparent 100%)`,
          filter: 'blur(18px)',
        }}
      />
    </AbsoluteFill>
  );
};

/** Deterministic floating dust/particles. */
export const Particles: React.FC<{ count?: number; seed?: number; opacity?: number; speed?: number }> = ({
  count = 70,
  seed = 1,
  opacity = 1,
  speed = 1,
}) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity }}>
      {Array.from({ length: count }).map((_, i) => {
        const r1 = hash(i * 7 + seed);
        const r2 = hash(i * 13 + seed * 3);
        const r3 = hash(i * 29 + seed * 5);
        const x = r1 * 1920 + Math.sin(t * 0.4 + i) * 18;
        const y = ((r2 * 1180 - t * (14 + r3 * 26) * speed) % 1180 + 1180) % 1180 - 50;
        const size = 1.2 + r3 * 2.6;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.8 + r1 * 1.6) + i));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: r1 > 0.72 ? '#ffffff' : C.tealLight,
              opacity: tw * (0.25 + r2 * 0.45),
              boxShadow: `0 0 ${6 + size * 3}px ${tealA(0.7)}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Rotating volumetric light rays behind a hero object. */
export const Rays: React.FC<{ x: number; y: number; opacity: number; size?: number }> = ({ x, y, opacity, size = 1800 }) => {
  const frame = useCurrentFrame();
  const rot = frame * 0.12;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        opacity,
        transform: `rotate(${rot}deg)`,
        background: `repeating-conic-gradient(from 0deg, ${tealA(0.16)} 0deg 3deg, transparent 3deg 14deg)`,
        maskImage: 'radial-gradient(circle, black 0%, transparent 62%)',
        WebkitMaskImage: 'radial-gradient(circle, black 0%, transparent 62%)',
        pointerEvents: 'none',
      }}
    />
  );
};

/** Decaying camera shake applied to children. */
export const Shake: React.FC<{ hits: number[]; intensity?: number; dur?: number; children: React.ReactNode }> = ({
  hits,
  intensity = 10,
  dur = 20,
  children,
}) => {
  const frame = useCurrentFrame();
  let dx = 0;
  let dy = 0;
  let rot = 0;
  hits.forEach((h, k) => {
    if (frame >= h && frame < h + dur) {
      const decay = Math.pow(1 - (frame - h) / dur, 2);
      dx += (hash(frame * 3 + k) - 0.5) * 2 * intensity * decay;
      dy += (hash(frame * 5 + k + 11) - 0.5) * 2 * intensity * decay;
      rot += (hash(frame * 7 + k + 23) - 0.5) * 0.6 * decay;
    }
  });
  return (
    <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)` }}>{children}</AbsoluteFill>
  );
};

/**
 * Digital glitch: renders children once, plus a few horizontally displaced
 * slices during short bursts. `intensity` 0..1. No blend modes, so the frame
 * never washes out.
 */
export const Glitch: React.FC<{ intensity: number; seed?: number; children: React.ReactNode }> = ({ intensity, seed = 1, children }) => {
  const frame = useCurrentFrame();
  const tick = Math.floor(frame / 2);
  const burst = intensity > 0 && hash(tick * 1.37 + seed) < 0.18 + intensity * 0.42;
  return (
    <AbsoluteFill>
      <AbsoluteFill>{children}</AbsoluteFill>
      {burst &&
        [0, 1, 2].map((b) => {
          const top = hash(tick * 3.1 + b * 7.7 + seed) * 1000;
          const h = 14 + hash(tick * 5.3 + b * 2.9 + seed) * (40 + intensity * 90);
          const dx = (hash(tick * 9.7 + b * 4.1 + seed) - 0.5) * 2 * (18 + intensity * 70);
          return (
            <AbsoluteFill
              key={b}
              style={{
                clipPath: `inset(${top}px 0 ${Math.max(0, 1080 - top - h)}px 0)`,
                transform: `translateX(${dx}px)`,
                filter: b === 0 ? 'hue-rotate(-25deg) saturate(1.6)' : b === 1 ? 'hue-rotate(160deg) saturate(1.4)' : 'none',
              }}
            >
              {children}
            </AbsoluteFill>
          );
        })}
    </AbsoluteFill>
  );
};
