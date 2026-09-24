import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Zap, ShieldCheck, Cpu } from 'lucide-react';
import { PageTransition } from '../components/layout/PageTransition';
import { NetworkTopology2D } from '../components/dashboard/NetworkTopology2D';
import { AgentIcon } from '../components/ui/ModelLogos';

// --- MOCK DATA ---
const INITIAL_EXECUTIONS = [
  { id: 'TRC-8F72K9', time: '14:22:01.042', node: 'SYSTEM_PROMPT_01', model: 'gemini-2.5-pro', tokens: 4021, latency: 843, status: 'OK' },
  { id: 'TRC-2M9X1B', time: '14:22:00.891', node: 'DATA_EXTRACT_A', model: 'gemini-2.5', tokens: 12402, latency: 1204, status: 'OK' },
  { id: 'TRC-9P4V0C', time: '14:21:58.112', node: 'ROUTER_NODE', model: 'llama-3.1-8b', tokens: 342, latency: 120, status: 'OK' },
  { id: 'TRC-5K1B2F', time: '14:21:55.663', node: 'CREATIVE_AGENT', model: 'llama-3-70b', tokens: 2890, latency: 1420, status: 'OK' },
  { id: 'TRC-3X8M9Z', time: '14:21:50.001', node: 'CODE_REVIEW', model: 'mistral-large', tokens: 8102, latency: 3411, status: 'ERR_TIMEOUT' },
  { id: 'TRC-1A2B3C', time: '14:21:48.552', node: 'SYSTEM_PROMPT_01', model: 'qwen-2.5-72b', tokens: 412, latency: 198, status: 'OK' },
];

const QUICK_ACTIONS = [
  { 
    title: 'Prompt Generator', 
    subtitle: 'High-fidelity multi-turn prompt designer', 
    path: '/app/generator', 
    shortcut: '⌘G',
    tag: 'GEN',
    borderHover: 'group-hover:border-copper-500/40'
  },
  { 
    title: 'Branching Pipeline', 
    subtitle: 'Multi-model tree visualizer & forks', 
    path: '/app/branching', 
    shortcut: '⌘B',
    tag: 'FORK',
    borderHover: 'group-hover:border-emerald-500/40'
  },
  { 
    title: 'Prompt Tester', 
    subtitle: 'Side-by-side LLM arena & benchmark', 
    path: '/app/tester', 
    shortcut: '⌘T',
    tag: 'ARENA',
    borderHover: 'group-hover:border-amber-500/40'
  },
  { 
    title: 'Prompt Library', 
    subtitle: 'Curated index of battle-tested prompts', 
    path: '/app/library', 
    shortcut: '⌘L',
    tag: 'INDEX',
    borderHover: 'group-hover:border-purple-500/40'
  },
];

export default function Dashboard() {
  const [executions, setExecutions] = useState(INITIAL_EXECUTIONS);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OK' | 'ERR'>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleExportCSV = () => {
    const headers = 'TRACE_ID,TIMESTAMP,NODE_ORIGIN,MODEL_TARGET,TOKENS,LATENCY_MS,STATUS\n';
    const rows = executions.map(e => `${e.id},${e.time},${e.node},${e.model},${e.tokens},${e.latency},${e.status}`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bedrock-traces-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Trace log exported to CSV');
  };

  const handleClearOrReset = () => {
    if (executions.length === 0) {
      setExecutions(INITIAL_EXECUTIONS);
      showNotification('Trace logs restored to defaults');
    } else {
      setExecutions([]);
      showNotification('Trace logs cleared');
    }
  };

  const filteredExecutions = executions.filter(item => {
    if (statusFilter === 'OK') return item.status === 'OK';
    if (statusFilter === 'ERR') return item.status !== 'OK';
    return true;
  });

  return (
    <PageTransition>
      <div className="relative w-full h-full min-h-screen overflow-y-auto bg-[#07090e] text-white font-sans selection:bg-copper-500/30 selection:text-white custom-scrollbar pb-16">
        
        {/* Ambient Glassmorphic Lighting & Atmospheric Glow Orbs (Diffusion layer) */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-0">
          {/* Warm amber/golden architectural light (inspired by Reference Image 2) */}
          <div className="absolute -top-[10%] right-[10%] w-[680px] h-[600px] bg-gradient-to-br from-amber-500/10 via-yellow-600/5 to-transparent rounded-full blur-[140px] mix-blend-screen" />
          
          {/* Deep emerald/cyan routing cluster light (cool accent) */}
          <div className="absolute top-[25%] -left-[10%] w-[620px] h-[580px] bg-gradient-to-tr from-emerald-500/10 via-cyan-500/6 to-transparent rounded-full blur-[140px] mix-blend-screen" />
          
          {/* Subtle violet/copper ground glow */}
          <div className="absolute bottom-[5%] left-[25%] w-[700px] h-[550px] bg-gradient-to-t from-copper-500/8 via-purple-600/5 to-transparent rounded-full blur-[160px] mix-blend-screen" />

          {/* Tactile Frosted Glass Micro-Noise */}
          <div className="absolute inset-0 glass-noise opacity-50 pointer-events-none mix-blend-overlay" />
          
          {/* Geometric dot grid */}
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:28px_28px] opacity-30 pointer-events-none" />
        </div>

        {/* SUBHEADER / GLASS COMMAND BAR */}
        <header className="relative w-full border-b border-white/[0.08] px-4 sm:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 bg-[#07090e]/75 backdrop-blur-2xl z-20 shadow-[0_12px_36px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-x-0 top-0 h-[1.5px] glass-specular-line pointer-events-none" />
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-pill shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.9)]"></span>
              </span>
              <span className="text-[11px] font-semibold tracking-wide text-emerald-400 uppercase font-mono">OPERATIONAL</span>
            </div>
            <div className="h-4 w-px bg-white/15 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-display font-semibold text-white tracking-tight">Command Center</span>
              <span className="text-xs text-white/40 hidden sm:inline">· Dynamic Multi-Cluster Routing</span>
            </div>
          </div>
          
          {/* Real-time KPI Metric Badges */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs">
            {/* Latency */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-pill shadow-sm hover:border-white/20 transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] text-white/40 font-mono font-medium uppercase tracking-wider">P99 LAT</span>
                <span className="font-mono text-xs font-semibold text-white">242ms</span>
              </div>
            </div>

            {/* Throughput */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-pill shadow-sm hover:border-white/20 transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] text-white/40 font-mono font-medium uppercase tracking-wider">THROUGHPUT</span>
                <span className="font-mono text-xs font-semibold text-white">14.2K<span className="text-[10px] font-sans font-normal text-white/40">/s</span></span>
              </div>
            </div>

            {/* Error Rate */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-pill shadow-sm hover:border-white/20 transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] text-white/40 font-mono font-medium uppercase tracking-wider">ERROR RATE</span>
                <span className="font-mono text-xs font-semibold text-emerald-400">0.04%</span>
              </div>
            </div>

            {/* Region */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl glass-pill shadow-sm hover:border-white/20 transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-copper-400 shadow-[0_0_8px_rgba(200,168,107,0.8)]" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] text-white/40 font-mono font-medium uppercase tracking-wider">CLUSTER</span>
                <span className="font-mono text-xs font-medium text-white/80">us-east-1</span>
              </div>
            </div>
          </div>
        </header>

        {/* MAIN DASHBOARD CONTENT */}
        <div className="relative z-10 w-full px-4 sm:px-8 pt-6 flex flex-col gap-8">
          
          {/* EXECUTIVE TELEMETRY KPI GLASS CARDS (Reference Image 1 & 2 inspired) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* Card 1: Inferences */}
            <div className="relative rounded-3xl glass-panel-luxury p-5 overflow-hidden group hover:translate-y-[-2px] transition-all duration-300 shadow-[0_20px_45px_rgba(0,0,0,0.6)]">
              <div className="absolute inset-x-0 top-0 h-[1.5px] glass-specular-line pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-white/50 tracking-wide uppercase font-mono">Total Inferences</span>
                <div className="w-8 h-8 rounded-xl bg-copper-500/10 border border-copper-500/25 flex items-center justify-center text-copper-400 shadow-[0_0_12px_rgba(200,168,107,0.2)]">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-white">1,482,920</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  +12.4%
                </span>
              </div>
              <p className="text-[11px] text-white/40 mt-1.5 font-mono">Past 24 hours · 99.98% valid</p>
            </div>

            {/* Card 2: Latency */}
            <div className="relative rounded-3xl glass-panel-luxury p-5 overflow-hidden group hover:translate-y-[-2px] transition-all duration-300 shadow-[0_20px_45px_rgba(0,0,0,0.6)]">
              <div className="absolute inset-x-0 top-0 h-[1.5px] glass-specular-line pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-white/50 tracking-wide uppercase font-mono">Cluster P99 Latency</span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-white">242ms</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  -18ms
                </span>
              </div>
              <p className="text-[11px] text-white/40 mt-1.5 font-mono">Dynamic route optimization</p>
            </div>

            {/* Card 3: Success Rate */}
            <div className="relative rounded-3xl glass-panel-luxury p-5 overflow-hidden group hover:translate-y-[-2px] transition-all duration-300 shadow-[0_20px_45px_rgba(0,0,0,0.6)]">
              <div className="absolute inset-x-0 top-0 h-[1.5px] glass-specular-line pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-white/50 tracking-wide uppercase font-mono">System Reliability</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-white">99.96%</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
                  Nominal
                </span>
              </div>
              <p className="text-[11px] text-white/40 mt-1.5 font-mono">Zero SLA breaches recorded</p>
            </div>

            {/* Card 4: Model Pool */}
            <div className="relative rounded-3xl glass-panel-luxury p-5 overflow-hidden group hover:translate-y-[-2px] transition-all duration-300 shadow-[0_20px_45px_rgba(0,0,0,0.6)]">
              <div className="absolute inset-x-0 top-0 h-[1.5px] glass-specular-line pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-white/50 tracking-wide uppercase font-mono">Active Model Pool</span>
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                  <Cpu className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-white">4 Models</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                  Balanced
                </span>
              </div>
              <p className="text-[11px] text-white/40 mt-1.5 font-mono">Gemini 2.5, LLaMA 3.1, Mistral, Qwen</p>
            </div>
          </div>
          
          {/* TOP SECTION: Topology Graph + Quick Executables */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
            
            {/* Left 3 Cols: Main Visualization Glass Card */}
            <div className="lg:col-span-3 flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-display font-semibold text-white tracking-wide">Live Pipeline Architecture</h2>
                  <span className="text-xs text-white/40 hidden sm:inline">· Active 2D Model Dispatch Graph</span>
                </div>
              </div>
              <NetworkTopology2D />
            </div>

            {/* Right 1 Col: Quick Executables Glass Card */}
            <div className="lg:col-span-1 flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-display font-semibold text-white tracking-wide">Executables</h2>
                <span className="text-[11px] font-mono text-white/40 uppercase">Workflows</span>
              </div>
              
              <div className="relative flex-1 rounded-3xl glass-panel-luxury p-5 sm:p-6 flex flex-col justify-between overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.85)] group">
                <div className="absolute inset-x-0 top-0 h-[1.5px] glass-specular-line pointer-events-none" />

                {/* Executables Links */}
                <div className="flex flex-col gap-2.5">
                  {QUICK_ACTIONS.map((action) => (
                    <Link 
                      key={action.title} 
                      to={action.path}
                      className={`group relative flex items-center justify-between p-3.5 rounded-2xl glass-subcard-interactive shadow-sm ${action.borderHover}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-[10px] font-bold px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70 group-hover:text-white group-hover:border-white/20 transition-colors shadow-sm">
                          {action.tag}
                        </span>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-white tracking-tight group-hover:text-white transition-colors truncate block">
                            {action.title}
                          </span>
                          <p className="text-[10px] text-white/45 truncate leading-tight mt-0.5">
                            {action.subtitle}
                          </p>
                        </div>
                      </div>

                      <span className="font-mono text-[10px] text-white/40 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md group-hover:text-white/80 group-hover:border-white/20 transition-colors shrink-0 ml-2 shadow-sm">
                        {action.shortcut}
                      </span>
                    </Link>
                  ))}
                </div>
                
                {/* System Environment Footer Widget */}
                <div className="mt-5 pt-4 border-t border-white/10">
                  <div className="rounded-2xl glass-subcard p-4 backdrop-blur-xl flex flex-col gap-2.5 border border-white/10 shadow-inner">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/70 font-medium">System Runtime</span>
                      <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shadow-sm">
                        v1.0.4-rc2
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between text-white/45">
                        <span>Region</span>
                        <span className="font-mono text-white/75">us-east-1</span>
                      </div>
                      <div className="flex justify-between text-white/45">
                        <span>Cluster Load</span>
                        <span className="font-mono text-emerald-400 font-medium">24% Normal</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden border border-white/5">
                      <div className="bg-gradient-to-r from-emerald-500 via-cyan-400 to-copper-400 h-full w-[24%] rounded-full shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
                    </div>
                  </div>
                </div>

              </div>
            </div>
            
          </div>

          {/* BOTTOM SECTION: Telemetry Log Glass Card */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
              <div>
                <h2 className="text-sm font-display font-semibold text-white tracking-wide flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-copper-400 shadow-[0_0_8px_rgba(200,168,107,0.7)]" />
                  <span>Execution Trace Log</span>
                </h2>
                <p className="text-xs text-white/40 mt-0.5">Live streaming event telemetry from active LLM inference clusters</p>
              </div>

              {/* Log Controls */}
              <div className="flex items-center gap-2">
                {/* Filter Pills */}
                <div className="flex items-center border border-white/10 p-0.5 rounded-xl bg-black/40 backdrop-blur-md text-[11px] font-mono shadow-sm">
                  {(['ALL', 'OK', 'ERR'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setStatusFilter(filter)}
                      className={`px-3 py-1 rounded-lg font-medium transition-all ${
                        statusFilter === filter
                          ? 'bg-white/20 text-white shadow-sm font-semibold border border-white/15'
                          : 'text-white/50 hover:text-white/90 hover:bg-white/5'
                      }`}
                    >
                      {filter === 'ALL' ? 'All Traces' : filter === 'OK' ? 'Healthy (OK)' : 'Errors'}
                    </button>
                  ))}
                </div>

                {/* Export CSV Button */}
                <button 
                  onClick={handleExportCSV}
                  className="text-xs font-mono border border-white/10 glass-pill-button px-3 py-1.5 rounded-xl text-white/80 hover:text-white transition-all shadow-sm active:scale-95"
                >
                  Export CSV
                </button>

                {/* Clear or Reset Button */}
                <button 
                  onClick={handleClearOrReset}
                  className="text-xs font-mono border border-white/10 glass-pill-button px-3 py-1.5 rounded-xl text-white/80 hover:text-white transition-all shadow-sm active:scale-95"
                >
                  {executions.length === 0 ? 'Restore' : 'Clear'}
                </button>
              </div>
            </div>
            
            {/* Table Container Card */}
            <div className="relative w-full rounded-3xl glass-panel-luxury shadow-[0_32px_80px_rgba(0,0,0,0.85)] overflow-hidden p-5 sm:p-6">
              <div className="absolute inset-x-0 top-0 h-[1.5px] glass-specular-line pointer-events-none" />

              {filteredExecutions.length > 0 ? (
                <div className="w-full overflow-x-auto custom-scrollbar rounded-2xl bg-black/30 backdrop-blur-xl border border-white/[0.08]">
                  <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                    <thead>
                      <tr className="text-white/50 border-b border-white/[0.08] bg-white/[0.025] font-mono">
                        <th className="p-3.5 font-medium text-[11px] uppercase tracking-wider pl-6">Trace ID</th>
                        <th className="p-3.5 font-medium text-[11px] uppercase tracking-wider">Timestamp</th>
                        <th className="p-3.5 font-medium text-[11px] uppercase tracking-wider">Node Origin</th>
                        <th className="p-3.5 font-medium text-[11px] uppercase tracking-wider">Target Model</th>
                        <th className="p-3.5 font-medium text-[11px] uppercase tracking-wider text-right">Tokens</th>
                        <th className="p-3.5 font-medium text-[11px] uppercase tracking-wider text-right">Latency</th>
                        <th className="p-3.5 font-medium text-[11px] uppercase tracking-wider text-right pr-6">Status</th>
                      </tr>
                    </thead>
                    <tbody className="text-white/80 divide-y divide-white/5">
                      {filteredExecutions.map((exec) => (
                        <tr 
                          key={exec.id} 
                          className="hover:bg-white/[0.05] transition-colors group"
                        >
                          <td className="p-3.5 pl-6">
                            <span className="font-mono text-xs text-white/80 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 group-hover:border-white/20 transition-colors shadow-sm">
                              {exec.id}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-white/50 text-xs">
                            {exec.time}
                          </td>
                          <td className="p-3.5 text-white/95 font-medium text-xs">
                            {exec.node}
                          </td>
                          <td className="p-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-mono border backdrop-blur-sm ${
                              exec.model.includes('llama')
                                ? 'bg-purple-500/15 text-purple-300 border-purple-500/35 shadow-[0_0_8px_rgba(168,85,247,0.15)]'
                                : exec.model.includes('gemini')
                                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35 shadow-[0_0_8px_rgba(6,182,212,0.15)]'
                                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                            }`}>
                              <AgentIcon model={exec.model} className="w-3 h-3" badgeClassName="w-3.5 h-3.5 bg-transparent border-0 shadow-none p-0" />
                              {exec.model}
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-mono text-white/80">
                            {exec.tokens.toLocaleString()}
                          </td>
                          <td className="p-3.5 text-right font-mono">
                            <span className={exec.latency > 2000 ? 'text-amber-400 font-semibold' : 'text-white/90'}>
                              {exec.latency}ms
                            </span>
                          </td>
                          <td className="p-3.5 text-right pr-6">
                            {exec.status === 'OK' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-sm backdrop-blur-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]"></span>
                                200 OK
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/25 shadow-sm backdrop-blur-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse shadow-[0_0_6px_rgba(244,63,94,0.8)]"></span>
                                TIMEOUT
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
                  <p className="text-sm font-medium text-white/70">No trace records found</p>
                  <p className="text-xs text-white/40 mt-1 font-mono">Adjust filters or restore mock trace records</p>
                  <button 
                    onClick={handleClearOrReset}
                    className="mt-4 text-xs font-semibold px-4 py-2 glass-pill-button text-white rounded-xl transition-all font-mono shadow-sm"
                  >
                    Restore Traces
                  </button>
                </div>
              )}
            </div>
          </div>
          
        </div>

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl glass-card text-white text-xs shadow-2xl backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 border border-white/15 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
            <span>{toastMessage}</span>
          </div>
        )}

      </div>
    </PageTransition>
  );
}
