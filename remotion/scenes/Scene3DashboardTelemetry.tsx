import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BrowserMockup } from '../components/BrowserMockup';

export const Scene3DashboardTelemetry: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance & Exit Opacity
  const opacity = interpolate(frame, [0, 20, 270, 290], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 3D Camera Tilt & Zoom
  const entranceSpring = spring({ frame, fps, config: { damping: 14, stiffness: 65 } });
  const scale = interpolate(entranceSpring, [0, 1], [0.82, 0.96]);
  const rotateX = interpolate(entranceSpring, [0, 1], [14, 4]);
  const rotateY = interpolate(entranceSpring, [0, 1], [18, 5]);

  // Telemetry Numbers Ticking Up
  const inferenceCount = Math.floor(interpolate(frame, [15, 220], [200, 1428], { extrapolateRight: 'clamp' }));
  const tokenCount = Math.floor(interpolate(frame, [25, 240], [100000, 842190], { extrapolateRight: 'clamp' }));
  const slaProgress = interpolate(frame, [35, 230], [98.5, 99.94], { extrapolateRight: 'clamp' }).toFixed(2);

  // Specular sheen sweep position across the browser glass (0% to 100%)
  const sheenOffset = interpolate(frame, [10, 160], [-20, 120]);

  // Card Springs
  const card1Spring = spring({ frame: Math.max(0, frame - 30), fps, config: { damping: 12, stiffness: 90 } });
  const card2Spring = spring({ frame: Math.max(0, frame - 45), fps, config: { damping: 12, stiffness: 90 } });
  const card3Spring = spring({ frame: Math.max(0, frame - 60), fps, config: { damping: 12, stiffness: 90 } });
  const card4Spring = spring({ frame: Math.max(0, frame - 75), fps, config: { damping: 12, stiffness: 90 } });

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
      {/* Background Volumetric Emerald & Cyan Glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 70% 30%, rgba(16, 185, 129, 0.18) 0%, transparent 60%), radial-gradient(circle at 30% 70%, rgba(6, 182, 212, 0.12) 0%, transparent 60%)',
        }}
      />

      {/* Floating Top Badge */}
      <div
        style={{
          position: 'absolute',
          top: '36px',
          padding: '8px 26px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(11, 14, 21, 0.9)',
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
          WORKSPACE 01 · REAL-TIME OBSERVABILITY & METRICS HUD
        </span>
      </div>

      {/* Real Bedrock Telemetry Dashboard Mockup */}
      <BrowserMockup
        imageSrc="screenshots/02_dashboard_hud.png"
        url="bedrock://app/dashboard"
        rotateX={rotateX}
        rotateY={rotateY}
        scale={scale}
        glowColor="rgba(16, 185, 129, 0.45)"
        sheenOffset={sheenOffset}
      />

      {/* Floating Holographic KPI Metric Cards with Staggered Springs */}
      <div
        style={{
          position: 'absolute',
          bottom: '36px',
          display: 'flex',
          gap: '20px',
          zIndex: 40,
        }}
      >
        {/* Card 1: Total Inferences */}
        <div
          style={{
            transform: `scale(${card1Spring})`,
            padding: '14px 26px',
            borderRadius: '16px',
            backgroundColor: 'rgba(11, 14, 21, 0.92)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.85), 0 0 25px rgba(16, 185, 129, 0.2)',
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
            transform: `scale(${card2Spring})`,
            padding: '14px 26px',
            borderRadius: '16px',
            backgroundColor: 'rgba(11, 14, 21, 0.92)',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.85), 0 0 25px rgba(6, 182, 212, 0.2)',
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
            transform: `scale(${card3Spring})`,
            padding: '14px 26px',
            borderRadius: '16px',
            backgroundColor: 'rgba(11, 14, 21, 0.92)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.85), 0 0 25px rgba(16, 185, 129, 0.2)',
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

        {/* Card 4: Multi-Model Gateway */}
        <div
          style={{
            transform: `scale(${card4Spring})`,
            padding: '14px 26px',
            borderRadius: '16px',
            backgroundColor: 'rgba(11, 14, 21, 0.92)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.85), 0 0 25px rgba(16, 185, 129, 0.2)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span style={{ fontSize: '11px', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            AI GATEWAY STATUS
          </span>
          <span style={{ fontSize: '26px', fontWeight: 800, color: '#34d399' }}>
            6 PROVIDERS LIVE
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
