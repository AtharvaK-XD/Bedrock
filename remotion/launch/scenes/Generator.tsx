import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../components/Stage';
import { AppWindow } from '../components/AppWindow';
import { Cursor } from '../components/Cursor';
import { Eyebrow, Slam } from '../components/Text';
import { Flash, LightSweep, Particles, Shake } from '../components/Fx';
import { C, EASE, FONT, SPRING, springAt, tealA, tween } from '../theme';
import { sceneCues } from '../timeline';

// ============================================================================
// 03 — GENERATOR
// Recreates the real Generator workspace (public/screenshots/03): brief →
// clarifying questions → compiled directive → "Structured. Constrained.
// Ready to ship." The brief text is the one shown in the app screenshot.
// ============================================================================

const BRIEF = 'Distributed Redis cluster orchestrator with automatic shard failover and zero-data-loss replication';

const QUESTIONS = [
  { q: 'Which runtime should the orchestrator target?', opts: ['Node.js · TypeScript', 'Go', 'Rust'], pick: 0 },
  { q: 'What consistency guarantee is required?', opts: ['Strong', 'Eventual'], pick: 0 },
  { q: 'Maximum failover time budget?', opts: ['< 5 s', '< 30 s', '< 2 min'], pick: 0 },
];

// <role>, <negative_constraints> and <verification_protocol> lines are the
// exact examples used on the Bedrock landing page.
const DIRECTIVE: Array<{ t: string; indent: number; kind: 'tag' | 'neg' | 'plain' }> = [
  { t: '<system_directive target="coding-agent">', indent: 0, kind: 'tag' },
  { t: '<role>Autonomous Senior Software Engineer</role>', indent: 1, kind: 'tag' },
  { t: '<objective>Redis cluster orchestrator · shard failover</objective>', indent: 1, kind: 'tag' },
  { t: '<runtime>Node.js · TypeScript</runtime>', indent: 1, kind: 'tag' },
  { t: '<consistency>strong · zero-data-loss</consistency>', indent: 1, kind: 'tag' },
  { t: '<negative_constraints>', indent: 1, kind: 'neg' },
  { t: 'No any types. Zero unhandled rejections.', indent: 2, kind: 'neg' },
  { t: '</negative_constraints>', indent: 1, kind: 'neg' },
  { t: '<failover_budget>< 5s</failover_budget>', indent: 1, kind: 'tag' },
  { t: '<verification_protocol>tsc --noEmit && npm run build</verification_protocol>', indent: 1, kind: 'tag' },
  { t: '</system_directive>', indent: 0, kind: 'tag' },
];

const STEPS = ['Analyze brief', 'Clarify intent', 'Synthesize directive', 'Validate schema'];

const Chip: React.FC<{ label: string; prefix?: string; active?: boolean }> = ({ label, prefix, active }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '9px 14px',
      borderRadius: 10,
      border: `1px solid ${active ? tealA(0.5) : C.line}`,
      background: active ? tealA(0.12) : 'rgba(255,255,255,0.02)',
      fontFamily: FONT.sans,
      fontSize: 17,
      color: C.muted,
    }}
  >
    {prefix && <span style={{ fontFamily: FONT.mono, fontSize: 12, color: C.dim }}>{prefix}</span>}
    <span style={{ color: C.text }}>{label}</span>
  </div>
);

/** Syntax-colored XML line. */
const XmlLine: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(<\/?[\w_]+(?:\s[^>]*)?>)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('<') && p.endsWith('>') ? (
          <span key={i} style={{ color: C.tealLight }}>
            {p}
          </span>
        ) : (
          <span key={i} style={{ color: '#E6ECEA' }}>
            {p}
          </span>
        ),
      )}
    </>
  );
};

export const Generator: React.FC = () => {
  const frame = useCurrentFrame();
  const c = sceneCues('generator');
  const describe = c.at('Describe what you want', 0);
  const asks = c.at('asks the right questions', 0.2);
  const synth = c.at('then synthesizes', 0.4);
  const structured = c.at('Structured', 0.72);
  const constrained = c.at('Constrained', 0.82);
  const ready = c.at('Ready to ship', 0.9);
  const exit = c.dur - 18;

  // window camera: fly in tilted, settle, recede for the kinetic words
  const enter = springAt(frame, 0, SPRING.heavy);
  const recede = tween(frame, [structured - 12, structured + 16], [0, 1], EASE.inOut);
  const whip = tween(frame, [exit, c.dur], [0, 1], EASE.inExpo);
  const rotX = 24 * (1 - enter) + 5 - recede * 2;
  const rotY = -14 * (1 - enter) - 3 + recede * -10;

  // inner phases
  const typed = Math.round(BRIEF.length * tween(frame, [describe + 4, asks - 10], [0, 1], (t) => t));
  const askP = tween(frame, [asks, asks + 22], [0, 1], EASE.inOut);
  const synthP = tween(frame, [synth - 4, synth + 18], [0, 1], EASE.inOut);

  return (
    <AbsoluteFill>
      <Backdrop glow={1} grid={0.25} gridY={-frame * 0.3} />
      <Particles count={40} seed={21} opacity={0.6} />

      <Shake hits={[structured, constrained, ready]} intensity={5} dur={14}>
        <AbsoluteFill
          style={{
            transform: `translateX(${-whip * 900}px)`,
            filter: `blur(${whip * 18}px)`,
            opacity: 1 - whip * 0.8,
          }}
        >
          {/* ===================== APP WINDOW ===================== */}
          <div style={{ position: 'absolute', inset: 0, perspective: 2600 }}>
            <div
              style={{
                position: 'absolute',
                left: 180,
                top: 96,
                transform: `translateY(${(1 - enter) * 420}px) translateX(${recede * 520}px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${1 - recede * 0.22})`,
                transformOrigin: '50% 50%',
                opacity: Math.min(1, enter * 1.6),
                filter: `brightness(${1 - recede * 0.35})`,
              }}
            >
              <AppWindow width={1560} height={820} active="Generator">
                {/* ---- phase 1: brief input ---- */}
                <div style={{ position: 'absolute', inset: 0, opacity: 1 - synthP }}>
                  <div
                    style={{
                      textAlign: 'center',
                      marginTop: 56 - askP * 40,
                      opacity: 1 - askP * 0.6,
                      transform: `scale(${1 - askP * 0.25})`,
                    }}
                  >
                    <div style={{ fontFamily: FONT.serif, fontWeight: 700, fontSize: 60, color: C.text, letterSpacing: '-0.01em' }}>
                      Craft the Perfect Prompt.
                    </div>
                    <div style={{ fontFamily: FONT.sans, fontSize: 21, color: C.muted, marginTop: 12, opacity: 1 - askP }}>
                      Turn a vague idea into a solid, build-ready prompt.
                    </div>
                  </div>

                  <div
                    style={{
                      position: 'absolute',
                      left: 210,
                      width: 1140,
                      top: 250 - askP * 128,
                      borderRadius: 26,
                      border: `1px solid ${tealA(0.28)}`,
                      background: 'rgba(10,13,14,0.95)',
                      boxShadow: `0 0 60px ${tealA(0.1)}`,
                      padding: 22,
                      transform: `scale(${1 - askP * 0.06})`,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 12 }}>
                      <Chip prefix="DEV" label="Coding Agent" />
                      <Chip prefix="Provider:" label="Universal" />
                      <Chip prefix="Model:" label="Auto-select best model" />
                    </div>
                    <div
                      style={{
                        fontFamily: FONT.sans,
                        fontSize: 27,
                        color: C.text,
                        padding: '28px 10px 18px',
                        minHeight: 120 - askP * 50,
                        lineHeight: 1.4,
                      }}
                    >
                      {BRIEF.slice(0, typed)}
                      {typed < BRIEF.length && (
                        <span style={{ display: 'inline-block', width: 3, height: 30, marginLeft: 3, verticalAlign: 'middle', background: C.tealLight, opacity: Math.floor(frame / 15) % 2 }} />
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', opacity: 1 - askP }}>
                      <div
                        style={{
                          padding: '14px 34px',
                          borderRadius: 14,
                          background: C.teal,
                          color: '#03110e',
                          fontFamily: FONT.sans,
                          fontWeight: 600,
                          fontSize: 20,
                          transform: `scale(${frame >= asks - 8 && frame < asks ? 0.94 : 1})`,
                          boxShadow: `0 0 30px ${tealA(0.45)}`,
                        }}
                      >
                        Generate
                      </div>
                    </div>
                  </div>

                  {/* clarifying questions */}
                  {QUESTIONS.map((qq, i) => {
                    const d = asks + 10 + i * 9;
                    const p = springAt(frame, d, SPRING.ui);
                    const pickAt = d + 20 + i * 6;
                    return (
                      <div
                        key={i}
                        style={{
                          position: 'absolute',
                          left: 210,
                          width: 1140,
                          top: 330 + i * 118,
                          padding: '18px 24px',
                          borderRadius: 18,
                          border: `1px solid ${C.line}`,
                          background: 'rgba(14,17,18,0.92)',
                          opacity: p,
                          transform: `translateY(${(1 - p) * 60}px)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ fontFamily: FONT.mono, fontSize: 13, color: C.tealLight, letterSpacing: '0.14em' }}>
                            QUESTION {i + 1} · SINGLE SELECT
                          </div>
                          <div style={{ fontFamily: FONT.sans, fontSize: 23, color: C.text, marginTop: 8 }}>{qq.q}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          {qq.opts.map((o, j) => {
                            const on = j === qq.pick && frame >= pickAt;
                            const pop = on ? springAt(frame, pickAt, SPRING.bouncy) : 0;
                            return (
                              <div
                                key={o}
                                style={{
                                  padding: '10px 18px',
                                  borderRadius: 12,
                                  fontFamily: FONT.sans,
                                  fontSize: 18,
                                  color: on ? '#03110e' : C.muted,
                                  background: on ? C.tealLight : 'rgba(255,255,255,0.03)',
                                  border: `1px solid ${on ? C.tealLight : C.line}`,
                                  transform: `scale(${1 + pop * 0.06 - (on ? 0.06 : 0)})`,
                                  fontWeight: on ? 600 : 400,
                                }}
                              >
                                {o}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ---- phase 2: synthesis split view ---- */}
                {frame >= synth - 6 && (
                  <div style={{ position: 'absolute', inset: 0, opacity: synthP, display: 'flex', gap: 28, padding: 34 }}>
                    <div style={{ width: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ fontFamily: FONT.mono, fontSize: 14, color: C.dim, letterSpacing: '0.18em', marginBottom: 6 }}>SYNTHESIS PIPELINE</div>
                      {STEPS.map((s, i) => {
                        const doneAt = synth + 8 + i * 13;
                        const done = frame >= doneAt;
                        const p = tween(frame, [doneAt - 13, doneAt]);
                        return (
                          <div
                            key={s}
                            style={{
                              padding: '18px 20px',
                              borderRadius: 16,
                              border: `1px solid ${done ? tealA(0.45) : C.line}`,
                              background: done ? tealA(0.08) : 'rgba(255,255,255,0.02)',
                              fontFamily: FONT.sans,
                              fontSize: 21,
                              color: done ? C.text : C.muted,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              position: 'relative',
                              overflow: 'hidden',
                            }}
                          >
                            <div style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: `${p * 100}%`, background: C.teal, boxShadow: `0 0 10px ${C.teal}` }} />
                            <span>{s}</span>
                            <span style={{ color: C.tealLight, fontFamily: FONT.mono, opacity: done ? 1 : 0.3 }}>{done ? '✓' : '···'}</span>
                          </div>
                        );
                      })}
                      <div style={{ marginTop: 'auto', fontFamily: FONT.mono, fontSize: 15, color: C.dim, lineHeight: 1.7 }}>
                        target: coding-agent
                        <br />
                        clarifications: 3 / 3
                      </div>
                    </div>

                    <div
                      style={{
                        flex: 1,
                        borderRadius: 20,
                        border: `1px solid ${C.lineStrong}`,
                        background: '#07090a',
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderBottom: `1px solid ${C.line}`, fontFamily: FONT.mono, fontSize: 15, color: C.muted }}>
                        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f56' }} />
                        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ffbd2e' }} />
                        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#27c93f' }} />
                        <span style={{ marginLeft: 10 }}>directive.xml</span>
                      </div>
                      <div style={{ padding: '20px 26px', fontFamily: FONT.mono, fontSize: 19.5, lineHeight: 1.72 }}>
                        {DIRECTIVE.map((l, i) => {
                          const at = synth + 6 + i * 5;
                          const p = tween(frame, [at, at + 14], [0, 1], EASE.outExpo);
                          const tagFlash = l.kind !== 'plain' ? tween(frame, [structured, structured + 6]) * tween(frame, [structured + 6, structured + 34], [1, 0]) : 0;
                          const negGlow = l.kind === 'neg' ? tween(frame, [constrained, constrained + 8]) : 0;
                          return (
                            <div
                              key={i}
                              style={{
                                display: 'flex',
                                whiteSpace: 'nowrap',
                                opacity: p,
                                transform: `translateX(${(1 - p) * -24}px)`,
                                background: negGlow ? tealA(0.14 * negGlow) : tagFlash ? tealA(0.08 * tagFlash) : 'transparent',
                                boxShadow: negGlow ? `inset 3px 0 0 ${C.teal}` : 'none',
                                borderRadius: 4,
                              }}
                            >
                              <span style={{ width: 36, flexShrink: 0, color: C.dim, textAlign: 'right', marginRight: 18 }}>{i + 1}</span>
                              <span style={{ paddingLeft: l.indent * 26 }}>
                                <XmlLine text={l.t} />
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {frame >= ready && (
                        <div
                          style={{
                            position: 'absolute',
                            right: 28,
                            bottom: 26,
                            padding: '14px 22px',
                            borderRadius: 14,
                            border: `2px solid ${C.tealLight}`,
                            background: 'rgba(8,37,34,0.92)',
                            color: C.tealLight,
                            fontFamily: FONT.mono,
                            fontSize: 20,
                            letterSpacing: '0.1em',
                            transform: `scale(${2 - springAt(frame, ready, SPRING.snappy)}) rotate(-4deg)`,
                            opacity: tween(frame, [ready, ready + 6]),
                            boxShadow: `0 0 40px ${tealA(0.5)}`,
                          }}
                        >
                          ✓ VALIDATED · READY TO SHIP
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </AppWindow>
            </div>
          </div>

          <Cursor
            path={[
              { f: describe, x: 1500, y: 900 },
              { f: asks - 8, x: 1392, y: 520, click: true },
              { f: asks + 30, x: 1520, y: 760 },
            ]}
            hideAt={asks + 24}
          />

          {/* ===================== KINETIC WORDS ===================== */}
          <div style={{ position: 'absolute', left: 120, top: 300, fontFamily: FONT.display, fontWeight: 700, fontSize: 112, lineHeight: 1.08, letterSpacing: '-0.035em' }}>
            <Slam at={structured} style={{ color: C.text, transformOrigin: 'left center' }}>
              Structured.
            </Slam>
            <Slam at={constrained} style={{ color: C.text, transformOrigin: 'left center' }}>
              Constrained.
            </Slam>
            <Slam at={ready} style={{ color: C.tealLight, transformOrigin: 'left center', textShadow: `0 0 40px ${tealA(0.6)}` }}>
              Ready to ship.
            </Slam>
          </div>

          <Eyebrow at={10} index="02" label="GENERATOR" exitAt={structured - 14} style={{ position: 'absolute', left: 120, top: 40 }} />
        </AbsoluteFill>
      </Shake>

      <Flash at={ready} strength={0.25} dur={12} />
      <LightSweep at={exit - 4} dur={24} />
    </AbsoluteFill>
  );
};
