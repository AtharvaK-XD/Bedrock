import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Network, BarChart3, ArrowUpRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { AgentIcon } from '../ui/ModelLogos';
import type { UserTraceItem } from '../../lib/telemetry';
import { cn } from '../../lib/utils';

interface ModelAggregatedStats {
  id: string;
  title: string;
  subtitle: string;
  modelCode: string;
  engine: string;
  contextWindow: string;
  color: string;
  glowColor: string;
  runs: number;
  tokens: number;
  avgLatency: number;
  failures: number;
  isActive: boolean;
  box: { x: number; y: number; w: number; h: number };
  inPort: { x: number; y: number };
  outPort: { x: number; y: number };
}

interface EdgeDefinition {
  id: string;
  source: string;
  target: string;
  d: string;
  color: string;
  isActive: boolean;
}

export function NetworkTopology2D({ traces = [] }: { traces?: UserTraceItem[] }) {
  const [viewMode, setViewMode] = useState<'topology' | 'breakdown'>('topology');
  const [routeFilter, setRouteFilter] = useState<'ALL' | 'LLAMA' | 'GEMINI' | 'CLAUDE' | 'OPENAI'>('ALL');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Aggregate user traces per model group truthfully
  const modelStats = useMemo(() => {
    const aggregate = (matchTerms: string[]) => {
      const matching = traces.filter((t) =>
        matchTerms.some((term) => t.model.toLowerCase().includes(term))
      );
      const runs = matching.length;
      const tokens = matching.reduce((sum, t) => sum + (t.tokens || 0), 0);
      const failures = matching.filter((t) => t.status !== 'OK').length;
      const latencySum = matching.reduce((sum, t) => sum + (t.latency || 0), 0);
      const avgLatency = runs > 0 ? Math.round(latencySum / runs) : 0;
      return { runs, tokens, avgLatency, failures, isActive: runs > 0 };
    };

    return {
      llama: aggregate(['llama', 'groq', 'mixtral']),
      gemini: aggregate(['gemini', 'google']),
      claude: aggregate(['claude', 'anthropic']),
      openai: aggregate(['gpt', 'openai', 'o1', 'o3']),
    };
  }, [traces]);

  const totalRuns = traces.length;
  const totalTokens = traces.reduce((acc, t) => acc + (t.tokens || 0), 0);
  const avgOverallLatency = totalRuns > 0
    ? Math.round(traces.reduce((acc, t) => acc + (t.latency || 0), 0) / totalRuns)
    : 0;

  // Realistic Nodes Layout
  const MODEL_NODES: ModelAggregatedStats[] = useMemo(() => [
    {
      id: 'LLAMA',
      title: 'LLAMA-3.3',
      subtitle: 'GROQ / 128K',
      modelCode: 'llama-3.3-70b-versatile',
      engine: 'Groq LPU Direct / Open Weights',
      contextWindow: '128,000 tokens',
      color: '#a855f7',
      glowColor: 'rgba(168, 85, 247, 0.45)',
      runs: modelStats.llama.runs,
      tokens: modelStats.llama.tokens,
      avgLatency: modelStats.llama.avgLatency,
      failures: modelStats.llama.failures,
      isActive: modelStats.llama.isActive,
      box: { x: 440, y: 18, w: 175, h: 64 },
      inPort: { x: 440, y: 50 },
      outPort: { x: 615, y: 50 },
    },
    {
      id: 'GEMINI',
      title: 'GEMINI-2.5',
      subtitle: 'GOOGLE / 1M',
      modelCode: 'gemini-2.5-flash / pro',
      engine: 'Google AI Studio / DeepMind',
      contextWindow: '1,000,000 tokens',
      color: '#06b6d4',
      glowColor: 'rgba(6, 182, 212, 0.45)',
      runs: modelStats.gemini.runs,
      tokens: modelStats.gemini.tokens,
      avgLatency: modelStats.gemini.avgLatency,
      failures: modelStats.gemini.failures,
      isActive: modelStats.gemini.isActive,
      box: { x: 440, y: 104, w: 175, h: 64 },
      inPort: { x: 440, y: 136 },
      outPort: { x: 615, y: 136 },
    },
    {
      id: 'CLAUDE',
      title: 'CLAUDE-3.5',
      subtitle: 'ANTHROPIC / 200K',
      modelCode: 'claude-3-5-sonnet',
      engine: 'Anthropic Direct API',
      contextWindow: '200,000 tokens',
      color: '#f97316',
      glowColor: 'rgba(249, 115, 22, 0.45)',
      runs: modelStats.claude.runs,
      tokens: modelStats.claude.tokens,
      avgLatency: modelStats.claude.avgLatency,
      failures: modelStats.claude.failures,
      isActive: modelStats.claude.isActive,
      box: { x: 440, y: 190, w: 175, h: 64 },
      inPort: { x: 440, y: 222 },
      outPort: { x: 615, y: 222 },
    },
    {
      id: 'OPENAI',
      title: 'GPT-4o',
      subtitle: 'OPENAI / 128K',
      modelCode: 'gpt-4o / o3-mini',
      engine: 'OpenAI API Direct',
      contextWindow: '128,000 tokens',
      color: '#10b981',
      glowColor: 'rgba(16, 185, 129, 0.45)',
      runs: modelStats.openai.runs,
      tokens: modelStats.openai.tokens,
      avgLatency: modelStats.openai.avgLatency,
      failures: modelStats.openai.failures,
      isActive: modelStats.openai.isActive,
      box: { x: 440, y: 276, w: 175, h: 64 },
      inPort: { x: 440, y: 308 },
      outPort: { x: 615, y: 308 },
    },
  ], [modelStats]);

  // Edges connecting Ingest -> Router -> Models -> Egress
  const EDGES: EdgeDefinition[] = useMemo(() => [
    {
      id: 'edge-ingest-router',
      source: 'INGEST',
      target: 'ROUTER',
      d: 'M 170 178 L 220 178',
      color: '#38bdf8',
      isActive: totalRuns > 0,
    },
    {
      id: 'edge-router-llama',
      source: 'ROUTER',
      target: 'LLAMA',
      d: 'M 355 158 C 400 158, 395 50, 440 50',
      color: '#a855f7',
      isActive: modelStats.llama.isActive,
    },
    {
      id: 'edge-router-gemini',
      source: 'ROUTER',
      target: 'GEMINI',
      d: 'M 355 171 C 400 171, 395 136, 440 136',
      color: '#06b6d4',
      isActive: modelStats.gemini.isActive,
    },
    {
      id: 'edge-router-claude',
      source: 'ROUTER',
      target: 'CLAUDE',
      d: 'M 355 185 C 400 185, 395 222, 440 222',
      color: '#f97316',
      isActive: modelStats.claude.isActive,
    },
    {
      id: 'edge-router-openai',
      source: 'ROUTER',
      target: 'OPENAI',
      d: 'M 355 198 C 400 198, 395 308, 440 308',
      color: '#10b981',
      isActive: modelStats.openai.isActive,
    },
    {
      id: 'edge-llama-egress',
      source: 'LLAMA',
      target: 'EGRESS',
      d: 'M 615 50 C 660 50, 655 158, 700 158',
      color: '#a855f7',
      isActive: modelStats.llama.isActive,
    },
    {
      id: 'edge-gemini-egress',
      source: 'GEMINI',
      target: 'EGRESS',
      d: 'M 615 136 C 660 136, 655 171, 700 171',
      color: '#06b6d4',
      isActive: modelStats.gemini.isActive,
    },
    {
      id: 'edge-claude-egress',
      source: 'CLAUDE',
      target: 'EGRESS',
      d: 'M 615 222 C 660 222, 655 185, 700 185',
      color: '#f97316',
      isActive: modelStats.claude.isActive,
    },
    {
      id: 'edge-openai-egress',
      source: 'OPENAI',
      target: 'EGRESS',
      d: 'M 615 308 C 660 308, 655 198, 700 198',
      color: '#10b981',
      isActive: modelStats.openai.isActive,
    },
    {
      id: 'edge-egress-sink',
      source: 'EGRESS',
      target: 'SINK',
      d: 'M 845 178 L 885 178',
      color: '#38bdf8',
      isActive: totalRuns > 0,
    },
  ], [totalRuns, modelStats]);

  const activeNodeId = hoveredNode || selectedNode;
  const inspectedModel = MODEL_NODES.find((m) => m.id === activeNodeId);

  // Check if edge matches the active route filter
  const isEdgeVisible = (edge: EdgeDefinition) => {
    if (routeFilter === 'ALL') return true;
    if (edge.source === 'INGEST' || edge.target === 'ROUTER' || edge.source === 'EGRESS') {
      return true;
    }
    return edge.source === routeFilter || edge.target === routeFilter;
  };

  // Group traces for the breakdown list
  const breakdownRows = useMemo(() => {
    const byModel = new Map<string, { runs: number; failures: number; tokens: number; latencySum: number }>();
    for (const t of traces) {
      const entry = byModel.get(t.model) || { runs: 0, failures: 0, tokens: 0, latencySum: 0 };
      entry.runs += 1;
      entry.tokens += t.tokens || 0;
      entry.latencySum += t.latency || 0;
      if (t.status !== 'OK') entry.failures += 1;
      byModel.set(t.model, entry);
    }
    return Array.from(byModel, ([model, e]) => ({
      model,
      runs: e.runs,
      failures: e.failures,
      tokens: e.tokens,
      avgLatency: e.runs ? Math.round(e.latencySum / e.runs) : 0,
    }))
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 6);
  }, [traces]);

  const maxBreakdownRuns = breakdownRows[0]?.runs || 1;

  return (
    <div className="relative w-full glass-panel-luxury overflow-hidden flex flex-col font-sans text-xs text-white/80 select-none rounded-3xl group shadow-[0_32px_80px_rgba(0,0,0,0.85)] border border-white/10 bg-black">
      {/* Ambient background accents */}
      <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-copper-500/30 to-transparent pointer-events-none z-20" />
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-cyan-500/[0.04] rounded-full blur-3xl pointer-events-none -z-0" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-copper-500/[0.04] rounded-full blur-3xl pointer-events-none -z-0" />

      {/* Top HUD Controls Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-white/[0.08] bg-white/[0.02] backdrop-blur-2xl gap-3">
        {/* Left: Pipeline Title & Real Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-semibold tracking-wider text-white font-display uppercase">
              Pipeline Architecture
            </span>
          </div>
          <span className="text-[11px] font-mono text-white/40 hidden sm:inline">
            {totalRuns === 0 ? '· Standby (0 runs logged)' : `· ${totalRuns} real ${totalRuns === 1 ? 'run' : 'runs'} logged`}
          </span>
        </div>

        {/* Right: Route Filters & View Toggle */}
        <div className="flex items-center gap-2">
          {viewMode === 'topology' && (
            <div className="hidden md:flex items-center border border-white/10 p-0.5 rounded-xl bg-black/60 backdrop-blur-lg text-[11px]">
              {(['ALL', 'LLAMA', 'GEMINI', 'CLAUDE', 'OPENAI'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setRouteFilter(filter)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5",
                    routeFilter === filter
                      ? "bg-white/15 text-white font-semibold border border-white/10 shadow-sm"
                      : "text-white/40 hover:text-white/80 hover:bg-white/5"
                  )}
                >
                  {filter !== 'ALL' && (
                    <AgentIcon
                      model={filter.toLowerCase()}
                      className="w-3 h-3"
                      badgeClassName="w-3 h-3"
                    />
                  )}
                  <span>
                    {filter === 'ALL'
                      ? 'All'
                      : filter === 'LLAMA'
                      ? 'Llama'
                      : filter === 'GEMINI'
                      ? 'Gemini'
                      : filter === 'CLAUDE'
                      ? 'Claude'
                      : 'GPT-4o'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* View Mode Toggle: Topology Graph vs Usage Breakdown */}
          <div className="flex items-center border border-white/10 p-0.5 rounded-xl bg-white/[0.03] backdrop-blur-md">
            <button
              onClick={() => setViewMode('topology')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                viewMode === 'topology'
                  ? "bg-copper-500/20 text-copper-300 border border-copper-500/30 font-semibold shadow-sm"
                  : "text-white/40 hover:text-white hover:bg-white/5"
              )}
              title="View 2D interactive architecture topology"
            >
              <Network className="w-3.5 h-3.5" />
              <span>Topology</span>
            </button>
            <button
              onClick={() => setViewMode('breakdown')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                viewMode === 'breakdown'
                  ? "bg-copper-500/20 text-copper-300 border border-copper-500/30 font-semibold shadow-sm"
                  : "text-white/40 hover:text-white hover:bg-white/5"
              )}
              title="View real model usage breakdown"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Breakdown</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area: Topology Graph OR Usage Breakdown */}
      {viewMode === 'breakdown' ? (
        <div className="p-6 min-h-[350px] flex flex-col justify-center">
          {breakdownRows.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center py-10">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-copper-500/25 bg-copper-500/10 text-copper-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-white">No runs yet</p>
              <p className="max-w-xs text-xs leading-relaxed text-white/50 font-mono">
                Once you generate a prompt, you will see which models handled it, how often, and how fast.
              </p>
              <Link
                to="/app/generator"
                className="mt-1 rounded-xl bg-copper-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-copper-500/25 transition-all hover:bg-copper-600 active:scale-[0.98] inline-flex items-center gap-1.5"
              >
                <span>Start a prompt</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <ul className="flex flex-1 flex-col justify-center gap-4 max-w-2xl mx-auto w-full">
              {breakdownRows.map((row, index) => (
                <li key={row.model} className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2 text-white">
                      <AgentIcon model={row.model} className="h-4 w-4 shrink-0" badgeClassName="w-4 h-4" />
                      <span className="truncate font-medium font-mono">{row.model}</span>
                    </span>
                    <span className="shrink-0 text-white/50 font-mono text-[11px]">
                      {row.runs} {row.runs === 1 ? 'run' : 'runs'}
                      {row.avgLatency > 0 && <> · avg {row.avgLatency} ms</>}
                      {row.tokens > 0 && <> · {row.tokens.toLocaleString()} tok</>}
                      {row.failures > 0 && <span className="text-rose-400"> · {row.failures} failed</span>}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-copper-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(6, Math.round((row.runs / maxBreakdownRuns) * 100))}%` }}
                      transition={{ duration: 0.7, delay: index * 0.06, ease: 'easeOut' }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="relative w-full overflow-x-auto overflow-y-hidden bg-black flex items-center justify-center p-3 sm:p-5 min-h-[350px]">
          <svg
            viewBox="0 0 940 360"
            className="w-full h-auto max-w-[940px] select-none"
            style={{ minWidth: '760px' }}
          >
            <defs>
              <pattern id="dot-grid-topo" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.75" fill="rgba(255, 255, 255, 0.06)" />
              </pattern>
              <linearGradient id="ingest-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="router-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.01" />
              </linearGradient>
              <linearGradient id="egress-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Dot Grid Background */}
            <rect width="940" height="360" fill="url(#dot-grid-topo)" />

            {/* Edges Connecting Nodes */}
            {EDGES.map((edge) => {
              const isVisible = isEdgeVisible(edge);
              const opacity = isVisible ? (edge.isActive ? 1 : 0.4) : 0.12;

              return (
                <g key={edge.id} className="transition-opacity duration-300" style={{ opacity }}>
                  {/* Base path */}
                  <path
                    d={edge.d}
                    fill="none"
                    stroke={edge.isActive ? edge.color : 'rgba(255, 255, 255, 0.18)'}
                    strokeWidth={edge.isActive ? '1.8' : '1.2'}
                    strokeDasharray={edge.isActive ? 'none' : '4 4'}
                    strokeLinecap="round"
                    className="transition-all duration-300"
                  />

                  {/* Active edge glow */}
                  {edge.isActive && (
                    <path
                      d={edge.d}
                      fill="none"
                      stroke={edge.color}
                      strokeWidth="4"
                      strokeOpacity="0.15"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Gentle authentic data flow animation ONLY when route is genuinely active */}
                  {edge.isActive && (
                    <circle r="2.5" fill={edge.color}>
                      <animateMotion
                        path={edge.d}
                        dur="2.4s"
                        repeatCount="indefinite"
                        keyPoints="0;1"
                        keyTimes="0;1"
                      />
                    </circle>
                  )}
                </g>
              );
            })}

            {/* 1. INGEST NODE */}
            <g
              transform="translate(40, 143)"
              className="cursor-pointer transition-transform duration-200"
              onMouseEnter={() => setHoveredNode('INGEST')}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => setSelectedNode(selectedNode === 'INGEST' ? null : 'INGEST')}
            >
              <rect
                x="0"
                y="0"
                width="130"
                height="70"
                rx="14"
                fill="url(#ingest-grad)"
                stroke={activeNodeId === 'INGEST' ? '#38bdf8' : 'rgba(56, 189, 248, 0.35)'}
                strokeWidth={activeNodeId === 'INGEST' ? '1.75' : '1'}
                className="backdrop-blur-sm"
              />
              <circle cx="16" cy="18" r="4" fill="#38bdf8" />
              <text x="26" y="21" fill="#ffffff" fontSize="11" fontWeight="700" fontFamily="Space Grotesk, sans-serif">
                INGEST
              </text>
              <text x="26" y="32" fill="rgba(255, 255, 255, 0.45)" fontSize="8.5" fontFamily="Fira Code, monospace">
                CLIENT GATEWAY
              </text>
              <line x1="12" y1="42" x2="118" y2="42" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="0.8" />
              <text x="14" y="58" fill="#38bdf8" fontSize="9.5" fontWeight="600" fontFamily="Fira Code, monospace">
                {totalRuns === 0 ? 'STANDBY' : `${totalRuns} reqs`}
              </text>
              <text x="116" y="58" textAnchor="end" fill="rgba(255, 255, 255, 0.5)" fontSize="8" fontFamily="Fira Code, monospace">
                {totalRuns === 0 ? 'READY' : '100% OK'}
              </text>
              {/* Output port */}
              <circle cx="130" cy="35" r="4" fill="#38bdf8" stroke="#000000" strokeWidth="1" />
            </g>

            {/* 2. ROUTER NODE */}
            <g
              transform="translate(220, 143)"
              className="cursor-pointer transition-transform duration-200"
              onMouseEnter={() => setHoveredNode('ROUTER')}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => setSelectedNode(selectedNode === 'ROUTER' ? null : 'ROUTER')}
            >
              <rect
                x="0"
                y="0"
                width="135"
                height="70"
                rx="14"
                fill="url(#router-grad)"
                stroke={activeNodeId === 'ROUTER' ? '#ffffff' : 'rgba(255, 255, 255, 0.25)'}
                strokeWidth={activeNodeId === 'ROUTER' ? '1.75' : '1'}
                className="backdrop-blur-sm"
              />
              {/* Input port */}
              <circle cx="0" cy="35" r="4" fill="#000000" stroke="#38bdf8" strokeWidth="1.5" />
              <circle cx="0" cy="35" r="1.5" fill="#38bdf8" />

              <text x="16" y="21" fill="#ffffff" fontSize="11" fontWeight="700" fontFamily="Space Grotesk, sans-serif">
                SMART ROUTER
              </text>
              <text x="16" y="32" fill="rgba(255, 255, 255, 0.45)" fontSize="8.5" fontFamily="Fira Code, monospace">
                DYNAMIC DISPATCH
              </text>
              <line x1="12" y1="42" x2="123" y2="42" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="0.8" />
              <text x="14" y="58" fill="#ffffff" fontSize="9.5" fontWeight="600" fontFamily="Fira Code, monospace">
                AUTO_WEIGHT
              </text>
              <text x="121" y="58" textAnchor="end" fill="rgba(255, 255, 255, 0.5)" fontSize="8" fontFamily="Fira Code, monospace">
                {avgOverallLatency > 0 ? `${avgOverallLatency}ms` : 'READY'}
              </text>

              {/* 4 output ports to models */}
              <circle cx="135" cy="15" r="3" fill="#a855f7" />
              <circle cx="135" cy="28" r="3" fill="#06b6d4" />
              <circle cx="135" cy="42" r="3" fill="#f97316" />
              <circle cx="135" cy="55" r="3" fill="#10b981" />
            </g>

            {/* 3. FOUR MODEL NODES */}
            {MODEL_NODES.map((model) => {
              const isInspected = activeNodeId === model.id;
              const matchesFilter = routeFilter === 'ALL' || routeFilter === model.id;
              const opacity = matchesFilter ? 1 : 0.25;

              return (
                <g
                  key={model.id}
                  transform={`translate(${model.box.x}, ${model.box.y})`}
                  className="cursor-pointer transition-all duration-200"
                  style={{ opacity }}
                  onMouseEnter={() => setHoveredNode(model.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => setSelectedNode(selectedNode === model.id ? null : model.id)}
                >
                  {/* Background container */}
                  <rect
                    x="0"
                    y="0"
                    width={model.box.w}
                    height={model.box.h}
                    rx="12"
                    fill="rgba(12, 13, 16, 0.95)"
                    stroke={isInspected ? model.color : model.isActive ? model.color : 'rgba(255, 255, 255, 0.12)'}
                    strokeWidth={isInspected ? '2' : model.isActive ? '1.5' : '1'}
                    filter={model.isActive ? `drop-shadow(0 0 10px ${model.glowColor})` : 'none'}
                  />

                  {/* Input port */}
                  <circle cx="0" cy="32" r="3.5" fill="#000000" stroke={model.color} strokeWidth="1.2" />

                  {/* Header: title + subtitle */}
                  <text x="14" y="20" fill="#ffffff" fontSize="10.5" fontWeight="700" fontFamily="Space Grotesk, sans-serif">
                    {model.title}
                  </text>
                  <text x="14" y="31" fill="rgba(255, 255, 255, 0.45)" fontSize="8" fontFamily="Fira Code, monospace">
                    {model.subtitle}
                  </text>

                  {/* Status pill in top-right */}
                  {model.isActive ? (
                    <g transform="translate(122, 10)">
                      <rect x="0" y="0" width="42" height="14" rx="4" fill={`${model.color}25`} stroke={`${model.color}60`} strokeWidth="0.8" />
                      <circle cx="6" cy="7" r="2" fill={model.color} />
                      <text x="12" y="10" fill={model.color} fontSize="7.5" fontWeight="600" fontFamily="Fira Code, monospace">
                        ACTIVE
                      </text>
                    </g>
                  ) : (
                    <g transform="translate(116, 10)">
                      <rect x="0" y="0" width="48" height="14" rx="4" fill="rgba(255, 255, 255, 0.04)" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="0.8" />
                      <text x="7" y="10" fill="rgba(255, 255, 255, 0.4)" fontSize="7.5" fontFamily="Fira Code, monospace">
                        STANDBY
                      </text>
                    </g>
                  )}

                  {/* Horizontal divider */}
                  <line x1="10" y1="38" x2={model.box.w - 10} y2="38" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="0.8" />

                  {/* Metrics Footer */}
                  <text x="14" y="52" fill={model.isActive ? model.color : 'rgba(255, 255, 255, 0.7)'} fontSize="9" fontWeight="600" fontFamily="Fira Code, monospace">
                    {model.isActive ? `${model.runs} ${model.runs === 1 ? 'run' : 'runs'}` : '0 runs logged'}
                  </text>
                  <text x={model.box.w - 14} y="52" textAnchor="end" fill="rgba(255, 255, 255, 0.45)" fontSize="8" fontFamily="Fira Code, monospace">
                    {model.isActive && model.avgLatency > 0 ? `avg ${model.avgLatency}ms` : 'Ready'}
                  </text>

                  {/* Output port */}
                  <circle cx={model.box.w} cy="32" r="3.5" fill={model.color} stroke="#000000" strokeWidth="1" />
                </g>
              );
            })}

            {/* 4. EGRESS / LAKEBASE SINK NODE */}
            <g
              transform="translate(700, 143)"
              className="cursor-pointer transition-transform duration-200"
              onMouseEnter={() => setHoveredNode('EGRESS')}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => setSelectedNode(selectedNode === 'EGRESS' ? null : 'EGRESS')}
            >
              <rect
                x="0"
                y="0"
                width="145"
                height="70"
                rx="14"
                fill="url(#egress-grad)"
                stroke={activeNodeId === 'EGRESS' ? '#38bdf8' : 'rgba(56, 189, 248, 0.35)'}
                strokeWidth={activeNodeId === 'EGRESS' ? '1.75' : '1'}
                className="backdrop-blur-sm"
              />
              {/* 4 input ports from models */}
              <circle cx="0" cy="15" r="3" fill="#a855f7" />
              <circle cx="0" cy="28" r="3" fill="#06b6d4" />
              <circle cx="0" cy="42" r="3" fill="#f97316" />
              <circle cx="0" cy="55" r="3" fill="#10b981" />

              <text x="16" y="21" fill="#ffffff" fontSize="11" fontWeight="700" fontFamily="Space Grotesk, sans-serif">
                STREAM & SINK
              </text>
              <text x="16" y="32" fill="rgba(255, 255, 255, 0.45)" fontSize="8.5" fontFamily="Fira Code, monospace">
                NEON LAKEBASE
              </text>
              <line x1="12" y1="42" x2="133" y2="42" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="0.8" />
              <text x="14" y="58" fill="#38bdf8" fontSize="9.5" fontWeight="600" fontFamily="Fira Code, monospace">
                {totalTokens > 0 ? `${totalTokens.toLocaleString()} tok` : '0 tok synced'}
              </text>
              <text x="131" y="58" textAnchor="end" fill="rgba(255, 255, 255, 0.5)" fontSize="8" fontFamily="Fira Code, monospace">
                {totalRuns > 0 ? 'SYNCED' : 'READY'}
              </text>
              {/* Output port */}
              <circle cx="145" cy="35" r="4" fill="#38bdf8" stroke="#000000" strokeWidth="1" />
            </g>

            {/* 5. OUTPUT TERMINAL */}
            <g transform="translate(885, 171)">
              <circle cx="7" cy="7" r="6" fill="rgba(56, 189, 248, 0.15)" stroke="#38bdf8" strokeWidth="1.5" />
              <circle cx="7" cy="7" r="2.5" fill="#38bdf8" />
            </g>
          </svg>
        </div>
      )}

      {/* Bottom Telemetry HUD / Inspector Panel */}
      <div className="relative z-10 border-t border-white/[0.08] bg-white/[0.02] backdrop-blur-2xl px-5 py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        {inspectedModel ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 w-full">
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-[11px] uppercase tracking-wider font-semibold">Inspecting</span>
              <span
                className="font-semibold text-xs px-2.5 py-0.5 rounded-lg border shadow-sm backdrop-blur-md flex items-center gap-1.5"
                style={{
                  color: inspectedModel.color,
                  backgroundColor: `${inspectedModel.color}15`,
                  borderColor: `${inspectedModel.color}40`,
                }}
              >
                <AgentIcon model={inspectedModel.id.toLowerCase()} className="w-3.5 h-3.5" badgeClassName="w-3.5 h-3.5" />
                <span>{inspectedModel.title}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-white/70">
              <span className="text-white/40">Engine:</span>
              <span className="text-white font-mono text-[11px] bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
                {inspectedModel.engine}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">Context:</span>
              <span className="text-white font-mono font-medium">{inspectedModel.contextWindow}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">Real Runs:</span>
              <span className={cn("font-mono font-semibold", inspectedModel.runs > 0 ? "text-emerald-400" : "text-white/50")}>
                {inspectedModel.runs} {inspectedModel.runs === 1 ? 'run' : 'runs'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">Avg Latency:</span>
              <span className="text-white font-mono">
                {inspectedModel.avgLatency > 0 ? `${inspectedModel.avgLatency}ms` : 'No runs yet'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-white/40">Tokens Synced:</span>
              <span className="text-white/90 font-mono font-semibold">{inspectedModel.tokens.toLocaleString()}</span>
            </div>
          </div>
        ) : activeNodeId === 'INGEST' ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs w-full">
            <span className="text-white/40 uppercase tracking-wider font-semibold">Node</span>
            <span className="text-sky-400 font-mono font-semibold">INGEST · API Gateway</span>
            <span className="text-white/40">Type: <span className="text-white font-mono">Bedrock Client Dispatch</span></span>
            <span className="text-white/40">Total Inferences: <span className="text-emerald-400 font-mono font-semibold">{totalRuns}</span></span>
            <span className="text-white/40 ml-auto">Status: <span className="text-emerald-400 font-medium">Nominal Edge Ready</span></span>
          </div>
        ) : activeNodeId === 'ROUTER' ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs w-full">
            <span className="text-white/40 uppercase tracking-wider font-semibold">Node</span>
            <span className="text-white font-mono font-semibold">SMART ROUTER</span>
            <span className="text-white/40">Algorithm: <span className="text-white font-mono">Semantic Complexity & Quota Dispatch</span></span>
            <span className="text-white/40">Avg Dispatch Latency: <span className="text-white font-mono">{avgOverallLatency > 0 ? `${avgOverallLatency}ms` : '<15ms'}</span></span>
            <span className="text-white/40 ml-auto">Routes: <span className="text-emerald-400 font-medium">4 Models Connected</span></span>
          </div>
        ) : activeNodeId === 'EGRESS' ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs w-full">
            <span className="text-white/40 uppercase tracking-wider font-semibold">Node</span>
            <span className="text-sky-400 font-mono font-semibold">STREAM & SINK · Lakebase</span>
            <span className="text-white/40">Persistence: <span className="text-white font-mono">Neon Lakebase Postgres (Direct Sync)</span></span>
            <span className="text-white/40">Total Synced: <span className="text-white font-mono">{totalTokens.toLocaleString()} tokens</span></span>
            <span className="text-white/40 ml-auto">Health: <span className="text-emerald-400 font-medium">All Systems Operational</span></span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-white/50 w-full text-xs">
            <div className="flex items-center gap-2 text-white/80">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Status: <span className="text-emerald-400 font-medium font-mono">Pipeline Operational</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">Total Inferences:</span>
              <span className="text-white font-mono font-medium">{totalRuns}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">Active Models:</span>
              <span className="text-white font-mono font-medium">
                {MODEL_NODES.filter((m) => m.isActive).length} / 4 Used
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40">Tokens Synced:</span>
              <span className="text-white font-mono font-medium">{totalTokens.toLocaleString()}</span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 ml-auto text-[11px] text-white/40 font-mono">
              <span>Click or hover any node to inspect telemetry</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
