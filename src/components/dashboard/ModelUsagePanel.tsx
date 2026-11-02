import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wand2 } from 'lucide-react';
import { AgentIcon } from '../ui/ModelLogos';
import type { UserTraceItem } from '../../lib/telemetry';

interface ModelRow {
  model: string;
  runs: number;
  failures: number;
  tokens: number;
  avgLatency: number;
}

/** Real usage per model, worked out from the user's own run log. Nothing here is estimated or made up. */
export function ModelUsagePanel({ traces }: { traces: UserTraceItem[] }) {
  const rows = useMemo<ModelRow[]>(() => {
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

  const maxRuns = rows[0]?.runs || 1;

  return (
    <div className="glass-card flex min-h-[320px] flex-col rounded-3xl p-5 sm:p-6">
      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-copper-500/25 bg-copper-500/10 text-copper-400">
            <Wand2 className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-white">No runs yet</p>
          <p className="max-w-xs text-xs leading-relaxed text-white/50">
            Once you generate a prompt, you will see which models handled it, how often, and how fast.
          </p>
          <Link
            to="/app/generator"
            className="mt-1 rounded-xl bg-copper-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-copper-500/25 transition-all hover:bg-copper-600 active:scale-[0.98]"
          >
            Start a prompt
          </Link>
        </div>
      ) : (
        <ul className="flex flex-1 flex-col justify-center gap-4">
          {rows.map((row, index) => (
            <li key={row.model}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                <span className="flex min-w-0 items-center gap-2 text-white">
                  <AgentIcon model={row.model} className="h-4 w-4 shrink-0" badgeClassName="w-4 h-4" />
                  <span className="truncate font-medium">{row.model}</span>
                </span>
                <span className="shrink-0 text-white/50">
                  {row.runs} {row.runs === 1 ? 'run' : 'runs'}
                  {row.avgLatency > 0 && <> · avg {row.avgLatency} ms</>}
                  {row.failures > 0 && <span className="text-rose-400"> · {row.failures} failed</span>}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-copper-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(6, Math.round((row.runs / maxRuns) * 100))}%` }}
                  transition={{ duration: 0.7, delay: index * 0.06, ease: 'easeOut' }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
