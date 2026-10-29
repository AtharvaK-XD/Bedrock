import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Backdrop } from '../components/Stage';
import { Eyebrow } from '../components/Text';
import { LightSweep } from '../components/Fx';
import { C, EASE, FONT, SPRING, springAt, tealA, tween } from '../theme';
import { sceneCues } from '../timeline';

// ============================================================================
// 04 — BRANCHING CANVAS
// Visual DAG built from the node types named on the Bedrock site: condition
// routers, dynamic data stores, script transforms and consensus merges.
// The first two nodes are the ones shown in public/screenshots/04.
// ============================================================================

type NodeKind = 'SYS' | 'PROMPT' | 'ROUTER' | 'SCRIPT' | 'STORE' | 'MERGE';

interface DagNode {
  id: string;
  kind: NodeKind;
  header: string;
  title: string;
  body: string;
  x: number;
  y: number;
  model?: string;
}

const KIND_COLOR: Record<NodeKind, string> = {
  SYS: C.blue,
  PROMPT: C.tealLight,
  ROUTER: C.amber,
  SCRIPT: C.violet,
  STORE: C.blue,
  MERGE: C.tealLight,
};

const NODES: DagNode[] = [
  { id: 'sys', kind: 'SYS', header: 'SYSTEM PERSONA', title: 'Code Reviewer Persona', body: 'You are a Senior Security & Performance Code Reviewer.', x: 300, y: 540, model: 'Gemini Flash' },
  { id: 'prompt', kind: 'PROMPT', header: 'USER PROMPT', title: 'JWT Auth Middleware', body: 'Generate an Express/Node authentication middleware…', x: 820, y: 540 },
  { id: 'router', kind: 'ROUTER', header: 'CONDITION ROUTER', title: 'Risk Gate', body: 'if risk_score > 0.7', x: 1340, y: 540 },
  { id: 'script', kind: 'SCRIPT', header: 'SCRIPT TRANSFORM', title: 'Normalize Diff', body: 'return diff.trim().split("\\n")', x: 1860, y: 300 },
  { id: 'store', kind: 'STORE', header: 'DATA STORE', title: 'Context Cache', body: 'context.auth_rules', x: 1860, y: 780 },
  { id: 'merge', kind: 'MERGE', header: 'CONSENSUS MERGE', title: 'Consensus Merge', body: '3-model vote · majority', x: 2380, y: 540 },
];

const EDGES: Array<{ a: string; b: string; label?: string }> = [
  { a: 'sys', b: 'prompt' },
  { a: 'prompt', b: 'router' },
  { a: 'router', b: 'script', label: 'true' },
  { a: 'router', b: 'store', label: 'false' },
  { a: 'script', b: 'merge' },
  { a: 'store', b: 'merge' },
];

const NW = 400;
const NH = 236;
const byId = (id: string) => NODES.find((n) => n.id === id)!;

const bez = (ax: number, ay: number, bx: number, by: number, t: number) => {
  const c1x = ax + (bx - ax) * 0.5;
  const c2x = ax + (bx - ax) * 0.5;
  const mt = 1 - t;
  return {
    x: mt * mt * mt * ax + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * bx,
    y: mt * mt * mt * ay + 3 * mt * mt * t * ay + 3 * mt * t * t * by + t * t * t * by,
  };
};

export const Branching: React.FC = () => {
  const frame = useCurrentFrame();
  const c = sceneCues('branching');
  const chain = c.at('Chain prompts', 0);
  const canvas = c.at('visual DAG canvas', 0.25);
  const route = c.at('Route conditions', 0.45);
  const merge = c.at('merge consensus', 0.62);
  const orch = c.at('orchestrate', 0.78);
  const exit = c.dur - 18;

  const appear: Record<string, number> = {
    sys: Math.max(4, chain - 10),
    prompt: chain + 10,
    router: route - 6,
    script: route + 8,
    store: route + 14,
    merge: merge - 4,
  };
  const edgeAt = (a: string, b: string) => Math.max(appear[a], appear[b]) + 8;

  // camera keyframes (world center x/y + zoom)
  const keys = [
    { f: 0, x: 560, y: 540, z: 1.08 },
    { f: canvas, x: 640, y: 540, z: 1.0 },
    { f: route + 4, x: 1500, y: 540, z: 0.92 },
    { f: merge + 4, x: 1980, y: 540, z: 0.9 },
    { f: orch + 6, x: 1340, y: 540, z: 0.66 },
    { f: exit, x: 1360, y: 540, z: 0.7 },
  ];
  let cam = keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame >= a.f) {
      // hold on `a`, then arrive on `b` exactly at its cue
      const p = tween(frame, [Math.max(a.f, b.f - 32), Math.max(a.f + 1, b.f)], [0, 1], EASE.inOut);
      cam = { f: frame, x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, z: a.z + (b.z - a.z) * p };
    }
  }
  const dive = tween(frame, [exit, c.dur], [0, 1], EASE.inExpo);
  const z = cam.z * (1 + dive * 1.6);

  const statusOf = (i: number): 'IDLE' | 'RUNNING' | 'DONE' => {
    const s = orch + 8 + i * 9;
    if (frame < s) return 'IDLE';
    if (frame < s + 16) return 'RUNNING';
    return 'DONE';
  };

  return (
    <AbsoluteFill>
      <Backdrop glow={0.8} grid={0} />
      {/* dot-grid canvas that pans with the camera */}
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.13) 1.3px, transparent 1.8px)',
          backgroundSize: `${34 * z}px ${34 * z}px`,
          backgroundPosition: `${960 - cam.x * z}px ${540 - cam.y * z}px`,
          opacity: tween(frame, [0, 20]) * (1 - dive),
        }}
      />

      <AbsoluteFill style={{ filter: `blur(${dive * 16}px)`, opacity: 1 - dive * 0.7 }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 2800,
            height: 1080,
            transform: `translate(${960 - cam.x * z}px, ${540 - cam.y * z}px) scale(${z})`,
            transformOrigin: '0 0',
          }}
        >
          {/* edges */}
          <svg width={2800} height={1080} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            <defs>
              <filter id="edgeGlow">
                <feGaussianBlur stdDeviation="4" />
              </filter>
            </defs>
            {EDGES.map((e, i) => {
              const A = byId(e.a);
              const B = byId(e.b);
              const ax = A.x + NW / 2;
              const ay = A.y;
              const bx = B.x - NW / 2;
              const by = B.y;
              const d = `M${ax},${ay} C${(ax + bx) / 2},${ay} ${(ax + bx) / 2},${by} ${bx},${by}`;
              const s = edgeAt(e.a, e.b);
              const p = tween(frame, [s, s + 22], [0, 1], EASE.outQuart);
              const hot = frame >= orch;
              return (
                <g key={i}>
                  <path d={d} fill="none" stroke={tealA(0.6)} strokeWidth={8} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} filter="url(#edgeGlow)" opacity={hot ? 0.9 : 0.45} />
                  <path d={d} fill="none" stroke={hot ? C.tealLight : C.teal} strokeWidth={3} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} />
                  {p >= 1 &&
                    [0, 0.33, 0.66].map((o, k) => {
                      const t = ((frame - s) / (hot ? 26 : 50) + o) % 1;
                      const pt = bez(ax, ay, bx, by, t);
                      return <circle key={k} cx={pt.x} cy={pt.y} r={hot ? 7 : 5} fill="#eafffb" style={{ filter: `drop-shadow(0 0 8px ${C.tealLight})` }} />;
                    })}
                  {e.label && p > 0.6 && (
                    <g opacity={tween(frame, [s + 10, s + 20])}>
                      <rect x={(ax + bx) / 2 - 36} y={(ay + by) / 2 - 18} width={72} height={36} rx={10} fill="#0b0f10" stroke={e.label === 'true' ? C.tealLight : C.amber} />
                      <text x={(ax + bx) / 2} y={(ay + by) / 2 + 7} textAnchor="middle" fontFamily={FONT.mono} fontSize={18} fill={e.label === 'true' ? C.tealLight : C.amber}>
                        {e.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* nodes */}
          {NODES.map((n, i) => {
            const p = springAt(frame, appear[n.id], SPRING.bouncy);
            if (frame < appear[n.id]) return null;
            const status = statusOf(i);
            const color = KIND_COLOR[n.kind];
            const running = status === 'RUNNING';
            const done = status === 'DONE';
            return (
              <div
                key={n.id}
                style={{
                  position: 'absolute',
                  left: n.x - NW / 2,
                  top: n.y - NH / 2,
                  width: NW,
                  height: NH,
                  borderRadius: 26,
                  border: `2px solid ${done ? C.tealLight : running ? C.tealLight : 'rgba(255,255,255,0.12)'}`,
                  background: `linear-gradient(180deg, rgba(20,26,30,0.96) 0%, rgba(9,11,13,0.98) 100%)`,
                  boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 ${running ? 60 : done ? 34 : 0}px ${tealA(running ? 0.55 : 0.3)}`,
                  transform: `scale(${0.4 + p * 0.6})`,
                  opacity: Math.min(1, p * 2),
                  fontFamily: FONT.sans,
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: `1px solid ${C.line}` }}>
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontWeight: 500,
                      fontSize: 15,
                      color,
                      padding: '5px 10px',
                      borderRadius: 8,
                      border: `1px solid ${color}55`,
                      background: `${color}14`,
                    }}
                  >
                    {n.kind}
                  </span>
                  <span style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: 17, letterSpacing: '0.06em', color: C.text }}>{n.header}</span>
                  {n.model && (
                    <span style={{ marginLeft: 'auto', fontFamily: FONT.mono, fontSize: 13, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 8, padding: '4px 8px' }}>
                      {n.model}
                    </span>
                  )}
                </div>
                <div style={{ padding: '14px 18px' }}>
                  <div style={{ fontSize: 23, fontWeight: 600, color: C.text }}>{n.title}</div>
                  <div style={{ marginTop: 10, fontFamily: FONT.mono, fontSize: 15, color: C.muted, lineHeight: 1.5, height: 46, overflow: 'hidden' }}>{n.body}</div>
                </div>
                <div style={{ position: 'absolute', left: 18, right: 18, bottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: FONT.mono, fontSize: 14, letterSpacing: '0.16em', color: done ? C.tealLight : running ? C.amber : C.dim }}>
                    {done ? '✓ DONE' : running ? '● RUNNING' : 'IDLE'}
                  </span>
                  <span style={{ fontFamily: FONT.sans, fontSize: 15, fontWeight: 600, color: C.blue, background: 'rgba(91,157,245,0.12)', padding: '6px 14px', borderRadius: 8 }}>Run</span>
                </div>
                {running && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      bottom: 0,
                      height: 3,
                      width: `${tween(frame, [orch + 8 + i * 9, orch + 24 + i * 9]) * 100}%`,
                      background: C.tealLight,
                      boxShadow: `0 0 12px ${C.tealLight}`,
                    }}
                  />
                )}
                {/* ports */}
                {[
                  { l: -9, t: NH / 2 - 9 },
                  { l: NW - 9, t: NH / 2 - 9 },
                ].map((pp, k) => (
                  <span
                    key={k}
                    style={{ position: 'absolute', left: pp.l, top: pp.t, width: 18, height: 18, borderRadius: '50%', border: `3px solid ${C.tealLight}`, background: '#0a0d0e' }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* screen-space canvas chrome (toolbar + node palette like the real app) */}
      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 112,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 18px',
          borderRadius: 14,
          border: `1px solid ${C.line}`,
          background: 'rgba(10,12,13,0.88)',
          fontFamily: FONT.mono,
          fontSize: 15,
          color: C.muted,
          opacity: tween(frame, [6, 22]) * (1 - dive),
          transform: `translateY(${(1 - tween(frame, [6, 26])) * -30}px)`,
        }}
      >
        <span style={{ color: C.text, fontFamily: FONT.sans, fontWeight: 600 }}>Auth Review Pipeline</span>
        <span style={{ color: C.tealLight, border: `1px solid ${tealA(0.45)}`, background: tealA(0.1), padding: '3px 10px', borderRadius: 6 }}>Save</span>
        <span>V:Select</span>
        <span>H:Pan</span>
        <span>DEL:Remove</span>
      </div>
      <div style={{ position: 'absolute', right: 120, top: 200, display: 'flex', flexDirection: 'column', gap: 12, opacity: tween(frame, [10, 26]) * tween(frame, [orch - 16, orch], [1, 0]) }}>
        {(['SYS', 'PROMPT', 'ROUTER', 'SCRIPT', 'STORE', 'MERGE'] as NodeKind[]).map((k, i) => (
          <div
            key={k}
            style={{
              width: 60,
              height: 52,
              borderRadius: 12,
              border: `1px solid ${KIND_COLOR[k]}55`,
              background: `${KIND_COLOR[k]}12`,
              color: KIND_COLOR[k],
              fontFamily: FONT.mono,
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `translateX(${(1 - springAt(frame, 10 + i * 3, SPRING.ui)) * 80}px)`,
            }}
          >
            {k}
          </div>
        ))}
      </div>

      {/* run-all status chip */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 112,
          transform: `translateX(-50%) translateY(${(1 - springAt(frame, orch + 4, SPRING.ui)) * -40}px)`,
          opacity: frame >= orch ? tween(frame, [orch, orch + 10]) * (1 - dive) : 0,
          display: 'flex',
          gap: 18,
          alignItems: 'center',
          padding: '12px 22px',
          borderRadius: 14,
          border: `1px solid ${tealA(0.5)}`,
          background: 'rgba(8,37,34,0.9)',
          fontFamily: FONT.mono,
          fontSize: 16,
          color: C.tealLight,
          boxShadow: `0 0 40px ${tealA(0.35)}`,
        }}
      >
        <span>▶ RUN ALL</span>
        <span style={{ color: C.muted }}>6 nodes · 6 edges</span>
        <span>{frame >= orch + 8 + 5 * 9 + 16 ? '✓ COMPLETE' : 'executing…'}</span>
      </div>

      <Eyebrow at={6} index="03" label="BRANCHING CANVAS" style={{ position: 'absolute', left: 120, top: 52 }} exitAt={exit - 10} />
      <LightSweep at={exit - 4} dur={24} />
    </AbsoluteFill>
  );
};
