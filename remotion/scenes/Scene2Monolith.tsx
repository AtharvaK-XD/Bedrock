import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// Mathematical 3D Particle Generator
interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

const PARTICLES: Particle[] = Array.from({ length: 32 }, (_, i) => ({
  id: i,
  x: (i * 61) % 100,
  y: (i * 47) % 100,
  size: 2 + (i % 4),
  speed: 0.4 + ((i % 5) * 0.15),
  opacity: 0.2 + ((i % 6) * 0.12),
}));

export const Scene2Monolith: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene Entrance & Exit Opacity
  const opacity = interpolate(frame, [0, 20, 200, 220], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 3D Monolith Rotation & Scale Animation
  const rotateY = interpolate(frame, [0, 220], [-25, 25]);
  const rotateX = interpolate(frame, [0, 220], [15, -10]);
  const scale = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.8, stiffness: 70 },
  });

  // Badge Springs
  const badge1Spring = spring({ frame: Math.max(0, frame - 30), fps, config: { damping: 12, stiffness: 100 } });
  const badge2Spring = spring({ frame: Math.max(0, frame - 45), fps, config: { damping: 12, stiffness: 100 } });
  const badge3Spring = spring({ frame: Math.max(0, frame - 60), fps, config: { damping: 12, stiffness: 100 } });

  // Light Beam Angle Sweep
  const beamAngle = interpolate(frame, [0, 220], [0, 360]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#06080d',
        opacity,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
        overflow: 'hidden',
        perspective: '1200px',
      }}
    >
      {/* Volumetric Radial Glow */}
      <div
        style={{
          position: 'absolute',
          width: '900px',
          height: '900px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200, 168, 107, 0.22) 0%, rgba(204, 138, 51, 0.08) 45%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Floating 3D Ambient Dust Particles */}
      {PARTICLES.map((p) => {
        const currentY = (p.y - frame * p.speed * 0.2 + 100) % 100;
        const currentX = p.x + Math.sin((frame + p.id * 10) / 25) * 3;
        return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${currentX}%`,
              top: `${currentY}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              borderRadius: '50%',
              backgroundColor: '#c8a86b',
              opacity: p.opacity,
              boxShadow: '0 0 8px rgba(200, 168, 107, 0.8)',
            }}
          />
        );
      })}

      {/* Central 3D Geometric Monolith Container */}
      <div
        style={{
          position: 'relative',
          width: '420px',
          height: '420px',
          transform: `scale(${scale}) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          transformStyle: 'preserve-3d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Monolith SVG Facets */}
        <svg
          width="360"
          height="360"
          viewBox="0 0 360 360"
          style={{
            filter: 'drop-shadow(0 20px 50px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 35px rgba(200, 168, 107, 0.35))',
          }}
        >
          <defs>
            <linearGradient id="facetGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1a202c" />
              <stop offset="100%" stopColor="#0b0e15" />
            </linearGradient>
            <linearGradient id="facetGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2d3748" />
              <stop offset="100%" stopColor="#171923" />
            </linearGradient>
            <linearGradient id="copperRim" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e2c48d" />
              <stop offset="50%" stopColor="#c8a86b" />
              <stop offset="100%" stopColor="#7a5c2f" />
            </linearGradient>
          </defs>

          {/* Polyhedron Base Facets */}
          {/* Top Facet */}
          <polygon
            points="180,30 290,110 180,160 70,110"
            fill="url(#facetGrad2)"
            stroke="url(#copperRim)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Left Facet */}
          <polygon
            points="70,110 180,160 180,310 70,240"
            fill="url(#facetGrad1)"
            stroke="url(#copperRim)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Right Facet */}
          <polygon
            points="180,160 290,110 290,240 180,310"
            fill="#0f131d"
            stroke="url(#copperRim)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Inner Geometric Circuit Lines */}
          <line x1="180" y1="30" x2="180" y2="160" stroke="#06b6d4" strokeWidth="1.5" opacity="0.7" strokeDasharray="4 4" />
          <line x1="180" y1="160" x2="180" y2="310" stroke="#10b981" strokeWidth="2" opacity="0.8" />
          <line x1="70" y1="110" x2="290" y2="240" stroke="#c8a86b" strokeWidth="1" opacity="0.4" />

          {/* Pulsing Core Diamond Node */}
          <circle cx="180" cy="160" r="10" fill="#10b981" filter="drop-shadow(0 0 12px #10b981)" />
        </svg>

        {/* Dynamic Specular Border Halo Ring */}
        <div
          style={{
            position: 'absolute',
            width: '440px',
            height: '440px',
            borderRadius: '50%',
            border: '2px solid transparent',
            background: `conic-gradient(from ${beamAngle}deg, transparent 0%, rgba(200, 168, 107, 0.8) 20%, transparent 40%)`,
            WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Floating Architectural Technology Badges */}
      {/* Badge 1: Top-Left */}
      <div
        style={{
          position: 'absolute',
          top: '22%',
          left: '12%',
          transform: `scale(${badge1Spring})`,
          padding: '12px 24px',
          borderRadius: '12px',
          backgroundColor: 'rgba(11, 14, 21, 0.85)',
          border: '1px solid rgba(200, 168, 107, 0.3)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#06b6d4' }} />
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', letterSpacing: '0.08em' }}>
          DUAL RUNTIME · TAURI 2.0 & ELECTRON 43.3
        </span>
      </div>

      {/* Badge 2: Top-Right */}
      <div
        style={{
          position: 'absolute',
          top: '28%',
          right: '12%',
          transform: `scale(${badge2Spring})`,
          padding: '12px 24px',
          borderRadius: '12px',
          backgroundColor: 'rgba(11, 14, 21, 0.85)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', letterSpacing: '0.08em' }}>
          REACT 19 · FRAMER MOTION 12 · GSAP
        </span>
      </div>

      {/* Badge 3: Bottom-Center */}
      <div
        style={{
          position: 'absolute',
          bottom: '16%',
          transform: `scale(${badge3Spring})`,
          padding: '12px 28px',
          borderRadius: '12px',
          backgroundColor: 'rgba(11, 14, 21, 0.85)',
          border: '1px solid rgba(200, 168, 107, 0.3)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#c8a86b' }} />
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', letterSpacing: '0.08em' }}>
          NEON POSTGRESQL · PRISMA 6 · UPSTASH REDIS
        </span>
      </div>
    </AbsoluteFill>
  );
};
