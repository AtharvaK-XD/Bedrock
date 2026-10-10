import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const FRAMEWORKS = [
  { name: 'LangChain', type: 'Python / TS', color: 'rgba(255,255,255,0.8)' },
  { name: 'LlamaIndex', type: 'RAG Pipeline', color: 'rgba(255,255,255,0.8)' },
  { name: 'OpenAI SDK', type: 'Structured Outputs', color: 'rgba(255,255,255,0.8)' },
  { name: 'Anthropic SDK', type: 'Tool Use', color: 'rgba(255,255,255,0.8)' },
  { name: 'Vercel AI SDK', type: 'Streaming UI', color: 'rgba(255,255,255,1)' },
  { name: 'Google GenAI', type: 'Multimodal', color: 'rgba(255,255,255,0.8)' },
  { name: 'Mastra Agents', type: 'Autonomous', color: 'rgba(255,255,255,0.8)' },
  { name: 'Rust Crates', type: 'Native High-Perf', color: 'rgba(255,255,255,0.8)' },
  { name: 'Python Pydantic', type: 'Data Validation', color: 'rgba(255,255,255,0.8)' },
  { name: 'TypeScript Core', type: 'Type-Safe Directives', color: 'rgba(255,255,255,0.8)' },
  { name: 'cURL / REST', type: 'Direct HTTP', color: 'rgba(255,255,255,0.5)' },
  { name: 'Promptfoo', type: 'Security & Red-Teaming', color: 'rgba(255,255,255,0.8)' },
];

export const Scene5ArenaAndFrameworks: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance & Exit (1310 to 1550, local 0 to 240)
  const sceneOpacity = interpolate(frame, [0, 20, 215, 240], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cameraZoom = interpolate(frame, [0, 240], [0.98, 1.05]);

  // Phase transition: Frame 0-90 = Arena Duel, Frame 90-240 = 15 Framework Exporters
  const isFrameworkPhase = frame >= 85;

  const titleSpring = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 24, stiffness: 60 } });
  const arenaSpring = spring({ frame: Math.max(0, frame - 15), fps, config: { damping: 24, stiffness: 60 } });
  const fwStageSpring = spring({ frame: Math.max(0, frame - 85), fps, config: { damping: 24, stiffness: 60 } });

  // Arena progress
  const claudeScore = Math.min(99.1, Number(interpolate(frame, [20, 80], [60, 99.1]).toFixed(1)));
  const deepseekScore = Math.min(98.7, Number(interpolate(frame, [20, 80], [58, 98.7]).toFixed(1)));

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
      {/* Background Radial Matrix */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 60%)',
        }}
      />

      {/* 3D Camera Stage */}
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${cameraZoom})`,
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
            Arena & Targets
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
            {!isFrameworkPhase
              ? 'Frontier head-to-head.'
              : '15 export frameworks.'}
          </h2>
        </div>

        {/* PHASE 1: ARENA HEAD-TO-HEAD CLASH (Frames 0-85) */}
        {!isFrameworkPhase && (
          <div
            style={{
              transform: `scale(${arenaSpring}) translateY(${interpolate(arenaSpring, [0, 1], [30, 0])}px)`,
              opacity: arenaSpring,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '40px',
              zIndex: 20,
            }}
          >
            {/* Gladiator A: Claude 3.7 */}
            <div
              style={{
                width: '460px',
                padding: '32px',
                borderRadius: '24px',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(30px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                  CHALLENGER A
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#ffffff' }}>
                  HYBRID
                </span>
              </div>
              <div style={{ fontSize: '32px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.02em' }}>
                Claude 3.7 Sonnet
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', marginTop: '8px' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>FIDELITY</span>
                <span style={{ fontSize: '24px', fontFamily: "'JetBrains Mono', monospace", color: '#ffffff', fontWeight: 500 }}>
                  {claudeScore}%
                </span>
              </div>
            </div>

            {/* VS Elegant Divider */}
            <div
              style={{
                fontSize: '18px',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.3)',
                letterSpacing: '0.1em',
              }}
            >
              VS
            </div>

            {/* Gladiator B: DeepSeek R1 */}
            <div
              style={{
                width: '460px',
                padding: '32px',
                borderRadius: '24px',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(30px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                  CHALLENGER B
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#ffffff' }}>
                  OPEN
                </span>
              </div>
              <div style={{ fontSize: '32px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.02em' }}>
                DeepSeek R1
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', marginTop: '8px' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>FIDELITY</span>
                <span style={{ fontSize: '24px', fontFamily: "'JetBrains Mono', monospace", color: '#ffffff', fontWeight: 500 }}>
                  {deepseekScore}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* PHASE 2: 15 PRODUCTION FRAMEWORK EXPORTERS (Frames 85-240) */}
        {isFrameworkPhase && (
          <div
            style={{
              transform: `scale(${fwStageSpring}) translateY(${interpolate(fwStageSpring, [0, 1], [30, 0])}px)`,
              opacity: fwStageSpring,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '24px',
              width: '1200px',
              zIndex: 20,
            }}
          >
            {FRAMEWORKS.map((fw, i) => {
              const itemSpring = spring({ frame: Math.max(0, frame - 85 - i * 3), fps, config: { damping: 24, stiffness: 60 } });

              return (
                <div
                  key={fw.name}
                  style={{
                    transform: `scale(${itemSpring})`,
                    opacity: itemSpring,
                    padding: '24px',
                    borderRadius: '20px',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                      READY
                    </span>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>{fw.type}</span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 500, color: '#ffffff', letterSpacing: '-0.02em' }}>
                    {fw.name}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
