import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { Backdrop } from '../components/Stage';
import { Eyebrow } from '../components/Text';
import { Flash, LightSweep, Particles, Shake } from '../components/Fx';
import { C, EASE, FONT, SPRING, hash, springAt, tealA, tween } from '../theme';
import { sceneCues } from '../timeline';

// ============================================================================
// 05 — THE ARENA
// Side-by-side benchmark of the four models the Bedrock site names (Claude
// 3.7, GPT-4o, DeepSeek-R1, Gemini 2.5), then the ten-provider ring and live
// latency / token telemetry. Metric values are illustrative UI states.
// ============================================================================

const COLUMNS = [
  { name: 'Gemini 2.5', logo: 'logos/gemini.png', rate: 1.25, ttft: 182, tps: 212 },
  { name: 'Claude 3.7 Sonnet', logo: 'logos/claude.png', rate: 1.0, ttft: 241, tps: 168 },
  { name: 'GPT-4o', logo: 'logos/openai.png', rate: 1.1, ttft: 207, tps: 184 },
  { name: 'DeepSeek-R1', logo: 'logos/deepseek.png', rate: 0.82, ttft: 312, tps: 121 },
];

// Ten provider logos available in public/logos, matching the README providers.
const RING = ['openai', 'claude', 'gemini', 'deepseek', 'meta', 'mistral', 'qwen', 'grok', 'cohere', 'perplexity'];

const COL_W = 400;
const GAP = 24;
const LEFT = (1920 - (COL_W * 4 + GAP * 3)) / 2;

export const Arena: React.FC = () => {
  const frame = useCurrentFrame();
  const c = sceneCues('arena');
  const prove = c.at('Then prove it', 0);
  const bench = c.at('Benchmark side by side', 0.2);
  const ten = c.at('ten frontier models', 0.45);
  const latency = c.at('live latency', 0.7);
  const token = c.at('token telemetry', 0.82);
  const ringOut = latency - 6;
  const exit = c.dur - 18;

  const titleSlam = springAt(frame, prove, SPRING.snappy);
  const titleUp = tween(frame, [bench - 10, bench + 16], [0, 1], EASE.inOut);
  const ringIn = tween(frame, [ten - 8, ten + 12], [0, 1], EASE.outExpo);
  const ringGone = tween(frame, [ringOut, ringOut + 16], [0, 1], EASE.inExpo);
  const ringVis = ringIn * (1 - ringGone);
  const split = tween(frame, [exit, c.dur], [0, 1], EASE.inExpo);

  return (
    <AbsoluteFill>
      <Backdrop glow={1} grid={0.2} />
      <Particles count={45} seed={33} opacity={0.5} />

      <Shake hits={[prove, ten]} intensity={7} dur={16}>
        {/* title */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 420 - titleUp * 312,
            textAlign: 'center',
            fontFamily: FONT.serif,
            fontWeight: 700,
            fontSize: 168 - titleUp * 100,
            letterSpacing: '-0.02em',
            color: C.text,
            opacity: frame >= prove ? Math.min(1, titleSlam * 2) * (1 - split) * (1 - ringVis * 0.85) : 0,
            transform: `scale(${1.6 - titleSlam * 0.6})`,
            filter: `blur(${(1 - titleSlam) * 12}px)`,
          }}
        >
          The Arena.
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 196,
            textAlign: 'center',
            fontFamily: FONT.sans,
            fontSize: 22,
            color: C.muted,
            opacity: titleUp * (1 - split) * (1 - ringVis),
          }}
        >
          Test your prompts instantly against multiple LLMs side-by-side.
        </div>

        {/* columns */}
        {COLUMNS.map((col, i) => {
          const d = bench + i * 5;
          const p = springAt(frame, d, SPRING.ui);
          if (frame < d) return null;
          const streamStart = d + 14;
          const lines = 11;
          const shown = Math.max(0, Math.min(lines, ((frame - streamStart) / 7) * col.rate));
          const done = shown >= lines;
          const metrics = tween(frame, [latency - 4, latency + 30], [0, 1], EASE.outQuart);
          const tokens = Math.round(tween(frame, [token - 4, token + 40], [0, 1], EASE.outQuart) * (780 + i * 140));
          const dir = i < 2 ? -1 : 1;
          return (
            <div
              key={col.name}
              style={{
                position: 'absolute',
                left: LEFT + i * (COL_W + GAP),
                top: 262,
                width: COL_W,
                height: 560,
                borderRadius: 24,
                border: `1px solid ${done ? tealA(0.45) : C.lineStrong}`,
                background: 'linear-gradient(180deg, rgba(18,21,23,0.95), rgba(9,11,12,0.97))',
                boxShadow: `0 40px 90px rgba(0,0,0,0.6), 0 0 ${done ? 40 : 0}px ${tealA(0.22)}`,
                transform: `translateY(${(1 - p) * 300}px) translateX(${split * dir * (900 + i * 60)}px) scale(${1 - ringVis * 0.08})`,
                opacity: Math.min(1, p * 2) * (1 - ringVis * 0.7),
                filter: `blur(${ringVis * 6 + split * 10}px)`,
                overflow: 'hidden',
                fontFamily: FONT.sans,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px', borderBottom: `1px solid ${C.line}` }}>
                <Img src={staticFile(col.logo)} style={{ width: 30, height: 30, objectFit: 'contain' }} />
                <span style={{ fontSize: 21, fontWeight: 600, color: C.text }}>{col.name}</span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontFamily: FONT.mono,
                    fontSize: 13,
                    color: done ? C.tealLight : C.amber,
                    letterSpacing: '0.1em',
                  }}
                >
                  {done ? '✓ DONE' : '● STREAMING'}
                </span>
              </div>
              <div style={{ padding: '20px 20px 0' }}>
                {Array.from({ length: lines }).map((_, l) => {
                  const w = 0.45 + hash(l * 7 + i * 13) * 0.5;
                  const lp = Math.max(0, Math.min(1, shown - l));
                  return (
                    <div
                      key={l}
                      style={{
                        height: 12,
                        width: `${w * 100 * lp}%`,
                        borderRadius: 6,
                        marginBottom: 14,
                        background: l === Math.floor(shown) ? C.tealLight : 'rgba(255,255,255,0.13)',
                        boxShadow: l === Math.floor(shown) ? `0 0 12px ${C.tealLight}` : 'none',
                      }}
                    />
                  );
                })}
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  padding: '16px 20px',
                  borderTop: `1px solid ${C.line}`,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  fontFamily: FONT.mono,
                  background: 'rgba(255,255,255,0.015)',
                }}
              >
                {[
                  { k: 'TTFT', v: metrics > 0 ? `${Math.round(col.ttft * metrics)}ms` : '—' },
                  { k: 'TOK/S', v: metrics > 0 ? `${Math.round(col.tps * metrics)}` : '—' },
                  { k: 'TOKENS', v: tokens > 0 ? `${tokens}` : '—' },
                ].map((m) => (
                  <div key={m.k}>
                    <div style={{ fontSize: 12, color: C.dim, letterSpacing: '0.14em' }}>{m.k}</div>
                    <div style={{ fontSize: 22, color: metrics > 0 ? C.text : C.dim, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{m.v}</div>
                  </div>
                ))}
              </div>
              {/* latency sparkline */}
              <svg width={COL_W} height={60} style={{ position: 'absolute', left: 0, bottom: 86, opacity: metrics }}>
                <path
                  d={Array.from({ length: 20 })
                    .map((_, k) => `${k === 0 ? 'M' : 'L'}${10 + k * 19},${40 - hash(k * 3 + i * 17) * 26 - (k / 19) * 6}`)
                    .join(' ')}
                  fill="none"
                  stroke={C.teal}
                  strokeWidth={2.5}
                  pathLength={1}
                  strokeDasharray="1 1"
                  strokeDashoffset={1 - metrics}
                />
              </svg>
            </div>
          );
        })}

        {/* ten-provider ring */}
        {ringVis > 0.01 && (
          <AbsoluteFill style={{ opacity: ringVis }}>
            <div
              style={{
                position: 'absolute',
                left: 960 - 330,
                top: 520 - 330,
                width: 660,
                height: 660,
                borderRadius: '50%',
                border: `1px solid ${tealA(0.35)}`,
                boxShadow: `0 0 80px ${tealA(0.18)} inset`,
                transform: `scale(${0.6 + ringIn * 0.4 - ringGone * 0.4})`,
              }}
            />
            {RING.map((name, i) => {
              const a = (i / RING.length) * Math.PI * 2 + frame * 0.012 - Math.PI / 2;
              const r = 330 * (0.6 + ringIn * 0.4) * (1 - ringGone * 0.6);
              const pop = springAt(frame, ten - 8 + i * 3, SPRING.bouncy);
              return (
                <div
                  key={name}
                  style={{
                    position: 'absolute',
                    left: 960 + Math.cos(a) * r - 42,
                    top: 520 + Math.sin(a) * r - 42,
                    width: 84,
                    height: 84,
                    borderRadius: 24,
                    background: 'rgba(14,18,19,0.95)',
                    border: `1px solid ${tealA(0.4)}`,
                    boxShadow: `0 0 30px ${tealA(0.25)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: `scale(${pop})`,
                  }}
                >
                  <Img src={staticFile(`logos/${name}.png`)} style={{ width: 50, height: 50, objectFit: 'contain' }} />
                </div>
              );
            })}
            <div style={{ position: 'absolute', left: 0, right: 0, top: 410, textAlign: 'center' }}>
              <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 180, lineHeight: 1, color: C.text, letterSpacing: '-0.04em' }}>
                {Math.round(tween(frame, [ten - 4, ten + 26], [1, 10], EASE.outQuart))}
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: 22, letterSpacing: '0.3em', color: C.tealLight, marginTop: 6 }}>FRONTIER MODELS</div>
            </div>
          </AbsoluteFill>
        )}
      </Shake>

      <div
        style={{
          position: 'absolute',
          left: LEFT,
          right: LEFT,
          top: 846,
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: FONT.mono,
          fontSize: 16,
          color: C.muted,
          opacity: tween(frame, [latency, latency + 14]) * (1 - split),
        }}
      >
        <span>
          <span style={{ color: C.tealLight }}>●</span> LIVE TELEMETRY
        </span>
        <span>latency · tokens · throughput</span>
      </div>

      <Eyebrow at={6} index="04" label="ARENA" style={{ position: 'absolute', left: 120, top: 52 }} exitAt={exit - 10} />
      <Flash at={ten} strength={0.2} dur={12} />
      <LightSweep at={exit - 2} dur={22} angle={18} />
    </AbsoluteFill>
  );
};
