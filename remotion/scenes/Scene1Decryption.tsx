import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const GLYPHS = '01#@$%&*<>[]{}~=+/ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function getScrambledText(targetText: string, progress: number, seed: number): string {
  const chars = targetText.split('');
  const lockIndex = Math.floor(chars.length * progress);

  return chars
    .map((char, i) => {
      if (char === ' ' || char === '·' || char === ':' || char === '[' || char === ']') return char;
      if (i < lockIndex) return char;
      const glyphIndex = Math.abs((seed * 37 + i * 17) % GLYPHS.length);
      return GLYPHS[glyphIndex];
    })
    .join('');
}

export const Scene1Decryption: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animations
  const opacity = interpolate(frame, [0, 20, 160, 180], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const zoom = interpolate(frame, [0, 180], [1, 1.08], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const decryptProgress = interpolate(frame, [15, 120], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const sublineProgress = interpolate(frame, [50, 140], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const percentProgress = Math.min(100, Math.floor(decryptProgress * 100));

  const titleText = getScrambledText('BEDROCK WORKSTATION v1.2.2', decryptProgress, frame);
  const subText = getScrambledText('PROMPT SYNTHESIS & VISUAL DAG ORCHESTRATION', sublineProgress, frame * 2);

  // Scanline pulse
  const scanlineY = (frame * 6) % 1080;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#06080d',
        opacity,
        transform: `scale(${zoom})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Space Grotesk', 'Inter', monospace",
        overflow: 'hidden',
      }}
    >
      {/* Background Ambient Radial Copper Mesh */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(200, 168, 107, 0.15) 0%, rgba(6, 8, 13, 0.95) 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Cyber Grid Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(200, 168, 107, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(200, 168, 107, 0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          opacity: 0.6,
        }}
      />

      {/* Sweeping Laser Scanline */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: scanlineY,
          height: '2px',
          background: 'linear-gradient(90deg, transparent, rgba(200, 168, 107, 0.4), rgba(6, 182, 212, 0.8), rgba(200, 168, 107, 0.4), transparent)',
          boxShadow: '0 0 16px rgba(6, 182, 212, 0.6)',
        }}
      />

      {/* Main Terminal Frame */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '880px',
          padding: '48px',
          borderRadius: '24px',
          backgroundColor: 'rgba(11, 14, 21, 0.75)',
          border: '1px solid rgba(200, 168, 107, 0.3)',
          boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 40px rgba(200, 168, 107, 0.15)',
          backdropFilter: 'blur(32px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Terminal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            marginBottom: '32px',
            borderBottom: '1px solid rgba(200, 168, 107, 0.15)',
            paddingBottom: '16px',
            fontSize: '13px',
            letterSpacing: '0.15em',
            color: '#c8a86b',
            textTransform: 'uppercase',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
            <span>SECURE SYSTEM INITIALIZATION</span>
          </div>
          <span style={{ color: '#06b6d4' }}>SHA-256 VERIFIED</span>
        </div>

        {/* Scrambled Main Title */}
        <div
          style={{
            fontSize: '44px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            color: '#f8fafc',
            textShadow: '0 0 24px rgba(200, 168, 107, 0.4)',
            marginBottom: '16px',
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {titleText}
        </div>

        {/* Scrambled Subline */}
        <div
          style={{
            fontSize: '16px',
            fontWeight: 500,
            letterSpacing: '0.2em',
            color: '#c8a86b',
            marginBottom: '36px',
            textTransform: 'uppercase',
          }}
        >
          {subText}
        </div>

        {/* Futuristic Loading Bar */}
        <div style={{ width: '100%', marginBottom: '24px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#94a3b8',
              marginBottom: '8px',
              letterSpacing: '0.1em',
            }}
          >
            <span>DECRYPTION PROGRESS</span>
            <span style={{ color: '#06b6d4', fontWeight: 700 }}>{percentProgress}%</span>
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '9999px',
              overflow: 'hidden',
              border: '1px solid rgba(200, 168, 107, 0.2)',
            }}
          >
            <div
              style={{
                width: `${percentProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #c8a86b 0%, #06b6d4 50%, #10b981 100%)',
                boxShadow: '0 0 16px rgba(6, 182, 212, 0.8)',
                transition: 'width 0.05s linear',
              }}
            />
          </div>
        </div>

        {/* Boot Telemetry Badges */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            fontSize: '11px',
            color: '#64748b',
            letterSpacing: '0.08em',
          }}
        >
          <span style={{ padding: '4px 10px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
            NEON POSTGRES: READY
          </span>
          <span style={{ padding: '4px 10px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
            REDIS CLUSTER: READY
          </span>
          <span style={{ padding: '4px 10px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
            AI PROXY: ONLINE
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
