import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { BrowserMockup } from '../components/BrowserMockup';

export const Scene4SynthesisWizard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance & Exit Opacity
  const opacity = interpolate(frame, [0, 20, 270, 290], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 3D Camera Zoom into the editor
  const entranceSpring = spring({ frame, fps, config: { damping: 14, stiffness: 65 } });
  const scale = interpolate(entranceSpring, [0, 1], [0.82, 1.02]);
  const rotateX = interpolate(entranceSpring, [0, 1], [-12, -2]);
  const rotateY = interpolate(entranceSpring, [0, 1], [-16, -2]);

  // Specular sheen sweep position across the browser glass (0% to 100%)
  const sheenOffset = interpolate(frame, [15, 170], [-20, 120]);

  // Top Badge Spring
  const badgeSpring = spring({ frame: Math.max(0, frame - 25), fps, config: { damping: 12, stiffness: 90 } });

  // Floating Scoping Capsules Springs
  const pill1Spring = spring({ frame: Math.max(0, frame - 45), fps, config: { damping: 12, stiffness: 90 } });
  const pill2Spring = spring({ frame: Math.max(0, frame - 60), fps, config: { damping: 12, stiffness: 90 } });
  const pill3Spring = spring({ frame: Math.max(0, frame - 75), fps, config: { damping: 12, stiffness: 90 } });

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
      {/* Background Volumetric Emerald Ambient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 40% 40%, rgba(16, 185, 129, 0.2) 0%, transparent 60%)',
        }}
      />

      {/* Floating Top Badge */}
      <div
        style={{
          position: 'absolute',
          top: '36px',
          transform: `scale(${badgeSpring})`,
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
        glowColor="rgba(16, 185, 129, 0.45)"
        sheenOffset={sheenOffset}
      />

      {/* Feature Callout Capsules with Springs */}
      <div
        style={{
          position: 'absolute',
          bottom: '36px',
          display: 'flex',
          gap: '16px',
          zIndex: 40,
        }}
      >
        <div
          style={{
            transform: `scale(${pill1Spring})`,
            padding: '12px 24px',
            borderRadius: '14px',
            backgroundColor: 'rgba(11, 14, 21, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.85)',
            fontSize: '12px',
            color: '#f8fafc',
            fontWeight: 700,
          }}
        >
          🎯 3–4 Dynamic Clarifying Scoping Questions
        </div>

        <div
          style={{
            transform: `scale(${pill2Spring})`,
            padding: '12px 24px',
            borderRadius: '14px',
            backgroundColor: 'rgba(11, 14, 21, 0.92)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.85), 0 0 20px rgba(16, 185, 129, 0.2)',
            fontSize: '12px',
            color: '#34d399',
            fontWeight: 700,
          }}
        >
          🛡️ Pinned Modern Dependencies (React 19 / Next 15 / Drizzle)
        </div>

        <div
          style={{
            transform: `scale(${pill3Spring})`,
            padding: '12px 24px',
            borderRadius: '14px',
            backgroundColor: 'rgba(11, 14, 21, 0.92)',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.85), 0 0 20px rgba(6, 182, 212, 0.2)',
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
