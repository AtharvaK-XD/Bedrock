import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

export const Scene6CinematicClimax: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance & Fade Out
  const opacity = interpolate(frame, [0, 20, 280, 320], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Emerald Shockwave Expansion
  const shockwaveRadius = interpolate(frame, [0, 90], [0, 1100], {
    extrapolateRight: 'clamp',
  });
  const shockwaveOpacity = interpolate(frame, [0, 20, 90], [1, 0.8, 0], {
    extrapolateRight: 'clamp',
  });

  // Monolith Scale Spring
  const monolithSpring = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.9, stiffness: 75 },
  });

  // Checkmark Capsule Spring
  const buttonSpring = spring({
    frame: Math.max(0, frame - 45),
    fps,
    config: { damping: 12, stiffness: 95 },
  });

  // Checkmark Progress
  const checkmarkProgress = interpolate(frame, [65, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Slow Cinematic Zoom
  const cameraZoom = interpolate(frame, [0, 320], [1, 1.06]);

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
        transform: `scale(${cameraZoom})`,
      }}
    >
      {/* Background Volumetric Aura */}
      <div
        style={{
          position: 'absolute',
          width: '1200px',
          height: '1200px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, rgba(200, 168, 107, 0.12) 40%, transparent 70%)',
          filter: 'blur(70px)',
        }}
      />

      {/* Expanding Emerald Shockwave Rings */}
      <div
        style={{
          position: 'absolute',
          width: `${shockwaveRadius * 2}px`,
          height: `${shockwaveRadius * 2}px`,
          borderRadius: '50%',
          border: '3px solid rgba(16, 185, 129, 0.85)',
          boxShadow: '0 0 35px rgba(16, 185, 129, 0.9)',
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
          border: '2px solid rgba(200, 168, 107, 0.6)',
          boxShadow: '0 0 25px rgba(200, 168, 107, 0.6)',
          opacity: shockwaveOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* Background Faded Real App Montage in 3D Space */}
      <div
        style={{
          position: 'absolute',
          width: '1400px',
          height: '780px',
          opacity: 0.18,
          transform: 'scale(1.1) rotateX(15deg) translateY(-40px)',
          filter: 'blur(4px)',
          borderRadius: '24px',
          overflow: 'hidden',
          border: '1px solid rgba(200, 168, 107, 0.2)',
        }}
      >
        <Img src={staticFile('screenshots/02_dashboard_hud.png')} style={{ width: '100%', height: 'auto' }} />
      </div>

      {/* Monolithic Brand Lockup */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transform: `scale(${monolithSpring})`,
          zIndex: 20,
        }}
      >
        {/* Monolith 3D Icon Badge */}
        <div
          style={{
            width: '130px',
            height: '130px',
            borderRadius: '32px',
            background: 'linear-gradient(135deg, #1e2638 0%, #0b0e15 100%)',
            border: '2.5px solid rgba(200, 168, 107, 0.6)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 50px rgba(200, 168, 107, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '28px',
          }}
        >
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none">
            <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" stroke="#c8a86b" strokeWidth="1.8" fill="rgba(200, 168, 107, 0.2)" />
            <line x1="12" y1="2" x2="12" y2="22" stroke="#10b981" strokeWidth="2" />
            <circle cx="12" cy="12" r="4" fill="#10b981" filter="drop-shadow(0 0 8px #10b981)" />
          </svg>
        </div>

        {/* Monolithic Title */}
        <div
          style={{
            fontSize: '84px',
            fontWeight: 900,
            letterSpacing: '0.08em',
            background: 'linear-gradient(180deg, #ffffff 0%, #e2c48d 50%, #c8a86b 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 50px rgba(200, 168, 107, 0.45)',
            marginBottom: '12px',
          }}
        >
          BEDROCK
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '22px',
            fontWeight: 500,
            letterSpacing: '0.24em',
            color: '#94a3b8',
            textTransform: 'uppercase',
            marginBottom: '44px',
          }}
        >
          The Enterprise Prompt Engineering Workstation
        </div>

        {/* Stateful Button Confirmation Capsule */}
        <div
          style={{
            transform: `scale(${buttonSpring})`,
            padding: '16px 36px',
            borderRadius: '9999px',
            backgroundColor: '#10b981',
            boxShadow: '0 0 45px rgba(16, 185, 129, 0.7), 0 12px 30px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            color: '#06080d',
            fontWeight: 900,
            fontSize: '16px',
            letterSpacing: '0.08em',
          }}
        >
          {/* Animated SVG Checkmark */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#06080d" strokeWidth="2.5" opacity="0.4" />
            <path
              d="M 6 12 L 10 16 L 18 8"
              stroke="#06080d"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="24"
              strokeDashoffset={24 * (1 - checkmarkProgress)}
            />
          </svg>
          <span>BUILD PRODUCTION PROMPTS AT LIGHTSPEED</span>
        </div>

        {/* Call to Action Badges */}
        <div
          style={{
            marginTop: '48px',
            fontSize: '13px',
            color: '#c8a86b',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            display: 'flex',
            gap: '20px',
            fontWeight: 700,
          }}
        >
          <span>AVAILABLE FOR WINDOWS & MACOS</span>
          <span>•</span>
          <span>GITHUB.COM/ATHARVAK-XD/BEDROCK</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
