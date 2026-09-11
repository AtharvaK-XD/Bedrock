import { useState } from 'react';
import { 
  Activity, 
  Zap, 
  Play, 
  Pause, 
  Cpu, 
  CheckCircle2
} from 'lucide-react';

interface NodeInfo {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  glowColor: string;
  metricPrimary: string;
  metricSecondary: string;
  box: { x: number; y: number; w: number; h: number };
  inPorts?: { x: number; y: number }[];
  outPorts?: { x: number; y: number }[];
  details: {
    model: string;
    engine: string;
    p99Latency: string;
    throughput: string;
    errorRate: string;
    queueDepth: number;
    activeConns: number;
  };
}

const NODES: NodeInfo[] = [
  {
    id: 'INGEST',
    title: 'INGEST',
    subtitle: 'API_GATEWAY_V1',
    color: '#38bdf8', // sky-400
    glowColor: 'rgba(56, 189, 248, 0.5)',
    metricPrimary: '4.2k req/s',
    metricSecondary: '99.98% OK',
    box: { x: 50, y: 135, w: 135, h: 70 },
    outPorts: [{ x: 185, y: 170 }],
    details: {
      model: 'edge-gateway-envoy',
      engine: 'Rust / Tokio v1.35',
      p99Latency: '8ms',
      throughput: '4,200 req/s',
      errorRate: '0.01%',
      queueDepth: 14,
      activeConns: 842,
    },
  },
  {
    id: 'ROUTER',
    title: 'ROUTER',
    subtitle: 'DYNAMIC_DISPATCH',
    color: '#e4e4e7', // zinc-200
    glowColor: 'rgba(228, 228, 231, 0.4)',
    metricPrimary: '12ms latency',
    metricSecondary: 'AUTO_WEIGHT',
    box: { x: 265, y: 135, w: 135, h: 70 },
    inPorts: [{ x: 265, y: 170 }],
    outPorts: [
      { x: 400, y: 155 }, // to GPT-4
      { x: 400, y: 185 }, // to Claude-3
    ],
    details: {
      model: 'bedrock-smart-router-v2',
      engine: 'Semantic Embed / Vector Sort',
      p99Latency: '14ms',
      throughput: '14,210 tok/s',
      errorRate: '0.00%',
      queueDepth: 3,
      activeConns: 1250,
    },
  },
  {
    id: 'GPT-4',
    title: 'GPT-4O',
    subtitle: 'OPENAI / 128K',
    color: '#10b981', // emerald-500
    glowColor: 'rgba(16, 185, 129, 0.5)',
    metricPrimary: '843ms',
    metricSecondary: '8.4k tok/s',
    box: { x: 495, y: 55, w: 155, h: 70 },
    inPorts: [{ x: 495, y: 90 }],
    outPorts: [{ x: 650, y: 90 }],
    details: {
      model: 'gpt-4o-2024-08-06',
      engine: 'OpenAI Direct API',
      p99Latency: '843ms',
      throughput: '8,420 tok/s',
      errorRate: '0.02%',
      queueDepth: 6,
      activeConns: 412,
    },
  },
  {
    id: 'CLAUDE-3',
    title: 'CLAUDE-3.5',
    subtitle: 'ANTHROPIC / 200K',
    color: '#f59e0b', // amber-500
    glowColor: 'rgba(245, 158, 11, 0.5)',
    metricPrimary: '1,210ms',
    metricSecondary: '5.8k tok/s',
    box: { x: 495, y: 215, w: 155, h: 70 },
    inPorts: [{ x: 495, y: 250 }],
    outPorts: [{ x: 650, y: 250 }],
    details: {
      model: 'claude-3-5-sonnet-20241022',
      engine: 'Anthropic Bedrock v2',
      p99Latency: '1,210ms',
      throughput: '5,790 tok/s',
      errorRate: '0.01%',
      queueDepth: 8,
      activeConns: 320,
    },
  },
  {
    id: 'EGRESS',
    title: 'EGRESS',
    subtitle: 'STREAM_SINK',
    color: '#a855f7', // purple-500
    glowColor: 'rgba(168, 85, 247, 0.5)',
    metricPrimary: '242ms P99',
    metricSecondary: 'STREAM_OK',
    box: { x: 740, y: 135, w: 135, h: 70 },
    inPorts: [
      { x: 740, y: 155 }, // from GPT-4
      { x: 740, y: 185 }, // from Claude-3
    ],
    outPorts: [{ x: 875, y: 170 }],
    details: {
      model: 'sse-streaming-multiplexer',
      engine: 'HTTP/2 Chunked Pipe',
      p99Latency: '242ms',
      throughput: '14,210 tok/s',
      errorRate: '0.00%',
      queueDepth: 0,
      activeConns: 1250,
    },
  },
];

interface EdgePath {
  id: string;
  source: string;
  target: string;
  d: string;
  color: string;
  speed: number;
}

const EDGES: EdgePath[] = [
  {
    id: 'path-ingest-router',
    source: 'INGEST',
    target: 'ROUTER',
    d: 'M 185 170 L 265 170',
    color: '#38bdf8',
    speed: 1.4,
  },
  {
    id: 'path-router-gpt',
    source: 'ROUTER',
    target: 'GPT-4',
    d: 'M 400 155 C 450 155, 445 90, 495 90',
    color: '#10b981',
    speed: 1.8,
  },
  {
    id: 'path-router-claude',
    source: 'ROUTER',
    target: 'CLAUDE-3',
    d: 'M 400 185 C 450 185, 445 250, 495 250',
    color: '#f59e0b',
    speed: 1.6,
  },
  {
    id: 'path-gpt-egress',
    source: 'GPT-4',
    target: 'EGRESS',
    d: 'M 650 90 C 700 90, 690 155, 740 155',
    color: '#10b981',
    speed: 1.8,
  },
  {
    id: 'path-claude-egress',
    source: 'CLAUDE-3',
    target: 'EGRESS',
    d: 'M 650 250 C 700 250, 690 185, 740 185',
    color: '#f59e0b',
    speed: 1.6,
  },
];

export function NetworkTopology2D() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [routeFilter, setRouteFilter] = useState<'ALL' | 'GPT-4' | 'CLAUDE-3'>('ALL');
  const [isPaused, setIsPaused] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [burstKey, setBurstKey] = useState<number>(0);

  const activeNodeId = hoveredNode || selectedNode;
  const activeNode = NODES.find((n) => n.id === activeNodeId) || null;

  const handleBurst = () => {
    setBurstKey((prev) => prev + 1);
  };

  const isEdgeActive = (edge: EdgePath) => {
    if (routeFilter === 'GPT-4') {
      if (edge.source === 'CLAUDE-3' || edge.target === 'CLAUDE-3') return false;
    }
    if (routeFilter === 'CLAUDE-3') {
      if (edge.source === 'GPT-4' || edge.target === 'GPT-4') return false;
    }
    if (activeNodeId) {
      return edge.source === activeNodeId || edge.target === activeNodeId;
    }
    return true;
  };

  return (
    <div className="relative w-full bg-[#050608] border border-white/10 overflow-hidden flex flex-col font-sans text-xs text-white/80 select-none shadow-[0_24px_60px_rgba(0,0,0,0.95)] rounded-3xl group">
      {/* Ambient top edge highlight for glass reflection */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none z-10" />

      {/* Top HUD Controls Bar */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-white/[0.08] bg-[#090b10]/90 backdrop-blur-xl gap-3">
        {/* Left: Monitor Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              {!isPaused && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isPaused ? 'bg-amber-400' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'}`}></span>
            </span>
            <span className="text-xs font-semibold tracking-wider text-white font-display uppercase">2D Topology Flow</span>
          </div>
          <span className="hidden sm:inline-block text-white/20">|</span>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-white/50">
            <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
            {isPaused ? 'Paused' : 'Realtime Routing'}
          </span>
          <span className="hidden md:inline-flex items-center text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shadow-sm">
            60 FPS SVG
          </span>
        </div>

        {/* Right: Route Filtering & Playback Controls */}
        <div className="flex items-center gap-2">
          {/* Route Filters */}
          <div className="flex items-center border border-white/10 p-0.5 rounded-xl bg-black/60 backdrop-blur-md text-[11px]">
            {(['ALL', 'GPT-4', 'CLAUDE-3'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setRouteFilter(mode)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  routeFilter === mode
                    ? 'bg-white/15 text-white shadow-sm font-semibold'
                    : 'text-white/50 hover:text-white/90 hover:bg-white/5'
                }`}
              >
                {mode === 'ALL' ? 'All Routes' : mode === 'GPT-4' ? 'GPT-4o' : 'Claude 3.5'}
              </button>
            ))}
          </div>

          {/* Speed Toggle */}
          <button
            onClick={() => setSpeedMultiplier((prev) => (prev === 1 ? 1.5 : prev === 1.5 ? 2.5 : 1))}
            title="Cycle simulation speed"
            className="text-xs border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] px-2.5 py-1 rounded-xl text-white/70 hover:text-white transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono text-[11px]">{speedMultiplier}x</span>
          </button>

          {/* Pause / Play */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? 'Resume live simulation' : 'Pause simulation'}
            className="text-xs border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] px-2.5 py-1 rounded-xl text-white/70 hover:text-white transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
            <span className="hidden sm:inline text-[11px] font-medium">{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          {/* Burst Trigger */}
          <button
            onClick={handleBurst}
            title="Inject high-volume traffic burst"
            className="text-xs border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1 rounded-xl text-cyan-300 transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.15)] active:scale-95"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="hidden sm:inline text-[11px] font-semibold tracking-wide">BURST</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="relative w-full overflow-x-auto overflow-y-hidden bg-[#030305] flex items-center justify-center p-3 sm:p-5 min-h-[340px]">
        <svg
          viewBox="0 0 920 340"
          className="w-full h-auto max-w-[920px] select-none"
          style={{ minWidth: '720px' }}
        >
          <defs>
            {/* Dark Matrix Grid Background */}
            <pattern id="matrix-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="0.8" fill="rgba(255, 255, 255, 0.06)" />
            </pattern>

            {/* Glowing Drop Shadows */}
            <filter id="glow-blue" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.8" />
            </filter>
            <filter id="glow-emerald" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#10b981" floodOpacity="0.8" />
            </filter>
            <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f59e0b" floodOpacity="0.8" />
            </filter>
            <filter id="glow-white" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#ffffff" floodOpacity="0.7" />
            </filter>
            <filter id="glow-purple" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#a855f7" floodOpacity="0.8" />
            </filter>

            {/* Deep Obsidian Black Node Gradients */}
            <linearGradient id="node-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0f1118" stopOpacity="0.98" />
              <stop offset="100%" stopColor="#050609" stopOpacity="0.98" />
            </linearGradient>
            <linearGradient id="node-sheen" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
            </linearGradient>

            {/* Edge Paths Definitions for packet animations */}
            {EDGES.map((edge) => (
              <path key={`def-${edge.id}`} id={edge.id} d={edge.d} fill="none" />
            ))}
          </defs>

          {/* Grid Pattern Fill */}
          <rect width="920" height="340" fill="url(#matrix-grid)" />

          {/* Background Stage Columns (Logical Pipeline Zones) */}
          <g opacity="0.05">
            <line x1="225" y1="15" x2="225" y2="325" stroke="#ffffff" strokeDasharray="3 3" />
            <line x1="450" y1="15" x2="450" y2="325" stroke="#ffffff" strokeDasharray="3 3" />
            <line x1="695" y1="15" x2="695" y2="325" stroke="#ffffff" strokeDasharray="3 3" />
          </g>

          <g opacity="0.4" fontSize="8.5" fill="#ffffff" letterSpacing="0.08em" fontFamily="Inter, sans-serif" fontWeight="500">
            <text x="50" y="28">STAGE 01 · INGESTION</text>
            <text x="265" y="28">STAGE 02 · ROUTING</text>
            <text x="495" y="28">STAGE 03 · INFERENCE CLUSTER</text>
            <text x="740" y="28">STAGE 04 · DISPATCH SINK</text>
          </g>

          {/* EDGES: Base Wire & Active Glow */}
          {EDGES.map((edge) => {
            const active = isEdgeActive(edge);
            const isHoveredEdge =
              activeNodeId && (edge.source === activeNodeId || edge.target === activeNodeId);

            return (
              <g key={`edge-group-${edge.id}`}>
                {/* Outer halo when active or connected */}
                {isHoveredEdge && (
                  <path
                    d={edge.d}
                    fill="none"
                    stroke={edge.color}
                    strokeWidth="5"
                    strokeOpacity="0.2"
                  />
                )}

                {/* Base connection wire */}
                <path
                  d={edge.d}
                  fill="none"
                  stroke={active ? edge.color : '#ffffff'}
                  strokeWidth={active ? '2' : '1'}
                  strokeOpacity={active ? (isHoveredEdge ? 0.9 : 0.45) : 0.08}
                  strokeDasharray={active ? 'none' : '4 4'}
                  className="transition-all duration-300"
                />

                {/* Dash stream pulse overlay */}
                {active && !isPaused && (
                  <path
                    d={edge.d}
                    fill="none"
                    stroke={edge.color}
                    strokeWidth="1.5"
                    strokeOpacity="0.7"
                    strokeDasharray="6 14"
                    className="animate-pulse"
                  />
                )}
              </g>
            );
          })}

          {/* ANIMATED PACKETS (SVG Native animateMotion) */}
          {!isPaused &&
            EDGES.map((edge) => {
              const active = isEdgeActive(edge);
              if (!active) return null;

              const baseDur = edge.speed / speedMultiplier;
              const filterId =
                edge.color === '#38bdf8'
                  ? 'url(#glow-blue)'
                  : edge.color === '#10b981'
                  ? 'url(#glow-emerald)'
                  : edge.color === '#f59e0b'
                  ? 'url(#glow-amber)'
                  : 'url(#glow-purple)';

              return (
                <g key={`packets-${edge.id}-${burstKey}`}>
                  {/* Packet 1 */}
                  <g>
                    {/* Glow halo */}
                    <circle r="6" fill={edge.color} opacity="0.35">
                      <animateMotion
                        dur={`${baseDur}s`}
                        repeatCount="indefinite"
                        begin="0s"
                        path={edge.d}
                      />
                    </circle>
                    {/* Core particle */}
                    <circle r="3" fill="#ffffff" filter={filterId}>
                      <animateMotion
                        dur={`${baseDur}s`}
                        repeatCount="indefinite"
                        begin="0s"
                        path={edge.d}
                      />
                    </circle>
                  </g>

                  {/* Packet 2 (staggered delay) */}
                  <g>
                    <circle r="6" fill={edge.color} opacity="0.35">
                      <animateMotion
                        dur={`${baseDur}s`}
                        repeatCount="indefinite"
                        begin={`${baseDur * 0.5}s`}
                        path={edge.d}
                      />
                    </circle>
                    <circle r="3" fill={edge.color} filter={filterId}>
                      <animateMotion
                        dur={`${baseDur}s`}
                        repeatCount="indefinite"
                        begin={`${baseDur * 0.5}s`}
                        path={edge.d}
                      />
                    </circle>
                  </g>

                  {/* Extra burst packet if burst triggered */}
                  {burstKey > 0 && (
                    <g>
                      <circle r="4.5" fill="#ffffff" filter={filterId}>
                        <animateMotion
                          dur={`${baseDur * 0.7}s`}
                          repeatCount="indefinite"
                          begin={`${baseDur * 0.25}s`}
                          path={edge.d}
                        />
                      </circle>
                    </g>
                  )}
                </g>
              );
            })}

          {/* NODES */}
          {NODES.map((node) => {
            const isHovered = hoveredNode === node.id;
            const isSelected = selectedNode === node.id;
            const isFocused = isHovered || isSelected;

            // Route filter dimming
            let isDimmed = false;
            if (routeFilter === 'GPT-4' && node.id === 'CLAUDE-3') isDimmed = true;
            if (routeFilter === 'CLAUDE-3' && node.id === 'GPT-4') isDimmed = true;

            return (
              <g
                key={`node-${node.id}`}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                className="cursor-pointer transition-transform duration-200"
                style={{
                  opacity: isDimmed ? 0.25 : 1,
                  filter: isFocused ? `drop-shadow(0 0 16px ${node.glowColor})` : 'none',
                }}
              >
                {/* Card Outer Box with Curved Corners */}
                <rect
                  x={node.box.x}
                  y={node.box.y}
                  width={node.box.w}
                  height={node.box.h}
                  rx="14"
                  ry="14"
                  fill="url(#node-gradient)"
                  stroke={isFocused ? node.color : 'rgba(255, 255, 255, 0.12)'}
                  strokeWidth={isFocused ? '1.5' : '1'}
                  className="transition-colors duration-200"
                />

                {/* Inner Sheen Top Highlight */}
                <rect
                  x={node.box.x}
                  y={node.box.y}
                  width={node.box.w}
                  height={node.box.h}
                  rx="14"
                  ry="14"
                  fill="url(#node-sheen)"
                  pointerEvents="none"
                />

                {/* Left accent indicator bar */}
                <rect
                  x={node.box.x + 3}
                  y={node.box.y + 12}
                  width="3"
                  height={node.box.h - 24}
                  rx="1.5"
                  fill={node.color}
                />

                {/* Status Dot */}
                <circle
                  cx={node.box.x + 20}
                  cy={node.box.y + 22}
                  r="3.5"
                  fill={node.color}
                />
                {!isPaused && (
                  <circle
                    cx={node.box.x + 20}
                    cy={node.box.y + 22}
                    r="6"
                    stroke={node.color}
                    strokeWidth="1"
                    strokeOpacity="0.4"
                    fill="none"
                  >
                    <animate
                      attributeName="r"
                      values="4;8;4"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="stroke-opacity"
                      values="0.6;0;0.6"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Title */}
                <text
                  x={node.box.x + 32}
                  y={node.box.y + 26}
                  fill="#ffffff"
                  fontSize="12.5"
                  fontWeight="600"
                  letterSpacing="0.02em"
                  fontFamily="Inter, -apple-system, sans-serif"
                >
                  {node.title}
                </text>

                {/* Subtitle / Engine */}
                <text
                  x={node.box.x + 18}
                  y={node.box.y + 42}
                  fill="rgba(255, 255, 255, 0.5)"
                  fontSize="9"
                  letterSpacing="0.02em"
                  fontFamily="Inter, -apple-system, sans-serif"
                >
                  {node.subtitle}
                </text>

                {/* Metric pill */}
                <rect
                  x={node.box.x + 14}
                  y={node.box.y + 48}
                  width={node.box.w - 28}
                  height="16"
                  rx="6"
                  fill="rgba(255, 255, 255, 0.04)"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="0.8"
                />
                <text
                  x={node.box.x + 20}
                  y={node.box.y + 60}
                  fill={node.color}
                  fontSize="8.5"
                  fontWeight="600"
                  fontFamily="Fira Code, monospace"
                >
                  {node.metricPrimary}
                </text>
                <text
                  x={node.box.x + node.box.w - 20}
                  y={node.box.y + 60}
                  textAnchor="end"
                  fill="rgba(255, 255, 255, 0.55)"
                  fontSize="8"
                  fontFamily="Fira Code, monospace"
                >
                  {node.metricSecondary}
                </text>

                {/* Input Ports */}
                {node.inPorts?.map((port, i) => (
                  <g key={`in-${node.id}-${i}`}>
                    <circle
                      cx={port.x}
                      cy={port.y}
                      r="4"
                      fill="#050505"
                      stroke={node.color}
                      strokeWidth="1.5"
                    />
                    <circle cx={port.x} cy={port.y} r="1.5" fill={node.color} />
                  </g>
                ))}

                {/* Output Ports */}
                {node.outPorts?.map((port, i) => (
                  <g key={`out-${node.id}-${i}`}>
                    <circle
                      cx={port.x}
                      cy={port.y}
                      r="4"
                      fill={node.color}
                      stroke="#050505"
                      strokeWidth="1"
                    />
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Bottom Telemetry HUD / Inspector Panel */}
      <div className="border-t border-white/[0.08] bg-[#090b10]/90 backdrop-blur-xl px-5 py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        {activeNode ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 w-full">
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-[11px] uppercase tracking-wider font-semibold">Inspecting</span>
              <span className="font-semibold text-xs px-2.5 py-0.5 rounded-lg border shadow-sm" style={{ color: activeNode.color, backgroundColor: `${activeNode.color}15`, borderColor: `${activeNode.color}30` }}>
                {activeNode.title}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-white/70">
              <span className="text-white/40">Runtime:</span>
              <span className="text-white font-mono text-[11px] bg-white/5 px-2 py-0.5 rounded border border-white/5">{activeNode.details.model}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">P99 Latency:</span>
              <span className="text-emerald-400 font-mono font-medium">{activeNode.details.p99Latency}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">Throughput:</span>
              <span className="text-white font-mono font-medium">{activeNode.details.throughput}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">Queue:</span>
              <span className="text-cyan-400 font-mono">{activeNode.details.queueDepth} reqs</span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-white/40">Error Rate:</span>
              <span className="text-white/90 font-mono">{activeNode.details.errorRate}</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-0.5" />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-white/50 w-full text-xs">
            <div className="flex items-center gap-2 text-white/80">
              <Cpu className="w-4 h-4 text-copper-400" />
              <span>Status: <span className="text-emerald-400 font-medium">All Systems Optimal</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">Total Flow:</span>
              <span className="text-white font-mono font-medium">14.2k tok/s</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">Active Routes:</span>
              <span className="text-white/90 font-medium">GPT-4o + Claude 3.5</span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 ml-auto text-[11px] text-white/40">
              <span>Click or hover any node for live runtime telemetry</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
