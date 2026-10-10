import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

export const Scene6MonolithicFinale: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance (1550 to 1800, local 0 to 250)
  const sceneOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
  });

  // Camera Motion (Subtle push in)
  const cameraZoom = interpolate(frame, [0, 250], [0.98, 1.05]);

  // Phase tracker for the finale words:
  // Phase 1 (0 to 52 frames / 0 to 1.7s): "STOP GUESSING."
  // Phase 2 (52 to 108 frames / 1.7 to 3.6s): "START ENGINEERING."
  // Phase 3 (108 to 150 frames / 3.6 to 5.0s): "BEDROCK."
  // Phase 4 (150 to 250 frames / 5.0 to 8.3s): "THE BEDROCK OF INTELLIGENT SOFTWARE." + Download CTA
  const phase = frame < 52 ? 1 : frame < 108 ? 2 : frame < 150 ? 3 : 4;

  // Cinematic heavy springs
  const wordSpring1 = spring({ frame, fps, config: { damping: 24, stiffness: 60 } });
  const wordSpring2 = spring({ frame: Math.max(0, frame - 52), fps, config: { damping: 24, stiffness: 60 } });
  const brandSpring = spring({ frame: Math.max(0, frame - 108), fps, config: { damping: 24, stiffness: 60 } });
  const ctaSpring = spring({ frame: Math.max(0, frame - 130), fps, config: { damping: 24, stiffness: 60 } });

  // Subtle Shockwave
  const shockwaveScale = interpolate(frame, [108, 200], [0.8, 2.5], { extrapolateRight: 'clamp' });
  const shockwaveOpacity = interpolate(frame, [108, 140, 200], [0, 0.1, 0], { extrapolateRight: 'clamp' });

  // Subtle Logo Float
  const logoFloat = Math.sin(frame * 0.04) * 4;

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
      {/* Dark Ambient Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 70%)',
        }}
      />

      {/* Volumetric Subtle Shockwave Ring */}
      {frame >= 108 && (
        <div
          style={{
            position: 'absolute',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,1)',
            transform: `scale(${shockwaveScale})`,
            opacity: shockwaveOpacity,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Main Content Stage */}
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
          zIndex: 10,
        }}
      >
        {/* PHASE 1: STOP GUESSING */}
        {phase === 1 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transform: `scale(${wordSpring1}) translateY(${interpolate(wordSpring1, [0, 1], [20, 0])}px)`,
              opacity: interpolate(wordSpring1, [0, 0.5, 1], [0, 0.5, 1])
            }}
          >
            <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '16px' }}>
              THE PAST
            </span>
            <h1
              style={{
                fontSize: '96px',
                fontWeight: 600,
                color: '#ffffff',
                letterSpacing: '-0.04em',
                margin: 0,
              }}
            >
              Stop guessing.
            </h1>
          </div>
        )}

        {/* PHASE 2: START ENGINEERING */}
        {phase === 2 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transform: `scale(${wordSpring2}) translateY(${interpolate(wordSpring2, [0, 1], [20, 0])}px)`,
              opacity: interpolate(wordSpring2, [0, 0.5, 1], [0, 0.5, 1])
            }}
          >
            <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '16px' }}>
              THE FUTURE
            </span>
            <h1
              style={{
                fontSize: '96px',
                fontWeight: 600,
                color: '#ffffff',
                letterSpacing: '-0.04em',
                margin: 0,
              }}
            >
              Start engineering.
            </h1>
          </div>
        )}

        {/* PHASE 3 & 4: BEDROCK BRAND MONOLITH & CTA */}
        {phase >= 3 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transform: `scale(${brandSpring}) translateY(${logoFloat}px)`,
              opacity: interpolate(brandSpring, [0, 0.5, 1], [0, 0.5, 1]),
              gap: '32px',
            }}
          >
            {/* Elegant Logo Icon */}
            <div
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '28px',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)',
                border: '1px solid rgba(255,255,255,0.05)',
                boxShadow: '0 40px 80px rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Img
                src={staticFile('logo.png')}
                style={{
                  width: '70px',
                  height: '70px',
                  objectFit: 'contain',
                }}
              />
            </div>

            {/* Brand Text Stack */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <h1
                style={{
                  fontSize: '72px',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                Bedrock
              </h1>

              {/* Sub-tagline */}
              <p
                style={{
                  fontSize: '18px',
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.4)',
                  letterSpacing: '0.02em',
                  margin: 0,
                }}
              >
                The bedrock of intelligent software.
              </p>
            </div>

            {/* Download CTA Bar */}
            <div
              style={{
                transform: `translateY(${interpolate(ctaSpring, [0, 1], [20, 0])}px)`,
                opacity: ctaSpring,
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginTop: '16px',
              }}
            >
              <div
                style={{
                  padding: '16px 32px',
                  borderRadius: '9999px',
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  fontSize: '15px',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: '0 20px 40px rgba(255,255,255,0.1)',
                }}
              >
                Download for macOS
              </div>

              <div
                style={{
                  padding: '15px 32px',
                  borderRadius: '9999px',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                }}
              >
                Windows & Web
              </div>
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
