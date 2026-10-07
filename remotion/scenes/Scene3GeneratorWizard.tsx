import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BrowserMockup } from '../components/BrowserMockup';

export const Scene3GeneratorWizard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance & Exit Opacity
  const opacity = interpolate(frame, [0, 20, 320, 340], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 3D Camera Dynamics (Zooming into prompt editor)
  const entranceSpring = spring({ frame, fps, config: { damping: 14, stiffness: 65 } });
  const scale = interpolate(entranceSpring, [0, 1], [0.8, 1.02]);
  const rotateX = interpolate(entranceSpring, [0, 1], [-12, -2]);
  const rotateY = interpolate(entranceSpring, [0, 1], [-16, -2]);

  // Floating Scoping Badge Spring
  const badgeSpring = spring({ frame: Math.max(0, frame - 35), fps, config: { damping: 12, stiffness: 90 } });

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
      {/* Background Volumetric Copper Glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 40% 40%, rgba(200, 168, 107, 0.2) 0%, transparent 60%)',
        }}
      />

      {/* Floating Top Badge */}
      <div
        style={{
          position: 'absolute',
          top: '36px',
          transform: `scale(${badgeSpring})`,
          padding: '8px 24px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(11, 14, 21, 0.9)',
          border: '1px solid rgba(200, 168, 107, 0.4)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(200, 168, 107, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 40,
        }}
      >
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
        <span style={{ fontSize: '12px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          WORKSPACE 02 · SYSTEM PROMPT SYNTHESIS ENGINE
        </span>
      </div>

      {/* Real Bedrock Prompt Generator Wizard Mockup */}
      <BrowserMockup
        imageSrc="screenshots/03_generator_wizard.png"
        url="bedrock://app/generator"
        rotateX={rotateX}
        rotateY={rotateY}
        scale={scale}
        glowColor="rgba(200, 168, 107, 0.4)"
      />

      {/* Feature Callout Capsules */}
      <div
        style={{
          position: 'absolute',
          bottom: '44px',
          display: 'flex',
          gap: '16px',
          zIndex: 40,
        }}
      >
        <div
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            backgroundColor: 'rgba(11, 14, 21, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            fontSize: '12px',
            color: '#f8fafc',
            fontWeight: 700,
          }}
        >
          🎯 3–4 Dynamic Clarifying Scoping Questions
        </div>
        <div
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            backgroundColor: 'rgba(11, 14, 21, 0.9)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            backdropFilter: 'blur(20px)',
            fontSize: '12px',
            color: '#10b981',
            fontWeight: 700,
          }}
        >
          🛡️ Pinned Modern Dependencies (React 19 / Next 15 / Drizzle)
        </div>
        <div
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            backgroundColor: 'rgba(11, 14, 21, 0.9)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            backdropFilter: 'blur(20px)',
            fontSize: '12px',
            color: '#06b6d4',
            fontWeight: 700,
          }}
        >
          ⚡ Strict Negative Constraints Matrix (No 'any', No TODOs)
        </div>
      </div>
    </AbsoluteFill>
  );
};
