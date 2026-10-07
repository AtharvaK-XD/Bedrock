import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Scene4EmeraldIgnition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance & Exit Opacity
  const opacity = interpolate(frame, [0, 20, 270, 300], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Shockwave Expansion Ring
  const shockwaveRadius = interpolate(frame, [0, 80], [0, 900], {
    extrapolateRight: 'clamp',
  });
  const shockwaveOpacity = interpolate(frame, [0, 20, 80], [1, 0.8, 0], {
    extrapolateRight: 'clamp',
  });

  // Brand Scale Spring
  const brandScale = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.9, stiffness: 80 },
  });

  // Stateful Button Confirmation Spring
  const buttonSpring = spring({
    frame: Math.max(0, frame - 50),
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  // Checkmark Drawing Progress
  const checkmarkProgress = interpolate(frame, [70, 95], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Slow Cinematic Camera Drift
  const cameraDrift = interpolate(frame, [0, 300], [1, 1.05]);

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
        transform: `scale(${cameraDrift})`,
      }}
    >
      {/* Background Volumetric Glow */}
      <div
        style={{
          position: 'absolute',
          width: '1000px',
          height: '1000px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, rgba(200, 168, 107, 0.1) 40%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Expanding Emerald Shockwave Rings */}
      <div
        style={{
          position: 'absolute',
          width: `${shockwaveRadius * 2}px`,
          height: `${shockwaveRadius * 2}px`,
          borderRadius: '50%',
          border: '2px solid rgba(16, 185, 129, 0.9)',
          boxShadow: '0 0 30px rgba(16, 185, 129, 0.8)',
          opacity: shockwaveOpacity,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: `${shockwaveRadius * 1.5}px`,
          height: `${shockwaveRadius * 1.5}px`,
          borderRadius: '50%',
          border: '1px solid rgba(200, 168, 107, 0.6)',
          boxShadow: '0 0 20px rgba(200, 168, 107, 0.5)',
          opacity: shockwaveOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* Monolithic Logo & Brand Lockup */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transform: `scale(${brandScale})`,
          zIndex: 10,
        }}
      >
        {/* Monolith Icon */}
        <div
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '28px',
            background: 'linear-gradient(135deg, #1e2638 0%, #0b0e15 100%)',
            border: '2px solid rgba(200, 168, 107, 0.5)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 40px rgba(200, 168, 107, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '28px',
          }}
        >
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" stroke="#c8a86b" strokeWidth="1.8" fill="rgba(200, 168, 107, 0.15)" />
            <line x1="12" y1="2" x2="12" y2="22" stroke="#10b981" strokeWidth="1.8" />
            <circle cx="12" cy="12" r="3.5" fill="#10b981" filter="drop-shadow(0 0 6px #10b981)" />
          </svg>
        </div>

        {/* Monolithic Title */}
        <div
          style={{
            fontSize: '76px',
            fontWeight: 900,
            letterSpacing: '0.08em',
            background: 'linear-gradient(180deg, #ffffff 0%, #e2c48d 50%, #c8a86b 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 40px rgba(200, 168, 107, 0.4)',
            marginBottom: '12px',
          }}
        >
          BEDROCK
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '20px',
            fontWeight: 500,
            letterSpacing: '0.24em',
            color: '#94a3b8',
            textTransform: 'uppercase',
            marginBottom: '40px',
          }}
        >
          The Enterprise Prompt Engineering Workstation
        </div>

        {/* Stateful Button Confirmation Capsule */}
        <div
          style={{
            transform: `scale(${buttonSpring})`,
            padding: '14px 32px',
            borderRadius: '9999px',
            backgroundColor: '#10b981',
            boxShadow: '0 0 35px rgba(16, 185, 129, 0.6), 0 10px 25px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#06080d',
            fontWeight: 800,
            fontSize: '15px',
            letterSpacing: '0.06em',
          }}
        >
          {/* Animated SVG Checkmark */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#06080d" strokeWidth="2.5" opacity="0.4" />
            <path
              d="M 6 12 L 10 16 L 18 8"
              stroke="#06080d"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="24"
              strokeDashoffset={24 * (1 - checkmarkProgress)}
            />
          </svg>
          <span>WORKSTATION READY · LAUNCHING WORKSPACE</span>
        </div>

        {/* Footer Distribution Metadata */}
        <div
          style={{
            marginTop: '44px',
            fontSize: '12px',
            color: '#64748b',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            display: 'flex',
            gap: '16px',
          }}
        >
          <span>VERSION v1.2.2</span>
          <span>•</span>
          <span>WINDOWS NSIS & MACOS UNIVERSAL</span>
          <span>•</span>
          <span>OPEN SOURCE</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
