import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Scene4DAGBranching: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance & Exit (970 to 1310, local 0 to 340)
  const sceneOpacity = interpolate(frame, [0, 20, 315, 340], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Infinite Canvas Pan and Dynamic Zoom
  const cameraZoom = interpolate(frame, [0, 340], [0.98, 1.05]);
  const canvasPanX = interpolate(frame, [0, 340], [-20, 30]);

  // Staggered Springs (Heavier, Cinematic)
  const titleSpring = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 24, stiffness: 60 } });
  const rootSpring = spring({ frame: Math.max(0, frame - 15), fps, config: { damping: 24, stiffness: 60 } });
  const node1Spring = spring({ frame: Math.max(0, frame - 35), fps, config: { damping: 24, stiffness: 60 } });
  const node2Spring = spring({ frame: Math.max(0, frame - 55), fps, config: { damping: 24, stiffness: 60 } });
  const node3Spring = spring({ frame: Math.max(0, frame - 75), fps, config: { damping: 24, stiffness: 60 } });

  // Evaluation Scores
  const score1 = Math.min(98.4, Number(interpolate(frame, [45, 180], [40, 98.4]).toFixed(1)));
  const score2 = Math.min(96.1, Number(interpolate(frame, [65, 200], [35, 96.1]).toFixed(1)));

  // Pruning trigger
  const isPruned = frame >= 150;
  const branch3Opacity = interpolate(frame, [150, 180], [1, 0.15], { extrapolateRight: 'clamp' });
  const branch3Scale = interpolate(frame, [150, 180], [1, 0.95], { extrapolateRight: 'clamp' });

  // Floating ambient motion
  const ambientWiggle = Math.sin(frame * 0.05) * 4;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        opacity: sceneOpacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* Infinite Grid Background (Very subtle) */}
      <div
        style={{
          position: 'absolute',
          inset: -200,
          background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 60%)',
          backgroundPosition: `${canvasPanX + frame * 0.4}px 0px`,
        }}
      />

      {/* Main Canvas Viewport */}
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${cameraZoom}) translateX(${canvasPanX}px)`,
          position: 'relative',
        }}
      >
        {/* Cinematic Header */}
        <div
          style={{
            position: 'absolute',
            top: '80px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            zIndex: 30,
          }}
        >
          <div
            style={{
              transform: `scale(${titleSpring}) translateY(${interpolate(titleSpring, [0, 1], [-20, 0])}px)`,
              opacity: titleSpring,
              color: 'rgba(255,255,255,0.4)',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Infinite DAG Canvas
          </div>

          <h2
            style={{
              fontSize: '64px',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              margin: 0,
              transform: `scale(${titleSpring}) translateY(${interpolate(titleSpring, [0, 1], [-20, 0])}px)`,
              opacity: titleSpring,
            }}
          >
            {frame < 140
              ? 'Agentic reasoning paths.'
              : 'Sub-millisecond pruning.'}
          </h2>
        </div>

        {/* DAG Nodes Container */}
        <div style={{ position: 'relative', width: '1300px', height: '600px', zIndex: 20 }}>
          {/* SVG Bezier DAG Connecting Cables (Thin, Elegant) */}
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            {/* Root to Branch 1 */}
            <path
              d="M 720 308 C 820 308, 800 138, 900 138"
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1.5"
            />
            <circle r="3" fill="#ffffff" style={{ offsetPath: "path('M 720 308 C 820 308, 800 138, 900 138')", animation: 'dash 2.5s infinite cubic-bezier(0.4, 0, 0.2, 1)', offsetDistance: `${(frame * 0.8) % 100}%` }} />

            {/* Root to Branch 2 */}
            <path
              d="M 720 308 L 900 308"
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1.5"
            />
            <circle r="3" fill="#ffffff" style={{ offsetPath: "path('M 720 308 L 900 308')", animation: 'dash 2.5s infinite cubic-bezier(0.4, 0, 0.2, 1)', offsetDistance: `${(frame * 0.8 + 20) % 100}%` }} />

            {/* Root to Branch 3 (Pruned) */}
            <path
              d="M 720 308 C 820 308, 800 478, 900 478"
              fill="none"
              stroke={isPruned ? "rgba(239, 68, 68, 0.3)" : "rgba(255,255,255,0.15)"}
              strokeWidth="1.5"
              strokeDasharray={isPruned ? '4 8' : 'none'}
              opacity={branch3Opacity}
            />
          </svg>

          {/* ROOT NODE */}
          <div
            style={{
              position: 'absolute',
              left: '420px',
              top: '258px',
              transform: `scale(${rootSpring}) translateY(${interpolate(rootSpring, [0, 1], [20, 0])}px)`,
              opacity: rootSpring,
              width: '280px',
              padding: '24px',
              borderRadius: '24px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(30px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                ORIGIN
              </span>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ffffff' }} />
            </div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.02em' }}>
              System Persona
            </div>
          </div>

          {/* BRANCH 1: HIGH EVALUATION */}
          <div
            style={{
              position: 'absolute',
              left: '900px',
              top: '60px',
              transform: `scale(${node1Spring}) translateY(${interpolate(node1Spring, [0, 1], [20, 0])}px)`,
              opacity: node1Spring,
              width: '320px',
              padding: '24px',
              borderRadius: '24px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(30px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                BRANCH 01
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.02em' }}>
              Chain-of-Thought
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>SCORE</span>
              <span style={{ fontSize: '16px', fontFamily: "'JetBrains Mono', monospace", color: '#10b981', fontWeight: 500 }}>
                {score1}%
              </span>
            </div>
          </div>

          {/* BRANCH 2: SECONDARY EVALUATION */}
          <div
            style={{
              position: 'absolute',
              left: '900px',
              top: '230px',
              transform: `scale(${node2Spring}) translateY(${interpolate(node2Spring, [0, 1], [20, 0])}px)`,
              opacity: node2Spring,
              width: '320px',
              padding: '24px',
              borderRadius: '24px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(30px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                BRANCH 02
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.02em' }}>
              Semantic Constraints
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>SCORE</span>
              <span style={{ fontSize: '16px', fontFamily: "'JetBrains Mono', monospace", color: '#ffffff', fontWeight: 500 }}>
                {score2}%
              </span>
            </div>
          </div>

          {/* BRANCH 3: PRUNED PATH */}
          <div
            style={{
              position: 'absolute',
              left: '900px',
              top: '400px',
              transform: `scale(${node3Spring * branch3Scale}) translateY(${ambientWiggle}px)`,
              opacity: branch3Opacity,
              width: '320px',
              padding: '24px',
              borderRadius: '24px',
              background: isPruned ? 'rgba(239, 68, 68, 0.05)' : 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
              border: isPruned ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(255, 255, 255, 0.05)',
              boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(30px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: isPruned ? '#ef4444' : 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                {isPruned ? 'PRUNED' : 'BRANCH 03'}
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: isPruned ? 'rgba(255,255,255,0.3)' : '#ffffff', letterSpacing: '-0.02em', textDecoration: isPruned ? 'line-through' : 'none' }}>
              Direct Completion
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '16px', borderTop: isPruned ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '12px', color: isPruned ? 'rgba(239, 68, 68, 0.6)' : 'rgba(255,255,255,0.4)' }}>DRIFT</span>
              <span style={{ fontSize: '16px', fontFamily: "'JetBrains Mono', monospace", color: isPruned ? '#ef4444' : '#ffffff', fontWeight: 500 }}>
                {isPruned ? 'REJECTED' : '62.4%'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
