import React from 'react';
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, DESIGN_H, DESIGN_W, FPS, hash, tealA } from '../theme';

/** Scales the 1920x1080 design space to whatever the composition size is. */
export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width } = useVideoConfig();
  const s = width / DESIGN_W;
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `scale(${s})`,
          transformOrigin: '0 0',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

/** Basalt background with drifting teal light and an optional dot grid. */
export const Backdrop: React.FC<{
  glow?: number;
  grid?: number;
  gridX?: number;
  gridY?: number;
  gridSize?: number;
}> = ({ glow = 1, grid = 0, gridX = 0, gridY = 0, gridSize = 36 }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const ax = 28 + Math.sin(t * 0.31) * 9;
  const ay = 32 + Math.cos(t * 0.23) * 7;
  const bx = 74 + Math.cos(t * 0.27) * 8;
  const by = 70 + Math.sin(t * 0.19) * 8;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(120% 95% at 50% 42%, #0a1312 0%, ${C.bg} 64%)` }} />
      <AbsoluteFill
        style={{
          opacity: glow,
          background: `radial-gradient(38% 46% at ${ax}% ${ay}%, ${tealA(0.17)}, transparent 72%), radial-gradient(34% 40% at ${bx}% ${by}%, ${tealA(0.11)}, transparent 72%)`,
        }}
      />
      {grid > 0 && (
        <AbsoluteFill
          style={{
            opacity: grid,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.16) 1.3px, transparent 1.8px)',
            backgroundSize: `${gridSize}px ${gridSize}px`,
            backgroundPosition: `${gridX}px ${gridY}px`,
            maskImage: 'radial-gradient(ellipse 72% 68% at 50% 50%, black 35%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 72% 68% at 50% 50%, black 35%, transparent 100%)',
          }}
        />
      )}
    </AbsoluteFill>
  );
};

/** Film grain + vignette, rendered on top of everything. */
export const FilmGrade: React.FC = () => {
  const frame = useCurrentFrame();
  const ox = Math.floor(hash(frame) * 240);
  const oy = Math.floor(hash(frame + 977) * 240);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill
        style={{
          backgroundImage: `url(${staticFile('noise.svg')})`,
          backgroundSize: '240px 240px',
          backgroundPosition: `${ox}px ${oy}px`,
          opacity: 0.16,
          mixBlendMode: 'overlay',
        }}
      />
      <AbsoluteFill
        style={{ background: 'radial-gradient(ellipse 88% 82% at 50% 50%, transparent 56%, rgba(0,0,0,0.62) 100%)' }}
      />
    </AbsoluteFill>
  );
};
