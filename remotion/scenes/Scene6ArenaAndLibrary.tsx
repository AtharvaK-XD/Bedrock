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

  // Staggered Entrance Springs
  const leftSpring = spring({ frame, fps, config: { damping: 14, stiffness: 70 } });
  const rightSpring = spring({ frame: Math.max(0, frame - 18), fps, config: { damping: 14, stiffness: 70 } });

  // Subtle Organic Ambient Float (damped when zoomed in)
  const ambientFloatX = Math.sin(frame * 0.04) * 0.65;
  const ambientFloatY = Math.cos(frame * 0.035) * 0.65;

  // ========================================================
  // 🔍 CINEMATIC ZOOM PHASES:
  // Phase 1 (Frames 25–92): Zoom in on THE ARENA (Left Card)
  // Phase 2 (Frames 95–170): Zoom in on CURATED LIBRARY (Right Card)
  // Phase 3 (Frames 170–200): Settle back to dual view before finale cut
  // ========================================================
  const arenaFocus = interpolate(frame, [25, 46, 78, 95], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const libraryFocus = interpolate(frame, [95, 116, 152, 172], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const baseLeftScale = interpolate(leftSpring, [0, 1], [0.75, 0.86]);
  const baseRightScale = interpolate(rightSpring, [0, 1], [0.75, 0.86]);

  // Left Window (The Arena) 3D Transforms & Focus State
  const leftScale = interpolate(
    arenaFocus,
    [0, 1],
    [interpolate(libraryFocus, [0, 1], [baseLeftScale, 0.74]), 1.18]
  );
  const leftTranslateX = interpolate(
    arenaFocus,
    [0, 1],
    [interpolate(libraryFocus, [0, 1], [0, -70]), 250]
  );
  const leftTranslateZ = interpolate(
    arenaFocus,
    [0, 1],
    [interpolate(libraryFocus, [0, 1], [0, -80]), 150]
  );
  const leftRotateY =
    interpolate(
      arenaFocus,
      [0, 1],
      [interpolate(libraryFocus, [0, 1], [interpolate(leftSpring, [0, 1], [25, 12]), 18]), 0]
    ) + ambientFloatY * (1 - arenaFocus);
  const leftRotateX =
    interpolate(
      arenaFocus,
      [0, 1],
      [interpolate(leftSpring, [0, 1], [15, 6]), 0]
    ) + ambientFloatX * (1 - arenaFocus);
  const leftOpacity = interpolate(libraryFocus, [0, 1], [1, 0.38]);
  const leftZIndex = arenaFocus > 0.05 ? 35 : (libraryFocus > 0.05 ? 10 : 20);

  // Right Window (Prompt Library) 3D Transforms & Focus State
  const rightScale = interpolate(
    libraryFocus,
    [0, 1],
    [interpolate(arenaFocus, [0, 1], [baseRightScale, 0.74]), 1.18]
  );
  const rightTranslateX = interpolate(
    libraryFocus,
    [0, 1],
    [interpolate(arenaFocus, [0, 1], [0, 70]), -250]
  );
  const rightTranslateZ = interpolate(
    libraryFocus,
    [0, 1],
    [interpolate(arenaFocus, [0, 1], [0, -80]), 150]
  );
  const rightRotateY =
    interpolate(
      libraryFocus,
      [0, 1],
      [interpolate(arenaFocus, [0, 1], [interpolate(rightSpring, [0, 1], [-25, -12]), -18]), 0]
    ) - ambientFloatY * (1 - libraryFocus);
  const rightRotateX =
    interpolate(
      libraryFocus,
      [0, 1],
      [interpolate(rightSpring, [0, 1], [15, 6]), 0]
    ) - ambientFloatX * (1 - libraryFocus);
  const rightOpacity = interpolate(arenaFocus, [0, 1], [1, 0.38]);
  const rightZIndex = libraryFocus > 0.05 ? 35 : (arenaFocus > 0.05 ? 10 : 20);

  // Top Badge Springs & Dynamic Highlighting
  const badgeSpring = spring({ frame: Math.max(0, frame - 15), fps, config: { damping: 12, stiffness: 90 } });
  const pillSpring = spring({ frame: Math.max(0, frame - 35), fps, config: { damping: 12, stiffness: 90 } });

  const activeBadgeText =
    arenaFocus > 0.35
      ? 'WORKSPACE 04 · THE ARENA (PARALLEL MULTI-MODEL BENCHMARK)'
      : libraryFocus > 0.35
      ? 'WORKSPACE 05 · CURATED PROMPT LIBRARY & 3D PHYSICS DECK'
      : 'WORKSPACES 04 & 05 · THE ARENA BENCHMARK & CURATED LIBRARY';

  const activeBadgeColor =
    arenaFocus > 0.35
      ? '#f59e0b'
      : libraryFocus > 0.35
      ? '#10b981'
      : '#38bdf8';

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
      {/* Background Volumetric Ambient Radial Glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            arenaFocus > 0.2
              ? 'radial-gradient(circle at 40% 50%, rgba(245, 158, 11, 0.18) 0%, transparent 65%)'
              : libraryFocus > 0.2
              ? 'radial-gradient(circle at 60% 50%, rgba(16, 185, 129, 0.2) 0%, transparent 65%)'
              : 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.16) 0%, transparent 65%)',
        }}
      />

      {/* Top Header Badge with Dynamic Focus Indicator */}
      <div
        style={{
          position: 'absolute',
          top: '36px',
          transform: `scale(${badgeSpring})`,
          padding: '8px 26px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(11, 14, 21, 0.92)',
          border: `1.5px solid ${activeBadgeColor}77`,
          backdropFilter: 'blur(20px)',
          boxShadow: `0 10px 30px rgba(0, 0, 0, 0.8), 0 0 25px ${activeBadgeColor}44`,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 40,
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: activeBadgeColor,
            boxShadow: `0 0 10px ${activeBadgeColor}`,
          }}
        />
        <span
          style={{
            fontSize: '13px',
            fontWeight: 800,
            color: '#f8fafc',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {activeBadgeText}
        </span>
      </div>

      {/* Dual 3D Window Container with Interactive Depth Stacking */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '30px',
          width: '100%',
          transformStyle: 'preserve-3d',
          zIndex: 10,
        }}
      >
        {/* Left Window: The Arena Benchmark */}
        <div
          style={{
            width: '800px',
            height: '520px',
            transform: `translate3d(${leftTranslateX}px, 0px, ${leftTranslateZ}px) scale(${leftScale}) rotateX(${leftRotateX}deg) rotateY(${leftRotateY}deg)`,
            transformStyle: 'preserve-3d',
            borderRadius: '20px',
            backgroundColor: '#070a0f',
            border: `${1.5 + arenaFocus * 0.8}px solid rgba(245, 158, 11, ${0.45 + arenaFocus * 0.45})`,
            boxShadow:
              arenaFocus > 0.05
                ? `0 35px 95px rgba(0, 0, 0, 0.95), 0 0 ${45 + arenaFocus * 35}px rgba(245, 158, 11, ${0.25 + arenaFocus * 0.35})`
                : '0 30px 80px rgba(0, 0, 0, 0.9), 0 0 45px rgba(245, 158, 11, 0.25)',
            opacity: leftOpacity,
            filter: libraryFocus > 0.05 ? `brightness(${1 - libraryFocus * 0.35}) blur(${libraryFocus * 1.5}px)` : 'none',
            overflow: 'hidden',
            zIndex: leftZIndex,
          }}
        >
          {/* Header */}
          <div
            style={{
              height: '38px',
              backgroundColor: 'rgba(9, 13, 19, 0.95)',
              borderBottom: '1px solid rgba(245, 158, 11, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              fontSize: '11px',
              color: '#fbbf24',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              <span style={{ marginLeft: '12px', fontWeight: 800 }}>THE ARENA · PARALLEL MULTI-MODEL BENCHMARK</span>
            </div>
            {arenaFocus > 0.3 && (
              <div
                style={{
                  padding: '2px 10px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  border: '1px solid rgba(245, 158, 11, 0.6)',
                  fontSize: '9px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: '#fef3c7',
                }}
              >
                LIVE BENCHMARK VIEW
              </div>
            )}
          </div>
          <Img src={staticFile('screenshots/05_arena_benchmark.png')} style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>

        {/* Right Window: Prompt Library */}
        <div
          style={{
            width: '800px',
            height: '520px',
            transform: `translate3d(${rightTranslateX}px, 0px, ${rightTranslateZ}px) scale(${rightScale}) rotateX(${rightRotateX}deg) rotateY(${rightRotateY}deg)`,
            transformStyle: 'preserve-3d',
            borderRadius: '20px',
            backgroundColor: '#070a0f',
            border: `${1.5 + libraryFocus * 0.8}px solid rgba(16, 185, 129, ${0.45 + libraryFocus * 0.45})`,
            boxShadow:
              libraryFocus > 0.05
                ? `0 35px 95px rgba(0, 0, 0, 0.95), 0 0 ${45 + libraryFocus * 35}px rgba(16, 185, 129, ${0.25 + libraryFocus * 0.35})`
                : '0 30px 80px rgba(0, 0, 0, 0.9), 0 0 45px rgba(16, 185, 129, 0.25)',
            opacity: rightOpacity,
            filter: arenaFocus > 0.05 ? `brightness(${1 - arenaFocus * 0.35}) blur(${arenaFocus * 1.5}px)` : 'none',
            overflow: 'hidden',
            zIndex: rightZIndex,
          }}
        >
          {/* Header */}
          <div
            style={{
              height: '38px',
              backgroundColor: 'rgba(9, 13, 19, 0.95)',
              borderBottom: '1px solid rgba(16, 185, 129, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              fontSize: '11px',
              color: '#34d399',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
              <span style={{ marginLeft: '12px', fontWeight: 800 }}>CURATED LIBRARY & 3D PHYSICS DECK</span>
            </div>
            {libraryFocus > 0.3 && (
              <div
                style={{
                  padding: '2px 10px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid rgba(16, 185, 129, 0.6)',
                  fontSize: '9px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: '#d1fae5',
                }}
              >
                PROMPT CATALOG VIEW
              </div>
            )}
          </div>
          <Img src={staticFile('screenshots/06_prompt_library.png')} style={{ width: '100%', height: 'auto', display: 'block' }} />
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
