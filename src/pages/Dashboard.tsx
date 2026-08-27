import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Sparkles, GitBranch, FlaskConical, BookOpen, 
  ArrowUpRight, Zap, Activity, TerminalSquare
} from 'lucide-react';
import { PageTransition } from '../components/layout/PageTransition';
import { cn } from '../lib/utils';

// --- MOCK DATA ---
const CHART_DATA = [32, 45, 28, 60, 42, 80, 55, 90, 70, 110, 85, 130];
const MAX_CHART = Math.max(...CHART_DATA);

const RECENT_EXECUTIONS = [
  { id: 'req_8f72k', model: 'gpt-4o', task: 'Generate React Component', tokens: '4,021', latency: '843ms', status: 'success' },
  { id: 'req_2m9x1', model: 'claude-3.5', task: 'Customer Support Extraction', tokens: '12,402', latency: '2.1s', status: 'success' },
  { id: 'req_9p4v0', model: 'gpt-4o-mini', task: 'Format JSON Payload', tokens: '342', latency: '120ms', status: 'success' },
  { id: 'req_5k1b2', model: 'llama-3-70b', task: 'Creative Story Draft', tokens: '2,890', latency: '1.4s', status: 'success' },
  { id: 'req_3x8m9', model: 'gpt-4o', task: 'Code Review Agent', tokens: '8,102', latency: '3.4s', status: 'error' },
];

const QUICK_ACTIONS = [
  { title: 'Prompt Generator', path: '/app/generator', icon: Sparkles, color: 'text-copper-400' },
  { title: 'Branching Pipeline', path: '/app/branching', icon: GitBranch, color: 'text-blue-400' },
  { title: 'A/B Prompt Tester', path: '/app/tester', icon: FlaskConical, color: 'text-purple-400' },
  { title: 'Prompt Library', path: '/app/library', icon: BookOpen, color: 'text-green-400' },
];

// --- COMPONENTS ---

function SparklineChart() {
  const points = CHART_DATA.map((val, i) => {
    const x = (i / (CHART_DATA.length - 1)) * 100;
    const y = 100 - (val / MAX_CHART) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="relative w-full h-full flex flex-col justify-end mt-4">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-16 overflow-visible">
        <defs>
          <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255, 165, 0, 0.4)" />
            <stop offset="100%" stopColor="rgba(255, 165, 0, 0.0)" />
          </linearGradient>
        </defs>
        <polygon 
          points={`0,100 ${points} 100,100`} 
          fill="url(#chart-gradient)" 
          className="animate-pulse opacity-50"
        />
        <polyline 
          points={points} 
          fill="none" 
          stroke="#ffa500" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="drop-shadow-[0_0_8px_rgba(255,165,0,0.5)]"
        />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a]/80 to-transparent pointer-events-none" />
    </div>
  );
}

export default function Dashboard() {
  return (
    <PageTransition>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-80px)] overflow-y-auto custom-scrollbar text-white">
        
        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[160px] pb-12">
          
          {/* HERO CARD (2x2) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
            className="md:col-span-2 md:row-span-2 relative bg-[#111] rounded-3xl border border-white/5 overflow-hidden flex flex-col p-8 group"
          >
            {/* Geometric / Orb Background */}
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-copper-500/20 rounded-full blur-[80px] pointer-events-none group-hover:bg-copper-500/30 transition-all duration-1000" />
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none mix-blend-overlay" />
            
            <div className="relative z-10 flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-auto">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                <span className="text-xs font-mono text-green-400 uppercase tracking-widest">Engine Online</span>
              </div>
              
              <div className="mt-8">
                <h1 className="text-4xl font-display font-medium tracking-tight mb-3">
                  Welcome back,<br/><span className="text-copper-400 font-serif italic">Atharva</span>
                </h1>
                <p className="text-gray-400 text-sm max-w-sm leading-relaxed">
                  Your AI infrastructure is operating at peak efficiency. 12 active workflows are currently routing traffic across 4 models.
                </p>
              </div>
            </div>
          </motion.div>

          {/* USAGE CHART (2x1) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            className="md:col-span-2 md:row-span-1 bg-[#151515] rounded-3xl border border-white/5 p-6 flex flex-col relative overflow-hidden"
          >
            <div className="flex justify-between items-start z-10">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Total Tokens (7d)</h3>
                <div className="text-2xl font-mono text-white">4.28M</div>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-green-400 bg-green-400/10 px-2 py-1 rounded-md">
                <ArrowUpRight className="w-3 h-3" /> 14.2%
              </div>
            </div>
            <SparklineChart />
          </motion.div>

          {/* METRIC: LATENCY (1x1) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
            className="md:col-span-1 md:row-span-1 bg-[#151515] rounded-3xl border border-white/5 p-6 flex flex-col justify-between group hover:border-white/10 transition-colors"
          >
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              P95 Latency
            </h3>
            <div>
              <div className="text-3xl font-mono text-white mb-1">245<span className="text-lg text-gray-500">ms</span></div>
              <p className="text-xs text-gray-400">Across all active models</p>
            </div>
          </motion.div>

          {/* METRIC: COST LIMIT (1x1) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
            className="md:col-span-1 md:row-span-1 bg-[#151515] rounded-3xl border border-white/5 p-6 flex flex-col justify-between group hover:border-white/10 transition-colors"
          >
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <Zap className="w-4 h-4 text-copper-400" />
              Cost Guardrail
            </h3>
            <div className="w-full">
              <div className="flex justify-between text-xs mb-2 font-mono">
                <span className="text-white">$42.50</span>
                <span className="text-gray-500">$100</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-copper-500 w-[42.5%] rounded-full" />
              </div>
            </div>
          </motion.div>

          {/* EXECUTION LOG (3x2) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
            className="md:col-span-3 md:row-span-2 bg-[#111] rounded-3xl border border-white/5 p-6 flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <TerminalSquare className="w-4 h-4 text-gray-400" />
                Live Execution Log
              </h2>
              <button className="text-xs text-gray-500 hover:text-white transition-colors font-medium flex items-center gap-1">
                View All <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-gray-500 border-b border-white/5">
                    <th className="pb-3 font-semibold">Request ID</th>
                    <th className="pb-3 font-semibold">Model</th>
                    <th className="pb-3 font-semibold hidden sm:table-cell">Task</th>
                    <th className="pb-3 font-semibold text-right">Tokens</th>
                    <th className="pb-3 font-semibold text-right">Latency</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {RECENT_EXECUTIONS.map((exec, idx) => (
                    <tr key={idx} className="border-b border-white/5 group hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 font-mono text-gray-400 text-xs">
                        {exec.id}
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-white border border-white/10">
                          {exec.model}
                        </span>
                      </td>
                      <td className="py-3 text-gray-300 truncate max-w-[200px] hidden sm:table-cell">
                        {exec.task}
                      </td>
                      <td className="py-3 font-mono text-gray-400 text-right text-xs">
                        {exec.tokens}
                      </td>
                      <td className="py-3 font-mono text-right text-xs flex items-center justify-end gap-2">
                        {exec.latency}
                        <div className={cn("w-1.5 h-1.5 rounded-full", exec.status === 'success' ? 'bg-green-500' : 'bg-red-500')} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* QUICK ACTIONS (1x2) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}
            className="md:col-span-1 md:row-span-2 bg-[#151515] rounded-3xl border border-white/5 p-4 flex flex-col"
          >
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 px-2 mt-2">
              Workspaces
            </h2>
            <div className="flex flex-col gap-2">
              {QUICK_ACTIONS.map((action) => (
                <Link 
                  key={action.title} 
                  to={action.path}
                  className="group relative flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-all duration-300"
                >
                  <div className="w-10 h-10 rounded-xl bg-black border border-white/5 flex items-center justify-center shadow-inner group-hover:border-white/10 transition-colors">
                    <action.icon className={cn("w-5 h-5", action.color)} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">{action.title}</h3>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-gray-600 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-white transition-all duration-300" />
                </Link>
              ))}
            </div>
            
            <div className="mt-auto p-4 bg-copper-500/10 border border-copper-500/20 rounded-2xl mx-2 mb-2">
              <h4 className="text-xs font-semibold text-copper-400 mb-1">Pro Tip</h4>
              <p className="text-xs text-copper-200/60 leading-relaxed">
                Connect your GitHub repository to automatically sync prompts to your codebase.
              </p>
            </div>
          </motion.div>

        </div>
      </div>
    </PageTransition>
  );
}
