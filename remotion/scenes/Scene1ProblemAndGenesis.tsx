import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

const GLYPHS = '01#@$%&*<>[]{}~=+/ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function getScrambledText(targetText: string, progress: number, seed: number): string {
  const chars = targetText.split('');
  const lockIndex = Math.floor(chars.length * progress);

  return chars
    .map((char, i) => {
      if (char === ' ' || char === '·' || char === ':' || char === '[' || char === ']' || char === '✓' || char === '❌') return char;
      if (i < lockIndex) return char;
      const glyphIndex = Math.abs((seed * 37 + i * 17) % GLYPHS.length);
      return GLYPHS[glyphIndex];
    })
    .join('');
}

export const Scene1ProblemAndGenesis: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Overall Scene Opacity (Fade in at 0, fade out to next scene at 430-450)
  const sceneOpacity = interpolate(frame, [0, 15, 430, 450], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Continuous Cinematic Camera Slow Push-in
  const cameraZoom = interpolate(frame, [0, 450], [1.0, 1.05]);

  // Phase 1: The Problem (Frames 0 - 165 / 0s - 5.5s)
  const problemSpring = spring({ frame, fps, config: { damping: 24, stiffness: 60 } }); // Heavier, smoother spring
  const problemZoom = interpolate(frame, [0, 165], [0.97, 1.02]);
  const problemCardOpacity = interpolate(frame, [0, 20, 145, 165], [0, 1, 1, 0]);

  // Phase 2: The Transformation (Frames 165 - 315 / 5.5s - 10.5s)
  const transformFrame = Math.max(0, frame - 165);
  const transformSpring = spring({ frame: transformFrame, fps, config: { damping: 24, stiffness: 60 } });
  const transformZoom = interpolate(transformFrame, [0, 150], [0.97, 1.02]);
  const transformCardOpacity = interpolate(frame, [165, 185, 295, 315], [0, 1, 1, 0]);

  // Phase 3: The Monolith Genesis (Frames 315 - 450 / 10.5s - 15.0s)
  const genesisFrame = Math.max(0, frame - 315);
  const monolithSpring = spring({ frame: genesisFrame, fps, config: { damping: 20, mass: 1, stiffness: 50 } });
  const monolithZoom = interpolate(genesisFrame, [0, 135], [0.95, 1.05]);
  const decryptProgress = interpolate(genesisFrame, [10, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const decryptedTitle = getScrambledText('BEDROCK WORKSTATION', decryptProgress, frame);

  // Hyperspace Dive Zoom into next scene at end of scene 1
  const diveZoom = interpolate(frame, [410, 450], [1, 1.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000', // Pure black
        opacity: sceneOpacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', sans-serif",
        overflow: 'hidden',
        perspective: '1400px',
        transform: `scale(${cameraZoom * diveZoom})`,
      }}
    >
      {/* Extremely subtle noise overlay (optional) or radial gradient for depth */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.03) 0%, transparent 60%)',
        }}
      />

      {/* ======================================================== */}
      {/* PHASE 1: THE CHAOS OF AI DEVELOPMENT (0s - 5.5s)        */}
      {/* ======================================================== */}
      {frame < 175 && (
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            opacity: problemCardOpacity,
            transform: `scale(${problemSpring * problemZoom}) translateY(${interpolate(problemSpring, [0, 1], [30, 0])}px)`,
            zIndex: 10,
          }}
        >
          {/* Kinetic Headline */}
          <div
            style={{
              fontSize: '56px',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              textAlign: 'center',
              marginBottom: '40px',
            }}
          >
            AI development is broken.
          </div>

          {/* Minimalist Floating Editor Card */}
          <div
            style={{
              width: '800px',
              padding: '2px', // Thin border illusion
              borderRadius: '24px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)',
              boxShadow: '0 40px 80px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                backgroundColor: '#0a0a0a',
                borderRadius: '22px',
                padding: '40px',
                width: '100%',
                height: '100%',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
              </div>
              
              <div
                style={{
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontSize: '16px',
                  color: 'rgba(255,255,255,0.8)',
                  lineHeight: 1.8,
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>// The standard prompt</span>
                <br />
                &quot;You are a helpful assistant. Please extract the user data and make sure you return valid JSON. Do not hallucinate, and please format it nicely without any errors...&quot;
              </div>
              
              {/* Subtle Red Error Line */}
              <div style={{ marginTop: '20px', borderLeft: '2px solid #ef4444', paddingLeft: '16px', color: '#ef4444', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace" }}>
                TypeError: Unexpected token ' in JSON at position 114
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PHASE 2: THE COMPILER-GRADE TRANSFORMATION (5.5s - 10.5s)*/}
      {/* ======================================================== */}
      {frame >= 165 && frame < 325 && (
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            opacity: transformCardOpacity,
            transform: `scale(${transformSpring * transformZoom}) translateY(${interpolate(transformSpring, [0, 1], [30, 0])}px)`,
            zIndex: 10,
          }}
        >
          {/* Kinetic Headline */}
          <div
            style={{
              fontSize: '56px',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              textAlign: 'center',
              marginBottom: '40px',
            }}
          >
            What if prompts had compiler rigor?
          </div>

          {/* Minimalist Structured Card */}
          <div
            style={{
              position: 'relative',
              width: '800px',
              padding: '2px', // Thin border illusion
              borderRadius: '24px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.03) 100%)',
              boxShadow: '0 40px 80px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                backgroundColor: '#0a0a0a',
                borderRadius: '22px',
                padding: '40px',
                width: '100%',
                height: '100%',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
              </div>
              
              <div
                style={{
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontSize: '15px',
                  color: 'rgba(255,255,255,0.9)',
                  lineHeight: 1.8,
                }}
              >
                <span style={{ color: '#10b981' }}>&lt;system_persona&gt;</span> Principal Distributed Architect &lt;/system_persona&gt;<br />
                <span style={{ color: '#06b6d4' }}>&lt;negative_constraints&gt;</span> Strict No-Any, Zero-Null, RFC 7807 Error Model &lt;/negative_constraints&gt;<br />
                <span style={{ color: '#3b82f6' }}>&lt;runtime_target&gt;</span> Dual-Runtime (Tauri 2.0 / Electron 43.3) &lt;/runtime_target&gt;
              </div>
              
              {/* Subtle Success Line */}
              <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace" }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                COMPILED · DETERMINISTIC SCHEMA ENFORCED
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PHASE 3: THE MONOLITH GENESIS (10.5s - 15.0s)            */}
      {/* ======================================================== */}
      {frame >= 305 && (
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transform: `scale(${monolithSpring * monolithZoom}) translateY(${interpolate(monolithSpring, [0, 1], [30, 0])}px)`,
            opacity: interpolate(genesisFrame, [0, 15], [0, 1]),
            zIndex: 10,
          }}
        >
          {/* Authentic Bedrock Logo - Highly Clean and Elegant */}
          <div
            style={{
              position: 'relative',
              width: '140px',
              height: '140px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '32px',
            }}
          >
            <Img
              src={staticFile('logo.png')}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 20px 40px rgba(16, 185, 129, 0.15))',
              }}
            />
          </div>

          {/* Kinetic Decrypted Title */}
          <div
            style={{
              fontSize: '64px',
              fontWeight: 700,
              letterSpacing: '-0.04em',
              color: '#ffffff',
              marginBottom: '16px',
            }}
          >
            {decryptedTitle}
          </div>

          <div
            style={{
              fontSize: '20px',
              fontWeight: 400,
              letterSpacing: '-0.01em',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            The enterprise prompt engineering workstation.
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
