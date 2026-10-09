import React from 'react';
import { interpolate } from 'remotion';

interface BranchingCanvasShowcaseProps {
  frame: number;
}

// Cubic Bezier interpolation helper
function getBezierPoint(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  t: number
): [number, number] {
  const cx =
    Math.pow(1 - t, 3) * p0[0] +
    3 * Math.pow(1 - t, 2) * t * p1[0] +
    3 * (1 - t) * Math.pow(t, 2) * p2[0] +
    Math.pow(t, 3) * p3[0];
  const cy =
    Math.pow(1 - t, 3) * p0[1] +
    3 * Math.pow(1 - t, 2) * t * p1[1] +
    3 * (1 - t) * Math.pow(t, 2) * p2[1] +
    Math.pow(t, 3) * p3[1];
  return [cx, cy];
}

export const BranchingCanvasShowcase: React.FC<BranchingCanvasShowcaseProps> = ({ frame }) => {
  // Execution Stages:
  // Stage 1 (frame 25 - 90): Node 1 & 2 -> Node 3
  // Stage 2 (frame 90 - 165): Node 3 -> Node 4A & 4B
  // Stage 3 (frame 160 - 235): Node 4A & 4B -> Node 5
  const stage1Progress = interpolate(frame, [25, 85], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const stage2Progress = interpolate(frame, [90, 155], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const stage3Progress = interpolate(frame, [160, 225], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Animated pulse positions
  const pulse1Pos = getBezierPoint([280, 135], [330, 135], [330, 235], [375, 235], stage1Progress);
  const pulse2Pos = getBezierPoint([280, 375], [330, 375], [330, 285], [375, 285], stage1Progress);

  const pulse3APos = getBezierPoint([635, 235], [675, 235], [675, 135], [715, 135], stage2Progress);
  const pulse3BPos = getBezierPoint([635, 285], [675, 285], [675, 375], [715, 375], stage2Progress);

  const pulse4APos = getBezierPoint([960, 135], [990, 135], [990, 225], [1020, 225], stage3Progress);
  const pulse4BPos = getBezierPoint([960, 375], [990, 375], [990, 295], [1020, 295], stage3Progress);

  // Dynamic cinematic camera pan & zoom tracking across execution stages
  const canvasPanX = interpolate(frame, [0, 80, 160, 240, 290], [25, 5, -25, -55, -45], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const canvasPanY = interpolate(frame, [0, 120, 240, 290], [-6, 8, -6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const canvasZoom = interpolate(frame, [0, 100, 200, 290], [1.0, 1.04, 1.06, 1.03], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#070a10',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Space Grotesk', 'Inter', -apple-system, sans-serif",
        color: '#f8fafc',
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ======================================================== */}
      {/* 🛠️ TOP WORKSPACE TOOLBAR & BREADCRUMB                    */}
      {/* ======================================================== */}
      <div
        style={{
          height: '46px',
          backgroundColor: 'rgba(9, 13, 20, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px',
          zIndex: 30,
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Left: Breadcrumbs & Workflow Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '11px',
              color: '#94a3b8',
              fontWeight: 600,
            }}
          >
            ← Workspaces
          </div>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.02em' }}>
            Production Security & Schema DAG Pipeline
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 8px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontSize: '10px',
              color: '#34d399',
              fontWeight: 700,
            }}
          >
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 6px #10b981' }} />
            <span>AUTO-SYNCED</span>
          </div>
        </div>

        {/* Center: Canvas Tool Mode Pills */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '8px',
            padding: '2px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ padding: '4px 12px', borderRadius: '6px', backgroundColor: 'rgba(6, 182, 212, 0.2)', color: '#38bdf8', fontSize: '11px', fontWeight: 700 }}>
            Select
          </div>
          <div style={{ padding: '4px 12px', borderRadius: '6px', color: '#64748b', fontSize: '11px', fontWeight: 600 }}>
            Pan
          </div>
          <div style={{ padding: '4px 12px', borderRadius: '6px', color: '#64748b', fontSize: '11px', fontWeight: 600 }}>
            + Add Node
          </div>
        </div>

        {/* Right: Pipeline Execution Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              padding: '5px 14px',
              borderRadius: '8px',
              backgroundColor: frame >= 220 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(6, 182, 212, 0.2)',
              border: frame >= 220 ? '1px solid rgba(16, 185, 129, 0.6)' : '1px solid rgba(6, 182, 212, 0.6)',
              fontSize: '11px',
              fontWeight: 800,
              color: frame >= 220 ? '#a7f3d0' : '#bae6fd',
              boxShadow: frame >= 220 ? '0 0 15px rgba(16, 185, 129, 0.3)' : '0 0 15px rgba(6, 182, 212, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{frame >= 220 ? '✓ PIPELINE VERIFIED' : '⚡ RUNNING DAG...'}</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
            SCALE: 100%
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 🌐 CANVAS VIEWPORT (XYFLOW DOTTED GRID & NODES)         */}
      {/* ======================================================== */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          backgroundImage:
            'radial-gradient(circle, rgba(6, 182, 212, 0.22) 1.2px, transparent 1.2px)',
          backgroundSize: '24px 24px',
          backgroundPosition: `${canvasPanX}px ${canvasPanY}px`,
        }}
      >
        {/* Transform Container with subtle camera movement */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translate(${canvasPanX}px, ${canvasPanY}px) scale(${canvasZoom})`,
            transformOrigin: '40% 45%',
          }}
        >
          {/* ======================================================== */}
          {/* ⚡ SVG CONNECTING BEZIER EDGES & FLOWING PARTICLES        */}
          {/* ======================================================== */}
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
            <defs>
              <linearGradient id="edgeBlueToAmber" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="edgePurpleToAmber" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="edgeAmberToRose" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="edgeAmberToTeal" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="edgeRoseToEmerald" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="edgeTealToEmerald" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {/* Edge 1: Node 1 (SYS) -> Node 3 (EVAL) */}
            <path
              d="M 280 135 C 330 135, 330 235, 375 235"
              fill="none"
              stroke="url(#edgeBlueToAmber)"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              strokeDashoffset={-frame * 2.5}
            />

            {/* Edge 2: Node 2 (DATA) -> Node 3 (EVAL) */}
            <path
              d="M 280 375 C 330 375, 330 285, 375 285"
              fill="none"
              stroke="url(#edgePurpleToAmber)"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              strokeDashoffset={-frame * 2.5}
            />

            {/* Edge 3: Node 3 (EVAL) -> Node 4A (CODE Schema - Top Branch) */}
            <path
              d="M 635 235 C 675 235, 675 135, 715 135"
              fill="none"
              stroke="url(#edgeAmberToRose)"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              strokeDashoffset={-frame * 2.5}
            />

            {/* Edge 4: Node 3 (EVAL) -> Node 4B (ROUTE Threat - Bottom Branch) */}
            <path
              d="M 635 285 C 675 285, 675 375, 715 375"
              fill="none"
              stroke="url(#edgeAmberToTeal)"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              strokeDashoffset={-frame * 2.5}
            />

            {/* Edge 5: Node 4A (CODE) -> Node 5 (OUT Terminal Artifact) */}
            <path
              d="M 960 135 C 990 135, 990 225, 1020 225"
              fill="none"
              stroke="url(#edgeRoseToEmerald)"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              strokeDashoffset={-frame * 2.5}
            />

            {/* Edge 6: Node 4B (ROUTE) -> Node 5 (OUT Terminal Artifact) */}
            <path
              d="M 960 375 C 990 375, 990 295, 1020 295"
              fill="none"
              stroke="url(#edgeTealToEmerald)"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              strokeDashoffset={-frame * 2.5}
            />

            {/* Active Data Pulse Particles */}
            {stage1Progress > 0 && stage1Progress < 1 && (
              <>
                <circle cx={pulse1Pos[0]} cy={pulse1Pos[1]} r="5" fill="#38bdf8" filter="drop-shadow(0 0 8px #06b6d4)" />
                <circle cx={pulse2Pos[0]} cy={pulse2Pos[1]} r="5" fill="#c084fc" filter="drop-shadow(0 0 8px #a855f7)" />
              </>
            )}

            {stage2Progress > 0 && stage2Progress < 1 && (
              <>
                <circle cx={pulse3APos[0]} cy={pulse3APos[1]} r="5" fill="#fb7185" filter="drop-shadow(0 0 8px #f43f5e)" />
                <circle cx={pulse3BPos[0]} cy={pulse3BPos[1]} r="5" fill="#2dd4bf" filter="drop-shadow(0 0 8px #14b8a6)" />
              </>
            )}

            {stage3Progress > 0 && stage3Progress < 1 && (
              <>
                <circle cx={pulse4APos[0]} cy={pulse4APos[1]} r="5" fill="#34d399" filter="drop-shadow(0 0 8px #10b981)" />
                <circle cx={pulse4BPos[0]} cy={pulse4BPos[1]} r="5" fill="#34d399" filter="drop-shadow(0 0 8px #10b981)" />
              </>
            )}
          </svg>

          {/* ======================================================== */}
          {/* 📦 NODE 1: SYSTEM PERSONA (SYS - BLUE)                   */}
          {/* ======================================================== */}
          <div
            style={{
              position: 'absolute',
              left: '40px',
              top: '50px',
              width: '240px',
              borderRadius: '14px',
              backgroundColor: 'rgba(10, 14, 24, 0.94)',
              border: '1.5px solid rgba(59, 130, 246, 0.6)',
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.8), 0 0 25px rgba(59, 130, 246, 0.25)',
              padding: '14px',
              zIndex: 20,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', fontSize: '10px', fontWeight: 800 }}>
                  SYS
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#93c5fd' }}>SYSTEM PERSONA</span>
              </div>
              <span style={{ fontSize: '9px', color: '#64748b' }}>Gemini 2.5 Flash</span>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
              Security Architect Persona
            </div>
            {/* Code Box */}
            <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', padding: '8px', borderRadius: '6px', fontSize: '10px', fontFamily: "'Fira Code', monospace", color: '#cbd5e1', lineHeight: 1.4, border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '8px' }}>
              &lt;system_persona&gt; Principal Security Architect &lt;/system_persona&gt;
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: '#38bdf8', fontWeight: 700 }}>
              <span>STATE: ACTIVE</span>
              <span>OUT: [AST Policy]</span>
            </div>
            {/* Output Port */}
            <div style={{ position: 'absolute', right: '-6px', top: '85px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#3b82f6', border: '2px solid #ffffff', boxShadow: '0 0 8px #3b82f6' }} />
          </div>

          {/* ======================================================== */}
          {/* 📦 NODE 2: DATA INGESTION (DATA - PURPLE)                */}
          {/* ======================================================== */}
          <div
            style={{
              position: 'absolute',
              left: '40px',
              top: '290px',
              width: '240px',
              borderRadius: '14px',
              backgroundColor: 'rgba(10, 14, 24, 0.94)',
              border: '1.5px solid rgba(168, 85, 247, 0.6)',
              boxShadow: '0 16px 36px rgba(0, 0, 0, 0.8), 0 0 25px rgba(168, 85, 247, 0.25)',
              padding: '14px',
              zIndex: 20,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', fontSize: '10px', fontWeight: 800 }}>
                  DATA
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#d8b4fe' }}>DATA STORE</span>
              </div>
              <span style={{ fontSize: '9px', color: '#64748b' }}>JSON Payload</span>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
              Ingress Request Stream
            </div>
            {/* Code Box */}
            <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', padding: '8px', borderRadius: '6px', fontSize: '10px', fontFamily: "'Fira Code', monospace", color: '#cbd5e1', lineHeight: 1.4, border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '8px' }}>
              {`{ endpoint: "/v1/compile", auth: "Bearer ***", strict: true }`}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: '#c084fc', fontWeight: 700 }}>
              <span>STATE: INGESTED</span>
              <span>OUT: [Raw Stream]</span>
            </div>
            {/* Output Port */}
            <div style={{ position: 'absolute', right: '-6px', top: '85px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#a855f7', border: '2px solid #ffffff', boxShadow: '0 0 8px #a855f7' }} />
          </div>

          {/* ======================================================== */}
          {/* 📦 NODE 3: AST INJECTION FIREWALL (EVAL - AMBER)         */}
          {/* ======================================================== */}
          <div
            style={{
              position: 'absolute',
              left: '375px',
              top: '155px',
              width: '260px',
              borderRadius: '14px',
              backgroundColor: 'rgba(12, 16, 26, 0.95)',
              border: `1.5px solid ${frame >= 80 ? 'rgba(245, 158, 11, 0.85)' : 'rgba(245, 158, 11, 0.5)'}`,
              boxShadow: frame >= 80 ? '0 20px 45px rgba(0, 0, 0, 0.9), 0 0 35px rgba(245, 158, 11, 0.35)' : '0 16px 36px rgba(0, 0, 0, 0.8)',
              padding: '14px',
              zIndex: 22,
            }}
          >
            {/* Input Ports */}
            <div style={{ position: 'absolute', left: '-6px', top: '80px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f59e0b', border: '2px solid #ffffff' }} />
            <div style={{ position: 'absolute', left: '-6px', top: '130px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f59e0b', border: '2px solid #ffffff' }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', fontSize: '10px', fontWeight: 800 }}>
                  EVAL
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#fde68a' }}>INJECTION FIREWALL</span>
              </div>
              <span style={{ fontSize: '9px', color: '#f59e0b', fontWeight: 700 }}>Groq Llama 3.1 70B</span>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
              AST & Threat Evaluator
            </div>
            {/* Code Box */}
            <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', padding: '8px', borderRadius: '6px', fontSize: '10px', fontFamily: "'Fira Code', monospace", color: '#fbbf24', lineHeight: 1.4, border: '1px solid rgba(245, 158, 11, 0.2)', marginBottom: '8px' }}>
              <div>SCAN: 42 OWASP Attack Vectors</div>
              <div style={{ color: '#34d399', fontWeight: 700 }}>VERDICT: 0 VULNERABILITIES</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: '#fbbf24', fontWeight: 700 }}>
              <span>{frame >= 80 ? '✓ 100% DEFENSE PASS' : '⚡ SCANNING AST...'}</span>
              <span>BRANCH: PARALLEL (2x)</span>
            </div>

            {/* Output Ports (Dual branching) */}
            <div style={{ position: 'absolute', right: '-6px', top: '80px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f59e0b', border: '2px solid #ffffff', boxShadow: '0 0 8px #f59e0b' }} />
            <div style={{ position: 'absolute', right: '-6px', top: '130px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f59e0b', border: '2px solid #ffffff', boxShadow: '0 0 8px #f59e0b' }} />
          </div>

          {/* ======================================================== */}
          {/* 📦 NODE 4A: SCHEMA COMPILER (CODE - ROSE) [TOP BRANCH]   */}
          {/* ======================================================== */}
          <div
            style={{
              position: 'absolute',
              left: '715px',
              top: '50px',
              width: '245px',
              borderRadius: '14px',
              backgroundColor: 'rgba(10, 14, 24, 0.94)',
              border: `1.5px solid ${frame >= 140 ? 'rgba(244, 63, 94, 0.85)' : 'rgba(244, 63, 94, 0.5)'}`,
              boxShadow: frame >= 140 ? '0 16px 36px rgba(0, 0, 0, 0.8), 0 0 25px rgba(244, 63, 94, 0.3)' : '0 16px 36px rgba(0, 0, 0, 0.8)',
              padding: '14px',
              zIndex: 20,
            }}
          >
            {/* Input Port */}
            <div style={{ position: 'absolute', left: '-6px', top: '85px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f43f5e', border: '2px solid #ffffff' }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(244, 63, 94, 0.2)', color: '#fb7185', fontSize: '10px', fontWeight: 800 }}>
                  CODE
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#fecdd3' }}>ZOD COMPILER</span>
              </div>
              <span style={{ fontSize: '9px', color: '#64748b' }}>Branch A</span>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
              Contract Schema Generator
            </div>
            {/* Code Box */}
            <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', padding: '8px', borderRadius: '6px', fontSize: '10px', fontFamily: "'Fira Code', monospace", color: '#fda4af', lineHeight: 1.4, border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '8px' }}>
              {`const Schema = z.object({\n  deterministic: z.boolean()\n});`}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: '#f43f5e', fontWeight: 700 }}>
              <span>{frame >= 140 ? '✓ SCHEMA VALID' : '⚙️ SYNTHESIZING...'}</span>
              <span>OUT: [Zod AST]</span>
            </div>
            {/* Output Port */}
            <div style={{ position: 'absolute', right: '-6px', top: '85px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f43f5e', border: '2px solid #ffffff', boxShadow: '0 0 8px #f43f5e' }} />
          </div>

          {/* ======================================================== */}
          {/* 📦 NODE 4B: THREAT AUDIT LOG (ROUTE - TEAL) [BOTTOM]     */}
          {/* ======================================================== */}
          <div
            style={{
              position: 'absolute',
              left: '715px',
              top: '290px',
              width: '245px',
              borderRadius: '14px',
              backgroundColor: 'rgba(10, 14, 24, 0.94)',
              border: `1.5px solid ${frame >= 140 ? 'rgba(20, 184, 166, 0.85)' : 'rgba(20, 184, 166, 0.5)'}`,
              boxShadow: frame >= 140 ? '0 16px 36px rgba(0, 0, 0, 0.8), 0 0 25px rgba(20, 184, 166, 0.3)' : '0 16px 36px rgba(0, 0, 0, 0.8)',
              padding: '14px',
              zIndex: 20,
            }}
          >
            {/* Input Port */}
            <div style={{ position: 'absolute', left: '-6px', top: '85px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#14b8a6', border: '2px solid #ffffff' }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(20, 184, 166, 0.2)', color: '#2dd4bf', fontSize: '10px', fontWeight: 800 }}>
                  ROUTE
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#99f6e4' }}>ZERO-TRUST LOG</span>
              </div>
              <span style={{ fontSize: '9px', color: '#64748b' }}>Branch B</span>
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
              Audit Telemetry Sync
            </div>
            {/* Code Box */}
            <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', padding: '8px', borderRadius: '6px', fontSize: '10px', fontFamily: "'Fira Code', monospace", color: '#5eead4', lineHeight: 1.4, border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '8px' }}>
              {`INSERT INTO telemetry_logs\n(p99_latency_ms, pass_rate)\nVALUES (42, 100);`}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: '#14b8a6', fontWeight: 700 }}>
              <span>{frame >= 140 ? '✓ NEON SYNCED' : '🛡️ AUDITING...'}</span>
              <span>OUT: [Telemetry]</span>
            </div>
            {/* Output Port */}
            <div style={{ position: 'absolute', right: '-6px', top: '85px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#14b8a6', border: '2px solid #ffffff', boxShadow: '0 0 8px #14b8a6' }} />
          </div>

          {/* ======================================================== */}
          {/* 📦 NODE 5: TERMINAL OUTPUT (OUT - EMERALD) [CONVERGENCE] */}
          {/* ======================================================== */}
          <div
            style={{
              position: 'absolute',
              left: '1020px',
              top: '140px',
              width: '215px',
              borderRadius: '14px',
              backgroundColor: 'rgba(8, 16, 14, 0.96)',
              border: `2px solid ${frame >= 210 ? 'rgba(16, 185, 129, 0.95)' : 'rgba(16, 185, 129, 0.45)'}`,
              boxShadow: frame >= 210 ? '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 45px rgba(16, 185, 129, 0.45)' : '0 16px 36px rgba(0, 0, 0, 0.8)',
              padding: '14px',
              zIndex: 25,
            }}
          >
            {/* Input Ports (Dual Converging inputs) */}
            <div style={{ position: 'absolute', left: '-6px', top: '85px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981', border: '2px solid #ffffff' }} />
            <div style={{ position: 'absolute', left: '-6px', top: '155px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981', border: '2px solid #ffffff' }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontSize: '10px', fontWeight: 800 }}>
                  OUT
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#a7f3d0' }}>TERMINAL</span>
              </div>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
            </div>

            <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
              Compiled Output Artifact
            </div>

            {/* CRT Terminal Screen */}
            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                fontSize: '10px',
                fontFamily: "'Fira Code', monospace",
                color: '#34d399',
                lineHeight: 1.5,
                marginBottom: '10px',
              }}
            >
              <div>● STATUS: 200 OK</div>
              <div>● THREATS: 0 DETECTED</div>
              <div>● LATENCY: 42ms (P99)</div>
              <div>● SCHEMA: VALID ZOD</div>
              <div style={{ color: '#6ee7b7', fontWeight: 700, marginTop: '4px' }}>
                {frame >= 210 ? '✓ READY FOR CODE' : '⏳ COMPILING...'}
              </div>
            </div>

            <div
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                backgroundColor: frame >= 210 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                border: frame >= 210 ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                color: frame >= 210 ? '#f0fdf4' : '#94a3b8',
                fontSize: '10px',
                fontWeight: 800,
                textAlign: 'center',
                letterSpacing: '0.06em',
              }}
            >
              {frame >= 210 ? 'EXPORTED TO APP.PY' : 'PROCESSING PIPELINE'}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* 🎛️ RIGHT RAIL: NODE PALETTE DOCK (8 CUSTOM NODE TYPES)     */}
        {/* ======================================================== */}
        <div
          style={{
            position: 'absolute',
            right: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backgroundColor: 'rgba(9, 13, 21, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '12px',
            padding: '8px 6px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
            zIndex: 35,
          }}
        >
          {[
            { tag: 'SYS', color: '#3b82f6' },
            { tag: 'PROMPT', color: '#f59e0b' },
            { tag: 'DATA', color: '#a855f7' },
            { tag: 'BRANCH', color: '#eab308' },
            { tag: 'CODE', color: '#f43f5e' },
            { tag: 'MERGE', color: '#14b8a6' },
            { tag: 'EVAL', color: '#8b5cf6' },
            { tag: 'OUT', color: '#10b981' },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${item.color}55`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 800,
                color: item.color,
                boxShadow: `0 0 8px ${item.color}22`,
              }}
            >
              {item.tag.slice(0, 3)}
            </div>
          ))}
        </div>

        {/* ======================================================== */}
        {/* 🗺️ MINIMAP RADAR OVERLAY (BOTTOM-RIGHT)                  */}
        {/* ======================================================== */}
        <div
          style={{
            position: 'absolute',
            right: '65px',
            bottom: '16px',
            width: '130px',
            height: '75px',
            backgroundColor: 'rgba(9, 13, 21, 0.9)',
            border: '1px solid rgba(6, 182, 212, 0.35)',
            borderRadius: '10px',
            backdropFilter: 'blur(12px)',
            overflow: 'hidden',
            padding: '6px',
            zIndex: 30,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.8)',
          }}
        >
          <div style={{ fontSize: '8px', fontWeight: 800, color: '#38bdf8', marginBottom: '4px', letterSpacing: '0.08em' }}>
            MINIMAP · 5 NODES
          </div>
          {/* Mini node outlines */}
          <div style={{ position: 'relative', width: '100%', height: '50px' }}>
            {/* Mini N1 */}
            <div style={{ position: 'absolute', left: '4px', top: '4px', width: '22px', height: '14px', borderRadius: '2px', backgroundColor: '#3b82f6' }} />
            {/* Mini N2 */}
            <div style={{ position: 'absolute', left: '4px', top: '28px', width: '22px', height: '14px', borderRadius: '2px', backgroundColor: '#a855f7' }} />
            {/* Mini N3 */}
            <div style={{ position: 'absolute', left: '38px', top: '16px', width: '24px', height: '18px', borderRadius: '2px', backgroundColor: '#f59e0b' }} />
            {/* Mini N4A */}
            <div style={{ position: 'absolute', left: '72px', top: '4px', width: '22px', height: '14px', borderRadius: '2px', backgroundColor: '#f43f5e' }} />
            {/* Mini N4B */}
            <div style={{ position: 'absolute', left: '72px', top: '28px', width: '22px', height: '14px', borderRadius: '2px', backgroundColor: '#14b8a6' }} />
            {/* Mini N5 */}
            <div style={{ position: 'absolute', left: '100px', top: '14px', width: '20px', height: '22px', borderRadius: '2px', backgroundColor: '#10b981' }} />

            {/* Active Camera Viewport box */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                border: '1px solid rgba(255, 255, 255, 0.6)',
                borderRadius: '4px',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
