import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

export const Scene7MonolithicFinale: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance & Final Fade Out to black at frame 110 (which maps to exactly 60.0s)
  const opacity = interpolate(frame, [0, 15, 95, 110], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Emerald Shockwave Expansion
  const shockwaveRadius = interpolate(frame, [0, 80], [0, 1200], {
    extrapolateRight: 'clamp',
  });
  const shockwaveOpacity = interpolate(frame, [0, 15, 80], [1, 0.85, 0], {
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
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 12, stiffness: 95 },
  });

  // Checkmark Drawing Progress
  const checkmarkProgress = interpolate(frame, [45, 75], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Slow Cinematic Push-in and 3D Perspective
  const cameraZoom = interpolate(frame, [0, 110], [0.96, 1.08]);
  const cameraRotateX = interpolate(frame, [0, 110], [4, 0]);
  const cameraRotateY = interpolate(frame, [0, 110], [-3, 1]);

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
        transform: `scale(${cameraZoom}) rotateX(${cameraRotateX}deg) rotateY(${cameraRotateY}deg)`,
      }}
    >
      {/* Background Volumetric Emerald Aura */}
      <div
        style={{
          position: 'absolute',
          width: '1200px',
          height: '1200px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.28) 0%, rgba(6, 182, 212, 0.12) 40%, transparent 70%)',
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
          boxShadow: '0 0 40px rgba(16, 185, 129, 0.9)',
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
          border: '2px solid rgba(52, 211, 153, 0.65)',
          boxShadow: '0 0 25px rgba(52, 211, 153, 0.6)',
          opacity: shockwaveOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* Faded Real App Montage in 3D Perspective */}
      <div
        style={{
          position: 'absolute',
          width: '1400px',
          height: '780px',
          opacity: 0.16,
          transform: 'scale(1.1) rotateX(15deg) translateY(-40px)',
          filter: 'blur(4px)',
          borderRadius: '24px',
          overflow: 'hidden',
          border: '1px solid rgba(16, 185, 129, 0.25)',
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
            width: '140px',
            height: '140px',
            borderRadius: '36px',
            background: 'radial-gradient(circle at 35% 30%, #162622 0%, #08110f 100%)',
            border: '2.5px solid rgba(16, 185, 129, 0.75)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 50px rgba(16, 185, 129, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '26px',
            position: 'relative',
          }}
        >
          <Img
            src={staticFile('logo.png')}
            style={{
              width: '92px',
              height: '92px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 24px rgba(52, 211, 153, 0.85)) drop-shadow(0 8px 16px rgba(0, 0, 0, 0.8))',
            }}
          />
        </div>

        {/* Monolithic Title */}
        <div
          style={{
            fontSize: '84px',
            fontWeight: 900,
            letterSpacing: '0.08em',
            background: 'linear-gradient(180deg, #ffffff 0%, #a7f3d0 50%, #10b981 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 50px rgba(16, 185, 129, 0.5)',
            marginBottom: '10px',
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
            padding: '16px 38px',
            borderRadius: '9999px',
            backgroundColor: '#10b981',
            boxShadow: '0 0 45px rgba(16, 185, 129, 0.75), 0 12px 30px rgba(0, 0, 0, 0.6)',
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
            marginTop: '44px',
            fontSize: '13px',
            color: '#34d399',
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
          <span>•</span>
          <span>v1.2.2</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
