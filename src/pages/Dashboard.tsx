import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Zap, ShieldCheck, Cpu, ArrowUpRight, Sparkles, Lock, Crown } from 'lucide-react';
import { PageTransition } from '../components/layout/PageTransition';
import { EncryptedText } from '../components/ui/encrypted-text';
import { NetworkTopology2D } from '../components/dashboard/NetworkTopology2D';
import { AgentIcon } from '../components/ui/ModelLogos';
import { cn } from '../lib/utils';
import { getUserTelemetry, clearUserTraces, TELEMETRY_UPDATE_EVENT, type UserTelemetrySummary } from '../lib/telemetry';
import { useUserProfile } from '../lib/useUserProfile';
import { usePromptQuota } from '../lib/usePromptQuota';
import { normalizeTier } from '../lib/subscriptionTiers';
import { formatCurrency } from '../lib/appSettings';


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
    borderHover: 'group-hover:border-copper-500/40'
  },
  { 
    title: 'Prompt Library', 
    subtitle: 'Curated index of battle-tested prompts', 
    path: '/app/library', 
    shortcut: '⌘L',
    tag: 'INDEX',
    borderHover: 'group-hover:border-purple-500/40'
  },
  { 
    title: 'Prompt History', 
    subtitle: 'Archived prompts, blueprints & generations', 
    path: '/app/history', 
    shortcut: '⌘H',
    tag: 'HISTORY',
    borderHover: 'group-hover:border-blue-500/40'
  },
];

export default function Dashboard() {
  const [telemetry, setTelemetry] = useState<UserTelemetrySummary>({
    totalInferences: 0,
    totalTokens: 0,
    avgLatency: 0,
    p99Latency: 0,
    reliability: 100,
    activeModelsCount: 0,
    activeModels: [],
    traces: [],
  });
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OK' | 'ERR'>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { profile } = useUserProfile();
  const currentTier = normalizeTier(profile?.plan);
  const isFree = currentTier === 'free';
  const { sessionPrompts, sessionLimit, sessionPercent, timeUntilSession } = usePromptQuota();

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    let mounted = true;
    const fetchTelemetry = async () => {
      const data = await getUserTelemetry();
      if (mounted) {
        setTelemetry(data);
      }
    };

    fetchTelemetry();
    window.addEventListener(TELEMETRY_UPDATE_EVENT, fetchTelemetry);
    return () => {
      mounted = false;
      window.removeEventListener(TELEMETRY_UPDATE_EVENT, fetchTelemetry);
    };
  }, []);

  const handleExportCSV = () => {
    if (telemetry.traces.length === 0) {
      showNotification('No traces available to export');
      return;
    }
    const headers = 'TRACE_ID,TIMESTAMP,NODE_ORIGIN,MODEL_TARGET,TOKENS,LATENCY_MS,STATUS\n';
    const rows = telemetry.traces.map(e => `${e.id},${e.time},${e.node},${e.model},${e.tokens},${e.latency},${e.status}`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bedrock-traces-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Trace log exported to CSV');
  };

  const handleClearTraces = async () => {
    await clearUserTraces();
    setTelemetry(prev => ({
      ...prev,
      totalInferences: 0,
      totalTokens: 0,
      avgLatency: 0,
      p99Latency: 0,
      traces: [],
    }));
    showNotification('Telemetry trace log cleared');
  };

  const filteredExecutions = telemetry.traces.filter(item => {
    if (statusFilter === 'OK') return item.status === 'OK';
    if (statusFilter === 'ERR') return item.status !== 'OK';
    return true;
  });

  const hasRuns = telemetry.totalInferences > 0;

  return (
    <PageTransition>
      <div className="relative w-full h-full min-h-screen overflow-y-auto bg-black text-white font-sans selection:bg-copper-500/30 selection:text-white custom-scrollbar pb-16">
        
        {/* Subtle geometric dot grid on pure black */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-0">
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:28px_28px] opacity-20 pointer-events-none" />
        </div>

        {/* MAIN DASHBOARD CONTENT */}
        <div className="relative z-10 w-full px-4 sm:px-8 pt-6 flex flex-col gap-8">
          
          {/* Executive Telemetry Header with EncryptedText */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <EncryptedText
                text="BEDROCK WORKSTATION ACTIVE · REAL-TIME TELEMETRY CLUSTER"
                encryptedClassName="text-copper-500/70 font-mono text-xs tracking-wider"
                revealedClassName="text-emerald-400 font-mono text-xs font-semibold tracking-wider"
                revealDelayMs={30}
                flipDelayMs={30}
              />
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-white/40">
              <span className="px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-copper-300">
                LAKEBASE POSTGRES
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                100% NOMINAL
              </span>
            </div>
          </div>

          {/* SUBSCRIPTION & QUOTA GLASS BANNER */}
          <div className="relative rounded-3xl p-5 sm:p-6 bg-[#0e1117]/80 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border",
                  isFree 
                    ? "bg-copper-500/10 border-copper-500/25 text-copper-400" 
                    : "bg-copper-500/15 border-copper-500/30 text-copper-300"
                )}>
                  {isFree ? <Lock className="w-6 h-6" /> : <Crown className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold font-editorial text-white">
                      {isFree ? 'Free Tier Workspace' : `${profile?.plan || 'Pro Plan'} Active`}
                    </h2>
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider border",
                      isFree 
                        ? "bg-copper-500/15 text-copper-300 border-copper-500/30" 
                        : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    )}>
                      {isFree ? '10 Prompts / Day Quota' : 'Unlimited Generations'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 font-sans">
                    {isFree ? (
                      <span>Session: <strong className="text-white font-mono">{sessionPrompts}/{sessionLimit}</strong> prompts used ({sessionPercent}%). Resets in <strong className="text-copper-300 font-mono">{timeUntilSession}</strong>.</span>
                    ) : (
                      <span>All frontier models, automated evals, and unlimited DAG pipeline nodes unlocked.</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                {isFree ? (
                  <Link
                    to="/app/pricing"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-copper-500 hover:bg-copper-600 text-white font-mono text-xs uppercase tracking-wider font-bold transition-all shadow-lg shadow-copper-500/25 active:scale-[0.98]"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Upgrade Plan ({formatCurrency(4.99)})</span>
                  </Link>

                ) : (
                  <Link
                    to="/app/billing"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-mono text-xs uppercase tracking-wider border border-white/15 transition-all shadow-sm"
                  >
                    <span>Manage Subscription</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>

            {/* Quota bar for Free users */}
            {isFree && (
              <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] font-mono text-zinc-400">
                <div className="flex items-center gap-2.5 flex-1">
                  <span className="shrink-0 text-zinc-400">Daily Quota Meter:</span>
                  <div className="h-1.5 flex-1 bg-black/60 rounded-full overflow-hidden border border-white/10">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        sessionPercent >= 100 ? "bg-red-500" : sessionPercent >= 80 ? "bg-copper-300" : "bg-copper-500"
                      )}
                      style={{ width: `${Math.min(100, sessionPercent)}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-white font-medium">{sessionPercent}%</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-500 text-[10px]">
                  <span>🔒 Pro & Ultimate models require an active subscription</span>
                </div>
              </div>
            )}
          </div>

          {/* EXECUTIVE TELEMETRY KPI GLASS CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* Card 1: Inferences */}
            <div className="relative rounded-3xl glass-panel-luxury p-5 overflow-hidden shadow-[0_20px_45px_rgba(0,0,0,0.6)]">
              <div className="absolute inset-x-0 top-0 h-[1.5px] glass-specular-line pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-white/50 tracking-wide uppercase font-mono">Total Inferences</span>
                <div className="w-8 h-8 rounded-xl bg-copper-500/10 border border-copper-500/25 flex items-center justify-center text-copper-400 shadow-[0_0_12px_rgba(200,168,107,0.2)]">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-white">
                  {telemetry.totalInferences.toLocaleString()}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  {hasRuns ? `${telemetry.totalTokens.toLocaleString()} tok` : 'Active'}
                </span>
              </div>
              <p className="text-[11px] text-white/40 mt-1.5 font-mono">
                {hasRuns ? 'Persisted in Neon DB' : 'Ready to generate prompts'}
              </p>
            </div>

            {/* Card 2: Latency */}
            <div className="relative rounded-3xl glass-panel-luxury p-5 overflow-hidden shadow-[0_20px_45px_rgba(0,0,0,0.6)]">
              <div className="absolute inset-x-0 top-0 h-[1.5px] glass-specular-line pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-white/50 tracking-wide uppercase font-mono">Cluster P99 Latency</span>
                <div className="w-8 h-8 rounded-xl bg-copper-500/10 border border-copper-500/25 flex items-center justify-center text-copper-400 shadow-[0_0_12px_rgba(44,154,139,0.2)]">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-white">
                  {telemetry.p99Latency > 0 ? `${telemetry.p99Latency}ms` : '—'}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  {telemetry.avgLatency > 0 ? `Avg ${telemetry.avgLatency}ms` : 'Standby'}
                </span>
              </div>
              <p className="text-[11px] text-white/40 mt-1.5 font-mono">
                {hasRuns ? 'Real-time cluster telemetry' : 'Awaiting prompt executions'}
              </p>
            </div>

            {/* Card 3: Success Rate */}
            <div className="relative rounded-3xl glass-panel-luxury p-5 overflow-hidden shadow-[0_20px_45px_rgba(0,0,0,0.6)]">
              <div className="absolute inset-x-0 top-0 h-[1.5px] glass-specular-line pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-white/50 tracking-wide uppercase font-mono">System Reliability</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-white">
                  {hasRuns ? `${telemetry.reliability}%` : '100%'}
                </span>
                <span className="inline-flex items-center text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                  Nominal
                </span>
              </div>
              <p className="text-[11px] text-white/40 mt-1.5 font-mono">
                {hasRuns ? `${telemetry.totalInferences} logged inference cycles` : 'Zero SLA breaches recorded'}
              </p>
            </div>

            {/* Card 4: Model Pool */}
            <div className="relative rounded-3xl glass-panel-luxury p-5 overflow-hidden shadow-[0_20px_45px_rgba(0,0,0,0.6)]">
              <div className="absolute inset-x-0 top-0 h-[1.5px] glass-specular-line pointer-events-none" />
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-white/50 tracking-wide uppercase font-mono">Active Model Pool</span>
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                  <Cpu className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-white">
                  {telemetry.activeModelsCount > 0 ? `${telemetry.activeModelsCount} Models` : 'Ready'}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                  Multi-LLM
                </span>
              </div>
              <p className="text-[11px] text-white/40 mt-1.5 font-mono truncate">
                {telemetry.activeModels.length > 0 
                  ? telemetry.activeModels.join(', ') 
                  : 'Gemini, Groq, OpenRouter & OSS'}
              </p>
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
              
              <div className="flex flex-col gap-3 h-full">
                {QUICK_ACTIONS.map((action) => (
                  <Link
                    key={action.path}
                    to={action.path}
                    className={`group relative rounded-2xl glass-card p-4 transition-all duration-300 hover:scale-[1.01] hover:bg-white/[0.04] border border-white/10 ${action.borderHover} flex flex-col justify-between`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/60 group-hover:text-white">
                        {action.tag}
                      </span>
                      <span className="text-[11px] font-mono text-white/30 group-hover:text-white/70 transition-colors flex items-center gap-1">
                        {action.shortcut}
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      </span>
                    </div>

                    <div className="mt-3">
                      <h3 className="text-sm font-display font-semibold text-white group-hover:text-copper-400 transition-colors">
                        {action.title}
                      </h3>
                      <p className="text-xs text-white/50 mt-1 line-clamp-1">
                        {action.subtitle}
                      </p>
                    </div>
                  </Link>
                ))}

                {/* Status card */}
                <div className="rounded-2xl glass-card p-4 border border-white/10 bg-white/[0.015] mt-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-white/60">Cluster Health</span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Nominal
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between text-white/45">
                      <span>Database Engine</span>
                      <span className="font-mono text-white/75">Neon Postgres</span>
                    </div>
                    <div className="flex justify-between text-white/45">
                      <span>Gateway Mode</span>
                      <span className="font-mono text-emerald-400 font-medium">Production Live</span>
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
                <h2 className="text-sm font-display font-semibold text-white tracking-wide">
                  Execution Trace Log
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
                {telemetry.traces.length > 0 && (
                  <button 
                    onClick={handleExportCSV}
                    className="text-xs font-mono border border-white/10 glass-pill-button px-3 py-1.5 rounded-xl text-white/80 hover:text-white transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                    Export CSV
                  </button>
                )}

                {/* Clear Traces Button */}
                {telemetry.traces.length > 0 && (
                  <button 
                    onClick={handleClearTraces}
                    className="text-xs font-mono border border-white/10 glass-pill-button px-3 py-1.5 rounded-xl text-white/80 hover:text-red-400 transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
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
                              <AgentIcon model={exec.model} className="w-3.5 h-3.5" badgeClassName="w-3.5 h-3.5" />
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
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-sm backdrop-blur-sm">
                                200 OK
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/25 shadow-sm backdrop-blur-sm">
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
                <div className="py-16 px-4 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-copper-400 mb-4 shadow-sm">
                    <Sparkles className="w-6 h-6 text-copper-400/80" />
                  </div>
                  <p className="text-base font-display font-semibold text-white tracking-tight">No execution traces yet</p>
                  <p className="text-xs text-white/45 mt-1.5 max-w-md font-mono leading-relaxed">
                    Generate or test your first prompt in Bedrock. Real-time telemetry, token usage, and latency will stream directly into this dashboard and persist to your account.
                  </p>
                  <Link 
                    to="/app/generator"
                    className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-copper-500 to-copper-600 hover:from-copper-400 hover:to-copper-500 text-white rounded-xl text-xs font-semibold uppercase tracking-wider shadow-lg shadow-copper-500/20 transition-all active:scale-95"
                  >
                    Open Prompt Generator
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>
          
        </div>

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl glass-card text-white text-xs shadow-2xl backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 border border-white/15 font-mono">
            <span>{toastMessage}</span>
          </div>
        )}

      </div>
    </PageTransition>
  );
}
