import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

export const Scene4DAGBranching: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgBlur = interpolate(frame, [0, 15, 325, 340], [12, 0, 0, 12], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sceneOpacity = interpolate(frame, [0, 20, 315, 340], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  
  const cameraZoom = interpolate(frame, [0, 340], [0.98, 1.05]);
  const canvasPanX = interpolate(frame, [0, 340], [-20, 30]);

  const titleSpring = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 14, stiffness: 90 } });
  const rootSpring = spring({ frame: Math.max(0, frame - 25), fps, config: { damping: 14, stiffness: 90 } });
  
  const node1Spring = spring({ frame: Math.max(0, frame - 65), fps, config: { damping: 14, stiffness: 90 } });
  const node2Spring = spring({ frame: Math.max(0, frame - 85), fps, config: { damping: 14, stiffness: 90 } });
  const node3Spring = spring({ frame: Math.max(0, frame - 105), fps, config: { damping: 14, stiffness: 90 } });

  const rootBlur = interpolate(rootSpring, [0, 0.8, 1], [10, 0, 0], { extrapolateRight: 'clamp' });
  const node1Blur = interpolate(node1Spring, [0, 0.8, 1], [10, 0, 0], { extrapolateRight: 'clamp' });
  const node2Blur = interpolate(node2Spring, [0, 0.8, 1], [10, 0, 0], { extrapolateRight: 'clamp' });
  const node3Blur = interpolate(node3Spring, [0, 0.8, 1], [10, 0, 0], { extrapolateRight: 'clamp' });

  // Draw lines
  const draw1 = interpolate(frame, [45, 65], [0, 1], { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const draw2 = interpolate(frame, [65, 85], [0, 1], { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const draw3 = interpolate(frame, [85, 105], [0, 1], { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Evaluation Scores
  const score1 = Math.min(98.4, Number(interpolate(frame, [65, 105], [40.0, 98.4], { easing: Easing.out(Easing.quad), extrapolateRight: 'clamp' }).toFixed(1)));
  const score2 = Math.min(96.1, Number(interpolate(frame, [85, 125], [35.0, 96.1], { easing: Easing.out(Easing.quad), extrapolateRight: 'clamp' }).toFixed(1)));
  const score3 = Math.min(62.4, Number(interpolate(frame, [105, 145], [20.0, 62.4], { easing: Easing.out(Easing.quad), extrapolateRight: 'clamp' }).toFixed(1)));

  // Pruning trigger
  const pruneProgress = interpolate(frame, [150, 170], [0, 1], { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  
  const branch3Opacity = interpolate(pruneProgress, [0, 1], [1, 0.15]);
  const branch3Scale = interpolate(pruneProgress, [0, 1], [1, 0.95]);
  const branch3Red = interpolate(pruneProgress, [0, 1], [0, 1]);

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
      <div style={{ position: 'absolute', inset: -200, background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 60%)', backgroundPosition: `${canvasPanX + frame * 0.4}px 0px`, filter: `blur(${bgBlur}px)` }} />

      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `scale(${cameraZoom}) translateX(${canvasPanX}px)`, position: 'relative' }}>
        
        <div style={{ position: 'absolute', top: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', zIndex: 30 }}>
          <div style={{ transform: `scale(${interpolate(titleSpring, [0,1], [0.9, 1])}) translateY(${interpolate(titleSpring, [0, 1], [-20, 0])}px)`, opacity: titleSpring, color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Infinite DAG Canvas
          </div>
          <h2 style={{ fontSize: '64px', fontWeight: 600, letterSpacing: '-0.03em', color: '#ffffff', margin: 0, transform: `scale(${interpolate(titleSpring, [0,1], [0.9, 1])}) translateY(${interpolate(titleSpring, [0, 1], [-20, 0])}px)`, opacity: titleSpring }}>
            {frame < 140 ? 'Agentic reasoning paths.' : 'Sub-millisecond pruning.'}
          </h2>
        </div>

        <div style={{ position: 'relative', width: '1300px', height: '600px', zIndex: 20 }}>
          
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
            <path d="M 720 308 C 820 308, 800 138, 900 138" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray={300} strokeDashoffset={300 * (1 - draw1)} />
            <circle r="3" fill="#ffffff" style={{ offsetPath: "path('M 720 308 C 820 308, 800 138, 900 138')", animation: 'dash 2.5s infinite cubic-bezier(0.4, 0, 0.2, 1)', offsetDistance: `${(frame * 0.8) % 100}%`, opacity: draw1 }} />

            <path d="M 720 308 L 900 308" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray={180} strokeDashoffset={180 * (1 - draw2)} />
            <circle r="3" fill="#ffffff" style={{ offsetPath: "path('M 720 308 L 900 308')", animation: 'dash 2.5s infinite cubic-bezier(0.4, 0, 0.2, 1)', offsetDistance: `${(frame * 0.8 + 20) % 100}%`, opacity: draw2 }} />

            <path d="M 720 308 C 820 308, 800 478, 900 478" fill="none" stroke={pruneProgress > 0.5 ? "rgba(239, 68, 68, 0.3)" : "rgba(255,255,255,0.15)"} strokeWidth="1.5" strokeDasharray={pruneProgress > 0.5 ? '4 8' : 300} strokeDashoffset={pruneProgress > 0.5 ? 0 : 300 * (1 - draw3)} opacity={1 - branch3Red * 0.8} />
          </svg>

          {/* ROOT NODE */}
          <div style={{ position: 'absolute', left: '420px', top: '258px', transform: `scale(${interpolate(rootSpring, [0, 1], [0.9, 1])}) translateY(${interpolate(rootSpring, [0, 1], [20, 0])}px)`, opacity: rootSpring, filter: `blur(${rootBlur}px)`, width: '280px', padding: '24px', borderRadius: '24px', background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255, 255, 255, 0.05)', boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(30px)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>ORIGIN</span>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ffffff' }} />
            </div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.02em' }}>System Persona</div>
          </div>

          {/* BRANCH 1 */}
          <div style={{ position: 'absolute', left: '900px', top: '60px', transform: `scale(${interpolate(node1Spring, [0, 1], [0.9, 1])}) translateY(${interpolate(node1Spring, [0, 1], [20, 0])}px)`, opacity: node1Spring, filter: `blur(${node1Blur}px)`, width: '320px', padding: '24px', borderRadius: '24px', background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255, 255, 255, 0.05)', boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(30px)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>BRANCH 01</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.02em' }}>Chain-of-Thought</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>SCORE</span>
              <span style={{ fontSize: '16px', fontFamily: "'JetBrains Mono', monospace", color: '#10b981', fontWeight: 500 }}>{score1}%</span>
            </div>
          </div>

          {/* BRANCH 2 */}
          <div style={{ position: 'absolute', left: '900px', top: '230px', transform: `scale(${interpolate(node2Spring, [0, 1], [0.9, 1])}) translateY(${interpolate(node2Spring, [0, 1], [20, 0])}px)`, opacity: node2Spring, filter: `blur(${node2Blur}px)`, width: '320px', padding: '24px', borderRadius: '24px', background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(255, 255, 255, 0.05)', boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(30px)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>BRANCH 02</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.02em' }}>Semantic Constraints</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>SCORE</span>
              <span style={{ fontSize: '16px', fontFamily: "'JetBrains Mono', monospace", color: '#ffffff', fontWeight: 500 }}>{score2}%</span>
            </div>
          </div>

          {/* BRANCH 3 (Pruned Path) */}
          <div style={{ position: 'absolute', left: '900px', top: '400px', transform: `scale(${interpolate(node3Spring, [0, 1], [0.9, 1]) * branch3Scale}) translateY(${interpolate(node3Spring, [0, 1], [20, 0]) + ambientWiggle}px)`, opacity: node3Spring * branch3Opacity, filter: `blur(${node3Blur}px)`, width: '320px', padding: '24px', borderRadius: '24px', background: `linear-gradient(180deg, rgba(${interpolate(branch3Red, [0, 1], [255, 239])}, ${interpolate(branch3Red, [0, 1], [255, 68])}, ${interpolate(branch3Red, [0, 1], [255, 68])}, ${interpolate(branch3Red, [0, 1], [0.08, 0.05])}) 0%, rgba(${interpolate(branch3Red, [0, 1], [255, 239])}, ${interpolate(branch3Red, [0, 1], [255, 68])}, ${interpolate(branch3Red, [0, 1], [255, 68])}, ${interpolate(branch3Red, [0, 1], [0.02, 0.05])}) 100%)`, border: `1px solid rgba(${interpolate(branch3Red, [0, 1], [255, 239])}, ${interpolate(branch3Red, [0, 1], [255, 68])}, ${interpolate(branch3Red, [0, 1], [255, 68])}, ${interpolate(branch3Red, [0, 1], [0.05, 0.2])})`, boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(30px)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: `rgba(${interpolate(branch3Red, [0, 1], [255, 239])}, ${interpolate(branch3Red, [0, 1], [255, 68])}, ${interpolate(branch3Red, [0, 1], [255, 68])}, ${interpolate(branch3Red, [0, 1], [0.4, 1])})`, fontWeight: 500 }}>
                {pruneProgress > 0.5 ? 'PRUNED' : 'BRANCH 03'}
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: `rgba(255, 255, 255, ${interpolate(branch3Red, [0, 1], [1, 0.3])})`, letterSpacing: '-0.02em', textDecoration: pruneProgress > 0.5 ? 'line-through' : 'none' }}>
              Direct Completion
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '16px', borderTop: `1px solid rgba(${interpolate(branch3Red, [0, 1], [255, 239])}, ${interpolate(branch3Red, [0, 1], [255, 68])}, ${interpolate(branch3Red, [0, 1], [255, 68])}, ${interpolate(branch3Red, [0, 1], [0.05, 0.2])})` }}>
              <span style={{ fontSize: '12px', color: `rgba(${interpolate(branch3Red, [0, 1], [255, 239])}, ${interpolate(branch3Red, [0, 1], [255, 68])}, ${interpolate(branch3Red, [0, 1], [255, 68])}, ${interpolate(branch3Red, [0, 1], [0.4, 0.6])})` }}>
                DRIFT
              </span>
              <span style={{ fontSize: '16px', fontFamily: "'JetBrains Mono', monospace", color: `rgba(${interpolate(branch3Red, [0, 1], [255, 239])}, ${interpolate(branch3Red, [0, 1], [255, 68])}, ${interpolate(branch3Red, [0, 1], [255, 68])}, 1)`, fontWeight: 500 }}>
                {pruneProgress > 0.5 ? 'REJECTED' : `${score3}%`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
