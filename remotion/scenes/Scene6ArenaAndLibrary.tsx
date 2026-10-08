import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

export const Scene6ArenaAndLibrary: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance & Exit Opacity
  const opacity = interpolate(frame, [0, 20, 180, 200], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 3D Staggered Windows Animations with Organic Counter-Float
  const leftSpring = spring({ frame, fps, config: { damping: 14, stiffness: 70 } });
  const rightSpring = spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 14, stiffness: 70 } });

  const ambientFloatX = Math.sin(frame * 0.04) * 0.7;
  const ambientFloatY = Math.cos(frame * 0.035) * 0.7;

  const leftScale = interpolate(leftSpring, [0, 1], [0.75, 0.9]);
  const leftRotateY = interpolate(leftSpring, [0, 1], [25, 12]) + ambientFloatY;
  const leftRotateX = interpolate(leftSpring, [0, 1], [15, 6]) + ambientFloatX;

  const rightScale = interpolate(rightSpring, [0, 1], [0.75, 0.9]);
  const rightRotateY = interpolate(rightSpring, [0, 1], [-25, -12]) - ambientFloatY;
  const rightRotateX = interpolate(rightSpring, [0, 1], [15, 6]) - ambientFloatX;

  // Top Badge Spring
  const badgeSpring = spring({ frame: Math.max(0, frame - 15), fps, config: { damping: 12, stiffness: 90 } });

  // Floating lower pills spring
  const pillSpring = spring({ frame: Math.max(0, frame - 35), fps, config: { damping: 12, stiffness: 90 } });

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
        perspective: '1500px',
      }}
    >
      {/* Background Volumetric Emerald Ambient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.16) 0%, transparent 65%)',
        }}
      />

      {/* Top Header Badge */}
      <div
        style={{
          position: 'absolute',
          top: '36px',
          transform: `scale(${badgeSpring})`,
          padding: '8px 26px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(11, 14, 21, 0.9)',
          border: '1.5px solid rgba(16, 185, 129, 0.45)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8), 0 0 25px rgba(16, 185, 129, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 40,
        }}
      >
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', boxShadow: '0 0 10px #f59e0b' }} />
        <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          WORKSPACES 04 & 05 · THE ARENA BENCHMARK & CURATED LIBRARY
        </span>
      </div>

      {/* Dual 3D Window Container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '30px',
          width: '100%',
          zIndex: 10,
        }}
      >
        {/* Left Window: The Arena Benchmark */}
        <div
          style={{
            width: '800px',
            height: '520px',
            transform: `scale(${leftScale}) rotateX(${leftRotateX}deg) rotateY(${leftRotateY}deg)`,
            transformStyle: 'preserve-3d',
            borderRadius: '20px',
            backgroundColor: '#070a0f',
            border: '1.5px solid rgba(245, 158, 11, 0.45)',
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.9), 0 0 45px rgba(245, 158, 11, 0.25)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              height: '38px',
              backgroundColor: 'rgba(9, 13, 19, 0.95)',
              borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              fontSize: '11px',
              color: '#fbbf24',
              gap: '8px',
            }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            <span style={{ marginLeft: '12px', fontWeight: 800 }}>THE ARENA · PARALLEL MULTI-MODEL BENCHMARK</span>
          </div>
          <Img src={staticFile('screenshots/05_arena_benchmark.png')} style={{ width: '100%', height: 'auto' }} />
        </div>

        {/* Right Window: Prompt Library */}
        <div
          style={{
            width: '800px',
            height: '520px',
            transform: `scale(${rightScale}) rotateX(${rightRotateX}deg) rotateY(${rightRotateY}deg)`,
            transformStyle: 'preserve-3d',
            borderRadius: '20px',
            backgroundColor: '#070a0f',
            border: '1.5px solid rgba(16, 185, 129, 0.45)',
            boxShadow: '0 30px 80px rgba(0, 0, 0, 0.9), 0 0 45px rgba(16, 185, 129, 0.25)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              height: '38px',
              backgroundColor: 'rgba(9, 13, 19, 0.95)',
              borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              fontSize: '11px',
              color: '#34d399',
              gap: '8px',
            }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
            <span style={{ marginLeft: '12px', fontWeight: 800 }}>CURATED LIBRARY & 3D PHYSICS DECK</span>
          </div>
          <Img src={staticFile('screenshots/06_prompt_library.png')} style={{ width: '100%', height: 'auto' }} />
        </div>
      </div>

      {/* Lower Tagline */}
      <div
        style={{
          position: 'absolute',
          bottom: '36px',
          transform: `scale(${pillSpring})`,
          padding: '12px 32px',
          borderRadius: '16px',
          backgroundColor: 'rgba(11, 14, 21, 0.92)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.85)',
          display: 'flex',
          gap: '24px',
          fontSize: '12px',
          color: '#94a3b8',
          letterSpacing: '0.08em',
          zIndex: 40,
        }}
      >
        <span>⚡ PROMISE.ALLSETTLED DUAL DISPATCH</span>
        <span>•</span>
        <span>⚔️ GROQ TURBO VS GEMINI FLASH</span>
        <span>•</span>
        <span>🎴 3D DRAGGABLE CARDS WITH SPRING INERTIA</span>
      </div>
    </AbsoluteFill>
  );
};
