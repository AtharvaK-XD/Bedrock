import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, EASINGS, LAYOUT_ZONES, SPRINGS } from '../components/MotionTokens';
import { SceneChrome } from '../components/SceneChrome';
import { GhostCursor, CursorWaypoint } from '../components/GhostCursor';
import { CameraRig } from '../components/Transitions';

export const Scene4DAGBranching: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Act 4 Spans Global Frames 1920 to 2598 (Duration: 678 frames)
  // Scene 11: 0 - 300 (Global 1920 - 2220) "Agentic reasoning paths."
  // Scene 12: 300 - 678 (Global 2220 - 2598) "Sub-millisecond pruning."

  const isScene11 = frame < 300;
  const isScene12 = frame >= 300;

  const s11Frame = frame;
  const s12Frame = Math.max(0, frame - 300);

  // S9 Horizontal Pan across DAG canvas + 8 deg yaw
  const panX = interpolate(frame, [0, 678], [0, -180]);
  const yaw = interpolate(frame, [0, 678], [4, -4]);

  // Nodes springs
  const rootSpring = spring({ frame: Math.max(0, s11Frame - 6), fps, config: SPRINGS.UI });
  const node1Spring = spring({ frame: Math.max(0, s11Frame - 24), fps, config: SPRINGS.UI });
  const node2Spring = spring({ frame: Math.max(0, s11Frame - 40), fps, config: SPRINGS.UI });
  const node3Spring = spring({ frame: Math.max(0, s11Frame - 56), fps, config: SPRINGS.UI });

  // Draw lines
  const draw1 = interpolate(s11Frame, [20, 44], [0, 1], { easing: EASINGS.OUT_EXPO, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const draw2 = interpolate(s11Frame, [36, 60], [0, 1], { easing: EASINGS.OUT_EXPO, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const draw3 = interpolate(s11Frame, [52, 76], [0, 1], { easing: EASINGS.OUT_EXPO, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Evaluation Scores
  const score1 = Math.min(98.4, Number(interpolate(s11Frame, [90, 180], [40.0, 98.4], { easing: EASINGS.OUT_EXPO, extrapolateRight: 'clamp' }).toFixed(1)));
  const score2 = Math.min(96.1, Number(interpolate(s11Frame, [110, 200], [35.0, 96.1], { easing: EASINGS.OUT_EXPO, extrapolateRight: 'clamp' }).toFixed(1)));
  const score3 = Math.min(62.4, Number(interpolate(s11Frame, [130, 220], [20.0, 62.4], { easing: EASINGS.OUT_EXPO, extrapolateRight: 'clamp' }).toFixed(1)));

  // W4 Ghost Cursor Waypoints in Scene 11 (Dragging branches out of System Persona)
  const cursorWaypointsDAG: CursorWaypoint[] = [
    { frame: 12, x: 560, y: 520, isClick: true },
    { frame: 32, x: 1060, y: 350, isClick: true },
    { frame: 48, x: 560, y: 520, isClick: true },
    { frame: 68, x: 1060, y: 520, isClick: true },
    { frame: 84, x: 560, y: 520, isClick: true },
    { frame: 104, x: 1060, y: 690, isClick: true },
  ];

  // ==========================================================================
  // SCENE 12 ANIMATIONS (300 - 678, duration 378)
  // ==========================================================================
  // Pruning Slash Cut at frame 380 (43.3s countdown)
  const isPruned = s12Frame >= 80;
  const pruneSlashProgress = interpolate(s12Frame, [75, 85], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Losing branch 3 falls with gravity
  const branch3FallY = isPruned ? Math.pow((s12Frame - 80) / 18, 2) * 140 : 0;
  const branch3Opacity = isPruned ? Math.max(0.12, 1 - (s12Frame - 80) / 25) : 1;
  const timerValue = isPruned ? '0.8 ms' : `${Math.min(0.8, Number((s12Frame * 0.012).toFixed(1)))} ms`;

  // Z8 Zoom-blur cut out at last 24 frames (654 - 678)
  const isZ8Exit = s12Frame >= 354;
  const z8ExitScale = isZ8Exit
    ? interpolate(s12Frame, [354, 378], [1, 1.35], { easing: EASINGS.IN_EXPO, extrapolateRight: 'clamp' })
    : 1;
  const z8ExitBlur = isZ8Exit
    ? interpolate(s12Frame, [354, 378], [0, 30], { extrapolateRight: 'clamp' })
    : 0;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <CameraRig sceneFrame={frame} sceneDuration={678} globalFrame={frame + 1920}>
        {/* ================================================================== */}
        {/* SCENE CHROME (Strict Zones: Headline y:100-180, Caption y:940-1030) */}
        {/* ================================================================== */}
        {isScene11 && (
          <SceneChrome
            eyebrow="VISUAL ORCHESTRATION"
            headline="Agentic reasoning paths."
            caption="Architect complex agentic reasoning on an infinite DAG canvas."
            keyWord="paths."
            sceneFrame={s11Frame}
            sceneDuration={300}
          />
        )}
        {isScene12 && (
          <SceneChrome
            eyebrow="TACTILE PHYSICS"
            headline="Sub-millisecond pruning."
            caption="Branch workflows, run parallel evaluations, and prune dead paths with sub-millisecond tactile physics."
            keyWord="pruning."
            sceneFrame={s12Frame}
            sceneDuration={378}
          />
        )}

        {/* Ghost Cursor Interaction (W4) */}
        {isScene11 && (
          <GhostCursor sceneFrame={s11Frame} waypoints={cursorWaypointsDAG} />
        )}

        {/* ================================================================== */}
        {/* 🌿 INFINITE DAG CANVAS (Nodes 300 x 120 inside x: 160 - 1760)       */}
        {/* ================================================================== */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translateX(${panX}px) rotateY(${yaw}deg) scale(${z8ExitScale})`,
            filter: `blur(${z8ExitBlur}px)`,
          }}
        >
          {/* Connector Paths */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
            {/* Path 1 -> Chain-of-Thought */}
            <path
              d="M 680 520 C 800 520, 800 350, 940 350"
              fill="none"
              stroke={COLORS.mint}
              strokeWidth="2.5"
              strokeDasharray="300"
              strokeDashoffset={300 * (1 - draw1)}
            />
            {/* Path 2 -> Hybrid Reasoning */}
            <path
              d="M 680 520 L 940 520"
              fill="none"
              stroke="rgba(255, 255, 255, 0.25)"
              strokeWidth="2"
              strokeDasharray="260"
              strokeDashoffset={260 * (1 - draw2)}
            />
            {/* Path 3 -> Raw Fallback (Pruned) */}
            <path
              d="M 680 520 C 800 520, 800 690, 940 690"
              fill="none"
              stroke={isPruned ? 'rgba(244, 63, 94, 0.4)' : 'rgba(255, 255, 255, 0.25)'}
              strokeWidth="2"
              strokeDasharray={isPruned ? '4 8' : '300'}
              strokeDashoffset={isPruned ? 0 : 300 * (1 - draw3)}
            />

            {/* W9 Slash Cut Mint Blade Streak in Scene 12 */}
            {isScene12 && pruneSlashProgress > 0 && pruneSlashProgress < 1 && (
              <line
                x1={760 + pruneSlashProgress * 80}
                y1={560 - pruneSlashProgress * 140}
                x2={840 + pruneSlashProgress * 80}
                y2={680 + pruneSlashProgress * 140}
                stroke="#ffffff"
                strokeWidth="5"
                style={{ filter: 'drop-shadow(0 0 16px #10b981)' }}
              />
            )}
          </svg>

          {/* ROOT NODE: System Persona (Origin) */}
          <div
            style={{
              position: 'absolute',
              left: '380px',
              top: '460px',
              width: '300px',
              height: '120px',
              borderRadius: '20px',
              background: COLORS.bgCardGlass,
              backgroundColor: COLORS.bgCard,
              border: `1.5px solid ${COLORS.mintBorder}`,
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(16, 185, 129, 0.3)',
              backdropFilter: 'blur(30px)',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              zIndex: 20,
              transform: `scale(${rootSpring})`,
              opacity: rootSpring,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '20px', color: COLORS.textMuted }}>ORIGIN</span>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.mint, boxShadow: '0 0 8px #10b981' }} />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: COLORS.white }}>System Persona</div>
          </div>

          {/* BRANCH 1: Chain-of-Thought (Winner Node) */}
          <div
            style={{
              position: 'absolute',
              left: '940px',
              top: '290px',
              width: '320px',
              height: '120px',
              borderRadius: '20px',
              background: COLORS.bgCardGlass,
              backgroundColor: COLORS.bgCard,
              border: `2px solid ${COLORS.mint}`,
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(16, 185, 129, 0.45)',
              backdropFilter: 'blur(30px)',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              zIndex: 20,
              transform: `scale(${node1Spring})`,
              opacity: node1Spring,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '20px', color: COLORS.mint, fontWeight: 700 }}>SURVIVING PATH</span>
              <span style={{ fontSize: '22px', fontWeight: 700, color: COLORS.mintText, fontFamily: "'JetBrains Mono', monospace" }}>{score1}%</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: COLORS.white }}>Chain-of-Thought</div>
          </div>

          {/* BRANCH 2: Hybrid Reasoning */}
          <div
            style={{
              position: 'absolute',
              left: '940px',
              top: '460px',
              width: '320px',
              height: '120px',
              borderRadius: '20px',
              background: COLORS.bgCardGlass,
              backgroundColor: COLORS.bgCard,
              border: COLORS.cardBorder,
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(30px)',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              zIndex: 20,
              transform: `scale(${node2Spring})`,
              opacity: node2Spring,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '20px', color: COLORS.textMuted }}>PARALLEL EVAL</span>
              <span style={{ fontSize: '22px', fontWeight: 700, color: COLORS.white, fontFamily: "'JetBrains Mono', monospace" }}>{score2}%</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: COLORS.white }}>Hybrid Reasoning</div>
          </div>

          {/* BRANCH 3: Raw Fallback (Pruned Branch) */}
          <div
            style={{
              position: 'absolute',
              left: '940px',
              top: `${630 + branch3FallY}px`,
              width: '320px',
              height: '120px',
              borderRadius: '20px',
              background: COLORS.bgCardGlass,
              backgroundColor: COLORS.bgCard,
              border: isPruned ? '1px dashed rgba(244, 63, 94, 0.5)' : COLORS.cardBorder,
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(30px)',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              zIndex: 20,
              transform: `scale(${node3Spring})`,
              opacity: node3Spring * branch3Opacity,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '20px', color: isPruned ? '#f43f5e' : COLORS.textMuted }}>
                {isPruned ? 'PRUNED' : 'EVALUATION'}
              </span>
              <span style={{ fontSize: '22px', fontWeight: 700, color: isPruned ? '#f43f5e' : COLORS.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
                {score3}%
              </span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: isPruned ? 'rgba(255, 255, 255, 0.4)' : COLORS.white }}>
              Raw Fallback
            </div>
          </div>

          {/* Z7 Timer Chip in Scene 12 ("0.8 ms") */}
          {isScene12 && (
            <div
              style={{
                position: 'absolute',
                left: '720px',
                top: '230px',
                padding: '8px 24px',
                borderRadius: '100px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: `1.5px solid ${COLORS.mintBorder}`,
                color: COLORS.mint,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '22px',
                fontWeight: 800,
                boxShadow: '0 0 25px rgba(16, 185, 129, 0.4)',
                zIndex: 30,
              }}
            >
              PRUNING LATENCY: {timerValue}
            </div>
          )}

          {/* S6 Faint Log Column on Right (continuous motion, fixes R8) */}
          <div
            style={{
              position: 'absolute',
              right: '120px',
              top: '260px',
              width: '320px',
              height: '480px',
              borderRadius: '20px',
              backgroundColor: 'rgba(5, 8, 10, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              zIndex: 25,
              backdropFilter: 'blur(20px)',
              overflow: 'hidden',
            }}
          >
            <div style={{ fontSize: '20px', fontWeight: 700, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace", paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              DAG EXECUTION LOGS
            </div>
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative', marginTop: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', transform: `translateY(-${(frame * 1.5) % 180}px)` }}>
                <div style={{ fontSize: '20px', lineHeight: '1.4', color: COLORS.white, fontFamily: "'JetBrains Mono', monospace" }}>
                  [eval] persona.dispatch()
                </div>
                <div style={{ fontSize: '20px', lineHeight: '1.4', color: COLORS.mintText, fontFamily: "'JetBrains Mono', monospace" }}>
                  [tree] branch_01: score=98.4%
                </div>
                <div style={{ fontSize: '20px', lineHeight: '1.4', color: COLORS.white, fontFamily: "'JetBrains Mono', monospace" }}>
                  [tree] branch_02: score=96.1%
                </div>
                <div style={{ fontSize: '20px', lineHeight: '1.4', color: '#fca5a5', fontFamily: "'JetBrains Mono', monospace" }}>
                  [prune] branch_03: cut (&lt;0.8ms)
                </div>
                <div style={{ fontSize: '20px', lineHeight: '1.4', color: COLORS.mint, fontFamily: "'JetBrains Mono', monospace" }}>
                  [status] optimal path locked
                </div>
                <div style={{ fontSize: '20px', lineHeight: '1.4', color: COLORS.white, fontFamily: "'JetBrains Mono', monospace" }}>
                  [eval] persona.dispatch()
                </div>
                <div style={{ fontSize: '20px', lineHeight: '1.4', color: COLORS.mintText, fontFamily: "'JetBrains Mono', monospace" }}>
                  [tree] branch_01: score=98.4%
                </div>
              </div>
            </div>
          </div>
        </div>
      </CameraRig>
    </AbsoluteFill>
  );
};
