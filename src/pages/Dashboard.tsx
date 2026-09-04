import { Link } from 'react-router-dom';
import { PageTransition } from '../components/layout/PageTransition';
import { NetworkTopology2D } from '../components/dashboard/NetworkTopology2D';

// --- MOCK DATA ---
const RECENT_EXECUTIONS = [
  { id: 'TRC-8F72K9', time: '14:22:01.042', node: 'SYSTEM_PROMPT_01', model: 'gpt-4o', tokens: 4021, latency: 843, status: 'OK' },
  { id: 'TRC-2M9X1B', time: '14:22:00.891', node: 'DATA_EXTRACT_A', model: 'claude-3.5', tokens: 12402, latency: 2104, status: 'OK' },
  { id: 'TRC-9P4V0C', time: '14:21:58.112', node: 'ROUTER_NODE', model: 'gpt-4o-mini', tokens: 342, latency: 120, status: 'OK' },
  { id: 'TRC-5K1B2F', time: '14:21:55.663', node: 'CREATIVE_AGENT', model: 'llama-3-70b', tokens: 2890, latency: 1420, status: 'OK' },
  { id: 'TRC-3X8M9Z', time: '14:21:50.001', node: 'CODE_REVIEW', model: 'gpt-4o', tokens: 8102, latency: 3411, status: 'ERR_TIMEOUT' },
  { id: 'TRC-1A2B3C', time: '14:21:48.552', node: 'SYSTEM_PROMPT_01', model: 'gpt-4o', tokens: 412, latency: 198, status: 'OK' },
];

const QUICK_ACTIONS = [
  { title: 'PROMPT_GENERATOR', path: '/app/generator', shortcut: '⌘G' },
  { title: 'BRANCHING_PIPELINE', path: '/app/branching', shortcut: '⌘B' },
  { title: 'PROMPT_TESTER', path: '/app/tester', shortcut: '⌘T' },
  { title: 'PROMPT_LIBRARY', path: '/app/library', shortcut: '⌘L' },
];

export default function Dashboard() {
  return (
    <PageTransition>
      <div className="w-full h-full overflow-y-auto bg-black text-white font-mono selection:bg-white/20 custom-scrollbar pb-12">
        
        {/* HEADER / TICKER */}
        <header className="w-full border-b border-white/10 px-4 sm:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 bg-black/90 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-bold tracking-widest uppercase">Bedrock / Cmd_Center</h1>
            <div className="h-4 w-px bg-white/20 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse" />
              <span className="text-xs text-green-400 font-semibold tracking-widest">SYS_ONLINE</span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 sm:gap-8 text-xs text-white/60 tracking-widest">
            <div className="flex gap-2">
              <span className="text-white/30">P99_LAT:</span>
              <span className="text-white">242ms</span>
            </div>
            <div className="flex gap-2">
              <span className="text-white/30">TOK/SEC:</span>
              <span className="text-white">14.2K</span>
            </div>
            <div className="flex gap-2">
              <span className="text-white/30">ERR_RT:</span>
              <span className="text-red-400">0.04%</span>
            </div>
          </div>
        </header>

        <div className="w-full px-4 sm:px-8 pt-8 flex flex-col gap-8">
          
          {/* TOP SECTION: Topology & Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Main Viz */}
            <div className="lg:col-span-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs text-white/50 tracking-widest">TRAFFIC_ROUTING_GRAPH</h2>
                <span className="text-[10px] text-white/30">REFRESH_RATE: 1000ms</span>
              </div>
              <NetworkTopology2D />
            </div>

            {/* Quick Actions (Terminal Style) */}
            <div className="lg:col-span-1 flex flex-col gap-2">
              <h2 className="text-xs text-white/50 tracking-widest">EXECUTABLES</h2>
              <div className="flex-1 border border-white/10 bg-[#050505] p-4 flex flex-col gap-1">
                {QUICK_ACTIONS.map((action, idx) => (
                  <Link 
                    key={action.title} 
                    to={action.path}
                    className="group flex items-center justify-between p-2 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-white/30 group-hover:text-white transition-colors">{`0${idx + 1}_`}</span>
                      <span className="text-sm tracking-wide group-hover:font-bold transition-all">{action.title}</span>
                    </div>
                    <span className="text-[10px] text-white/20 border border-white/10 px-1.5 py-0.5 group-hover:text-white/60 group-hover:border-white/30 transition-colors">
                      {action.shortcut}
                    </span>
                  </Link>
                ))}
                
                <div className="mt-auto pt-4 border-t border-white/10">
                  <div className="text-[10px] text-white/30 leading-relaxed">
                    <span className="text-blue-400">{'>'}</span> sys.info()<br/>
                    Build: 1.0.4-rc2<br/>
                    Region: us-east-1<br/>
                    Load: 24%
                  </div>
                </div>
              </div>
            </div>
            
          </div>

          {/* BOTTOM SECTION: Telemetry Log */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs text-white/50 tracking-widest">TRACE_LOG (LAST_6_EVENTS)</h2>
              <div className="flex gap-2">
                <button className="text-[10px] border border-white/10 px-2 py-1 hover:bg-white/10 transition-colors">EXPORT_CSV</button>
                <button className="text-[10px] border border-white/10 px-2 py-1 hover:bg-white/10 transition-colors">CLEAR</button>
              </div>
            </div>
            
            <div className="w-full border border-white/10 bg-[#050505] overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead>
                  <tr className="text-white/40 border-b border-white/10 bg-white/[0.02]">
                    <th className="p-3 font-normal tracking-widest">TRACE_ID</th>
                    <th className="p-3 font-normal tracking-widest">TIMESTAMP</th>
                    <th className="p-3 font-normal tracking-widest">NODE_ORIGIN</th>
                    <th className="p-3 font-normal tracking-widest">MODEL_TARGET</th>
                    <th className="p-3 font-normal tracking-widest text-right">TOKENS</th>
                    <th className="p-3 font-normal tracking-widest text-right">LATENCY(ms)</th>
                    <th className="p-3 font-normal tracking-widest text-right">STATUS</th>
                  </tr>
                </thead>
                <tbody className="text-white/80">
                  {RECENT_EXECUTIONS.map((exec, idx) => (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors cursor-crosshair">
                      <td className="p-3 text-white/50">{exec.id}</td>
                      <td className="p-3">{exec.time}</td>
                      <td className="p-3">{exec.node}</td>
                      <td className="p-3">
                        <span className="bg-white/10 px-1.5 py-0.5">{exec.model}</span>
                      </td>
                      <td className="p-3 text-right">{exec.tokens}</td>
                      <td className="p-3 text-right">{exec.latency}</td>
                      <td className="p-3 text-right">
                        <span className={exec.status === 'OK' ? 'text-green-400' : 'text-red-400'}>
                          [{exec.status}]
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      </div>
    </PageTransition>
  );
}
