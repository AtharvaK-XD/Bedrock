import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BrowserMockup } from '../components/BrowserMockup';

export const Scene4BranchingDAG: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance & Exit Opacity
  const opacity = interpolate(frame, [0, 20, 320, 340], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 3D Camera Dynamics (Dramatic wide angle to straight on)
  const entranceSpring = spring({ frame, fps, config: { damping: 14, stiffness: 65 } });
  const scale = interpolate(entranceSpring, [0, 1], [0.82, 0.98]);
  const rotateX = interpolate(entranceSpring, [0, 1], [15, 3]);
  const rotateY = interpolate(entranceSpring, [0, 1], [20, 4]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#06080d',
        opacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
        overflow: 'hidden',
        perspective: '1400px',
      }}
    >
      {/* Background Volumetric Cyan/Emerald Gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 60% 50%, rgba(6, 182, 212, 0.16) 0%, transparent 60%), radial-gradient(circle at 30% 30%, rgba(16, 185, 129, 0.12) 0%, transparent 60%)',
        }}
      />

      {/* Floating Top Badge */}
      <div
        style={{
          position: 'absolute',
          top: '36px',
          padding: '8px 24px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(11, 14, 21, 0.9)',
          border: '1px solid rgba(6, 182, 212, 0.4)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(6, 182, 212, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 40,
        }}
      >
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#06b6d4', boxShadow: '0 0 8px #06b6d4' }} />
        <span style={{ fontSize: '12px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          WORKSPACE 03 · VISUAL BRANCHING CANVAS (XYFLOW DAG)
        </span>
      </div>

      {/* Real Bedrock Branching Canvas Mockup */}
      <BrowserMockup
        imageSrc="screenshots/04_branching_canvas.png"
        url="bedrock://app/branching"
        rotateX={rotateX}
        rotateY={rotateY}
        scale={scale}
        glowColor="rgba(6, 182, 212, 0.4)"
      />

      {/* Node Acceleration Pillars */}
      <div
        style={{
          position: 'absolute',
          bottom: '44px',
          display: 'flex',
          gap: '20px',
          zIndex: 40,
        }}
      >
        <div
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            backgroundColor: 'rgba(11, 14, 21, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            fontSize: '12px',
            color: '#f8fafc',
            fontWeight: 700,
          }}
        >
          🌿 8 Custom Node Types (SYS, PROMPT, ROUTE, CODE, DATA, MERGE, EVAL, OUT)
        </div>
        <div
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            backgroundColor: 'rgba(11, 14, 21, 0.9)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            backdropFilter: 'blur(20px)',
            fontSize: '12px',
            color: '#10b981',
            fontWeight: 700,
          }}
        >
          🚀 Hardware Composite Layer (transform: translate3d)
        </div>
        <div
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            backgroundColor: 'rgba(11, 14, 21, 0.9)',
            border: '1px solid rgba(200, 168, 107, 0.3)',
            backdropFilter: 'blur(20px)',
            fontSize: '12px',
            color: '#c8a86b',
            fontWeight: 700,
          }}
        >
          🔍 Spacebar Panning & Smooth Scroll-Wheel Zoom
        </div>
      </div>
    </AbsoluteFill>
  );
};
