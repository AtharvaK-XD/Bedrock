import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Scene3HologramUI: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance & Exit Opacity
  const opacity = interpolate(frame, [0, 20, 240, 260], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Topbar Spring Entrance
  const topbarY = interpolate(
    spring({ frame, fps, config: { damping: 14, stiffness: 90 } }),
    [0, 1],
    [-80, 0]
  );

  // Nodes Staggered Spring Entrances
  const node1Spring = spring({ frame: Math.max(0, frame - 15), fps, config: { damping: 13, stiffness: 85 } });
  const node2Spring = spring({ frame: Math.max(0, frame - 35), fps, config: { damping: 13, stiffness: 85 } });
  const node3Spring = spring({ frame: Math.max(0, frame - 55), fps, config: { damping: 13, stiffness: 85 } });

  // Laser Spline Dash Animation
  const laserDash = (frame * 12) % 1000;

  // Real-time HUD Values
  const tokenCount = Math.floor(interpolate(frame, [40, 200], [12000, 26376], { extrapolateRight: 'clamp' }));
  const latency = interpolate(frame, [60, 200], [180, 110], { extrapolateRight: 'clamp' }).toFixed(0);

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
      }}
    >
      {/* Background Cyber Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 50% 40%, rgba(6, 182, 212, 0.08) 0%, transparent 60%), linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 40px 40px, 40px 40px',
        }}
      />

      {/* Floating Aceternity Air-Island Topbar */}
      <div
        style={{
          position: 'absolute',
          top: '36px',
          transform: `translateY(${topbarY}px)`,
          padding: '12px 32px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(11, 14, 21, 0.85)',
          border: '1px solid rgba(200, 168, 107, 0.3)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 24px rgba(200, 168, 107, 0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '0.06em',
          color: '#94a3b8',
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c8a86b', fontWeight: 800 }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#c8a86b', boxShadow: '0 0 8px #c8a86b' }} />
          <span>BEDROCK</span>
        </div>
        <span style={{ color: '#f8fafc' }}>Dashboard</span>
        <span>Generator</span>
        <span style={{ color: '#06b6d4' }}>Canvas (Active)</span>
        <span>The Arena</span>
        <span>Library</span>
        <span>History</span>
        <div
          style={{
            padding: '4px 12px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          BYOK ACTIVE
        </div>
      </div>

      {/* Central Interactive DAG Nodes Canvas Container */}
      <div
        style={{
          position: 'relative',
          width: '1200px',
          height: '480px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
        }}
      >
        {/* Animated Laser Spline Connections SVG */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          {/* Base Inactive Tracks */}
          <path d="M 280 240 C 420 180, 520 180, 600 240" fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="3" />
          <path d="M 600 240 C 720 300, 820 300, 920 240" fill="none" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="3" />

          {/* Active Laser Pulses */}
          <path
            d="M 280 240 C 420 180, 520 180, 600 240"
            fill="none"
            stroke="#06b6d4"
            strokeWidth="3.5"
            strokeDasharray="60 300"
            strokeDashoffset={-laserDash}
            filter="drop-shadow(0 0 10px #06b6d4)"
          />
          <path
            d="M 600 240 C 720 300, 820 300, 920 240"
            fill="none"
            stroke="#10b981"
            strokeWidth="3.5"
            strokeDasharray="60 300"
            strokeDashoffset={-laserDash * 1.3}
            filter="drop-shadow(0 0 10px #10b981)"
          />
        </svg>

        {/* Node 1: SYS Persona (Left) */}
        <div
          style={{
            transform: `scale(${node1Spring})`,
            width: '280px',
            padding: '24px',
            borderRadius: '16px',
            backgroundColor: 'rgba(11, 14, 21, 0.9)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 24px rgba(59, 130, 246, 0.2)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#3b82f6', letterSpacing: '0.1em' }}>SYS · PERSONA</span>
            <span style={{ fontSize: '10px', color: '#64748b' }}>NODE_01</span>
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
            Senior Security Auditor
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>
            OWASP Top 10, Auth bypass defenses, and RLS integrity rules.
          </div>
        </div>

        {/* Node 2: PROMPT Dispatcher (Center) */}
        <div
          style={{
            transform: `scale(${node2Spring})`,
            width: '320px',
            padding: '28px',
            borderRadius: '20px',
            backgroundColor: 'rgba(11, 14, 21, 0.95)',
            border: '2px solid rgba(200, 168, 107, 0.6)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 35px rgba(200, 168, 107, 0.3)',
            backdropFilter: 'blur(24px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#c8a86b', letterSpacing: '0.1em' }}>PROMPT · PIPELINE</span>
            <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 700 }}>SYNTHESIZING...</span>
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', marginBottom: '8px' }}>
            High-Concurrency Redis Gateway
          </div>
          <div style={{ fontSize: '12px', color: '#c8a86b', lineHeight: 1.4, fontFamily: 'monospace' }}>
            &lt;role&gt; Distributed Systems Architect &lt;/role&gt;
          </div>
        </div>

        {/* Node 3: OUT Blueprint (Right) */}
        <div
          style={{
            transform: `scale(${node3Spring})`,
            width: '280px',
            padding: '24px',
            borderRadius: '16px',
            backgroundColor: 'rgba(11, 14, 21, 0.9)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 24px rgba(16, 185, 129, 0.2)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', letterSpacing: '0.1em' }}>OUT · VERIFIED</span>
            <span style={{ fontSize: '10px', color: '#64748b' }}>EXEC_READY</span>
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
            Production Blueprint
          </div>
          <div style={{ fontSize: '12px', color: '#10b981', lineHeight: 1.4 }}>
            Definition of Done: 100% test pass, tsc exit 0, zero warnings.
          </div>
        </div>
      </div>

      {/* Bottom Telemetry HUD Matrix */}
      <div
        style={{
          position: 'absolute',
          bottom: '36px',
          display: 'flex',
          gap: '20px',
          zIndex: 30,
        }}
      >
        <div style={{ padding: '12px 24px', borderRadius: '12px', backgroundColor: 'rgba(11, 14, 21, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.1em' }}>INFERENCE SPEED</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#06b6d4' }}>{latency} ms</div>
        </div>

        <div style={{ padding: '12px 24px', borderRadius: '12px', backgroundColor: 'rgba(11, 14, 21, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.1em' }}>TOKENS STREAMED</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#c8a86b' }}>{tokenCount.toLocaleString()}</div>
        </div>

        <div style={{ padding: '12px 24px', borderRadius: '12px', backgroundColor: 'rgba(11, 14, 21, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.1em' }}>CLUSTER SLA</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981' }}>99.94%</div>
        </div>

        <div style={{ padding: '12px 24px', borderRadius: '12px', backgroundColor: 'rgba(11, 14, 21, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ fontSize: '10px', color: '#64748b', letterSpacing: '0.1em' }}>WAF INJECTION DEFENSE</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc' }}>100% NEUTRALIZED</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
