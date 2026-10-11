import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, EASINGS, LAYOUT_ZONES, SPRINGS } from '../components/MotionTokens';
import { SceneChrome } from '../components/SceneChrome';
import { GhostCursor, CursorWaypoint } from '../components/GhostCursor';
import { CameraRig } from '../components/Transitions';

// 4.3 Locked Geometry for Hero Cards (340 x 160)
interface HeroCardConfig {
  name: string;
  provider: string;
  cx: number;
  cy: number;
  score: string;
  latency: string;
  edgeX?: number;
  edgeY?: number;
}

const HERO_CARDS: HeroCardConfig[] = [
  { name: 'GPT-4.5 Orion', provider: 'OpenAI', cx: 960, cy: 320, score: '99.2%', latency: '195ms', edgeX: 960, edgeY: 400 },
  { name: 'Gemini 2.0 Flash', provider: 'Google', cx: 1455, cy: 488, score: '97.8%', latency: '98ms', edgeX: 1285, edgeY: 488 },
  { name: 'Grok 3', provider: 'xAI', cx: 1266, cy: 750, score: '98.1%', latency: '230ms', edgeX: 1145, edgeY: 670 },
  { name: 'DeepSeek R1', provider: 'DeepSeek', cx: 654, cy: 750, score: '98.4%', latency: '280ms', edgeX: 775, edgeY: 670 },
  { name: 'Claude 3.7 Sonnet', provider: 'Anthropic', cx: 485, cy: 488, score: '98.9%', latency: '210ms', edgeX: 655, edgeY: 488 },
];

export const Scene2FrontierMatrix: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Act 2 Spans Global Frames 708 to 1428 (Duration: 720 frames)
  // Scene 4: 0 - 90 (Global 708 - 798) "Meet Bedrock."
  // Scene 5: 90 - 342 (Global 798 - 1050) "The premier engineering workstation."
  // Scene 6: 342 - 522 (Global 1050 - 1230) "10 frontier models. One engine."
  // Scene 7: 522 - 612 (Global 1230 - 1320) "Zero vendor lock-in."
  // Scene 8: 612 - 720 (Global 1320 - 1428) "Real-time observability."

  const isScene4 = frame < 90;
  const isScene5 = frame >= 90 && frame < 342;
  const isScene6 = frame >= 342 && frame < 522;
  const isScene7 = frame >= 522 && frame < 612;
  const isScene8 = frame >= 612;

  // Local frame calculations
  const s4Frame = frame;
  const s5Frame = Math.max(0, frame - 90);
  const s6Frame = Math.max(0, frame - 342);
  const s7Frame = Math.max(0, frame - 522);
  const s8Frame = Math.max(0, frame - 612);

  // CORE Disc center (960, 560)
  const coreX = 960;
  const coreY = 560;

  // Counters
  const tokenRate = Math.min(1840, Math.floor(interpolate(frame, [140, 260], [0, 1840], { easing: EASINGS.OUT_EXPO, extrapolateRight: 'clamp' })));
  const costSavings = Math.min(74.2, Number(interpolate(frame, [160, 280], [0, 74.2], { easing: EASINGS.OUT_EXPO, extrapolateRight: 'clamp' }).toFixed(1)));
  const modelCount = Math.min(10, Math.floor(interpolate(s6Frame, [0, 60], [1, 10], { extrapolateRight: 'clamp' })));

  // Orbit rotation
  const orbitAngle = (frame * 0.4) % 360;

  // Z7 Macro Data Zoom into Gemini latency (around frame 240)
  const isZ7Active = isScene5 && s5Frame >= 150 && s5Frame <= 210;
  const z7Zoom = isZ7Active
    ? interpolate(s5Frame, [150, 170, 190, 210], [1.0, 1.35, 1.35, 1.0], { easing: EASINGS.IN_OUT, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1.0;

  // W4 Ghost Cursor Waypoints for Scene 5, Scene 7, Scene 8
  const cursorWaypointsScene5: CursorWaypoint[] = [
    { frame: 100, x: 500, y: 550 },
    { frame: 140, x: 960, y: 350, isClick: true },
    { frame: 180, x: 1420, y: 500, isClick: true },
    { frame: 230, x: 1200, y: 720 },
    { frame: 280, x: 960, y: 860, isClick: true },
  ];

  const cursorWaypointsScene8: CursorWaypoint[] = [
    { frame: 620, x: 280, y: 420 },
    { frame: 648, x: 810, y: 420, isClick: true },
    { frame: 676, x: 1490, y: 420, isClick: true },
    { frame: 704, x: 1600, y: 680 },
  ];

  // S4 Page Scroll Exit in Scene 8 (last 22 frames: 698 - 720)
  const isS4Exit = frame >= 698;
  const s4ExitY = isS4Exit
    ? interpolate(frame, [698, 720], [0, -1080], { easing: EASINGS.IN_OUT, extrapolateRight: 'clamp' })
    : 0;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', transform: `translateY(${s4ExitY}px)` }}>
      <CameraRig sceneFrame={frame} sceneDuration={720} globalFrame={frame + 708}>
        {/* ================================================================== */}
        {/* SCENE CHROME (Strict Zones: Headline y:100-180, Caption y:940-1030) */}
        {/* ================================================================== */}
        {isScene4 && (
          <SceneChrome
            eyebrow="CORE RUNTIME"
            headline="Meet Bedrock."
            caption="Meet Bedrock."
            keyWord="Bedrock."
            sceneFrame={s4Frame}
            sceneDuration={90}
          />
        )}
        {isScene5 && (
          <SceneChrome
            eyebrow="FRONTIER INTELLIGENCE"
            headline="The premier engineering workstation."
            caption="The premier engineering workstation built for frontier intelligence."
            keyWord="workstation."
            sceneFrame={s5Frame}
            sceneDuration={252}
          />
        )}
        {isScene6 && (
          <SceneChrome
            eyebrow="UNIFIED MODEL MATRIX"
            headline="10 frontier models. One engine."
            caption="Ten frontier models."
            keyWord="One engine."
            sceneFrame={s6Frame}
            sceneDuration={180}
          />
        )}
        {isScene7 && (
          <SceneChrome
            eyebrow="PORTABLE ARCHITECTURE"
            headline="Zero vendor lock-in."
            caption="Zero lock-in."
            keyWord="lock-in."
            sceneFrame={s7Frame}
            sceneDuration={90}
          />
        )}
        {isScene8 && (
          <SceneChrome
            eyebrow="LIVE TELEMETRY"
            headline="Real-time observability."
            caption="Real-time telemetry."
            keyWord="observability."
            sceneFrame={s8Frame}
            sceneDuration={108}
          />
        )}

        {/* Ghost Cursor Interaction Layer (W4) */}
        {(isScene5 || isScene7) && (
          <GhostCursor sceneFrame={frame} waypoints={cursorWaypointsScene5} />
        )}
        {isScene8 && (
          <GhostCursor sceneFrame={frame} waypoints={cursorWaypointsScene8} />
        )}

        {/* ================================================================== */}
        {/* 🌐 HUB & SPOKES VIEW (Scenes 4 - 7: y 230 to 830)                  */}
        {/* ================================================================== */}
        {!isScene8 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
            }}
          >
            {/* Spokes SVG Network */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
              {/* Central Orbit Ring around CORE */}
              <circle
                cx={coreX}
                cy={coreY}
                r={210}
                fill="none"
                stroke="rgba(16, 185, 129, 0.25)"
                strokeWidth="1.5"
                strokeDasharray="6 8"
                opacity={interpolate(frame, [8, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
                style={{ transform: `rotate(${orbitAngle}deg)`, transformOrigin: `${coreX}px ${coreY}px` }}
              />

              {/* 5 Spokes connecting to Hero Cards (branching outwards from frame 50 to card edges) */}
              {HERO_CARDS.map((card, i) => {
                const drawSpoke = interpolate(frame, [50 + i * 6, 76 + i * 6], [0, 1], {
                  easing: EASINGS.OUT_EXPO,
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                });
                const targetX = card.edgeX ?? card.cx;
                const targetY = card.edgeY ?? card.cy;
                const packetOffset = ((frame * 3 + i * 20) % 100) / 100;
                const px = coreX + (targetX - coreX) * packetOffset;
                const py = coreY + (targetY - coreY) * packetOffset;

                return (
                  <g key={`spoke-${card.name}`}>
                    <line
                      x1={coreX}
                      y1={coreY}
                      x2={targetX}
                      y2={targetY}
                      stroke="rgba(255, 255, 255, 0.14)"
                      strokeWidth="1.5"
                      opacity={drawSpoke}
                    />
                    {/* Energy Packet running along spoke */}
                    {drawSpoke > 0.5 && (
                      <circle
                        cx={px}
                        cy={py}
                        r={3.5}
                        fill="#ffffff"
                        style={{ filter: 'drop-shadow(0 0 6px #10b981)' }}
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Central CORE Engine Disc (960, 560, diameter 144) */}
            <div
              style={{
                position: 'absolute',
                left: `${coreX - 72}px`,
                top: `${coreY - 72}px`,
                width: '144px',
                height: '144px',
                borderRadius: '50%',
                background: 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.18) 0%, rgba(255, 255, 255, 0.04) 60%, rgba(0, 0, 0, 0.7) 100%)',
                border: `2px solid ${COLORS.mintBorder}`,
                boxShadow: '0 30px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(16, 185, 129, 0.4), inset 0 0 25px rgba(16, 185, 129, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 20,
                backdropFilter: 'blur(20px)',
                transform: `scale(${spring({ frame, fps, config: SPRINGS.UI })})`,
                opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
              }}
            >
              <Img
                src={staticFile('logo-tight.png')}
                style={{
                  width: '56px',
                  height: '56px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 16px rgba(16, 185, 129, 0.75))',
                  marginBottom: '4px',
                }}
              />
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.16em',
                  color: COLORS.white,
                  fontFamily: "'JetBrains Mono', monospace",
                  textShadow: '0 0 10px rgba(16, 185, 129, 0.5)',
                }}
              >
                CORE
              </span>
            </div>

            {/* 5 HERO CARDS (340 x 160) - Exact Section 4.3 Positions, ZERO Overlap */}
            {HERO_CARDS.map((card, i) => {
              // W3 Drag-in entrance on curved arcs with 100ms (6 frames) stagger, smoothly arriving into Scene 5
              const cardEnter = spring({
                frame: Math.max(0, frame - 68 - i * 6),
                fps,
                config: SPRINGS.UI,
              });

              // W7 Card flip during scene 7 (rotateY 180 deg)
              const flipY = isScene7
                ? interpolate(s7Frame, [i * 6, i * 6 + 22], [0, 180], {
                    easing: EASINGS.OUT_EXPO,
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  })
                : 0;

              const floatY = Math.sin((frame + i * 25) * 0.05) * 4;

              return (
                <div
                  key={card.name}
                  style={{
                    position: 'absolute',
                    left: `${card.cx - 170}px`,
                    top: `${card.cy - 80 + floatY}px`,
                    width: '340px',
                    height: '160px',
                    transform: `scale(${cardEnter * (card.name.includes('Gemini') ? z7Zoom : 1.0)}) rotateY(${flipY}deg)`,
                    transformStyle: 'preserve-3d',
                    opacity: cardEnter,
                    zIndex: card.name.includes('Gemini') ? 32 : 22,
                  }}
                >
                  {/* FRONT FACE */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '20px',
                      background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.02) 100%), #080c10',
                      border: COLORS.cardBorder,
                      boxShadow: '0 25px 50px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(30px)',
                      padding: '20px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {card.provider === 'Google' && (
                          <Img src={staticFile('logos/gemini.png')} style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                        )}
                        {card.provider === 'xAI' && (
                          <Img src={staticFile('logos/grok.png')} style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                        )}
                        {card.provider === 'OpenAI' && (
                          <Img src={staticFile('logos/openai.png')} style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                        )}
                        {card.provider === 'DeepSeek' && (
                          <Img src={staticFile('logos/deepseek.png')} style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                        )}
                        {card.provider === 'Anthropic' && (
                          <Img src={staticFile('logos/claude.png')} style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                        )}
                        <span style={{ fontSize: '20px', color: COLORS.textMuted, fontWeight: 500 }}>
                          {card.provider}
                        </span>
                      </div>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.mint, boxShadow: '0 0 8px #10b981' }} />
                    </div>

                    <div style={{ fontSize: '26px', fontWeight: 700, color: COLORS.white, letterSpacing: '-0.02em' }}>
                      {card.name}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.07)', paddingTop: '10px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '20px', color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>BENCH</span>
                        <span style={{ fontSize: '22px', fontWeight: 700, color: COLORS.white, fontFamily: "'JetBrains Mono', monospace" }}>{card.score}</span>
                      </div>
                      <span style={{ color: 'rgba(255, 255, 255, 0.25)', fontSize: '18px' }}>|</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '20px', color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>LATENCY</span>
                        <span style={{ fontSize: '22px', fontWeight: 700, color: COLORS.mintText, fontFamily: "'JetBrains Mono', monospace" }}>{card.latency}</span>
                      </div>
                    </div>
                  </div>

                  {/* BACK FACE (Scene 7: Zero Vendor Lock-in / Cracked Lock / Open Architecture) */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '20px',
                      background: 'radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.15) 0%, rgba(10, 16, 20, 0.95) 100%)',
                      border: `1.5px solid ${COLORS.mintBorder}`,
                      boxShadow: '0 25px 50px rgba(0, 0, 0, 0.85), 0 0 25px rgba(16, 185, 129, 0.3)',
                      backdropFilter: 'blur(30px)',
                      padding: '18px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px', color: COLORS.mint, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                        PORTABLE DIRECTIVE
                      </span>
                    </div>

                    {/* Unlocked / Cracked Lock SVG */}
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={COLORS.mint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                      <path d="M12 14l-1 3h2l-1 3" stroke="#ffffff" strokeWidth="2" />
                    </svg>

                    <div style={{ fontSize: '20px', fontWeight: 700, color: COLORS.white, fontFamily: "'Inter', sans-serif" }}>
                      ZERO LOCK-IN
                    </div>
                  </div>
                </div>
              );
            })}


            {/* Model Counter Chip in Scene 6 ("1 -> 10 Frontier Models") */}
            {isScene6 && (
              <div
                style={{
                  position: 'absolute',
                  left: '960px',
                  top: '440px',
                  transform: 'translate(-50%, -50%)',
                  padding: '6px 20px',
                  borderRadius: '100px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: `1px solid ${COLORS.mintBorder}`,
                  color: COLORS.mint,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '20px',
                  fontWeight: 700,
                  zIndex: 30,
                  boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)',
                }}
              >
                MODELS: {modelCount} / 10
              </div>
            )}



          </div>
        )}

        {/* PILL ROW ZONE (y: 860, centered at 960, 860) - DETACHED from z7Zoom container, enters smoothly with Scene 5 */}
        {!isScene8 && !isScene4 && (
          <div
            style={{
              position: 'absolute',
              top: '860px',
              left: '50%',
              transform: `translate(-50%, -50%) scale(${spring({ frame: s5Frame, fps, config: SPRINGS.UI })})`,
              opacity: interpolate(s5Frame, [0, 14], [0, 1], { extrapolateRight: 'clamp' }),
              padding: '12px 36px',
              borderRadius: '100px',
              background: 'rgba(8, 12, 16, 0.92)',
              border: `1px solid ${COLORS.mintBorder}`,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              zIndex: 35,
              backdropFilter: 'blur(20px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px', color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>THROUGHPUT</span>
              <span style={{ fontSize: '24px', fontWeight: 800, color: COLORS.white, fontFamily: "'JetBrains Mono', monospace" }}>{tokenRate} t/s</span>
            </div>
            <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px', color: COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>COST DELTA</span>
              <span style={{ fontSize: '24px', fontWeight: 800, color: COLORS.mintText, fontFamily: "'JetBrains Mono', monospace" }}>-{costSavings}%</span>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* 📊 SCENE 8: OBSERVABILITY HUD (FIX R3: Strict Geometry 4.4)         */}
        {/* ================================================================== */}
        {isScene8 && (
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* 5 Cards across x: 130 - 1790, y: 300 - 540 (300 x 240, 40px gaps) */}
            {HERO_CARDS.map((card, i) => {
              const cardX = 130 + i * 340;
              const cardEnter = spring({ frame: Math.max(0, s8Frame - i * 4), fps, config: SPRINGS.UI });

              return (
                <div
                  key={`obs-${card.name}`}
                  style={{
                    position: 'absolute',
                    left: `${cardX}px`,
                    top: '300px',
                    width: '300px',
                    height: '240px',
                    borderRadius: '20px',
                    background: COLORS.bgCardGlass,
                    backgroundColor: COLORS.bgCard,
                    border: COLORS.cardBorder,
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.75)',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    zIndex: 25,
                    transform: `scale(${cardEnter})`,
                    opacity: cardEnter,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '20px', color: COLORS.textMuted }}>{card.provider}</span>
                    <span style={{ fontSize: '20px', color: COLORS.mint, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>LIVE</span>
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: COLORS.white }}>{card.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '20px', color: COLORS.textDim }}>SCORE: {card.score}</span>
                    <span style={{ fontSize: '20px', color: COLORS.mintText }}>{card.latency}</span>
                  </div>

                  {/* Sparkline Canvas */}
                  <svg style={{ width: '100%', height: '36px' }} viewBox="0 0 100 36">
                    <path
                      d={`M 0,${24 + Math.sin(frame * 0.2 + i) * 6} L 25,${16 + Math.cos(frame * 0.2 + i) * 8} L 50,${20 + Math.sin(frame * 0.3 + i) * 6} L 75,${12 + Math.cos(frame * 0.2 + i) * 8} L 100,${18 + Math.sin(frame * 0.2 + i) * 4}`}
                      fill="none"
                      stroke={COLORS.mint}
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              );
            })}

            {/* S3 Telemetry Feed + S6 Log Stream filling y: 580 - 830 */}
            <div
              style={{
                position: 'absolute',
                left: '130px',
                right: '130px',
                top: '580px',
                height: '240px',
                borderRadius: '20px',
                backgroundColor: 'rgba(8, 12, 16, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '24px 32px',
                display: 'flex',
                gap: '40px',
                overflow: 'hidden',
                zIndex: 25,
                backdropFilter: 'blur(30px)',
              }}
            >
              {/* Left Column: Live Telemetry Stream (Stationary & Clean) */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: COLORS.mint, fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.mint, boxShadow: '0 0 10px #10b981' }} />
                  LIVE STREAMING TELEMETRY (1,840 TOKENS/SEC)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '20px', color: COLORS.white, fontFamily: "'JetBrains Mono', monospace" }}>
                    [0.98ms] OpenAI::GPT-4.5 Orion → StrictJSONSchema: VALIDATED (99.2% accuracy)
                  </div>
                  <div style={{ fontSize: '20px', color: COLORS.white, fontFamily: "'JetBrains Mono', monospace" }}>
                    [0.84ms] Google::Gemini 2.0 Flash → FastRouting: 98ms latency target met
                  </div>
                  <div style={{ fontSize: '20px', color: COLORS.white, fontFamily: "'JetBrains Mono', monospace" }}>
                    [1.20ms] Anthropic::Claude 3.7 Sonnet → HybridReasoning: 98.9% consensus
                  </div>
                </div>
              </div>

              {/* Right Column: S6 Monospace Telemetry Log */}
              <div style={{ width: '420px', borderLeft: '1px solid rgba(255, 255, 255, 0.08)', paddingLeft: '32px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
                  ENGINE DIAGNOSTICS
                </div>
                <div style={{ fontSize: '20px', color: 'rgba(255, 255, 255, 0.55)', fontFamily: "'JetBrains Mono', monospace" }}>
                  Egress Cost: -74.2% optimized
                </div>
                <div style={{ fontSize: '20px', color: 'rgba(255, 255, 255, 0.55)', fontFamily: "'JetBrains Mono', monospace" }}>
                  Cluster Jitter: &lt; 0.4ms
                </div>
                <div style={{ fontSize: '20px', color: COLORS.mintText, fontFamily: "'JetBrains Mono', monospace" }}>
                  Production Uptime: 99.999%
                </div>
              </div>

              {/* Scroll Track & Static Thumb on Feed */}
              <div
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '24px',
                  bottom: '24px',
                  width: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '2px',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    width: '4px',
                    height: '48px',
                    backgroundColor: COLORS.mint,
                    borderRadius: '2px',
                    boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)',
                  }}
                />
              </div>
            </div>

            {/* Precision 2px Vertical Laser Scanning Line (replaces blurry sweep) */}
            <div
              style={{
                position: 'absolute',
                top: '290px',
                height: '260px',
                left: `${130 + (s8Frame / 108) * 1660}px`,
                width: '2px',
                backgroundColor: COLORS.mint,
                boxShadow: '0 0 12px #10b981, 0 0 24px rgba(16, 185, 129, 0.8)',
                pointerEvents: 'none',
                zIndex: 30,
              }}
            />
          </div>
        )}
      </CameraRig>
    </AbsoluteFill>
  );
};
