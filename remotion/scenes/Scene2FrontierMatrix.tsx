import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface FrontierModel {
  name: string;
  provider: string;
  x: number;
  y: number;
  score: string;
  latency: string;
}

const MODELS: FrontierModel[] = [
  { name: 'Claude 3.7 Sonnet', provider: 'Anthropic', x: -380, y: -130, score: '98.9%', latency: '210ms' },
  { name: 'GPT-4.5 Orion', provider: 'OpenAI', x: 0, y: -180, score: '99.2%', latency: '195ms' },
  { name: 'Gemini 2.0 Flash', provider: 'Google', x: 380, y: -130, score: '97.8%', latency: '98ms' },
  { name: 'DeepSeek R1', provider: 'DeepSeek', x: -280, y: 140, score: '98.4%', latency: '280ms' },
  { name: 'Grok 3', provider: 'xAI', x: 280, y: 140, score: '98.1%', latency: '230ms' },
];

export const Scene2FrontierMatrix: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance & Exit Transitions (340 to 690, local 0 to 350)
  const sceneOpacity = interpolate(frame, [0, 20, 320, 350], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Slow Cinematic Camera
  const cameraZoom = interpolate(frame, [0, 350], [0.98, 1.05]);

  // Staggered Title Animations
  const titleSpring = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 24, stiffness: 60 } });
  const subtitleSpring = spring({ frame: Math.max(0, frame - 25), fps, config: { damping: 24, stiffness: 60 } });

  // Voiceover phrase synchronization cues
  const activePhase = frame < 60 ? 0 : frame < 180 ? 1 : frame < 240 ? 2 : frame < 290 ? 3 : 4;

  const tokenCounter = Math.min(1840, Math.floor(interpolate(frame, [50, 320], [200, 1840])));
  const costSavings = Math.min(74.2, Number(interpolate(frame, [70, 300], [12.0, 74.2]).toFixed(1)));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000', // Pure black
        opacity: sceneOpacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', sans-serif",
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 70%)',
        }}
      />

      {/* Camera Stage Container */}
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          transform: `scale(${cameraZoom})`,
        }}
      >
        {/* Cinematic Header Titles */}
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
            Frontier Reasoning Engine
          </div>

          <h2
            style={{
              fontSize: '64px',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              margin: 0,
              transform: `scale(${subtitleSpring}) translateY(${interpolate(subtitleSpring, [0, 1], [-20, 0])}px)`,
              opacity: subtitleSpring,
            }}
          >
            {activePhase === 0 && 'Meet Bedrock.'}
            {activePhase === 1 && 'The premier engineering workstation.'}
            {activePhase === 2 && '10 frontier models. One engine.'}
            {activePhase === 3 && 'Zero vendor lock-in.'}
            {activePhase >= 4 && 'Real-time observability.'}
          </h2>
        </div>

        {/* Minimalist SVG Connections */}
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
          {MODELS.map((model, i) => {
            const centerX = 960;
            const centerY = 540;
            const targetX = 960 + model.x;
            const targetY = 540 + model.y;

            return (
              <g key={`laser-${i}`}>
                {/* Thin, elegant interconnect */}
                <line
                  x1={centerX}
                  y1={centerY}
                  x2={targetX}
                  y2={targetY}
                  stroke="rgba(255, 255, 255, 0.15)"
                  strokeWidth="1.5"
                />
                
                {/* Subtle moving particle along the line */}
                <circle
                  r="3"
                  fill="#ffffff"
                  style={{
                    offsetPath: `path('M ${centerX} ${centerY} L ${targetX} ${targetY}')`,
                    animation: `dash 3s infinite cubic-bezier(0.4, 0, 0.2, 1) ${i * 0.2}s`,
                    offsetDistance: `${(frame * 0.5 + i * 20) % 100}%`
                  }}
                />
              </g>
            );
          })}
        </svg>

        {/* Central Core */}
        <div
          style={{
            position: 'absolute',
            width: '140px',
            height: '140px',
            borderRadius: '50%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
            backdropFilter: 'blur(20px)',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px',
            }}
          >
            <span style={{ fontSize: '20px', fontWeight: 700, color: '#000000' }}>B</span>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 500, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.7)' }}>
            CORE
          </span>
        </div>

        {/* Floating Model Cards - Clean & Apple-like */}
        {MODELS.map((model, i) => {
          const cardSpring = spring({ frame: Math.max(0, frame - 15 - i * 12), fps, config: { damping: 20, stiffness: 60 } });
          const floatOffset = Math.sin((frame + i * 25) * 0.05) * 4;

          return (
            <div
              key={model.name}
              style={{
                position: 'absolute',
                transform: `translate(${model.x}px, ${model.y + floatOffset}px) scale(${cardSpring})`,
                opacity: cardSpring,
                width: '300px',
                padding: '24px',
                borderRadius: '24px',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(30px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                zIndex: 25,
              }}
            >
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                {model.provider}
              </div>

              <div style={{ fontSize: '24px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.02em' }}>
                {model.name}
              </div>

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

        {/* Lower Real-time Telemetry Dashboard HUD Bar - Highly Minimal */}
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
            opacity: interpolate(frame, [180, 210], [0, 1]), // Fades in smoothly
            transform: `translateY(${interpolate(frame, [180, 210], [20, 0])}px)`,
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
