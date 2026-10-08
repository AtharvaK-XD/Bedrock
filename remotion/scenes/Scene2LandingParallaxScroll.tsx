import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BrowserMockup } from '../components/BrowserMockup';

export const Scene2LandingParallaxScroll: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance & Exit Opacity
  const opacity = interpolate(frame, [0, 20, 270, 290], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 3D Camera Dynamics & Spring Physics with Subtle Organic Floating Float
  const entranceSpring = spring({ frame, fps, config: { damping: 14, stiffness: 60 } });
  const scale = interpolate(entranceSpring, [0, 1], [0.78, 0.96]);
  const ambientFloatX = Math.sin(frame * 0.045) * 0.75;
  const ambientFloatY = Math.cos(frame * 0.038) * 0.75;
  const rotateX = interpolate(entranceSpring, [0, 1], [18, 5]) + ambientFloatX;
  const rotateY = interpolate(entranceSpring, [0, 1], [-16, -3]) + ambientFloatY;

  // Dynamic Parallax Scroll Effect across the Landing Page
  // From frame 40 to 220, scrolls smoothly down through the hero and showcase
  const panY = interpolate(frame, [40, 230], [0, -420], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Specular sheen sweep position across the browser glass (0% to 100%)
  const sheenOffset = interpolate(frame, [20, 180], [-20, 120]);

  // Simulated precision mouse cursor gliding across the page
  const cursorX = interpolate(frame, [50, 120, 170], [30, 52, 60], { extrapolateRight: 'clamp' });
  const cursorY = interpolate(frame, [50, 120, 170], [80, 58, 62], { extrapolateRight: 'clamp' });
  const cursorClick = frame >= 120 && frame <= 135;

  // Header Badge Spring
  const badgeSpring = spring({ frame: Math.max(0, frame - 25), fps, config: { damping: 12, stiffness: 90 } });

  // Lower Architecture Pills Staggered Springs
  const pill1Spring = spring({ frame: Math.max(0, frame - 50), fps, config: { damping: 12, stiffness: 90 } });
  const pill2Spring = spring({ frame: Math.max(0, frame - 65), fps, config: { damping: 12, stiffness: 90 } });
  const pill3Spring = spring({ frame: Math.max(0, frame - 80), fps, config: { damping: 12, stiffness: 90 } });

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
      {/* Background Volumetric Emerald Radial & Cyber Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 50% 40%, rgba(16, 185, 129, 0.16) 0%, transparent 65%), linear-gradient(rgba(16, 185, 129, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.035) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 48px 48px, 48px 48px',
        }}
      />

      {/* Floating Header Tag */}
      <div
        style={{
          position: 'absolute',
          top: '36px',
          transform: `scale(${badgeSpring})`,
          padding: '8px 26px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(11, 14, 21, 0.88)',
          border: '1.5px solid rgba(16, 185, 129, 0.45)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8), 0 0 25px rgba(16, 185, 129, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 40,
        }}
      >
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }} />
        <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          OFFICIAL WORKSTATION LAUNCH · BEDROCK v1.2.2
        </span>
      </div>

      {/* Real Bedrock Website Mockup with 3D Tilt and Continuous Parallax Scroll */}
      <BrowserMockup
        images={[
          'screenshots/01_landing_hero.png',
          'screenshots/01b_landing_showcase.png',
          'screenshots/01c_landing_features.png',
        ]}
        url="https://bedrockxai.com"
        rotateX={rotateX}
        rotateY={rotateY}
        scale={scale}
        panY={panY}
        glowColor="rgba(16, 185, 129, 0.45)"
        sheenOffset={sheenOffset}
        cursorX={cursorX}
        cursorY={cursorY}
        cursorClick={cursorClick}
      />

      {/* Lower Floating Architecture Pills with Staggered Springs */}
      <div
        style={{
          position: 'absolute',
          bottom: '36px',
          display: 'flex',
          gap: '16px',
          zIndex: 40,
        }}
      >
        <div
          style={{
            transform: `scale(${pill1Spring})`,
            padding: '12px 24px',
            borderRadius: '14px',
            backgroundColor: 'rgba(11, 14, 21, 0.92)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.85), 0 0 20px rgba(16, 185, 129, 0.15)',
            fontSize: '12px',
            color: '#34d399',
            fontWeight: 700,
            letterSpacing: '0.06em',
          }}
        >
          ⚡ REACT 19 & MOTION 12 ARCHITECTURE
        </div>

        <div
          style={{
            transform: `scale(${pill2Spring})`,
            padding: '12px 24px',
            borderRadius: '14px',
            backgroundColor: 'rgba(11, 14, 21, 0.92)',
            border: '1px solid rgba(6, 182, 212, 0.35)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.85), 0 0 20px rgba(6, 182, 212, 0.15)',
            fontSize: '12px',
            color: '#67e8f9',
            fontWeight: 700,
            letterSpacing: '0.06em',
          }}
        >
          🛡️ TAURI 2.0 & ELECTRON 43.3 DUAL RUNTIME
        </div>

        <div
          style={{
            transform: `scale(${pill3Spring})`,
            padding: '12px 24px',
            borderRadius: '14px',
            backgroundColor: 'rgba(11, 14, 21, 0.92)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.85), 0 0 20px rgba(16, 185, 129, 0.15)',
            fontSize: '12px',
            color: '#f8fafc',
            fontWeight: 700,
            letterSpacing: '0.06em',
          }}
        >
          🌿 LAKEBASE NEON POSTGRESQL SYNC
        </div>
      </div>
    </AbsoluteFill>
  );
};
