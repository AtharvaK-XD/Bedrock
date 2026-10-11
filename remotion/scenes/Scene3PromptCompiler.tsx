import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, EASINGS, LAYOUT_ZONES, SPRINGS } from '../components/MotionTokens';
import { SceneChrome } from '../components/SceneChrome';
import { CameraRig, EdgeLightWipe } from '../components/Transitions';

export const Scene3PromptCompiler: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Act 3 Spans Global Frames 1428 to 1920 (Duration: 492 frames)
  // Scene 9: 0 - 132 (Global 1428 - 1560) "Zero-shot to production."
  // Scene 10: 132 - 492 (Global 1560 - 1920) "Multi-pass reasoning."

  const isScene9 = frame < 132;
  const isScene10 = frame >= 132;

  const s9Frame = frame;
  const s10Frame = Math.max(0, frame - 132);

  // ==========================================================================
  // SCENE 9 ANIMATIONS (0 - 132)
  // ==========================================================================
  // Z4 Pull-back reveal (1.55 -> 1.00 over 36 frames)
  const s9PullBack = interpolate(s9Frame, [0, 36], [1.55, 1.00], {
    easing: EASINGS.OUT_EXPO,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Mint beam shoots from left card to right card (400ms = 24 frames)
  const beamProgress = interpolate(s9Frame, [20, 44], [0, 1], {
    easing: EASINGS.OUT_EXPO,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Z7 Zoom into "0 -> 1 shot" counter chip
  const s9CounterZoom = interpolate(s9Frame, [40, 60, 80, 100], [1.0, 1.4, 1.4, 1.0], {
    easing: EASINGS.IN_OUT,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shotCounter = s9Frame >= 60 ? '1-SHOT PRODUCTION' : '0-SHOT INTENT';

  // ==========================================================================
  // SCENE 10 ANIMATIONS (132 - 492, duration 360)
  // ==========================================================================
  const s10EnterSpring = spring({
    frame: s10Frame,
    fps,
    config: SPRINGS.UI,
  });

  // S1 XML lines typewriter & syntax glow
  const typingProgress = interpolate(s10Frame, [5, 120], [0, 1], {
    easing: EASINGS.OUT_EXPO,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const xmlLines = [
    { text: '<role archetype="image_generation" strict="true">', color: '#7dd3fc' },
    { text: '  <anti_hallucination>Zero coding.</anti_hallucination>', color: '#fca5a5' },
    { text: '  <aspect_ratio>16:9 Cinema 4K</aspect_ratio>', color: '#c4b5fd' },
    { text: '  <reasoning_passes>4x Verification</reasoning_passes>', color: '#7dd3fc' },
    { text: '  <schema_bounds type="strict" drift="0%" />', color: '#86efac' },
    { text: '</role>', color: '#7dd3fc' },
  ];

  // 4 Reasoning Passes Staggered Activation matching the voice narration
  const pass1 = s10Frame >= 20;  // Schema TypeCheck
  const pass2 = s10Frame >= 65;  // Zero-Coding Guardrail
  const pass3 = s10Frame >= 120; // Multi-Pass Reasoner
  const pass4 = s10Frame >= 175; // Cross-Target Optimizer

  // Red anti_hallucination line turns mint
  const antiHalMint = s10Frame >= 70;

  // Z3 Zoom-through transition exit (last 20 frames: 472 - 492)
  const isZ3Exit = frame >= 472;
  const z3ExitScale = isZ3Exit
    ? interpolate(frame, [472, 492], [1, 1.4], { easing: EASINGS.IN_EXPO, extrapolateRight: 'clamp' })
    : 1;
  const z3ExitBlur = isZ3Exit
    ? interpolate(frame, [472, 492], [0, 16], { extrapolateRight: 'clamp' })
    : 0;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <EdgeLightWipe startFrame={0} direction="R2L" />
      <EdgeLightWipe startFrame={130} direction="R2L" />

      <CameraRig sceneFrame={frame} sceneDuration={492} globalFrame={frame + 1428}>
        {/* ================================================================== */}
        {/* SCENE CHROME (Strict Zones: Headline y:100-180, Caption y:940-1030) */}
        {/* ================================================================== */}
        {isScene9 && (
          <SceneChrome
            eyebrow="NEURAL DIRECTIVES"
            headline="Zero-shot to production."
            caption="From zero-shot to production-grade directives in milliseconds."
            keyWord="production."
            sceneFrame={s9Frame}
            sceneDuration={132}
          />
        )}
        {isScene10 && (
          <SceneChrome
            eyebrow="SCHEMA SYNTHESIS"
            headline="Multi-pass reasoning."
            caption="Multi-pass reasoning, strict schema validation, and zero-coding archetypes."
            keyWord="Multi-pass"
            sceneFrame={s10Frame}
            sceneDuration={360}
          />
        )}

        {/* ================================================================== */}
        {/* 🎬 SCENE 9: ZERO-SHOT TO PRODUCTION DIRECTIVES (0 - 132)           */}
        {/* ================================================================== */}
        {isScene9 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `scale(${s9PullBack})`,
              transformOrigin: '960px 510px',
            }}
          >
            {/* LEFT CARD: Raw Intent Input (x: 180 - 760, y: 300 - 720) */}
            <div
              style={{
                position: 'absolute',
                left: '180px',
                top: '300px',
                width: '580px',
                height: '420px',
                borderRadius: '24px',
                background: COLORS.bgCardGlass,
                backgroundColor: COLORS.bgCard,
                border: COLORS.cardBorder,
                boxShadow: '0 30px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(30px)',
                padding: '28px 32px',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <span style={{ fontSize: '20px', color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
                  raw_intent.txt
                </span>
                <span style={{ fontSize: '20px', color: COLORS.mint, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                  INPUT
                </span>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '22px', lineHeight: 1.6, color: COLORS.white, flex: 1 }}>
                &quot;Create a master system prompt for an image and video generation director. Ensure zero coding hallucinations, strict visual composition, and deterministic cinematic output.&quot;
              </div>
            </div>

            {/* CONNECTOR PIPE & PACKETS (between cards at y: 510) */}
            <div
              style={{
                position: 'absolute',
                left: '760px',
                top: '480px',
                width: '300px',
                height: '60px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 22,
                pointerEvents: 'none',
              }}
            >
              {/* Pipe Track */}
              <div style={{ width: '100%', height: '3px', backgroundColor: 'rgba(255, 255, 255, 0.1)', position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${beamProgress * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #10b981, #ffffff)',
                    boxShadow: '0 0 16px rgba(16, 185, 129, 0.9)',
                  }}
                />
              </div>

              {/* Counter Chip / Compiling Badge */}
              <div
                style={{
                  marginTop: '12px',
                  padding: '6px 18px',
                  borderRadius: '100px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: `1px solid ${COLORS.mintBorder}`,
                  color: COLORS.mint,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '20px',
                  fontWeight: 700,
                  transform: `scale(${s9CounterZoom})`,
                }}
              >
                {shotCounter}
              </div>
            </div>

            {/* RIGHT CARD: directive.xml (x: 1060 - 1740) */}
            <div
              style={{
                position: 'absolute',
                left: '1060px',
                top: '300px',
                width: '680px',
                height: '420px',
                borderRadius: '24px',
                background: COLORS.bgCardGlass,
                backgroundColor: COLORS.bgCard,
                border: `1.5px solid ${COLORS.mintBorder}`,
                boxShadow: '0 30px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(16, 185, 129, 0.3)',
                backdropFilter: 'blur(30px)',
                padding: '26px 30px',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 20,
                overflow: 'hidden',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '20px', color: COLORS.mint, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                  directive.xml
                </span>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '18px', color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
                    SYNTHESIZING...
                  </span>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.mint, boxShadow: '0 0 10px #10b981' }} />
                </div>
              </div>

              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '18px', lineHeight: 1.65, flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ color: '#7dd3fc' }}>&lt;role archetype=&quot;image_generation&quot; strict=&quot;true&quot;&gt;</div>
                <div style={{ color: '#fca5a5' }}>  &lt;anti_hallucination&gt;Zero coding.&lt;/anti_hallucination&gt;</div>
                <div style={{ color: '#c4b5fd' }}>  &lt;aspect_ratio&gt;16:9 Cinema 4K&lt;/aspect_ratio&gt;</div>
                <div style={{ color: '#7dd3fc' }}>  &lt;reasoning_passes&gt;4x Verification&lt;/reasoning_passes&gt;</div>
                <div style={{ color: '#7dd3fc' }}>&lt;/role&gt;</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px' }}>
                <span style={{ fontSize: '17px', color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
                  STATUS: INGESTING SPEC
                </span>
                <span style={{ fontSize: '17px', color: COLORS.mint, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                  100% PARSED
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* 🎬 SCENE 10: MULTI-PASS REASONING & ARCHETYPE INSPECTOR (132 - 492) */}
        {/* Balanced Twin Glass Architecture: Left 160-940, Right 980-1760     */}
        {/* Zero Overlap · 124px Margin Clearance to Progress Rail (x: 1884)   */}
        {/* ================================================================== */}
        {isScene10 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `scale(${z3ExitScale * s10EnterSpring})`,
              transformOrigin: '960px 510px',
              filter: `blur(${z3ExitBlur}px)`,
              opacity: s10EnterSpring,
            }}
          >
            {/* ================================================================ */}
            {/* LEFT CARD: directive.xml (Hardened Archetype Directive Code)      */}
            {/* Geometry: left: 160px, width: 780px, top: 250px, height: 530px    */}
            {/* ================================================================ */}
            <div
              style={{
                position: 'absolute',
                left: '160px',
                top: '250px',
                width: '780px',
                height: '530px',
                borderRadius: '24px',
                background: COLORS.bgCardGlass,
                backgroundColor: COLORS.bgCard,
                border: `1.5px solid ${COLORS.mintBorder}`,
                boxShadow: '0 30px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(16, 185, 129, 0.3)',
                backdropFilter: 'blur(30px)',
                padding: '24px 28px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                zIndex: 20,
                boxSizing: 'border-box',
              }}
            >
              {/* Window Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '14px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f43f5e' }} />
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#eab308' }} />
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                  <span style={{ marginLeft: '12px', fontSize: '20px', color: COLORS.mint, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                    directive.xml
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '4px 14px', borderRadius: '100px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.mint, boxShadow: '0 0 8px #10b981' }} />
                  <span style={{ fontSize: '16px', color: COLORS.white, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                    ARCHETYPE DIRECTIVE
                  </span>
                </div>
              </div>

              {/* Code Body with Line Numbers */}
              <div style={{ display: 'flex', gap: '18px', padding: '16px 0', flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: '19px', lineHeight: 1.7 }}>
                {/* Line Numbers */}
                <div style={{ display: 'flex', flexDirection: 'column', color: 'rgba(255, 255, 255, 0.25)', userSelect: 'none', textAlign: 'right' }}>
                  <span>01</span>
                  <span>02</span>
                  <span>03</span>
                  <span>04</span>
                  <span>05</span>
                  <span>06</span>
                </div>

                {/* Code Lines */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                  {xmlLines.map((line, i) => {
                    const isLineActive = typingProgress * 6 >= i;
                    const isAntiHalLine = i === 1;
                    const lineColor = isAntiHalLine && antiHalMint ? COLORS.mint : line.color;

                    return (
                      <div
                        key={`code-line-${i}`}
                        style={{
                          color: lineColor,
                          opacity: isLineActive ? 1 : 0.25,
                          transform: isLineActive ? 'none' : 'translateY(4px)',
                          whiteSpace: 'nowrap',
                          fontWeight: isAntiHalLine && antiHalMint ? 700 : 400,
                          textShadow: isAntiHalLine && antiHalMint ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none',
                          transition: 'color 0.2s ease',
                        }}
                      >
                        {line.text}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pass Badges Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px' }}>
                <div style={{ fontSize: '17px', color: pass1 ? COLORS.mint : COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                  [PASS 1: SCHEMA {pass1 ? '✓' : '○'}]
                </div>
                <div style={{ fontSize: '17px', color: pass2 ? COLORS.mint : COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                  [PASS 2: LOGIC {pass2 ? '✓' : '○'}]
                </div>
                <div style={{ fontSize: '17px', color: pass3 ? COLORS.mint : COLORS.textDim, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                  [PASS 3: HARMONY {pass3 ? '✓' : '○'}]
                </div>
              </div>
            </div>

            {/* ================================================================ */}
            {/* RIGHT CARD: ARCHETYPE & SCHEMA INSPECTOR                         */}
            {/* Geometry: left: 980px, width: 780px, top: 250px, height: 530px   */}
            {/* (Symmetrical twin card, 124px clearance to progress rail at 1884) */}
            {/* ================================================================ */}
            <div
              style={{
                position: 'absolute',
                left: '980px',
                top: '250px',
                width: '780px',
                height: '530px',
                borderRadius: '24px',
                background: COLORS.bgCardGlass,
                backgroundColor: 'rgba(8, 12, 16, 0.94)',
                border: `1.5px solid ${COLORS.mintBorder}`,
                boxShadow: '0 30px 60px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(16, 185, 129, 0.3)',
                backdropFilter: 'blur(30px)',
                padding: '24px 28px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                zIndex: 20,
                boxSizing: 'border-box',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '14px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.mint, boxShadow: '0 0 10px #10b981' }} />
                  <span style={{ fontSize: '20px', fontWeight: 700, color: COLORS.white, fontFamily: "'JetBrains Mono', monospace" }}>
                    SCHEMA & ARCHETYPE INSPECTOR
                  </span>
                </div>
                <div style={{ fontSize: '16px', color: COLORS.mint, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: '4px 14px', borderRadius: '100px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  STRICT VALIDATED
                </div>
              </div>

              {/* Archetype Guardrail Summary Card */}
              <div
                style={{
                  backgroundColor: 'rgba(5, 8, 12, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '15px', color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
                    ARCHETYPE TARGET
                  </div>
                  <div style={{ fontSize: '19px', fontWeight: 700, color: COLORS.white, marginTop: '2px' }}>
                    ImageSynthesis::Cinema4K
                  </div>
                </div>
                <div style={{ height: '32px', width: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
                <div>
                  <div style={{ fontSize: '15px', color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
                    ANTI-HALLUCINATION
                  </div>
                  <div style={{ fontSize: '19px', fontWeight: 700, color: COLORS.mint, marginTop: '2px' }}>
                    Zero-Coding Protocol
                  </div>
                </div>
                <div style={{ height: '32px', width: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
                <div>
                  <div style={{ fontSize: '15px', color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
                    SCHEMA DRIFT
                  </div>
                  <div style={{ fontSize: '19px', fontWeight: 700, color: '#34d399', marginTop: '2px' }}>
                    0.00% Bound
                  </div>
                </div>
              </div>

              {/* 4 Multi-Pass Reasoning Telemetry Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em' }}>
                  MULTI-PASS REASONING ENGINE (4x DEPTH)
                </div>

                {/* Pass 1 */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    backgroundColor: pass1 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: pass1 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '17px',
                  }}
                >
                  <span style={{ color: pass1 ? COLORS.white : COLORS.textDim }}>
                    Pass 1: JSONSchema TypeSafe Validator
                  </span>
                  <span style={{ color: pass1 ? COLORS.mint : COLORS.textDim, fontWeight: 700 }}>
                    {pass1 ? '100% PASS · 12ms' : 'PENDING'}
                  </span>
                </div>

                {/* Pass 2 */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    backgroundColor: pass2 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: pass2 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '17px',
                  }}
                >
                  <span style={{ color: pass2 ? COLORS.white : COLORS.textDim }}>
                    Pass 2: Zero-Coding Archetype Guardrail
                  </span>
                  <span style={{ color: pass2 ? COLORS.mint : COLORS.textDim, fontWeight: 700 }}>
                    {pass2 ? 'ENFORCED · 0 ERRORS' : 'PENDING'}
                  </span>
                </div>

                {/* Pass 3 */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    backgroundColor: pass3 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: pass3 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '17px',
                  }}
                >
                  <span style={{ color: pass3 ? COLORS.white : COLORS.textDim }}>
                    Pass 3: Multi-Pass Reasoning Engine
                  </span>
                  <span style={{ color: pass3 ? COLORS.mint : COLORS.textDim, fontWeight: 700 }}>
                    {pass3 ? 'VERIFIED · 4x DEPTH' : 'PENDING'}
                  </span>
                </div>

                {/* Pass 4 */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    backgroundColor: pass4 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: pass4 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '17px',
                  }}
                >
                  <span style={{ color: pass4 ? COLORS.white : COLORS.textDim }}>
                    Pass 4: Cross-Target Runtime Alignment
                  </span>
                  <span style={{ color: pass4 ? COLORS.mint : COLORS.textDim, fontWeight: 700 }}>
                    {pass4 ? 'OPTIMIZED · 195ms' : 'PENDING'}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px', fontFamily: "'JetBrains Mono', monospace", fontSize: '16px' }}>
                <span style={{ color: COLORS.textDim }}>
                  LATENCY: 195ms · DETERMINISM: 100%
                </span>
                <span style={{ color: COLORS.mint, fontWeight: 700 }}>
                  STATUS: PRODUCTION HARDENED
                </span>
              </div>
            </div>
          </div>
        )}
      </CameraRig>
    </AbsoluteFill>
  );
};
