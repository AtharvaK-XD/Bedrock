import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile } from 'remotion';

/** Full-bleed Higgsfield background plate, graded to sit under the motion graphics. */
export const Plate: React.FC<{ src: string | null; opacity: number; playbackRate?: number }> = ({ src, opacity, playbackRate = 1 }) => {
  if (!src || opacity <= 0) return null;
  return (
    <AbsoluteFill style={{ opacity }}>
      <OffthreadVideo
        src={staticFile(src)}
        muted
        playbackRate={playbackRate}
        style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(0.9) contrast(1.05) brightness(0.8)' }}
      />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 80% 75% at 50% 50%, transparent 30%, rgba(3,4,5,0.85) 100%)' }} />
    </AbsoluteFill>
  );
};
