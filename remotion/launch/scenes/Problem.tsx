import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../components/Stage';
import { Cursor } from '../components/Cursor';
import { Eyebrow } from '../components/Text';
import { Flash, Glitch, Shake } from '../components/Fx';
import { C, EASE, FONT, hash, tealA, tween, springAt, SPRING } from '../theme';
import { SCENES, sceneCues } from '../timeline';
import { PROBLEM_SHATTER } from '../beats';

// ============================================================================
// 01 — THE PROBLEM
// A single prompt box → prompt sprawl → model update → drift → production
// breaks and the whole frame shatters (the shards are reborn as the logo).
// ============================================================================

const PROMPT_TEXT = 'build an AI agent that answers support tickets. make it smart. no hallucinations pls';

const SPRAWL = [
  'prompt_v3_final.txt',
  'prompt_v4_FINAL_fixed.txt',
  'system_prompt_old.md',
  'support_bot_v7.md',
  'agent_prompt (2).txt',
  'do_not_edit.txt',
  'prompt_backup_tuesday.txt',
  'rules_new_new.md',
  'classifier_prompt.txt',
  'summarize_v2.txt',
  'prompt_that_works.txt',
  'copy_of_prompt.md',
];

const JSON_LINES: Array<{ ok: string; bad: string }> = [
  { ok: '"intent": "refund_request",', bad: '"Intent": "Refund Request!!",' },
  { ok: '"confidence": 0.94,', bad: '"confidence": "pretty high",' },
  { ok: '"reply": "Your refund is on its way."', bad: '"response": "Sure! Here is a friendly reply…' },
];

const cues = () => {
  const c = sceneCues('problem');
  const brk = c.at('And production', 0.86);
  return {
    every: c.at('Every AI product', 0),
    vague: c.at('A vague idea', 0.25),
    typed: c.at('typed into a box', 0.35),
    hope: c.at('and a hope', 0.45),
    model: c.at('Then the model updates', 0.58),
    drift: c.at('The output drifts', 0.72),
    brk,
    shatter: PROBLEM_SHATTER - SCENES.problem.from,
    dur: c.dur,
  };
};

// Radial wedge pieces used by the shatter — split into inner and outer rings.
const CX = 960;
const CY = 520;
const WEDGES = 11;
const RING = 360;
const angles = Array.from({ length: WEDGES }, (_, i) => ((i + hash(i * 9.1) * 0.7) / WEDGES) * Math.PI * 2).sort((a, b) => a - b);
const pt = (a: number, r: number) => `${(CX + Math.cos(a) * r).toFixed(1)}px ${(CY + Math.sin(a) * r).toFixed(1)}px`;
const PIECES = angles.flatMap((a1, i) => {
  const a2 = angles[(i + 1) % WEDGES] + (i === WEDGES - 1 ? Math.PI * 2 : 0);
  const mid = (a1 + a2) / 2;
  const r = RING * (0.8 + hash(i * 3.3) * 0.4);
  return [
    { clip: `polygon(${CX}px ${CY}px, ${pt(a1, r)}, ${pt(mid, r * 1.05)}, ${pt(a2, r)})`, mid, inner: true, i },
    { clip: `polygon(${pt(a1, r)}, ${pt(a1, 2600)}, ${pt(a2, 2600)}, ${pt(a2, r)}, ${pt(mid, r * 1.05)})`, mid, inner: false, i },
  ];
});

const Content: React.FC = () => {
  const frame = useCurrentFrame();
  const k = cues();

  // ---- camera: slow push → pull back to reveal sprawl → push into output
  const pull = tween(frame, [k.hope, k.hope + 54], [0, 1], EASE.inOut);
  const push = tween(frame, [k.model - 8, k.model + 26], [0, 1], EASE.inOut);
  const cam = (1 + tween(frame, [0, k.hope], [0, 0.04], (t) => t)) * (1 - pull * 0.5) * (1 + push * 0.35);

  // ---- prompt box
  const boxOpen = tween(frame, [k.every - 6, k.every + 22], [0, 1], EASE.outExpo);
  const typed = Math.round(PROMPT_TEXT.length * tween(frame, [k.vague, k.hope - 4], [0, 1], (t) => t));
  const caretOn = Math.floor(frame / 16) % 2 === 0;
  const worldFade = 1 - push * 0.82;

  // ---- output card
  const outIn = springAt(frame, k.model - 2, SPRING.ui);
  const driftP = (i: number) => tween(frame, [k.drift + i * 6, k.drift + i * 6 + 30], [0, 1], EASE.outQuart);
  const broken = frame >= k.drift + 22;
  const flip = tween(frame, [k.model + 4, k.model + 18], [0, 1], EASE.inOut);

  // ---- production break
  const alarm = tween(frame, [k.brk - 2, k.brk + 6]);
  const chartP = tween(frame, [k.brk, k.brk + 34], [0, 1], EASE.outQuart);
  const outShift = tween(frame, [k.brk - 4, k.brk + 22], [0, 1], EASE.inOut);

  return (
    <AbsoluteFill>
      <Backdrop glow={0.75 * (1 - alarm * 0.6)} grid={0.35 * worldFade} />
      <AbsoluteFill style={{ background: `radial-gradient(70% 70% at 50% 50%, rgba(240,82,95,${0.16 * alarm}), transparent 70%)` }} />

      {/* ===================== WORLD (prompt box + sprawl) ===================== */}
      <AbsoluteFill
        style={{
          transform: `scale(${cam})`,
          transformOrigin: `${CX}px ${CY}px`,
          opacity: worldFade,
          filter: `blur(${push * 7}px)`,
        }}
      >
        {SPRAWL.map((name, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const x = CX - 1500 + col * 1000 + (hash(i * 2.2) - 0.5) * 220 + (col > 1 ? 120 : -120);
          const y = CY - 820 + row * 820 + (hash(i * 4.7) - 0.5) * 180 + (row === 1 ? (col < 2 ? -40 : 40) : 0);
          const d = k.hope + 6 + i * 3;
          const p = springAt(frame, d, SPRING.ui);
          const rot = (hash(i * 6.1) - 0.5) * 14;
          if (row === 1 && (col === 1 || col === 2)) return null; // keep center clear for the hero box
          return (
            <div
              key={name}
              style={{
                position: 'absolute',
                left: x - 330,
                top: y - 150,
                width: 660,
                height: 300,
                borderRadius: 22,
                border: `1px solid ${C.lineStrong}`,
                background: C.card,
                opacity: p,
                transform: `translateZ(0) scale(${0.6 + p * 0.4}) rotate(${rot * p}deg)`,
                filter: `blur(${(1 - p) * 12}px)`,
                padding: 28,
                fontFamily: FONT.mono,
                color: C.muted,
                fontSize: 26,
                boxShadow: '0 40px 90px rgba(0,0,0,0.6)',
              }}
            >
              <div style={{ color: C.text, marginBottom: 18 }}>{name}</div>
              {[0.92, 0.7, 0.84, 0.5].map((w, j) => (
                <div key={j} style={{ height: 14, width: `${w * 100}%`, borderRadius: 7, background: 'rgba(255,255,255,0.08)', marginBottom: 16 }} />
              ))}
            </div>
          );
        })}

        {/* hero prompt box */}
        <div
          style={{
            position: 'absolute',
            left: CX - 520,
            top: CY - 110,
            width: 1040,
            height: 220,
            borderRadius: 30,
            border: `1px solid ${tealA(0.25 + boxOpen * 0.25)}`,
            background: 'rgba(8,11,12,0.92)',
            boxShadow: `0 0 0 6px ${tealA(0.05)}, 0 40px 120px rgba(0,0,0,0.7), 0 0 80px ${tealA(0.15)}`,
            transform: `scaleX(${0.02 + boxOpen * 0.98}) scaleY(${0.3 + boxOpen * 0.7})`,
            opacity: Math.min(1, boxOpen * 3),
            padding: '34px 40px',
            fontFamily: FONT.sans,
          }}
        >
          <div style={{ fontSize: 34, lineHeight: 1.35, color: typed ? C.text : C.dim, opacity: boxOpen }}>
            {typed ? PROMPT_TEXT.slice(0, typed) : 'Type your prompt…'}
            <span style={{ display: 'inline-block', width: 3, height: 38, marginLeft: 4, verticalAlign: 'middle', background: C.tealLight, opacity: caretOn ? 1 : 0 }} />
          </div>
          <div
            style={{
              position: 'absolute',
              right: 28,
              bottom: 24,
              padding: '14px 30px',
              borderRadius: 14,
              background: C.teal,
              color: '#04110f',
              fontWeight: 600,
              fontSize: 22,
              opacity: boxOpen,
              transform: `scale(${frame >= k.hope - 2 && frame < k.hope + 8 ? 0.94 : 1})`,
            }}
          >
            Generate
          </div>
        </div>
      </AbsoluteFill>

      <Cursor
        path={[
          { f: k.typed, x: 1500, y: 760 },
          { f: k.hope - 4, x: 1418, y: 600, click: true },
          { f: k.hope + 30, x: 1440, y: 640 },
        ]}
        hideAt={k.hope + 26}
      />

      {/* ===================== OUTPUT CARD (model update → drift) ===================== */}
      {frame >= k.model - 4 && (
        <div
          style={{
            position: 'absolute',
            left: CX - 470 - outShift * 330,
            top: CY - 230,
            width: 940,
            borderRadius: 26,
            border: `1px solid ${broken ? 'rgba(240,82,95,0.5)' : C.lineStrong}`,
            background: 'rgba(9,11,12,0.94)',
            boxShadow: `0 50px 120px rgba(0,0,0,0.75), 0 0 70px ${broken ? 'rgba(240,82,95,0.18)' : tealA(0.12)}`,
            transform: `translateY(${(1 - outIn) * 80}px) scale(${(0.9 + outIn * 0.1) * (1 - outShift * 0.12)})`,
            opacity: outIn,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 30px', borderBottom: `1px solid ${C.line}`, fontFamily: FONT.mono, fontSize: 20 }}>
            <span style={{ color: C.muted }}>support-bot · production · output</span>
            <span style={{ perspective: 400 }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: `1px solid ${flip > 0.5 ? 'rgba(232,163,61,0.6)' : tealA(0.5)}`,
                  background: flip > 0.5 ? 'rgba(232,163,61,0.12)' : tealA(0.12),
                  color: flip > 0.5 ? C.amber : C.tealLight,
                  transform: `rotateX(${flip < 0.5 ? flip * 180 : (1 - flip) * 180}deg)`,
                }}
              >
                {flip > 0.5 ? 'model v2.0 · updated' : 'model v1.0'}
              </span>
            </span>
          </div>
          <div style={{ padding: '26px 34px', fontFamily: FONT.mono, fontSize: 30, lineHeight: 1.7 }}>
            <div style={{ color: C.dim }}>{'{'}</div>
            {JSON_LINES.map((l, i) => {
              const p = driftP(i);
              const dir = i % 2 === 0 ? 1 : -1;
              const jitter = p > 0 && p < 1 ? (hash(frame * 3 + i) - 0.5) * 10 : 0;
              const showBad = frame >= k.drift + 8 + i * 6;
              return (
                <div
                  key={i}
                  style={{
                    paddingLeft: 32,
                    whiteSpace: 'nowrap',
                    transform: `translateX(${dir * p * (26 + i * 22) + jitter}px) skewX(${dir * p * -4}deg)`,
                    color: showBad ? (i === 2 ? C.red : C.amber) : C.tealLight,
                    textShadow: showBad ? '-2px 0 rgba(255,60,90,0.55), 2px 0 rgba(60,240,220,0.45)' : 'none',
                  }}
                >
                  {showBad ? l.bad : l.ok}
                </div>
              );
            })}
            <div style={{ color: C.dim }}>{'}'}</div>
          </div>
          <div style={{ padding: '0 34px 28px' }}>
            <span
              style={{
                display: 'inline-flex',
                gap: 10,
                alignItems: 'center',
                padding: '10px 18px',
                borderRadius: 10,
                fontFamily: FONT.mono,
                fontSize: 20,
                letterSpacing: '0.08em',
                color: broken ? C.red : C.tealLight,
                background: broken ? 'rgba(240,82,95,0.12)' : tealA(0.12),
                border: `1px solid ${broken ? 'rgba(240,82,95,0.5)' : tealA(0.4)}`,
              }}
            >
              {broken ? '✕ SCHEMA BROKEN · 3 ERRORS' : '✓ SCHEMA VALID'}
            </span>
          </div>
        </div>
      )}

      {/* ===================== ERROR RATE + TOAST ===================== */}
      {frame >= k.brk - 4 && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 1120,
              top: CY - 220,
              width: 660,
              height: 440,
              borderRadius: 26,
              border: '1px solid rgba(240,82,95,0.45)',
              background: 'rgba(14,8,9,0.94)',
              transform: `translateX(${(1 - tween(frame, [k.brk - 4, k.brk + 18])) * 200}px)`,
              opacity: tween(frame, [k.brk - 4, k.brk + 10]),
              padding: 30,
              fontFamily: FONT.mono,
              boxShadow: '0 0 90px rgba(240,82,95,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: C.muted, fontSize: 20 }}>
              <span>error_rate · prod</span>
              <span style={{ color: C.red, fontSize: 40, fontWeight: 500 }}>{(0.2 + chartP * 37.8).toFixed(1)}%</span>
            </div>
            <svg width={600} height={300} viewBox="0 0 600 300" style={{ marginTop: 20 }}>
              {[60, 140, 220].map((y) => (
                <line key={y} x1={0} x2={600} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" />
              ))}
              <path
                d="M0 280 L80 278 L150 276 L210 279 L270 272 L330 270 L380 250 L420 200 L460 120 L500 60 L540 30 L600 14"
                fill="none"
                stroke={C.red}
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray={900}
                strokeDashoffset={900 * (1 - chartP)}
                style={{ filter: 'drop-shadow(0 0 10px rgba(240,82,95,0.8))' }}
              />
            </svg>
          </div>
          <div
            style={{
              position: 'absolute',
              left: CX - 330,
              top: 70 + (1 - tween(frame, [k.brk + 2, k.brk + 18])) * -120,
              width: 660,
              padding: '18px 26px',
              borderRadius: 16,
              background: 'rgba(240,82,95,0.14)',
              border: '1px solid rgba(240,82,95,0.6)',
              color: '#ffd9dc',
              fontFamily: FONT.mono,
              fontSize: 22,
              display: 'flex',
              gap: 14,
              alignItems: 'center',
              boxShadow: '0 20px 60px rgba(240,82,95,0.25)',
            }}
          >
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: C.red, boxShadow: `0 0 12px ${C.red}`, opacity: Math.floor(frame / 8) % 2 ? 1 : 0.35 }} />
            PRODUCTION · 500 Internal Server Error
          </div>
        </>
      )}

      <Eyebrow at={8} index="01" label="THE PROBLEM" exitAt={k.model - 10} style={{ position: 'absolute', left: 120, top: 92 }} />
    </AbsoluteFill>
  );
};

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const k = cues();
  const glitch = Math.min(1, tween(frame, [k.drift, k.drift + 24], [0, 0.45]) + tween(frame, [k.brk, k.brk + 8], [0, 0.55]));

  // Before the shatter: the live scene, with RGB split once things go wrong.
  if (frame < k.shatter) {
    return (
      <Shake hits={[k.model + 4, k.drift + 10, k.brk, k.brk + 22]} intensity={frame >= k.brk ? 16 : 6}>
        <Glitch intensity={glitch} seed={3}>
          <Content />
        </Glitch>
        <Flash at={k.brk} strength={0.35} color="#ff5864" />
      </Shake>
    );
  }

  // Shatter: the frame breaks into radial pieces that blow out toward camera.
  const t = frame - k.shatter;
  const crack = tween(frame, [k.shatter, k.shatter + 6]);
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      {PIECES.map((pc, n) => {
        const delay = pc.inner ? 0 : 3 + hash(n) * 4;
        const p = tween(t, [delay, delay + 42], [0, 1], EASE.inExpo);
        const dist = (pc.inner ? 900 : 1500) * p;
        const dx = Math.cos(pc.mid) * dist;
        const dy = Math.sin(pc.mid) * dist + p * p * 380;
        const rot = (hash(n * 7.7) - 0.5) * 70 * p;
        const sc = 1 + p * (pc.inner ? 0.9 : 0.4);
        return (
          <AbsoluteFill
            key={n}
            style={{
              clipPath: pc.clip,
              transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${sc})`,
              transformOrigin: `${CX}px ${CY}px`,
              opacity: 1 - tween(t, [delay + 20, delay + 42]),
              filter: `blur(${p * 6}px) brightness(${1 + crack * 0.25})`,
            }}
          >
            <Content />
          </AbsoluteFill>
        );
      })}
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: tween(t, [0, 3]) * tween(t, [8, 26], [1, 0]) }}>
        {angles.map((a, i) => (
          <line key={i} x1={CX} y1={CY} x2={CX + Math.cos(a) * 2200} y2={CY + Math.sin(a) * 2200} stroke="#eafffb" strokeWidth={2.5} strokeOpacity={0.85} />
        ))}
      </svg>
      <Flash at={k.shatter} strength={0.55} dur={14} />
    </AbsoluteFill>
  );
};
