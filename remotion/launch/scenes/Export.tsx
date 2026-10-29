import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { Backdrop } from '../components/Stage';
import { Cursor } from '../components/Cursor';
import { Eyebrow } from '../components/Text';
import { Flash, Particles, Shake, Shockwave } from '../components/Fx';
import { C, EASE, FONT, SPRING, springAt, tealA, tween } from '../theme';
import { sceneCues } from '../timeline';

// ============================================================================
// 06 — MULTI-TARGET EXPORT
// The 15 formats are exactly the README "Export Targets" list (IDE directives,
// framework SDKs per language, raw payloads). Named tiles light on their word.
// ============================================================================

interface Target {
  name: string;
  file: string;
  logo?: string;
  glyph?: string;
  word?: string; // phrase spoken in the narration
}

const TARGETS: Target[] = [
  { name: 'Cursor', file: '.cursorrules', logo: 'logos/cursor.png', word: 'Cursor' },
  { name: 'Claude Code', file: 'CLAUDE.md', logo: 'logos/claude.png', word: 'Claude Code' },
  { name: 'Windsurf', file: '.windsurfrules', logo: 'logos/windsurf.png', word: 'Windsurf' },
  { name: 'GitHub Copilot', file: 'copilot-instructions.md', logo: 'logos/copilot.png', word: 'Copilot' },
  { name: 'Vercel AI SDK', file: 'route.ts', glyph: '▲', word: 'Vercel AI SDK' },
  { name: 'OpenAI SDK', file: 'Python', logo: 'logos/openai.png' },
  { name: 'OpenAI SDK', file: 'TypeScript', logo: 'logos/openai.png' },
  { name: 'Anthropic SDK', file: 'Python', logo: 'logos/claude.png' },
  { name: 'Anthropic SDK', file: 'TypeScript', logo: 'logos/claude.png' },
  { name: 'Google Gen AI', file: 'Python', logo: 'logos/gemini.png' },
  { name: 'Google Gen AI', file: 'TypeScript', logo: 'logos/gemini.png' },
  { name: 'LangChain', file: 'Python', logo: 'logos/python.png' },
  { name: 'cURL', file: 'raw request', glyph: '>_' },
  { name: 'JSON', file: 'payload', glyph: '{ }' },
  { name: 'Markdown', file: 'YAML frontmatter', glyph: 'MD' },
];

const TW = 300;
const TH = 112;
const GX = 22;
const GY = 20;
const GRID_LEFT = (1920 - (TW * 5 + GX * 4)) / 2;
const GRID_TOP = 236;
const HUB = { x: 960, y: 150 };

export const Export: React.FC = () => {
  const frame = useCurrentFrame();
  const c = sceneCues('export');
  const exportAt = c.at('Export in one click', 0);
  const more = c.at('and more', 0.7);
  const fifteen = c.at('Fifteen formats', 0.86);
  const exit = c.dur - 22;

  const launch = TARGETS.map((t, i) => (t.word ? c.at(t.word, 0.15 + i * 0.1) : more + (i - 5) * 3));

  const hubMove = tween(frame, [exportAt + 4, exportAt + 26], [0, 1], EASE.inOut);
  const hubX = 960;
  const hubY = 470 + (HUB.y - 470) * hubMove;
  const collapse = tween(frame, [exit, c.dur - 4], [0, 1], EASE.inExpo);

  return (
    <AbsoluteFill>
      <Backdrop glow={1} grid={0.2} />
      <Particles count={50} seed={55} opacity={0.6} />

      <Shake hits={[fifteen]} intensity={10} dur={18}>
        {/* beams */}
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
          {TARGETS.map((t, i) => {
            const col = i % 5;
            const row = Math.floor(i / 5);
            const tx = GRID_LEFT + col * (TW + GX) + TW / 2;
            const ty = GRID_TOP + row * (TH + GY) + TH / 2;
            const p = tween(frame, [launch[i], launch[i] + 14], [0, 1], EASE.outQuart);
            const fade = tween(frame, [launch[i] + 14, launch[i] + 40], [1, 0.18]);
            if (p <= 0) return null;
            return (
              <line
                key={i}
                x1={hubX}
                y1={hubY + 40}
                x2={hubX + (tx - hubX) * p}
                y2={hubY + 40 + (ty - hubY - 40) * p}
                stroke={C.tealLight}
                strokeWidth={2}
                strokeOpacity={fade * (1 - collapse)}
                style={{ filter: `drop-shadow(0 0 6px ${C.teal})` }}
              />
            );
          })}
        </svg>

        {/* hub: the compiled directive */}
        <div
          style={{
            position: 'absolute',
            left: hubX - 300,
            top: hubY - 120,
            width: 600,
            height: 240,
            transform: `scale(${1 - hubMove * 0.55 - collapse * 0.3})`,
            borderRadius: 24,
            border: `1px solid ${tealA(0.5)}`,
            background: 'rgba(8,12,12,0.96)',
            boxShadow: `0 0 ${60 + hubMove * 40}px ${tealA(0.3)}, 0 40px 100px rgba(0,0,0,0.7)`,
            padding: 26,
            fontFamily: FONT.mono,
            opacity: tween(frame, [0, 14]) * (1 - collapse),
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: C.muted, fontSize: 18 }}>
            <span>directive.xml · compiled</span>
            <span style={{ color: C.tealLight }}>✓ validated</span>
          </div>
          <div style={{ marginTop: 18, fontSize: 19, lineHeight: 1.7, color: '#E6ECEA' }}>
            <span style={{ color: C.tealLight }}>{'<role>'}</span>Autonomous Senior Software Engineer<span style={{ color: C.tealLight }}>{'</role>'}</span>
            <br />
            <span style={{ color: C.tealLight }}>{'<negative_constraints>'}</span>No any types.<span style={{ color: C.tealLight }}>…</span>
          </div>
          <div
            style={{
              position: 'absolute',
              right: 22,
              bottom: 20,
              padding: '12px 26px',
              borderRadius: 12,
              background: C.teal,
              color: '#03110e',
              fontFamily: FONT.sans,
              fontWeight: 600,
              fontSize: 19,
              transform: `scale(${frame >= exportAt - 6 && frame < exportAt + 2 ? 0.93 : 1})`,
              opacity: 1 - hubMove,
            }}
          >
            Export ▾
          </div>
        </div>

        {/* target tiles */}
        {TARGETS.map((t, i) => {
          const col = i % 5;
          const row = Math.floor(i / 5);
          const x = GRID_LEFT + col * (TW + GX);
          const y = GRID_TOP + row * (TH + GY);
          const p = springAt(frame, launch[i], SPRING.snappy);
          if (frame < launch[i]) return null;
          const fromX = hubX - (x + TW / 2);
          const fromY = hubY - (y + TH / 2);
          const lit = tween(frame, [launch[i], launch[i] + 4]) * tween(frame, [launch[i] + 4, launch[i] + 34], [1, 0]);
          const named = Boolean(t.word);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: TW,
                height: TH,
                borderRadius: 18,
                border: `1px solid ${lit > 0.05 || named ? tealA(0.35 + lit * 0.6) : C.lineStrong}`,
                background: `linear-gradient(180deg, rgba(20,25,27,0.96), rgba(10,12,13,0.97))`,
                boxShadow: `0 0 ${10 + lit * 50}px ${tealA(0.15 + lit * 0.5)}`,
                transform: `translate(${(fromX * (1 - p) - fromX * collapse * 0) * 1}px, ${fromY * (1 - p)}px) scale(${(0.3 + p * 0.7) * (1 + lit * 0.05) * (1 - collapse)})`,
                opacity: Math.min(1, p * 2) * (1 - collapse),
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '0 20px',
                fontFamily: FONT.sans,
              }}
            >
              <div
                style={{
                  width: 54,
                  height: 54,
                  flexShrink: 0,
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${C.line}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: FONT.mono,
                  fontWeight: 500,
                  fontSize: t.glyph === '▲' ? 26 : 18,
                  color: C.text,
                }}
              >
                {t.logo ? <Img src={staticFile(t.logo)} style={{ width: 32, height: 32, objectFit: 'contain' }} /> : t.glyph}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: C.text, whiteSpace: 'nowrap' }}>{t.name}</div>
                <div style={{ fontFamily: FONT.mono, fontSize: 14, color: named ? C.tealLight : C.muted, marginTop: 4, whiteSpace: 'nowrap' }}>{t.file}</div>
              </div>
            </div>
          );
        })}

        {/* 15 formats */}
        {frame >= fifteen - 2 && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 690,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'baseline',
              gap: 28,
              opacity: tween(frame, [fifteen - 2, fifteen + 6]) * (1 - collapse),
              transform: `scale(${2 - springAt(frame, fifteen, SPRING.snappy)})`,
              filter: `blur(${(1 - tween(frame, [fifteen - 2, fifteen + 10])) * 10}px)`,
            }}
          >
            <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 190, lineHeight: 1, color: C.tealLight, letterSpacing: '-0.05em', textShadow: `0 0 60px ${tealA(0.55)}` }}>15</span>
            <span style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: 64, color: C.text, letterSpacing: '-0.02em' }}>ready formats.</span>
          </div>
        )}
      </Shake>

      <Cursor
        path={[
          { f: Math.max(0, exportAt - 34), x: 1500, y: 820 },
          { f: exportAt - 6, x: 1170, y: 560, click: true },
          { f: exportAt + 26, x: 1300, y: 700 },
        ]}
        hideAt={exportAt + 22}
      />

      <Eyebrow at={6} index="05" label="MULTI-TARGET EXPORT" style={{ position: 'absolute', left: 120, top: 52 }} exitAt={exit - 10} />
      <Shockwave at={fifteen} x={960} y={790} maxR={800} rings={2} />
      <Flash at={c.dur - 6} strength={0.5} dur={10} />
    </AbsoluteFill>
  );
};
