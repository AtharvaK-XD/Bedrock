import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Sparkles, 
  GitBranch, 
  FlaskConical, 
  BookOpen, 
  Zap, 
  Activity, 
  ShieldCheck, 
  ArrowUpRight, 
  Download, 
  RotateCcw, 
  Radio, 
  Terminal, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { PageTransition } from '../components/layout/PageTransition';
import { NetworkTopology2D } from '../components/dashboard/NetworkTopology2D';

// --- MOCK DATA ---
const INITIAL_EXECUTIONS = [
  { id: 'TRC-8F72K9', time: '14:22:01.042', node: 'SYSTEM_PROMPT_01', model: 'gpt-4o', tokens: 4021, latency: 843, status: 'OK' },
  { id: 'TRC-2M9X1B', time: '14:22:00.891', node: 'DATA_EXTRACT_A', model: 'claude-3.5', tokens: 12402, latency: 2104, status: 'OK' },
  { id: 'TRC-9P4V0C', time: '14:21:58.112', node: 'ROUTER_NODE', model: 'gpt-4o-mini', tokens: 342, latency: 120, status: 'OK' },
  { id: 'TRC-5K1B2F', time: '14:21:55.663', node: 'CREATIVE_AGENT', model: 'llama-3-70b', tokens: 2890, latency: 1420, status: 'OK' },
  { id: 'TRC-3X8M9Z', time: '14:21:50.001', node: 'CODE_REVIEW', model: 'gpt-4o', tokens: 8102, latency: 3411, status: 'ERR_TIMEOUT' },
  { id: 'TRC-1A2B3C', time: '14:21:48.552', node: 'SYSTEM_PROMPT_01', model: 'gpt-4o', tokens: 412, latency: 198, status: 'OK' },
];

const QUICK_ACTIONS = [
  { 
    title: 'Prompt Generator', 
    subtitle: 'High-fidelity multi-turn prompt designer', 
    path: '/app/generator', 
    shortcut: '⌘G',
    icon: Sparkles,
    gradient: 'from-teal-500/20 to-copper-500/20',
    iconColor: 'text-copper-400',
    borderHover: 'group-hover:border-copper-500/40'
  },
  { 
    title: 'Branching Pipeline', 
    subtitle: 'Multi-model tree visualizer & forks', 
    path: '/app/branching', 
    shortcut: '⌘B',
    icon: GitBranch,
    gradient: 'from-emerald-500/20 to-teal-500/20',
    iconColor: 'text-emerald-400',
    borderHover: 'group-hover:border-emerald-500/40'
  },
  { 
    title: 'Prompt Tester', 
    subtitle: 'Side-by-side LLM arena & benchmark', 
    path: '/app/tester', 
    shortcut: '⌘T',
    icon: FlaskConical,
    gradient: 'from-amber-500/20 to-orange-500/20',
    iconColor: 'text-amber-400',
    borderHover: 'group-hover:border-amber-500/40'
  },
  { 
    title: 'Prompt Library', 
    subtitle: 'Curated index of battle-tested prompts', 
    path: '/app/library', 
    shortcut: '⌘L',
    icon: BookOpen,
    gradient: 'from-purple-500/20 to-indigo-500/20',
    iconColor: 'text-purple-400',
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
      <div className="relative w-full h-full min-h-screen overflow-y-auto bg-black text-white font-sans selection:bg-copper-500/30 selection:text-white custom-scrollbar pb-16">
        
        {/* Subtle geometric dot grid pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:28px_28px] pointer-events-none opacity-30 -z-0" />

        {/* SUBHEADER / GLASS COMMAND BAR */}
        <header className="w-full border-b border-white/[0.08] px-4 sm:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 bg-black/80 backdrop-blur-2xl z-20">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#08090d] border border-white/10 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]"></span>
              </span>
              <span className="text-xs font-semibold tracking-wide text-emerald-400 uppercase">Operational</span>
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
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#08090d] border border-white/10 shadow-sm">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">P99 Lat</span>
                <span className="font-mono text-xs font-semibold text-white">242ms</span>
              </div>
            </div>

            {/* Throughput */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#08090d] border border-white/10 shadow-sm">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Tokens</span>
                <span className="font-mono text-xs font-semibold text-white">14.2K<span className="text-[10px] font-sans font-normal text-white/40">/s</span></span>
              </div>
            </div>

            {/* Error Rate */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#08090d] border border-white/10 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Error Rate</span>
                <span className="font-mono text-xs font-semibold text-emerald-400">0.04%</span>
              </div>
            </div>

            {/* Region */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#08090d] border border-white/10 shadow-sm">
              <Radio className="w-3.5 h-3.5 text-copper-400" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] text-white/40 font-medium uppercase tracking-wider">Cluster</span>
                <span className="font-mono text-xs font-medium text-white/80">us-east-1</span>
              </div>
            </div>
          </div>
        </header>

        {/* MAIN DASHBOARD CONTENT */}
        <div className="relative z-10 w-full px-4 sm:px-8 pt-6 flex flex-col gap-8">
          
          {/* TOP SECTION: Topology Graph + Quick Executables */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
            
            {/* Left 3 Cols: Main Visualization Glass Card */}
            <div className="lg:col-span-3 flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-display font-semibold text-white tracking-wide">Live Pipeline Architecture</h2>
                  <span className="text-xs text-white/40 hidden sm:inline">· Active 2D Model Dispatch Graph</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span>1000ms Polling</span>
                </div>
              </div>
              <NetworkTopology2D />
            </div>

            {/* Right 1 Col: Quick Executables Glass Card */}
            <div className="lg:col-span-1 flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-display font-semibold text-white tracking-wide">Executables</h2>
                <span className="text-[11px] text-white/40">Workflows</span>
              </div>
              
              <div className="relative flex-1 rounded-3xl bg-[#050608] border border-white/10 p-5 sm:p-6 flex flex-col justify-between overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.95)] group">
                {/* Luminous top border sheen */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

                {/* Executables Links */}
                <div className="flex flex-col gap-2.5">
                  {QUICK_ACTIONS.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Link 
                        key={action.title} 
                        to={action.path}
                        className={`group relative flex items-center justify-between p-3.5 rounded-2xl glass-subcard hover:border-white/25 hover:bg-white/[0.08] transition-all duration-300 shadow-sm ${action.borderHover}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${action.gradient} border border-white/15 flex items-center justify-center shrink-0 shadow-inner`}>
                            <Icon className={`w-4 h-4 ${action.iconColor}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-white tracking-tight group-hover:text-white transition-colors truncate">
                                {action.title}
                              </span>
                            </div>
                            <p className="text-[10px] text-white/45 truncate leading-tight mt-0.5">
                              {action.subtitle}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className="font-mono text-[10px] text-white/40 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md group-hover:text-white/80 group-hover:border-white/20 transition-colors">
                            {action.shortcut}
                          </span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/80 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
                
                {/* System Environment Footer Widget */}
                <div className="mt-5 pt-4 border-t border-white/10">
                  <div className="rounded-2xl glass-subcard p-4 backdrop-blur-xl flex flex-col gap-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-white/70 font-medium">
                        <Terminal className="w-3.5 h-3.5 text-blue-400" />
                        <span>System Runtime</span>
                      </div>
                      <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
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
                      <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full w-[24%] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
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
                  <Activity className="w-4 h-4 text-copper-400" />
                  <span>Execution Trace Log</span>
                </h2>
                <p className="text-xs text-white/40 mt-0.5">Live streaming event telemetry from active LLM inference clusters</p>
              </div>

              {/* Log Controls */}
              <div className="flex items-center gap-2">
                {/* Filter Pills */}
                <div className="flex items-center border border-white/10 p-0.5 rounded-xl bg-black/40 backdrop-blur-md text-[11px]">
                  {(['ALL', 'OK', 'ERR'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setStatusFilter(filter)}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                        statusFilter === filter
                          ? 'bg-white/20 text-white shadow-sm font-semibold'
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
                  className="text-xs border border-white/10 bg-[#08090d] hover:bg-white/[0.06] px-3 py-1.5 rounded-xl text-white/80 hover:text-white transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Download className="w-3.5 h-3.5 text-white/60" />
                  <span className="hidden sm:inline font-medium">Export CSV</span>
                </button>

                {/* Clear or Reset Button */}
                <button 
                  onClick={handleClearOrReset}
                  className="text-xs border border-white/10 bg-[#08090d] hover:bg-white/[0.06] px-3 py-1.5 rounded-xl text-white/80 hover:text-white transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-white/60" />
                  <span className="hidden sm:inline font-medium">{executions.length === 0 ? 'Restore' : 'Clear'}</span>
                </button>
              </div>
            </div>
            
            {/* Table Container Card */}
            <div className="relative w-full rounded-3xl bg-[#050608] border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.95)] overflow-hidden p-5 sm:p-6">
              {/* Luminous top border sheen */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

              {filteredExecutions.length > 0 ? (
                <div className="w-full overflow-x-auto custom-scrollbar rounded-2xl bg-[#030305] border border-white/[0.08]">
                  <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                    <thead>
                      <tr className="text-white/40 border-b border-white/[0.08] bg-[#08090d]">
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
                          className="hover:bg-white/[0.04] transition-colors group"
                        >
                          <td className="p-3.5 pl-6">
                            <span className="font-mono text-xs text-white/70 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 group-hover:border-white/15 transition-colors">
                              {exec.id}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-white/50 text-xs">
                            {exec.time}
                          </td>
                          <td className="p-3.5 text-white/90 font-medium text-xs">
                            {exec.node}
                          </td>
                          <td className="p-3.5">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-mono border ${
                              exec.model.includes('gpt-4o')
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : exec.model.includes('claude')
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                            }`}>
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
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                200 OK
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                                Timeout
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
                  <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                    <AlertCircle className="w-5 h-5 text-white/30" />
                  </div>
                  <p className="text-sm font-medium text-white/70">No trace records found</p>
                  <p className="text-xs text-white/40 mt-1">Adjust filters or restore mock trace records</p>
                  <button 
                    onClick={handleClearOrReset}
                    className="mt-4 text-xs font-semibold px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-xl transition-all"
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
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl glass-card text-white text-xs shadow-2xl backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

      </div>
    </PageTransition>
  );
}
