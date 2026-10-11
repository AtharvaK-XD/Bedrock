import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, EASINGS, HIT_FRAMES, LAYOUT_ZONES, SPRINGS } from '../components/MotionTokens';
import { SceneChrome } from '../components/SceneChrome';
import { CameraRig, FlashOverlay } from '../components/Transitions';

const GLYPHS = '01#@$%&*<>[]{}~=+/ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function getScrambledText(targetText: string, progress: number, seed: number): string {
  const chars = targetText.split('');
  const lockIndex = Math.floor(chars.length * progress);

  return chars
    .map((char, i) => {
      if (char === ' ' || char === '·' || char === ':' || char === '[' || char === ']') return char;
      if (i < lockIndex) return char;
      const glyphIndex = Math.abs((seed * 37 + i * 17) % GLYPHS.length);
      return GLYPHS[glyphIndex];
    })
    .join('');
}

export const Scene1ProblemAndGenesis: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Act 1 Spans Global Frames 0 to 708 (11.8s)
  // Scene 1: 0 - 336 (0.0 - 5.6s)
  // Scene 2: 336 - 600 (5.6 - 10.0s)
  // Scene 3: 600 - 708 (10.0 - 11.8s)

  const isScene1 = frame < 336;
  const isScene2 = frame >= 336 && frame < 600;
  const isScene3 = frame >= 600;

  // Local frame in current scene
  const s1Frame = frame;
  const s2Frame = Math.max(0, frame - 336);
  const s3Frame = Math.max(0, frame - 600);

  // ==========================================================================
  // SCENE 1 ANIMATIONS (0 - 336)
  // ==========================================================================
  // Dutch tilt 1.5 deg in scene 1, straightening in scene 2
  const s1CardSpring = spring({ frame: Math.max(0, s1Frame - 15), fps, config: SPRINGS.UI });
  const s1TypingProgress = interpolate(s1Frame, [30, 210], [0, 1], {
    easing: EASINGS.OUT_EXPO,
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const promptCode = `// Standard Unchecked Prompt\nconst prompt = \`Extract user entities and return JSON.\nDo not hallucinate, format accurately without errors.\`;\n\nawait llm.generate({ prompt, temperature: 0.7 });`;
  const s1Chars = Math.floor(s1TypingProgress * promptCode.length);

  // Error spike at frame 240 (4.0s) through dismissal flick at 306 (5.1s)
  const isError = s1Frame >= 240 && s1Frame <= 306;
  const errorShake = isError ? Math.sin((s1Frame - 240) * 2.8) * 4 : 0;
  const errorBorderColor = isError ? COLORS.errorRed : 'rgba(255, 255, 255, 0.08)';

  // W2 Flick-dismiss at frame 306 (5.1s)
  const isFlicked = s1Frame >= 306;
  const flickAge = Math.max(0, s1Frame - 306);
  const flickX = isFlicked ? Math.pow(flickAge / 28, 2.5) * 3200 : 0;
  const flickRot = isFlicked ? (flickAge / 28) * 16 : 0;
  const flickOpacity = isFlicked ? Math.max(0, 1 - flickAge / 22) : 1;

  // Audio-calibrated captions for Scene 1 (0.0s - 5.6s / frames 0 - 336)
  // Sentence 1: 0.1s - 3.2s (frames 6 - 192)
  // Sentence 2: 3.2s - 7.64s (frames 192 - 458, continues into Scene 2)
  const s1IsSentence1 = s1Frame < 192;
  const s1Caption = s1IsSentence1
    ? "The modern software landscape is a labyrinth."
    : "We chain prompts, we wrangle context, we pray for coherence.";
  const s1CapStart = s1IsSentence1 ? 6 : 192;
  const s1CapEnd = s1IsSentence1 ? 186 : 458;

  // Audio-calibrated captions for Scene 2 (5.6s - 10.0s / global frames 336 - 600)
  // Sentence 2 concludes: 5.6s - 7.64s (global 336 - 458 / s2Frame 0 - 122)
  // Sentence 3: 7.64s - 10.0s (global 458 - 600 / s2Frame 122 - 264)
  const s2IsSentence2 = s2Frame < 122;
  const s2Caption = s2IsSentence2
    ? "We chain prompts, we wrangle context, we pray for coherence."
    : "The result? Fragile abstractions built on shifting sands.";
  const s2CapStart = s2IsSentence2 ? -144 : 122;
  const s2CapEnd = s2IsSentence2 ? 122 : 252;

  // ==========================================================================
  // SCENE 2 ANIMATIONS (336 - 600, duration 264)
  // ==========================================================================
  // Z4 Pull-back reveal (1.55 -> 1.00 over 36 frames)
  const s2PullBack = interpolate(s2Frame, [0, 36], [1.55, 1.00], {
    easing: EASINGS.OUT_EXPO,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const s2CardSpring = spring({ frame: Math.max(0, s2Frame - 8), fps, config: SPRINGS.UI });

  // Terminal scroll (S1)
  const compilerCode = `[SCHEMA_STRICT] Archetype::SystemDirective<Engine>\n├── TypeSafeValidator<JSONSchema> -> PASS\n├── ZeroCodingGuardrail -> ACTIVE (0 errors)\n├── MultiPassReasoner -> VERIFIED (195ms)\n└── ModelTarget::FrontierEngine -> READY`;
  const s2Typing = interpolate(s2Frame, [15, 140], [0, 1], {
    easing: EASINGS.OUT_EXPO,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const s2Chars = Math.floor(s2Typing * compilerCode.length);

  // Scene 2 exit lean-back (last 36 frames)
  const s2LeanBack = interpolate(s2Frame, [228, 264], [1, 0.96], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const s2BlurOut = interpolate(s2Frame, [228, 264], [0, 6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ==========================================================================
  // SCENE 3 ANIMATIONS (600 - 708, duration 108)
  // ==========================================================================
  // Decryption scramble (snappy cybernetic resolve in 22 frames = ~0.36s)
  const s3ScrambleProgress = interpolate(s3Frame, [0, 22], [0, 1], {
    easing: EASINGS.OUT_QUAD,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wordmarkScramble = getScrambledText('BEDROCK WORKSTATION', s3ScrambleProgress, s3Frame);

  // 3D rotation of logo badge (upright settle over 36 frames)
  const s3LogoRotX = interpolate(s3Frame, [0, 36], [18, 0], {
    easing: EASINGS.OUT_EXPO,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Shockwave expanding at hit (Hit 1 is at global frame 680 = s3Frame 80)
  const shockwaveProgress = interpolate(s3Frame, [80, 108], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shockwaveScale = 1 + shockwaveProgress * 3.5;
  const shockwaveOpacity = Math.max(0, 1 - shockwaveProgress);

  // Smooth cinematic ease into Act 2 (gentle scale ease and soft crossfade, NO violent collapse)
  const s3ExitScale = interpolate(s3Frame, [88, 108], [1.0, 0.94], {
    easing: EASINGS.OUT_QUAD,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const s3ExitOpacity = interpolate(s3Frame, [98, 108], [1.0, 0.0], {
    easing: EASINGS.OUT_QUAD,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* Mint Flash Overlay for Hit 1 at frame 680 (Fixes R7) */}
      <FlashOverlay triggerFrame={HIT_FRAMES.HIT_1} duration={6} />

      {/* ==================================================================== */}
      {/* 🎬 SCENE 1: AI development is broken.                                */}
      {/* ==================================================================== */}
      {isScene1 && (
        <CameraRig sceneFrame={s1Frame} sceneDuration={336} globalFrame={frame}>
          <SceneChrome
            eyebrow="PROMPT ARCHITECTURE"
            headline="AI development is broken."
            caption={s1Caption}
            keyWord="broken."
            sceneFrame={s1Frame}
            sceneDuration={336}
            captionStartFrame={s1CapStart}
            captionEndFrame={s1CapEnd}
          />

          {/* Diagram Zone: Code Card (460 - 1460, y: 260 - 780) */}
          <div
            style={{
              position: 'absolute',
              left: '460px',
              top: '260px',
              width: '1000px',
              height: '520px',
              borderRadius: '24px',
              background: COLORS.bgCardGlass,
              backgroundColor: COLORS.bgCard,
              border: `1px solid ${errorBorderColor}`,
              boxShadow: isError
                ? '0 30px 80px rgba(244, 63, 94, 0.35), inset 0 0 30px rgba(244, 63, 94, 0.15)'
                : '0 30px 80px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(30px)',
              transform: `translate(${flickX + errorShake}px, ${errorShake}px) rotate(${flickRot}deg) scale(${s1CardSpring})`,
              opacity: flickOpacity * s1CardSpring,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 20,
            }}
          >
            {/* Window Titlebar */}
            <div
              style={{
                height: '56px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                background: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f43f5e' }} />
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#eab308' }} />
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                <span style={{ marginLeft: '12px', fontSize: '20px', color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
                  brittle_prompt.ts
                </span>
              </div>
              {isError && (
                <div
                  style={{
                    backgroundColor: 'rgba(244, 63, 94, 0.18)',
                    color: '#f43f5e',
                    border: '1px solid rgba(244, 63, 94, 0.4)',
                    padding: '4px 14px',
                    borderRadius: '6px',
                    fontSize: '20px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  SCHEMA_COLLAPSE_DETECTED
                </div>
              )}
            </div>

            {/* Terminal Body */}
            <div style={{ padding: '32px', flex: 1, position: 'relative', overflow: 'hidden' }}>
              <pre
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '24px',
                  lineHeight: '1.6',
                  color: isError ? '#fca5a5' : 'rgba(255, 255, 255, 0.9)',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {promptCode.slice(0, s1Chars)}
                {s1Frame < 210 && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: '10px',
                      height: '24px',
                      backgroundColor: COLORS.mint,
                      marginLeft: '4px',
                      opacity: s1Frame % 30 < 15 ? 1 : 0,
                    }}
                  />
                )}
              </pre>

              {/* Error Callout Overlay */}
              {isError && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '32px',
                    left: '32px',
                    right: '32px',
                    padding: '20px 24px',
                    borderRadius: '12px',
                    background: 'rgba(244, 63, 94, 0.14)',
                    border: '1px solid rgba(244, 63, 94, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: '#ffffff', fontSize: '22px', fontWeight: 600 }}>
                    ❌ Model Drift: JSON parsing failed silently in production.
                  </span>
                  <span style={{ color: '#f43f5e', fontFamily: "'JetBrains Mono', monospace", fontSize: '20px', fontWeight: 700 }}>
                    ERR_UNDEFINED_SCHEMA
                  </span>
                </div>
              )}
            </div>
          </div>
        </CameraRig>
      )}

      {/* ==================================================================== */}
      {/* 🎬 SCENE 2: What if prompts had compiler rigor?                      */}
      {/* ==================================================================== */}
      {isScene2 && (
        <CameraRig sceneFrame={s2Frame} sceneDuration={264} globalFrame={frame}>
          <SceneChrome
            eyebrow="DETERMINISTIC COMPILATION"
            headline="What if prompts had compiler rigor?"
            caption={s2Caption}
            keyWord="compiler rigor?"
            sceneFrame={s2Frame}
            sceneDuration={264}
            captionStartFrame={s2CapStart}
            captionEndFrame={s2CapEnd}
          />

          {/* Diagram Zone: Compiler Rigor Card */}
          <div
            style={{
              position: 'absolute',
              left: '460px',
              top: '260px',
              width: '1000px',
              height: '520px',
              borderRadius: '24px',
              background: COLORS.bgCardGlass,
              backgroundColor: COLORS.bgCard,
              border: `1px solid ${COLORS.mintBorder}`,
              boxShadow: '0 30px 80px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(16, 185, 129, 0.3)',
              backdropFilter: 'blur(30px)',
              transform: `scale(${s2PullBack * s2LeanBack})`,
              filter: `blur(${s2BlurOut}px)`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 20,
            }}
          >
            {/* Header */}
            <div
              style={{
                height: '56px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                background: 'rgba(16, 185, 129, 0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.mint, boxShadow: '0 0 10px #10b981' }} />
                <span style={{ fontSize: '20px', color: COLORS.white, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                  bedrock-compiler.rs
                </span>
              </div>
              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: COLORS.mint,
                  border: `1px solid ${COLORS.mintBorder}`,
                  padding: '4px 14px',
                  borderRadius: '6px',
                  fontSize: '20px',
                  fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                0 ERRORS · STRICT COMPILED
              </div>
            </div>

            {/* Code Body */}
            <div style={{ padding: '36px', flex: 1, position: 'relative' }}>
              <pre
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '24px',
                  lineHeight: '1.7',
                  color: COLORS.white,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {compilerCode.slice(0, s2Chars)}
              </pre>
            </div>
          </div>
        </CameraRig>
      )}

      {/* ==================================================================== */}
      {/* 🎬 SCENE 3: Logo Reveal (Hit at 11.33s = global 680 = local 80)      */}
      {/* ==================================================================== */}
      {isScene3 && (
        <CameraRig sceneFrame={s3Frame} sceneDuration={108} globalFrame={frame}>
          <SceneChrome
            eyebrow="ENTERPRISE WORKSTATION"
            headline="BEDROCK WORKSTATION"
            keyWord="WORKSTATION"
            sceneFrame={s3Frame}
            sceneDuration={108}
            hideHeadline
            hideCaption
          />

          {/* Central Logo Lockup Zone */}
          <div
            style={{
              position: 'absolute',
              top: '280px',
              left: 0,
              right: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 30,
              transform: `scale(${s3ExitScale})`,
              opacity: s3ExitOpacity,
            }}
          >
            {/* Expanding Shockwave Ring on Hit 1 */}
            {s3Frame >= 80 && (
              <div
                style={{
                  position: 'absolute',
                  width: '300px',
                  height: '300px',
                  borderRadius: '50%',
                  border: `2px solid ${COLORS.mint}`,
                  boxShadow: '0 0 40px rgba(16, 185, 129, 0.8)',
                  transform: `scale(${shockwaveScale})`,
                  opacity: shockwaveOpacity,
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* 3D Icon Badge */}
            <div
              style={{
                width: '160px',
                height: '160px',
                borderRadius: '36px',
                background: 'radial-gradient(circle at 35% 30%, #162622 0%, #08110f 100%)',
                border: `2px solid ${COLORS.mintBorder}`,
                boxShadow: s3Frame >= 80
                  ? '0 30px 80px rgba(0, 0, 0, 0.95), 0 0 60px rgba(16, 185, 129, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
                  : '0 30px 80px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `rotateX(${s3LogoRotX}deg)`,
                marginBottom: '28px',
                backdropFilter: 'blur(30px)',
              }}
            >
              <Img
                src={staticFile('logo.png')}
                style={{
                  width: '100px',
                  height: '100px',
                  objectFit: 'contain',
                  filter: s3Frame >= 80
                    ? 'drop-shadow(0 0 25px rgba(16, 185, 129, 0.85))'
                    : 'none',
                }}
              />
            </div>

            {/* Resolved Wordmark */}
            <div
              style={{
                fontFamily: "'Space Grotesk', 'Inter', monospace",
                fontSize: '44px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                color: COLORS.white,
                marginBottom: '14px',
                textShadow: s3Frame >= 80 ? '0 0 30px rgba(16, 185, 129, 0.6)' : 'none',
              }}
            >
              {wordmarkScramble}
            </div>

            {/* Tagline */}
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '22px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: COLORS.mint,
                opacity: interpolate(s3Frame, [8, 24], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              The enterprise prompt engineering workstation.
            </div>
          </div>
        </CameraRig>
      )}
    </AbsoluteFill>
  );
};
