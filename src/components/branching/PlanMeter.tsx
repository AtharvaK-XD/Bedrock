import { cn } from '../../lib/utils';

interface PlanMeterProps {
  /** Nodes that count toward the limit (sticky notes are excluded by the caller). */
  count: number;
  /** The plan's node limit, or Infinity (desktop and unlimited plans). */
  limit: number;
  /** "Free", "Pro", "Ultimate"... */
  planLabel: string;
  /** Opens the upgrade window. Only used when there is a limit. */
  onClick: () => void;
}

/** "2 / 3 nodes (Free)": turns amber at the limit, and opens the upgrade window when clicked. */
export function PlanMeter({ count, limit, planLabel, onClick }: PlanMeterProps) {
  const limited = Number.isFinite(limit);
  const atLimit = limited && count >= limit;
  const label = limited ? `${count} / ${limit} nodes (${planLabel})` : `${count} ${count === 1 ? 'node' : 'nodes'}`;

  const className = cn(
    'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors',
    atLimit ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/10 text-gray-300'
  );

  if (!limited) {
    return (
      <span className={className} title={`${count} ${count === 1 ? 'node' : 'nodes'} on canvas`}>
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(className, 'cursor-pointer', atLimit ? 'hover:bg-amber-500/25' : 'hover:bg-white/10')}
      title={atLimit ? 'You have reached your plan limit. Click to see upgrade options.' : 'Nodes used on your plan. Click to see upgrade options.'}
    >
      {label}
    </button>
  );
}
