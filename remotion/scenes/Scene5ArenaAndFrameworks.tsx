import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, EASINGS, HIT_FRAMES, LAYOUT_ZONES, SPRINGS } from '../components/MotionTokens';
import { SceneChrome } from '../components/SceneChrome';
import { GhostCursor, CursorWaypoint } from '../components/GhostCursor';
import { CameraRig, EdgeLightWipe, FlashOverlay } from '../components/Transitions';

const FRAMEWORKS = [
  { name: 'LangChain', type: 'Python / TS' },
  { name: 'LlamaIndex', type: 'RAG Pipeline' },
  { name: 'OpenAI SDK', type: 'Structured Outputs' },
  { name: 'Anthropic SDK', type: 'Tool Use' },
  { name: 'Vercel AI SDK', type: 'Streaming UI' },
  { name: 'Google GenAI', type: 'Multimodal' },
  { name: 'Mastra Agents', type: 'Autonomous' },
  { name: 'Rust Crates', type: 'Native High-Perf' },
  { name: 'Python Pydantic', type: 'Data Validation' },
  { name: 'TypeScript Core', type: 'Type-Safe Directives' },
  { name: 'cURL / REST', type: 'Direct HTTP' },
  { name: 'Promptfoo', type: 'Security & Red-Teaming' },
];

export const Scene5ArenaAndFrameworks: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Act 5 Spans Global Frames 2598 to 3114 (Duration: 516 frames)
  // Scene 13: 0 - 222 (Global 2598 - 2820) "Frontier head-to-head."
  // Scene 14: 222 - 516 (Global 2820 - 3114) "15 export frameworks."

  const isScene13 = frame < 222;
  const isScene14 = frame >= 222;

  const s13Frame = frame;
  const s14Frame = Math.max(0, frame - 222);

  // ==========================================================================
  // SCENE 13 ANIMATIONS (0 - 222)
  // ==========================================================================
  // FIX R10: Head-to-Head Collision lands EXACTLY on frame 0 (Global 2598 = 43.30s)!
  const collisionAge = s13Frame;
  const collisionShockScale = interpolate(collisionAge, [0, 20], [1, 2.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const collisionShockOpacity = interpolate(collisionAge, [0, 20], [0.8, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Challenger A (Claude) & Challenger B (DeepSeek) slam together at center x:960 on frame 0, then rebound
  const clashSlideA = interpolate(s13Frame, [0, 4, 20], [60, 60, 0], {
    easing: EASINGS.BACK_OUT,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const clashSlideB = interpolate(s13Frame, [0, 4, 20], [-60, -60, 0], {
    easing: EASINGS.BACK_OUT,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Scoreboard digit-wheel roll (Claude 99.1%, DeepSeek 98.7% over 600ms = 36 frames)
  const claudeScore = Math.min(99.1, Number(interpolate(s13Frame, [0, 36], [60.0, 99.1], { easing: EASINGS.OUT_EXPO, extrapolateRight: 'clamp' }).toFixed(1)));
  const deepseekScore = Math.min(98.7, Number(interpolate(s13Frame, [0, 36], [58.0, 98.7], { easing: EASINGS.OUT_EXPO, extrapolateRight: 'clamp' }).toFixed(1)));

  // W4 Ghost Cursor in Scene 13: taps winner card at frame 70
  const cursorWaypointsArena: CursorWaypoint[] = [
    { frame: 30, x: 960, y: 510 },
    { frame: 70, x: 560, y: 510, isClick: true },
    { frame: 140, x: 960, y: 510 },
  ];

  // W2 Flick Exit out of Scene 13 (frames 195 - 222)
  const isArenaExit = s13Frame >= 195;
  const arenaExitAge = Math.max(0, s13Frame - 195);
  const arenaExitX = isArenaExit ? Math.pow(arenaExitAge / 25, 2) * 1600 : 0;

  // ==========================================================================
  // SCENE 14 ANIMATIONS (222 - 516, duration 294)
  // ==========================================================================
  // FIX R4: First framework card visible within 15 frames (250ms), previous caption already left!
  const isExitPhase = s14Frame >= 210; // ~49.8s (frames 210 - 294)
  const exitAge = Math.max(0, s14Frame - 210);

  // Clean exit transition without any 3D flipping or mirroring
  const exitScale = isExitPhase
    ? interpolate(exitAge, [40, 80], [1, 0.92], { easing: EASINGS.IN_EXPO, extrapolateRight: 'clamp' })
    : 1;
  const exitOpacity = isExitPhase
    ? interpolate(exitAge, [45, 80], [1, 0], { extrapolateRight: 'clamp' })
    : 1;

  // Marquee rows (S2) decelerating onto 12 grid slots
  const marqueeSettle = spring({ frame: Math.max(0, s14Frame - 6), fps, config: SPRINGS.UI });

  // W4 Ghost Cursor clicks Promptfoo READY badge at frame 110 of Scene 14 (safe from text)
  const cursorWaypointsFW: CursorWaypoint[] = [
    { frame: 30, x: 400, y: 400 },
    { frame: 80, x: 1650, y: 640 },
    { frame: 110, x: 1650, y: 640, isClick: true },
  ];

  // Tile "+3 more" counter counts +1 -> +3 rapidly (Fixes E12)
  const plusThreeCounter = Math.min(3, Math.floor(interpolate(s14Frame, [10, 45], [1, 3], { extrapolateRight: 'clamp' })));

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* Collision Hit Flash at 43.3s = Frame 2598 */}
      <FlashOverlay triggerFrame={HIT_FRAMES.HIT_2} duration={5} />

      {/* Edge Light Wipe T->B for Scene 14 entrance */}
      <EdgeLightWipe startFrame={220} direction="T2B" />

      <CameraRig sceneFrame={frame} sceneDuration={516} globalFrame={frame + 2598}>
        {/* ================================================================== */}
        {/* SCENE CHROME (Strict Zones: Headline y:100-180, Caption y:940-1030) */}
        {/* ================================================================== */}
        {isScene13 && (
          <SceneChrome
            eyebrow="ARENA BENCHMARK"
            headline="Frontier head-to-head."
            caption="Pit frontier LLMs head-to-head in the Arena."
            keyWord="head-to-head."
            sceneFrame={s13Frame}
            sceneDuration={222}
            immediateHeadline
          />
        )}
        {isScene14 && (
          <SceneChrome
            eyebrow="RUNTIME COMPATIBILITY"
            headline="15 export frameworks."
            caption="Then export hardened system directives across fifteen production frameworks."
            keyWord="frameworks."
            sceneFrame={s14Frame}
            sceneDuration={294}
          />
        )}

        {/* Ghost Cursor Interaction (W4) */}
        {isScene13 && <GhostCursor sceneFrame={s13Frame} waypoints={cursorWaypointsArena} />}
        {isScene14 && !isExitPhase && <GhostCursor sceneFrame={s14Frame} waypoints={cursorWaypointsFW} />}

        {/* ================================================================== */}
        {/* ⚔️ SCENE 13: ARENA HEAD-TO-HEAD CLASH (Geometry 4.4)               */}
        {/* ================================================================== */}
        {isScene13 && (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Shockwave expanding from clash center */}
            <div
              style={{
                position: 'absolute',
                left: '960px',
                top: '510px',
                width: '180px',
                height: '180px',
                borderRadius: '50%',
                border: `2px solid ${COLORS.mint}`,
                boxShadow: '0 0 35px rgba(16, 185, 129, 0.8)',
                transform: `translate(-50%, -50%) scale(${collisionShockScale})`,
                opacity: collisionShockOpacity,
                pointerEvents: 'none',
              }}
            />

            {/* Challenger A: Claude 3.7 Sonnet (Winner, left: 380, width: 520) */}
            <div
              style={{
                position: 'absolute',
                left: '380px',
                top: '360px',
                width: '520px',
                height: '300px',
                borderRadius: '24px',
                background: COLORS.bgCardGlass,
                backgroundColor: COLORS.bgCard,
                border: `2px solid ${COLORS.mint}`,
                boxShadow: '0 30px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(16, 185, 129, 0.45)',
                backdropFilter: 'blur(30px)',
                padding: '28px 32px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                zIndex: 25,
                transform: `translateX(${clashSlideA - arenaExitX}px)`,
                opacity: 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '20px', color: COLORS.textMuted }}>CHALLENGER A</span>
                <span
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.18)',
                    color: COLORS.mint,
                    border: `1px solid ${COLORS.mintBorder}`,
                    padding: '4px 14px',
                    borderRadius: '8px',
                    fontSize: '20px',
                    fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  WINNER ✓
                </span>
              </div>
              <div style={{ fontSize: '34px', fontWeight: 700, color: COLORS.white, letterSpacing: '-0.02em' }}>
                Claude 3.7 Sonnet
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
                <span style={{ fontSize: '20px', color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>ARENA SCORE</span>
                <span style={{ fontSize: '32px', fontWeight: 800, color: COLORS.mintText, fontFamily: "'JetBrains Mono', monospace" }}>{claudeScore}%</span>
              </div>
            </div>

            {/* VS Badge in Center (960, 510) */}
            <div
              style={{
                position: 'absolute',
                left: '960px',
                top: '510px',
                transform: `translate(-50%, -50%) scale(${interpolate(s13Frame, [0, 8], [0.3, 1], { easing: EASINGS.BACK_OUT, extrapolateRight: 'clamp' })})`,
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(10, 16, 20, 0.95)',
                border: `2px solid ${COLORS.mintBorder}`,
                boxShadow: '0 0 25px rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                fontWeight: 800,
                color: COLORS.white,
                fontFamily: "'JetBrains Mono', monospace",
                zIndex: 30,
              }}
            >
              VS
            </div>

            {/* Challenger B: DeepSeek R1 (Loser, left: 1020, width: 520) */}
            <div
              style={{
                position: 'absolute',
                left: '1020px',
                top: '360px',
                width: '520px',
                height: '300px',
                borderRadius: '24px',
                background: COLORS.bgCardGlass,
                backgroundColor: COLORS.bgCard,
                border: COLORS.cardBorder,
                boxShadow: '0 30px 60px rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(30px)',
                padding: '28px 32px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                zIndex: 25,
                transform: `translateX(${clashSlideB + arenaExitX}px)`,
                opacity: 0.85, // Loser dims 15%
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '20px', color: COLORS.textMuted }}>CHALLENGER B</span>
                <span style={{ fontSize: '20px', color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>RUNNER UP</span>
              </div>
              <div style={{ fontSize: '34px', fontWeight: 700, color: COLORS.white, letterSpacing: '-0.02em' }}>
                DeepSeek R1
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
                <span style={{ fontSize: '20px', color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>ARENA SCORE</span>
                <span style={{ fontSize: '32px', fontWeight: 800, color: COLORS.white, fontFamily: "'JetBrains Mono', monospace" }}>{deepseekScore}%</span>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* 📦 SCENE 14: 15 EXPORT FRAMEWORKS (Geometry 4.4: 12 cards + tile)   */}
        {/* ================================================================== */}
        {isScene14 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: isExitPhase ? `scale(${exitScale})` : 'none',
              opacity: exitOpacity,
              transformOrigin: '960px 540px',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* 12 Cards Grid (360 x 110, gap 28 -> x: 198 - 1722, y: 300 - 686) */}
              <div
                style={{
                  position: 'absolute',
                  top: '300px',
                  left: '198px',
                  width: '1524px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 360px)',
                  columnGap: '28px',
                  rowGap: '24px',
                  zIndex: 25,
                }}
              >
                {FRAMEWORKS.map((fw, i) => {
                  const cardSpring = spring({ frame: Math.max(0, s14Frame - i * 3), fps, config: SPRINGS.UI });

                  return (
                    <div
                      key={fw.name}
                      style={{
                        width: '360px',
                        height: '110px',
                        borderRadius: '16px',
                        background: COLORS.bgCardGlass,
                        backgroundColor: COLORS.bgCard,
                        border: COLORS.cardBorder,
                        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(25px)',
                        padding: '16px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transform: `scale(${cardSpring * marqueeSettle})`,
                        opacity: cardSpring,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '20px', color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{fw.type}</span>
                        <span style={{ fontSize: '20px', color: COLORS.mint, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>READY</span>
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: 700, color: COLORS.white, letterSpacing: '-0.01em' }}>
                        {fw.name}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* "+3 more" Tile (Centered at 960, 760 with symmetrical padding & nowrap) */}
              <div
                style={{
                  position: 'absolute',
                  left: '960px',
                  top: '760px',
                  transform: 'translate(-50%, -50%)',
                  padding: '12px 36px',
                  borderRadius: '100px',
                  backgroundColor: 'rgba(16, 185, 129, 0.14)',
                  border: `1.5px solid ${COLORS.mintBorder}`,
                  boxShadow: '0 15px 35px rgba(0, 0, 0, 0.8), 0 0 24px rgba(16, 185, 129, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  zIndex: 26,
                  backdropFilter: 'blur(20px)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    fontSize: '20px',
                    fontWeight: 800,
                    color: COLORS.mint,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: '0.04em',
                  }}
                >
                  +{plusThreeCounter}
                </span>
                <span
                  style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    color: COLORS.white,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: '0.04em',
                  }}
                >
                  MORE EXPORT RUNTIMES
                </span>
              </div>
            </div>
          </div>
        )}
      </CameraRig>
    </AbsoluteFill>
  );
};
