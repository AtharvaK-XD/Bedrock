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
  const cameraZoom = interpolate(frame, [0, 450], [0.94, 1.10]);

  // Phase 1: The Problem (Frames 0 - 165 / 0s - 5.5s)
  const problemSpring = spring({ frame, fps, config: { damping: 14, stiffness: 80 } });
  const problemZoom = interpolate(frame, [0, 165], [0.95, 1.05]);
  const problemRotateX = interpolate(frame, [0, 165], [9, 1]);
  const problemRotateY = interpolate(frame, [0, 165], [-11, 2]);
  const problemCardOpacity = interpolate(frame, [0, 15, 155, 175], [0, 1, 1, 0]);
  const glitchOffset = frame < 165 && frame % 12 < 3 ? Math.sin(frame * 4) * 4 : 0;

  // Phase 2: The Transformation (Frames 165 - 315 / 5.5s - 10.5s)
  const transformFrame = Math.max(0, frame - 165);
  const transformSpring = spring({ frame: transformFrame, fps, config: { damping: 13, stiffness: 75 } });
  const transformZoom = interpolate(transformFrame, [0, 150], [0.95, 1.06]);
  const transformRotateX = interpolate(transformFrame, [0, 150], [8, -1]);
  const transformRotateY = interpolate(transformFrame, [0, 150], [10, -2]);

  const transformCardOpacity = interpolate(frame, [165, 185, 305, 325], [0, 1, 1, 0]);

  // Phase 3: The Monolith Genesis (Frames 315 - 450 / 10.5s - 15.0s)
  const genesisFrame = Math.max(0, frame - 315);
  const monolithSpring = spring({ frame: genesisFrame, fps, config: { damping: 14, mass: 0.9, stiffness: 70 } });
  const monolithRotateY = interpolate(genesisFrame, [0, 135], [-24, 18]);
  const monolithRotateX = interpolate(genesisFrame, [0, 135], [16, -4]);
  const monolithZoom = interpolate(genesisFrame, [0, 135], [0.95, 1.07]);
  const decryptProgress = interpolate(genesisFrame, [10, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const decryptedTitle = getScrambledText('BEDROCK WORKSTATION', decryptProgress, frame);

  // Hyperspace Dive Zoom into next scene at end of scene 1
  const diveZoom = interpolate(frame, [410, 450], [1, 2.2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#06080d',
        opacity: sceneOpacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
        overflow: 'hidden',
        perspective: '1400px',
        transform: `scale(${cameraZoom * diveZoom})`,
      }}
    >
      {/* Background Volumetric Emerald Aura */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.16) 0%, rgba(6, 8, 13, 0.95) 75%), linear-gradient(rgba(16, 185, 129, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 185, 129, 0.03) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 48px 48px, 48px 48px',
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
            transform: `scale(${problemSpring * problemZoom}) rotateX(${problemRotateX}deg) rotateY(${problemRotateY}deg) translateX(${glitchOffset}px)`,
            transformStyle: 'preserve-3d',
            zIndex: 10,
          }}
        >
          {/* Top Warning Badge */}
          <div
            style={{
              padding: '6px 20px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
            <span>THE STATUS QUO OF PROMPT ENGINEERING</span>
          </div>

          {/* Kinetic Headline */}
          <div
            style={{
              fontSize: '48px',
              fontWeight: 900,
              letterSpacing: '0.04em',
              color: '#ffffff',
              textAlign: 'center',
              marginBottom: '14px',
              textShadow: '0 0 30px rgba(239, 68, 68, 0.35)',
            }}
          >
            AI DEVELOPMENT IS BROKEN.
          </div>

          <div
            style={{
              fontSize: '17px',
              color: '#94a3b8',
              letterSpacing: '0.1em',
              textAlign: 'center',
              marginBottom: '36px',
              textTransform: 'uppercase',
            }}
          >
            Vague Prompts · Silent Regressions · Zero Observability
          </div>

          {/* 3D Floating Fragmented Prompt Card */}
          <div
            style={{
              width: '820px',
              padding: '32px',
              borderRadius: '20px',
              backgroundColor: 'rgba(11, 14, 21, 0.92)',
              border: '1.5px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(239, 68, 68, 0.2)',
              backdropFilter: 'blur(24px)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '11px', color: '#64748b' }}>
              <span>FRAGMENTED_PLAYGROUND_TAB_#47</span>
              <span style={{ color: '#ef4444', fontWeight: 700 }}>UNRELIABLE OUTPUT</span>
            </div>

            <div
              style={{
                fontFamily: "'Fira Code', monospace",
                fontSize: '14px',
                color: '#e2e8f0',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                lineHeight: 1.6,
                marginBottom: '20px',
              }}
            >
              <span style={{ color: '#ef4444' }}>&quot;You are a helpful assistant.</span> Please extract the user data and make sure you return valid JSON. Do not hallucinate, and please format it nicely without any errors...&quot;
            </div>

            {/* Pain Point Error Pills */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ padding: '6px 14px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '11px', fontWeight: 700 }}>
                ❌ PROMPT INJECTION VULNERABLE
              </div>
              <div style={{ padding: '6px 14px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fcd34d', fontSize: '11px', fontWeight: 700 }}>
                ❌ SILENT SCHEMA BREAKAGE
              </div>
              <div style={{ padding: '6px 14px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '11px', fontWeight: 700 }}>
                ❌ ZERO VERSION CONTROL
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
            transform: `scale(${transformSpring * transformZoom}) rotateX(${transformRotateX}deg) rotateY(${transformRotateY}deg)`,
            transformStyle: 'preserve-3d',
            zIndex: 10,
          }}
        >
          {/* Top Emerald Badge */}
          <div
            style={{
              padding: '6px 20px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.45)',
              color: '#34d399',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 10px #10b981' }} />
            <span>THE BEDROCK COMPILER PARADIGM</span>
          </div>

          {/* Kinetic Headline */}
          <div
            style={{
              fontSize: '44px',
              fontWeight: 900,
              letterSpacing: '0.04em',
              color: '#ffffff',
              textAlign: 'center',
              marginBottom: '14px',
              textShadow: '0 0 35px rgba(16, 185, 129, 0.4)',
            }}
          >
            WHAT IF PROMPTS HAD COMPILER RIGOR?
          </div>

          <div
            style={{
              fontSize: '16px',
              color: '#34d399',
              letterSpacing: '0.12em',
              textAlign: 'center',
              marginBottom: '36px',
              textTransform: 'uppercase',
            }}
          >
            Strict Typings · Visual DAG Orchestration · Active Firewalls
          </div>

          {/* Crystalline Transformed Card */}
          <div
            style={{
              position: 'relative',
              width: '860px',
              padding: '34px',
              borderRadius: '20px',
              backgroundColor: 'rgba(11, 14, 21, 0.95)',
              border: '1.5px solid rgba(16, 185, 129, 0.5)',
              boxShadow: '0 30px 80px rgba(0, 0, 0, 0.95), 0 0 45px rgba(16, 185, 129, 0.35)',
              backdropFilter: 'blur(30px)',
              overflow: 'hidden',
            }}
          >


            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '11px', color: '#10b981', fontWeight: 800 }}>
              <span>BEDROCK_COMPILED_BLUEPRINT_v1.2.2</span>
              <span>DETERMINISTIC · 100% PASS RATE</span>
            </div>

            <div
              style={{
                fontFamily: "'Fira Code', monospace",
                fontSize: '13px',
                color: '#f8fafc',
                backgroundColor: 'rgba(6, 8, 13, 0.8)',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                lineHeight: 1.6,
                marginBottom: '20px',
              }}
            >
              <span style={{ color: '#34d399' }}>&lt;system_persona&gt;</span> Principal Distributed Architect &lt;/system_persona&gt;<br />
              <span style={{ color: '#06b6d4' }}>&lt;negative_constraints&gt;</span> Strict No-Any, Zero-Null, RFC 7807 Error Model &lt;/negative_constraints&gt;<br />
              <span style={{ color: '#10b981' }}>&lt;runtime_target&gt;</span> Dual-Runtime (Tauri 2.0 / Electron 43.3) &lt;/runtime_target&gt;
            </div>

            {/* Production Grade Pills */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ padding: '6px 14px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', fontSize: '11px', fontWeight: 700 }}>
                ✓ DETERMINISTIC JSON SCHEMA
              </div>
              <div style={{ padding: '6px 14px', borderRadius: '8px', backgroundColor: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.4)', color: '#67e8f9', fontSize: '11px', fontWeight: 700 }}>
                ✓ 100% INJECTION DEFENSE FIREWALL
              </div>
              <div style={{ padding: '6px 14px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399', fontSize: '11px', fontWeight: 700 }}>
                ✓ 110ms P99 MULTI-MODEL LATENCY
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
            transform: `scale(${monolithSpring * monolithZoom})`,
            zIndex: 10,
          }}
        >
          {/* Authentic Bedrock 3D Monolith Logo Badge */}
          <div
            style={{
              position: 'relative',
              width: '260px',
              height: '260px',
              transform: `rotateX(${monolithRotateX}deg) rotateY(${monolithRotateY}deg)`,
              transformStyle: 'preserve-3d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '28px',
            }}
          >


            {/* 3D Glass Badge Housing the Authentic Bedrock Logo */}
            <div
              style={{
                width: '180px',
                height: '180px',
                borderRadius: '40px',
                background: 'radial-gradient(circle at 35% 30%, #162622 0%, #08110f 100%)',
                border: '2.5px solid rgba(16, 185, 129, 0.65)',
                boxShadow:
                  '0 30px 70px rgba(0, 0, 0, 0.95), 0 0 50px rgba(16, 185, 129, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 10,
              }}
            >
              <Img
                src={staticFile('logo.png')}
                style={{
                  width: '120px',
                  height: '120px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 20px rgba(52, 211, 153, 0.8)) drop-shadow(0 10px 20px rgba(0, 0, 0, 0.9))',
                }}
              />
            </div>
          </div>

          {/* Kinetic Decrypted Title */}
          <div
            style={{
              fontSize: '56px',
              fontWeight: 900,
              letterSpacing: '0.08em',
              background: 'linear-gradient(180deg, #ffffff 0%, #a7f3d0 50%, #10b981 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '12px',
              textShadow: '0 0 40px rgba(16, 185, 129, 0.5)',
            }}
          >
            {decryptedTitle}
          </div>

          <div
            style={{
              fontSize: '18px',
              fontWeight: 600,
              letterSpacing: '0.2em',
              color: '#94a3b8',
              textTransform: 'uppercase',
              marginBottom: '24px',
            }}
          >
            THE ENTERPRISE PROMPT ENGINEERING WORKSTATION
          </div>

          {/* Launch Pill */}
          <div
            style={{
              padding: '10px 28px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1.5px solid rgba(16, 185, 129, 0.5)',
              color: '#34d399',
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '0.1em',
              boxShadow: '0 0 25px rgba(16, 185, 129, 0.3)',
            }}
          >
            ENTERING WORKSTATION WORKSPACE...
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
