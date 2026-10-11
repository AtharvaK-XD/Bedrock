import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { COLORS, LAYOUT_ZONES, SCENE_TIMINGS, TOTAL_FRAMES } from './MotionTokens';

export const GlobalProgressRail: React.FC = () => {
  const frame = useCurrentFrame();

  const progress = Math.min(1, Math.max(0, frame / TOTAL_FRAMES));
  const totalHeight = LAYOUT_ZONES.progressRail.bottom - LAYOUT_ZONES.progressRail.top;
  const currentY = LAYOUT_ZONES.progressRail.top + progress * totalHeight;

  // Fade out cleanly at 59.5s - 60.0s (frames 3570-3600)
  const masterFade = interpolate(frame, [3570, 3600], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: `${LAYOUT_ZONES.progressRail.x}px`,
        top: `${LAYOUT_ZONES.progressRail.top}px`,
        height: `${totalHeight}px`,
        width: '12px',
        zIndex: 50,
        pointerEvents: 'none',
        opacity: masterFade,
      }}
    >
      {/* Background Track Rail */}
      <div
        style={{
          position: 'absolute',
          left: '4px',
          top: 0,
          bottom: 0,
          width: '3px',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '2px',
        }}
      />

      {/* Filled Progress Rail */}
      <div
        style={{
          position: 'absolute',
          left: '4px',
          top: 0,
          height: `${progress * totalHeight}px`,
          width: '3px',
          backgroundColor: COLORS.mint,
          boxShadow: '0 0 10px rgba(16, 185, 129, 0.65)',
          borderRadius: '2px',
          opacity: 0.85,
        }}
      />

      {/* Riding Head Indicator Dot */}
      <div
        style={{
          position: 'absolute',
          left: '2px',
          top: `${progress * totalHeight - 3}px`,
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          boxShadow: '0 0 12px #10b981, 0 0 4px #ffffff',
        }}
      />

      {/* Scene Start Tick Marks */}
      {SCENE_TIMINGS.map((scene) => {
        const tickRatio = scene.startFrame / TOTAL_FRAMES;
        const tickY = tickRatio * totalHeight;
        const isCurrentScene = frame >= scene.startFrame && frame < scene.endFrame;
        const tickBright = interpolate(
          frame,
          [scene.startFrame, scene.startFrame + 10, scene.startFrame + 40],
          [0.35, 0.85, 0.5],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );

        return (
          <div
            key={scene.id}
            style={{
              position: 'absolute',
              left: 0,
              top: `${tickY}px`,
              width: isCurrentScene ? '10px' : '6px',
              height: '1.5px',
              backgroundColor: isCurrentScene ? COLORS.mint : 'rgba(255, 255, 255, 0.35)',
              opacity: isCurrentScene ? tickBright : 0.3,
              boxShadow: isCurrentScene ? '0 0 6px #10b981' : 'none',
              transform: 'translateY(-50%)',
              transition: 'width 0.2s ease, opacity 0.2s ease',
            }}
          />
        );
      })}
    </div>
  );
};
