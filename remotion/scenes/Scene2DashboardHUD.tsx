import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BrowserMockup } from '../components/BrowserMockup';

export const Scene2DashboardHUD: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance & Exit Opacity
  const opacity = interpolate(frame, [0, 20, 300, 320], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 3D Camera Tilt Dynamics
  const entranceSpring = spring({ frame, fps, config: { damping: 14, stiffness: 65 } });
  const scale = interpolate(entranceSpring, [0, 1], [0.82, 0.95]);
  const rotateX = interpolate(entranceSpring, [0, 1], [14, 4]);
  const rotateY = interpolate(entranceSpring, [0, 1], [18, 6]);

  // Telemetry Numbers Ticking Up
  const inferenceCount = Math.floor(interpolate(frame, [20, 240], [200, 1428], { extrapolateRight: 'clamp' }));
  const tokenCount = Math.floor(interpolate(frame, [30, 260], [100000, 842190], { extrapolateRight: 'clamp' }));
  const slaProgress = interpolate(frame, [40, 250], [98.5, 99.94], { extrapolateRight: 'clamp' }).toFixed(2);

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
      {/* Cyan Volumetric Ambient Glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 70% 30%, rgba(6, 182, 212, 0.16) 0%, transparent 60%), radial-gradient(circle at 30% 70%, rgba(200, 168, 107, 0.12) 0%, transparent 60%)',
        }}
      />

      {/* Real Bedrock Telemetry Dashboard Mockup */}
      <BrowserMockup
        imageSrc="screenshots/02_dashboard_hud.png"
        url="bedrock://app/dashboard"
        rotateX={rotateX}
        rotateY={rotateY}
        scale={scale}
        glowColor="rgba(6, 182, 212, 0.4)"
      />

      {/* Floating Holographic KPI Metric Cards */}
      <div
        style={{
          position: 'absolute',
          bottom: '50px',
          display: 'flex',
          gap: '24px',
          zIndex: 40,
        }}
      >
        {/* Card 1: Total Inferences */}
        <div
          style={{
            padding: '16px 28px',
            borderRadius: '16px',
            backgroundColor: 'rgba(11, 14, 21, 0.9)',
            border: '1px solid rgba(200, 168, 107, 0.4)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(200, 168, 107, 0.2)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span style={{ fontSize: '11px', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            TOTAL INFERENCES
          </span>
          <span style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc' }}>
            {inferenceCount.toLocaleString()}
          </span>
        </div>

        {/* Card 2: Cumulative Tokens */}
        <div
          style={{
            padding: '16px 28px',
            borderRadius: '16px',
            backgroundColor: 'rgba(11, 14, 21, 0.9)',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(6, 182, 212, 0.2)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span style={{ fontSize: '11px', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            TOKENS CONSUMED
          </span>
          <span style={{ fontSize: '26px', fontWeight: 800, color: '#06b6d4' }}>
            {tokenCount.toLocaleString()}
          </span>
        </div>

        {/* Card 3: P99 Latency */}
        <div
          style={{
            padding: '16px 28px',
            borderRadius: '16px',
            backgroundColor: 'rgba(11, 14, 21, 0.9)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(16, 185, 129, 0.2)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span style={{ fontSize: '11px', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            P99 LATENCY / SLA
          </span>
          <span style={{ fontSize: '26px', fontWeight: 800, color: '#10b981' }}>
            110ms · {slaProgress}%
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
