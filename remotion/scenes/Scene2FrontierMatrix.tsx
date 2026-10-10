import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

interface FrontierModel {
  name: string;
  provider: string;
  x: number;
  y: number;
  score: string;
  latency: string;
  dist: number;
}

const MODELS: FrontierModel[] = [
  { name: 'Claude 3.7 Sonnet', provider: 'Anthropic', x: -380, y: -130, score: '98.9%', latency: '210ms', dist: 401.6 },
  { name: 'GPT-4.5 Orion', provider: 'OpenAI', x: 0, y: -180, score: '99.2%', latency: '195ms', dist: 180 },
  { name: 'Gemini 2.0 Flash', provider: 'Google', x: 380, y: -130, score: '97.8%', latency: '98ms', dist: 401.6 },
  { name: 'DeepSeek R1', provider: 'DeepSeek', x: -280, y: 140, score: '98.4%', latency: '280ms', dist: 313 },
  { name: 'Grok 3', provider: 'xAI', x: 280, y: 140, score: '98.1%', latency: '230ms', dist: 313 },
];

export const Scene2FrontierMatrix: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Depth of field cue on transitions
  const bgBlur = interpolate(frame, [0, 15, 335, 350], [12, 0, 0, 12], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sceneOpacity = interpolate(frame, [0, 15, 335, 350], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cameraZoom = interpolate(frame, [0, 350], [0.98, 1.05]);

  const title1Spring = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 14, stiffness: 90 } });
  const title2Spring = spring({ frame: Math.max(0, frame - 15), fps, config: { damping: 14, stiffness: 90 } });
  
  const activePhase = frame < 60 ? 0 : frame < 180 ? 1 : frame < 240 ? 2 : frame < 290 ? 3 : 4;

  const tokenCounter = Math.min(1840, Math.floor(interpolate(frame, [50, 100], [0, 1840], { easing: Easing.out(Easing.quad), extrapolateRight: 'clamp' })));
  const costSavings = Math.min(74.2, Number(interpolate(frame, [70, 120], [0, 74.2], { easing: Easing.out(Easing.quad), extrapolateRight: 'clamp' }).toFixed(1)));

  const coreSpring = spring({ frame: Math.max(0, frame - 25), fps, config: { damping: 12, stiffness: 100 } });
  const coreGlow = interpolate(coreSpring, [0, 1], [0, 30], { extrapolateRight: 'clamp' });

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
        perspective: '1400px',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 70%)', filter: `blur(${bgBlur}px)` }} />

      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', transform: `scale(${cameraZoom})` }}>
        {/* Header Titles */}
        <div style={{ position: 'absolute', top: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', zIndex: 30 }}>
          <div style={{ transform: `scale(${interpolate(title1Spring, [0,1], [0.9, 1])}) translateY(${interpolate(title1Spring, [0, 1], [-20, 0])}px)`, opacity: title1Spring, color: 'rgba(255,255,255,0.4)', fontSize: '14px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Frontier Reasoning Engine
          </div>
          <h2 style={{ fontSize: '64px', fontWeight: 600, letterSpacing: '-0.03em', color: '#ffffff', margin: 0, transform: `scale(${interpolate(title2Spring, [0,1], [0.9, 1])}) translateY(${interpolate(title2Spring, [0, 1], [-20, 0])}px)`, opacity: title2Spring }}>
            {activePhase === 0 && 'Meet Bedrock.'}
            {activePhase === 1 && 'The premier engineering workstation.'}
            {activePhase === 2 && '10 frontier models. One engine.'}
            {activePhase === 3 && 'Zero vendor lock-in.'}
            {activePhase >= 4 && 'Real-time observability.'}
          </h2>
        </div>

        {/* Lines */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10, transform: 'translateZ(-50px)' }}>
          {MODELS.map((model, i) => {
            const centerX = 960;
            const centerY = 540;
            const targetX = 960 + model.x;
            const targetY = 540 + model.y;
            const drawProgress = interpolate(frame, [35 + i * 4, 55 + i * 4], [0, 1], { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const dashOffset = model.dist * (1 - drawProgress);

            return (
              <g key={`laser-${i}`}>
                <line
                  x1={centerX} y1={centerY} x2={targetX} y2={targetY}
                  stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1.5"
                  strokeDasharray={model.dist}
                  strokeDashoffset={dashOffset}
                />
              </g>
            );
          })}
        </svg>

        {/* Central Core */}
        <div style={{ position: 'absolute', width: '140px', height: '140px', borderRadius: '50%', background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: `0 30px 60px rgba(0,0,0,0.5), 0 0 ${coreGlow}px rgba(255,255,255,0.2)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 20, backdropFilter: 'blur(20px)', transform: `scale(${coreSpring})`, opacity: interpolate(coreSpring, [0, 0.5], [0, 1]) }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#000000' }}>B</span>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 500, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.7)' }}>CORE</span>
        </div>

        {/* Cards */}
        {MODELS.map((model, i) => {
          const cardSpring = spring({ frame: Math.max(0, frame - 55 - i * 4), fps, config: { damping: 12, stiffness: 100 } });
          const floatOffset = Math.sin((frame + i * 25) * 0.05) * 4;
          const cardBlur = interpolate(cardSpring, [0, 0.8, 1], [10, 0, 0], { extrapolateRight: 'clamp' });

          return (
            <div
              key={model.name}
              style={{
                position: 'absolute',
                transform: `translate(${model.x}px, ${model.y + floatOffset}px) scale(${interpolate(cardSpring, [0, 1], [0.8, 1.05])}) translateZ(50px)`,
                opacity: interpolate(cardSpring, [0, 0.5], [0, 1]),
                filter: `blur(${cardBlur}px)`,
                width: '300px',
                padding: '24px',
                borderRadius: '24px',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(30px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                zIndex: 25,
              }}
            >
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{model.provider}</div>
              <div style={{ fontSize: '24px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.02em' }}>{model.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>BENCHMARK</span>
                  <span style={{ fontSize: '15px', fontFamily: "'JetBrains Mono', monospace", color: '#ffffff', fontWeight: 500 }}>{model.score}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>LATENCY</span>
                  <span style={{ fontSize: '15px', fontFamily: "'JetBrains Mono', monospace", color: '#ffffff', fontWeight: 500 }}>{model.latency}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Stats */}
        <div
          style={{
            position: 'absolute',
            bottom: '140px',
            display: 'flex',
            alignItems: 'center',
            gap: '32px',
            padding: '16px 40px',
            borderRadius: '100px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(30px)',
            zIndex: 30,
            opacity: interpolate(frame, [60, 90], [0, 1], { extrapolateRight: 'clamp' }),
            transform: `translateY(${interpolate(frame, [60, 90], [20, 0], { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateRight: 'clamp' })}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Throughput</span>
            <span style={{ fontSize: '18px', fontFamily: "'JetBrains Mono', monospace", color: '#ffffff', fontWeight: 500 }}>{tokenCounter} t/s</span>
          </div>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Cost delta</span>
            <span style={{ fontSize: '18px', fontFamily: "'JetBrains Mono', monospace", color: '#10b981', fontWeight: 500 }}>-{costSavings}%</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
