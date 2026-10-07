import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BrowserMockup } from '../components/BrowserMockup';

export const Scene1LandingHero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance & Exit Opacity
  const opacity = interpolate(frame, [0, 20, 220, 240], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 3D Camera Zoom & Spring Pitch
  const entranceSpring = spring({ frame, fps, config: { damping: 14, stiffness: 60 } });
  const scale = interpolate(entranceSpring, [0, 1], [0.75, 0.96]);
  const rotateX = interpolate(entranceSpring, [0, 1], [18, 5]);
  const rotateY = interpolate(entranceSpring, [0, 1], [-14, -4]);

  // Subtle Parallax Scroll of the Landing Page
  const panY = interpolate(frame, [40, 240], [0, -90], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Headline Overlay Animation
  const badgeSpring = spring({ frame: Math.max(0, frame - 30), fps, config: { damping: 12, stiffness: 90 } });

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
      {/* Background Volumetric Glow & Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 50% 40%, rgba(200, 168, 107, 0.18) 0%, transparent 65%), linear-gradient(rgba(200, 168, 107, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(200, 168, 107, 0.04) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 48px 48px, 48px 48px',
        }}
      />

      {/* Floating Header Tag */}
      <div
        style={{
          position: 'absolute',
          top: '36px',
          transform: `scale(${badgeSpring})`,
          padding: '8px 24px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(11, 14, 21, 0.85)',
          border: '1px solid rgba(200, 168, 107, 0.4)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(200, 168, 107, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 40,
        }}
      >
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#c8a86b', boxShadow: '0 0 8px #c8a86b' }} />
        <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          OFFICIAL WORKSTATION LAUNCH · BEDROCK v1.2.2
        </span>
      </div>

      {/* Real Bedrock Website Mockup */}
      <BrowserMockup
        imageSrc="screenshots/01_landing_hero.png"
        url="https://bedrockxai.com"
        rotateX={rotateX}
        rotateY={rotateY}
        scale={scale}
        panY={panY}
        glowColor="rgba(200, 168, 107, 0.4)"
      />

      {/* Lower Floating Architecture Pill */}
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          padding: '12px 32px',
          borderRadius: '16px',
          backgroundColor: 'rgba(11, 14, 21, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.9)',
          display: 'flex',
          gap: '24px',
          fontSize: '12px',
          color: '#94a3b8',
          letterSpacing: '0.08em',
          zIndex: 40,
        }}
      >
        <span>⚡ REACT 19 & MOTION 12</span>
        <span>•</span>
        <span>💎 ACETERNITY FLOATING TOPBAR</span>
        <span>•</span>
        <span>🛡️ SERVER-SIDE PROMPT INJECTION DEFENSE</span>
      </div>
    </AbsoluteFill>
  );
};
