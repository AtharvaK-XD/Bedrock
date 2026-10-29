import React from 'react';
import { Img, staticFile, useCurrentFrame } from 'remotion';
import shards from '../data/logoShards.json';
import { C, EASE, hash, tween } from '../theme';

type Tri = [number, number, number, number, number, number, number];
const TRIS = (shards as unknown as { tris: Tri[] }).tris;

/**
 * The real Bedrock logo assembled from triangle shards sampled from
 * public/logo.png (scripts/launch-video/build-logo-shards.py).
 * Shards converge on `at`; the crisp PNG takes over right after impact.
 */
export const LogoAssembly: React.FC<{
  at: number;
  size: number;
  travel?: number;
  scatter?: number;
}> = ({ at, size, travel = 50, scatter = 1300 }) => {
  const frame = useCurrentFrame();
  const png = tween(frame, [at + 2, at + 14]);
  const glow = tween(frame, [at - 6, at], [0, 1]) * tween(frame, [at, at + 40], [1, 0.35]);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {png < 1 && (
        <svg viewBox="0 0 512 512" width={size} height={size} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          {TRIS.map((t, i) => {
            const cx = (t[0] + t[2] + t[4]) / 3;
            const cy = (t[1] + t[3] + t[5]) / 3;
            const arrive = at - Math.round(hash(i * 3.1) * 16);
            const p = tween(frame, [arrive - travel, arrive], [0, 1], EASE.outQuart);
            if (p <= 0) return null;
            const ang = hash(i * 1.7) * Math.PI * 2;
            const dist = scatter * (0.45 + hash(i * 2.3) * 0.55);
            const dx = Math.cos(ang) * dist * (1 - p);
            const dy = Math.sin(ang) * dist * (1 - p);
            const rot = (hash(i * 5.9) - 0.5) * 720 * (1 - p);
            const sc = 1 + (hash(i * 4.4) * 1.4 - 0.4) * (1 - p);
            const settled = p >= 1;
            return (
              <polygon
                key={i}
                points={`${t[0]},${t[1]} ${t[2]},${t[3]} ${t[4]},${t[5]}`}
                transform={`translate(${dx} ${dy}) translate(${cx} ${cy}) rotate(${rot}) scale(${sc}) translate(${-cx} ${-cy})`}
                fill={settled ? C.logoMint : C.tealLight}
                fillOpacity={(settled ? t[6] : 0.35 + p * 0.6) * (1 - png)}
                stroke={settled ? 'none' : '#e6fffa'}
                strokeOpacity={0.5 * (1 - p)}
                strokeWidth={0.8}
              />
            );
          })}
        </svg>
      )}
      <Img
        src={staticFile('logo.png')}
        style={{
          position: 'absolute',
          inset: 0,
          width: size,
          height: size,
          opacity: png,
          filter: `drop-shadow(0 0 ${30 + glow * 60}px rgba(124, 219, 203, ${0.35 + glow * 0.5}))`,
        }}
      />
    </div>
  );
};

/** Static crisp logo with a soft halo. */
export const LogoMark: React.FC<{ size: number; halo?: number }> = ({ size, halo = 0.4 }) => (
  <Img
    src={staticFile('logo.png')}
    style={{ width: size, height: size, filter: `drop-shadow(0 0 ${size * 0.12}px rgba(124, 219, 203, ${halo}))` }}
  />
);
