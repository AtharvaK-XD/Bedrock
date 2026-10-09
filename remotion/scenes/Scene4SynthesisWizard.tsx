import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { BrowserMockup } from '../components/BrowserMockup';

export const Scene4SynthesisWizard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance & Exit Opacity
  const opacity = interpolate(frame, [0, 20, 270, 290], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // 3D Camera Zoom & Continuous Dolly Push-in with Organic Float
  const entranceSpring = spring({ frame, fps, config: { damping: 14, stiffness: 65 } });
  const cameraDolly = interpolate(frame, [0, 290], [0.96, 1.05]);
  const cameraOrbitX = interpolate(frame, [40, 270], [-2, 2]);
  const cameraOrbitY = interpolate(frame, [40, 270], [-2, 3.5]);

  const scale = interpolate(entranceSpring, [0, 1], [0.80, 0.96]) * cameraDolly;
  const ambientFloatX = Math.sin(frame * 0.04) * 0.65;
  const ambientFloatY = Math.cos(frame * 0.035) * 0.65;
  const rotateX = (frame < 40 ? interpolate(entranceSpring, [0, 1], [-12, -2]) : cameraOrbitX) + ambientFloatX;
  const rotateY = (frame < 40 ? interpolate(entranceSpring, [0, 1], [-16, -2]) : cameraOrbitY) + ambientFloatY;

  // Smooth scroll down the synthesized prompt in Phase C
  const promptScrollY = interpolate(frame, [150, 260], [0, -75], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Specular sheen sweep position across the browser glass (0% to 100%)
  const sheenOffset = interpolate(frame, [15, 170], [-20, 120]);

  // Phase Transition:
  // Phase A: 0 - 60 (Prompt drafted, cursor glides to Generate button)
  // Phase B: 60 - 120 (Click triggers, Neural Compiler passes stream)
  // Phase C: 120 - 290 (Result page reveals with synthesized markdown prompt)
  const isCompiling = frame >= 50 && frame < 125;
  const isResult = frame >= 125;

  // Cursor movements
  const cursorX = interpolate(frame, [10, 50], [45, 63], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cursorY = interpolate(frame, [10, 50], [70, 53], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cursorClick = frame >= 50 && frame <= 65;
  const showCursor = frame < 55;

  // Top Badge Spring
  const badgeSpring = spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 12, stiffness: 90 } });

  // Result Card Reveal Spring
  const resultSpring = spring({ frame: Math.max(0, frame - 125), fps, config: { damping: 13, stiffness: 85 } });

  // Floating Pills Staggered Springs
  const pill1Spring = spring({ frame: Math.max(0, frame - 30), fps, config: { damping: 12, stiffness: 90 } });
  const pill2Spring = spring({ frame: Math.max(0, frame - 45), fps, config: { damping: 12, stiffness: 90 } });
  const pill3Spring = spring({ frame: Math.max(0, frame - 60), fps, config: { damping: 12, stiffness: 90 } });

  // Compiler Pass Progress (with strict clamp on left and right)
  const compilerPass1 = interpolate(frame, [50, 75], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const compilerPass2 = interpolate(frame, [75, 100], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const compilerPass3 = interpolate(frame, [100, 125], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Typewriter effect progress for the synthesized prompt in Phase C
  const promptProgress = interpolate(frame, [130, 220], [0, 1], { extrapolateRight: 'clamp' });

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
            'radial-gradient(circle at 50% 40%, rgba(16, 185, 129, 0.22) 0%, transparent 65%), radial-gradient(circle at 20% 80%, rgba(6, 182, 212, 0.12) 0%, transparent 50%)',
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
          backgroundColor: 'rgba(11, 14, 21, 0.92)',
          border: isResult ? '1.5px solid rgba(52, 211, 153, 0.7)' : '1.5px solid rgba(16, 185, 129, 0.45)',
          backdropFilter: 'blur(20px)',
          boxShadow: isResult
            ? '0 10px 30px rgba(0, 0, 0, 0.8), 0 0 35px rgba(16, 185, 129, 0.4)'
            : '0 10px 30px rgba(0, 0, 0, 0.8), 0 0 25px rgba(16, 185, 129, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 40,
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isResult ? '#34d399' : '#10b981',
            boxShadow: '0 0 10px #10b981',
          }}
        />
        <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {isResult
            ? 'WORKSPACE 02 · SYNTHESIZED SYSTEM PROMPT (PRODUCTION READY)'
            : isCompiling
            ? 'WORKSPACE 02 · COMPILING SYSTEM PERSONA VIA NEURAL PIPELINE...'
            : 'WORKSPACE 02 · SYSTEM PROMPT SYNTHESIS ENGINE'}
        </span>
      </div>

      {/* Real Bedrock Prompt Generator Workstation Mockup */}
      <BrowserMockup
        url={isResult ? 'bedrock://app/result' : 'bedrock://app/generator'}
        rotateX={rotateX}
        rotateY={rotateY}
        scale={scale}
        glowColor={isResult ? 'rgba(52, 211, 153, 0.55)' : 'rgba(16, 185, 129, 0.45)'}
        sheenOffset={sheenOffset}
        cursorX={showCursor ? cursorX : undefined}
        cursorY={showCursor ? cursorY : undefined}
        cursorClick={cursorClick}
      >
        {!isResult ? (
          /* ========================================================= */
          /* STAGE 1 & 2: INPUT DRAFT & LIVE NEURAL COMPILER PIPELINE  */
          /* ========================================================= */
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Img
              src={staticFile('screenshots/03_generator_wizard.png')}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                filter: isCompiling ? 'brightness(0.7) blur(1px)' : 'none',
                transition: 'filter 0.2s ease',
              }}
            />

            {/* Live Holographic Compiler HUD (Frames 50 to 125) */}
            {isCompiling && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(6, 8, 13, 0.65)',
                  backdropFilter: 'blur(8px)',
                  zIndex: 25,
                }}
              >
                {/* Active Compiler Card */}
                <div
                  style={{
                    width: '640px',
                    padding: '28px 36px',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(11, 14, 21, 0.95)',
                    border: '1.5px solid rgba(16, 185, 129, 0.65)',
                    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 45px rgba(16, 185, 129, 0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          border: '2px solid #10b981',
                          borderTopColor: 'transparent',
                          animation: 'spin 1s linear infinite',
                        }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#34d399', letterSpacing: '0.08em' }}>
                        SYNTHESIS PIPELINE IN PROGRESS · GEMINI 2.5 FLASH
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>STAGE 2/3</span>
                  </div>

                  {/* Progress Passes */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', fontFamily: "'Fira Code', monospace" }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#e2e8f0' }}>
                      <span>[1] PARSE ARCHITECTURE SPEC & TOPOLOGY</span>
                      <span style={{ color: compilerPass1 >= 1 ? '#34d399' : '#64748b', fontWeight: 700 }}>
                        {compilerPass1 >= 1 ? '✓ COMPLETE' : `${Math.round(compilerPass1 * 100)}%`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#e2e8f0' }}>
                      <span>[2] INJECT INVARIANTS: RAFT · RPO=0 · SUB-10MS</span>
                      <span style={{ color: compilerPass2 >= 1 ? '#34d399' : '#64748b', fontWeight: 700 }}>
                        {compilerPass2 >= 1 ? '✓ VERIFIED' : `${Math.round(compilerPass2 * 100)}%`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#e2e8f0' }}>
                      <span>[3] COMPILE PRODUCTION SYSTEM PROMPT AST</span>
                      <span style={{ color: compilerPass3 >= 1 ? '#34d399' : '#64748b', fontWeight: 700 }}>
                        {compilerPass3 >= 1 ? '✓ SYNTHESIZED' : `${Math.round(compilerPass3 * 100)}%`}
                      </span>
                    </div>
                  </div>

                  {/* Laser Scanline Bar */}
                  <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${((compilerPass1 + compilerPass2 + compilerPass3) / 3) * 100}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #10b981, #34d399, #67e8f9)',
                        boxShadow: '0 0 12px #10b981',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ========================================================= */
          /* STAGE 3: THE ACTUAL GENERATED PROMPT RESULT WORKSTATION   */
          /* ========================================================= */
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              backgroundColor: '#0a0d14',
              color: '#ffffff',
              transform: `scale(${resultSpring})`,
            }}
          >
            {/* Left Pane: Interactive Refinement & Telemetry (40% width) */}
            <div
              style={{
                width: '40%',
                borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#070a0f',
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                  Interactive Prompt Refinement
                </span>
                <span style={{ fontSize: '11px', color: '#10b981', fontFamily: 'monospace' }}>340ms · OK</span>
              </div>

              {/* User Prompt Request Bubble */}
              <div
                style={{
                  alignSelf: 'flex-end',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '16px 16px 4px 16px',
                  padding: '14px 18px',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  color: '#e2e8f0',
                  marginBottom: '18px',
                  maxWidth: '90%',
                }}
              >
                Distributed Redis cluster orchestrator with automatic shard failover and zero-data-loss replication.
              </div>

              {/* Bedrock AI Synthesis Response Bubble */}
              <div
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1.5px solid rgba(16, 185, 129, 0.4)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 20px rgba(16, 185, 129, 0.15)',
                  borderRadius: '16px 16px 16px 4px',
                  padding: '16px 18px',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  color: '#f8fafc',
                  maxWidth: '95%',
                }}
              >
                <div style={{ fontSize: '10px', color: '#34d399', fontWeight: 800, textTransform: 'uppercase', marginBottom: '6px' }}>
                  ✓ Prompt Synthesized via Gemini 2.5 Flash
                </div>
                <div>
                  Here is the standalone prompt covering your requirements. Configured with strict zero-data-loss failover state machines and RFC 7807 error specifications.
                </div>
              </div>

              {/* Quick Action Badges */}
              <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '10px', color: '#94a3b8' }}>
                  ⚔️ Test in Arena
                </div>
                <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '10px', color: '#94a3b8' }}>
                  🌿 Export to Canvas
                </div>
              </div>
            </div>

            {/* Right Pane: The Synthesized Production Prompt (60% width) */}
            <div
              style={{
                width: '60%',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#0c1017',
                padding: '24px 30px',
              }}
            >
              {/* Header Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc' }}>Bedrock App Prompt</span>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontWeight: 700 }}>
                    MD · 2,410 TOKENS
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ padding: '6px 14px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.5)', color: '#34d399', fontSize: '11px', fontWeight: 800 }}>
                    ✓ COPIED!
                  </div>
                  <div style={{ padding: '6px 14px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#f8fafc', fontSize: '11px', fontWeight: 700 }}>
                    DOWNLOAD .MD
                  </div>
                </div>
              </div>

              {/* Synthesized Prompt Markdown Viewport with Smooth Scroll Animation */}
              <div
                style={{
                  flex: 1,
                  fontFamily: "'Fira Code', monospace",
                  fontSize: '11.5px',
                  lineHeight: '1.7',
                  color: '#cbd5e1',
                  backgroundColor: 'rgba(0, 0, 0, 0.45)',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  boxShadow: 'inset 0 2px 10px rgba(0, 0, 0, 0.8)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div style={{ transform: `translateY(${promptScrollY}px)`, transition: 'transform 0.1s linear' }}>
                <div style={{ color: '#34d399', fontWeight: 800, marginBottom: '8px' }}>
                  # SYSTEM PERSONA: DISTRIBUTED REDIS ORCHESTRATOR
                </div>
                <div style={{ color: '#06b6d4', marginBottom: '8px' }}>
                  &lt;role&gt; Principal Distributed Reliability Architect &amp; Raft Cluster Controller &lt;/role&gt;
                </div>
                <div style={{ color: '#f59e0b', marginBottom: '4px' }}>
                  &lt;strict_negative_constraints&gt;
                </div>
                <div style={{ paddingLeft: '16px', color: '#e2e8f0', marginBottom: '8px' }}>
                  • [ZERO DATA LOSS] Disallow unacknowledged replica promotions (RPO=0).<br />
                  • [SUB-10MS FAILOVER] Immediate automated quorum quarantine on missed pings.<br />
                  • [DETERMINISTIC SPEC] Emit RFC 7807 error schema with zero unhandled exceptions.<br />
                  • [INJECTION DEFENSE] Strict multi-turn boundary token isolation.
                </div>
                <div style={{ color: '#f59e0b', marginBottom: '8px' }}>
                  &lt;/strict_negative_constraints&gt;
                </div>
                <div style={{ color: '#38bdf8', marginBottom: '4px' }}>
                  &lt;json_schema_enforcement&gt;
                </div>
                <div style={{ paddingLeft: '16px', color: '#94a3b8', marginBottom: '8px' }}>
                  type ClusterTopology = &#123; epoch: number; activeLeader: string; quorumNodes: string[] &#125;;
                </div>
                <div style={{ color: '#38bdf8', marginBottom: '8px' }}>
                  &lt;/json_schema_enforcement&gt;
                </div>
                <div style={{ color: '#a78bfa' }}>
                  &lt;runtime_target&gt; Dual-Runtime: Tauri 2.0 / Electron 43.3 Native Engine &lt;/runtime_target&gt;
                </div>
              </div>
            </div>
            </div>
          </div>
        )}
      </BrowserMockup>

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
            border: isResult ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.85)',
            fontSize: '12px',
            color: isResult ? '#34d399' : '#f8fafc',
            fontWeight: 700,
          }}
        >
          {isResult ? '⚡ 340ms Synthesis Latency (Gemini 2.5 Flash)' : '🎯 3–4 Dynamic Clarifying Scoping Questions'}
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
          {isResult ? '🛡️ Strict Invariants & RFC 7807 Error Schema' : '🛡️ Pinned Modern Dependencies (React 19 / Tauri 2.0)'}
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
          {isResult ? '📋 2,410 Tokens Synthesized · Zero Hallucinations' : '⚡ Strict Negative Constraints Matrix (No \'any\', No TODOs)'}
        </div>
      </div>
    </AbsoluteFill>
  );
};
