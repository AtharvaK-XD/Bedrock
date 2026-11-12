import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Trophy, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MISSIONS, type MissionId } from './missionList';

const CONFETTI_COLORS = ['#2c9a8b', '#ff9b71', '#f5c542', '#7c9cff', '#f06292', '#6ee7b7'];

/** A short burst of falling pieces, drawn with CSS only. Skipped when the person asked for less motion. */
export function Confetti({ burst }: { burst: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (burst === 0) return;
    const reduce =
      document.documentElement.classList.contains('reduce-motion') ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reduce) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1900);
    return () => clearTimeout(t);
  }, [burst]);

  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: `${(i * 97) % 100}%`,
        delay: `${(i % 9) * 0.05}s`,
        duration: `${1.1 + (i % 5) * 0.18}s`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: `${(i * 47) % 360}deg`,
        drift: `${((i % 7) - 3) * 18}px`,
      })),
    []
  );

  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="branch-confetti-piece"
          style={
            {
              left: p.left,
              animationDelay: p.delay,
              animationDuration: p.duration,
              backgroundColor: p.color,
              '--confetti-rotate': p.rotate,
              '--confetti-drift': p.drift,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

interface MissionsPanelProps {
  open: boolean;
  done: MissionId[];
  onClose: () => void;
}

export function MissionsPanel({ open, done, onClose }: MissionsPanelProps) {
  const finished = new Set(done);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-label="Missions"
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          className="absolute top-16 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,360px)] rounded-2xl border border-white/10 bg-sf-16181d/95 backdrop-blur-2xl shadow-2xl p-4 nowheel nopan nodrag"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-300" />
              <h3 className="font-display text-sm text-white">Missions</h3>
              <span className="text-[10px] font-mono text-gray-400">
                {finished.size} of {MISSIONS.length}
              </span>
            </div>
            <button type="button" onClick={onClose} aria-label="Close missions" className="text-gray-400 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-3" role="progressbar" aria-valuenow={finished.size} aria-valuemin={0} aria-valuemax={MISSIONS.length}>
            <motion.div className="h-full rounded-full bg-copper-500" animate={{ width: `${(finished.size / MISSIONS.length) * 100}%` }} transition={{ type: 'spring', stiffness: 160, damping: 22 }} />
          </div>
          <ul className="space-y-1.5">
            {MISSIONS.map((m) => {
              const isDone = finished.has(m.id);
              return (
                <li key={m.id} className={cn('flex items-start gap-2.5 rounded-xl border p-2.5', isDone ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/5 bg-white/[0.02]')}>
                  <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', isDone ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-white/20')}>
                    {isDone && <Check className="h-3 w-3" />}
                  </span>
                  <div className="min-w-0">
                    <p className={cn('text-xs font-medium', isDone ? 'text-emerald-200' : 'text-white')}>{m.title}</p>
                    {!isDone && <p className="text-[11px] text-gray-400 mt-0.5">{m.hint}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
