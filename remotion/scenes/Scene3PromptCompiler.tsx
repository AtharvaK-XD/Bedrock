import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Scene3PromptCompiler: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance & Exit (690 to 970, local 0 to 280)
  const sceneOpacity = interpolate(frame, [0, 20, 255, 280], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Camera Motion
  const cameraZoom = interpolate(frame, [0, 280], [0.97, 1.05]);

  // Springs (Heavier, Apple-like)
  const titleSpring = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 24, stiffness: 60 } });
  const rawBoxSpring = spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 24, stiffness: 60 } });
  const prismSpring = spring({ frame: Math.max(0, frame - 40), fps, config: { damping: 24, stiffness: 60 } });
  const compiledBoxSpring = spring({ frame: Math.max(0, frame - 65), fps, config: { damping: 24, stiffness: 60 } });

  // Phase tracker synced to speech:
  const isMultiPassPhase = frame >= 110;

  // Compilation Progress
  const scanBeamY = (frame * 3) % 280;
  const tokenWeight = Math.min(100, Math.floor(interpolate(frame, [40, 240], [10, 99.4])));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        opacity: sceneOpacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', sans-serif",
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 60%)',
        }}
      />

      {/* Main Stage */}
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${cameraZoom})`,
          position: 'relative',
        }}
      >
        {/* Cinematic Header Titles */}
        <div
          style={{
            position: 'absolute',
            top: '80px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            zIndex: 30,
          }}
        >
          <div
            style={{
              transform: `scale(${titleSpring}) translateY(${interpolate(titleSpring, [0, 1], [-20, 0])}px)`,
              opacity: titleSpring,
              color: 'rgba(255,255,255,0.4)',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Neural Prompt Compiler
          </div>

          <h2
            style={{
              fontSize: '64px',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              margin: 0,
              transform: `scale(${titleSpring}) translateY(${interpolate(titleSpring, [0, 1], [-20, 0])}px)`,
              opacity: titleSpring,
            }}
          >
            {!isMultiPassPhase
              ? 'Zero-shot to production.'
              : 'Multi-pass reasoning.'}
          </h2>
        </div>

        {/* Compiler Flow Container */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '40px',
            width: '1400px',
            marginTop: '40px',
            zIndex: 20,
          }}
        >
          {/* Left Panel: Raw Prompt Input Stream */}
          <div
            style={{
              transform: `scale(${rawBoxSpring}) translateY(${interpolate(rawBoxSpring, [0, 1], [30, 0])}px)`,
              opacity: rawBoxSpring,
              width: '400px',
              height: '320px',
              padding: '1px', // Thin border illusion
              borderRadius: '24px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)',
              boxShadow: '0 40px 80px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                backgroundColor: '#0a0a0a',
                borderRadius: '23px',
                padding: '32px',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>
                  raw_intent.txt
                </span>
              </div>

              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '14px',
                  lineHeight: 1.6,
                  color: 'rgba(255,255,255,0.8)',
                  flex: 1,
                }}
              >
                "Create a master system prompt for an image and video generation director. Ensure zero coding hallucinations, strict visual composition, and deterministic cinematic output."
              </div>
            </div>
          </div>

          {/* Central Connecting Lines / Progress */}
          <div
            style={{
              transform: `scale(${prismSpring})`,
              opacity: prismSpring,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '120px',
              position: 'relative',
              gap: '12px'
            }}
          >
            <div style={{ width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }} />
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }}>
              COMPILING
            </span>
            <div style={{ width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }} />
          </div>

          {/* Right Panel: Production-Grade Hardened Directives */}
          <div
            style={{
              transform: `scale(${compiledBoxSpring}) translateY(${interpolate(compiledBoxSpring, [0, 1], [30, 0])}px)`,
              opacity: compiledBoxSpring,
              width: '560px',
              height: '320px',
              padding: '1px', // Thin border illusion
              borderRadius: '24px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.03) 100%)',
              boxShadow: '0 40px 80px rgba(0,0,0,0.5)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                backgroundColor: '#0a0a0a',
                borderRadius: '23px',
                padding: '32px',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Subtle Scanning Line */}
              <div
                style={{
                  position: 'absolute',
                  top: `${scanBeamY}px`,
                  left: 0,
                  right: 0,
                  height: '1px',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                  pointerEvents: 'none',
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#10b981' }}>
                  directive.xml
                </span>
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {tokenWeight}% SYNTHESIZED
                </span>
              </div>

              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '13px',
                  lineHeight: 1.6,
                  color: 'rgba(255,255,255,0.9)',
                  flex: 1,
                  overflow: 'hidden',
                }}
              >
                <span style={{ color: '#38bdf8' }}>&lt;role</span> <span style={{ color: '#f59e0b' }}>archetype</span>=<span style={{ color: '#10b981' }}>"image_generation"</span> <span style={{ color: '#f59e0b' }}>strict</span>=<span style={{ color: '#10b981' }}>"true"</span><span style={{ color: '#38bdf8' }}>&gt;</span><br />
                &nbsp;&nbsp;<span style={{ color: '#f43f5e' }}>&lt;anti_hallucination&gt;</span>Zero coding instructions.<span style={{ color: '#f43f5e' }}>&lt;/anti_hallucination&gt;</span><br />
                &nbsp;&nbsp;<span style={{ color: '#a78bfa' }}>&lt;aspect_ratio&gt;</span>16:9 Cinema 4K<span style={{ color: '#a78bfa' }}>&lt;/aspect_ratio&gt;</span><br />
                &nbsp;&nbsp;<span style={{ color: '#38bdf8' }}>&lt;reasoning_passes&gt;</span>4x Verification<span style={{ color: '#38bdf8' }}>&lt;/reasoning_passes&gt;</span><br />
                <span style={{ color: '#38bdf8' }}>&lt;/role&gt;</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
