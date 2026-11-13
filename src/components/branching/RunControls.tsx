import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, CircleDot, Footprints, Lightbulb, Play, Square, Stethoscope, X, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { GraphIssue } from '../../lib/workflowEngine';
import type { StepState } from './useWorkflowRunner';
import { sortIssues } from './runMapping';

interface RunButtonsProps {
  running: boolean;
  stopping: boolean;
  stepActive: boolean;
  canRun: boolean;
  aiEstimate: number;
  onRunAll: () => void;
  onStop: () => void;
  onStartSteps: () => void;
}

/** "Run all", "Step" and "Stop": the first thing in the top bar. */
export function RunButtons(p: RunButtonsProps) {
  if (p.running) {
    return (
      <button
        type="button"
        onClick={p.onStop}
        disabled={p.stopping}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/15 text-rose-200 border border-rose-500/35 hover:bg-rose-500/25 transition-colors disabled:opacity-60 cursor-pointer"
        title="Stop after the current step"
      >
        <Square className="w-3 h-3 fill-current" />
        {p.stopping ? 'Stopping…' : 'Stop'}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        data-tour="run-all"
        onClick={p.onRunAll}
        disabled={!p.canRun || p.stepActive}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-copper-500/20 text-copper-200 border border-copper-500/40 hover:bg-copper-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        title={p.aiEstimate > 0 ? `Run every step in order (about ${p.aiEstimate} AI ${p.aiEstimate === 1 ? 'call' : 'calls'})` : 'Run every step in order (no AI calls)'}
      >
        <Play className="w-3 h-3 fill-current" />
        Run all
      </button>
      <button
        type="button"
        onClick={p.onStartSteps}
        disabled={!p.canRun || p.stepActive}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-gray-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        title="Go one step at a time and see why each decision went the way it did"
      >
        <Footprints className="w-3.5 h-3.5" />
        Step
      </button>
    </div>
  );
}

/** The doctor's chip: green when ready, amber or red with a count when something needs a look. */
export function DoctorChip({ issues, open, onToggle }: { issues: GraphIssue[]; open: boolean; onToggle: () => void }) {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const tone = errors ? 'error' : warnings ? 'warning' : 'ok';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-mono transition-colors cursor-pointer',
        tone === 'ok' && 'text-emerald-300 hover:bg-emerald-500/10',
        tone === 'warning' && 'text-amber-200 bg-amber-500/10 hover:bg-amber-500/15',
        tone === 'error' && 'text-rose-200 bg-rose-500/10 hover:bg-rose-500/15',
        open && 'ring-1 ring-white/15'
      )}
      title="Pipeline doctor: checks your workflow before you run it"
    >
      <Stethoscope className="w-3.5 h-3.5" />
      {tone === 'ok' ? 'Ready' : `${errors + warnings} to check`}
    </button>
  );
}

const ICONS = { error: XCircle, warning: AlertTriangle, tip: Lightbulb } as const;
const TONE = {
  error: 'text-rose-300',
  warning: 'text-amber-300',
  tip: 'text-sky-300',
} as const;

/** The doctor's list. Clicking a problem jumps to the node it is about. */
export function DoctorPanel({ open, issues, onClose, onFocus }: { open: boolean; issues: GraphIssue[]; onClose: () => void; onFocus: (issue: GraphIssue) => void }) {
  const reduce = useReducedMotion();
  const sorted = sortIssues(issues);
  const blocking = issues.some((i) => i.severity !== 'tip');
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="doctor"
          initial={reduce ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16 }}
          className="absolute top-16 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,400px)] rounded-2xl border border-white/10 bg-sf-16181d/95 backdrop-blur-2xl shadow-2xl p-3 nowheel nopan nodrag"
          role="dialog"
          aria-label="Pipeline doctor"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-copper-300" /> Pipeline doctor
            </span>
            <button type="button" onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10" aria-label="Close the doctor">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {!blocking && (
            <p className="flex items-center gap-1.5 text-[12px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2 mb-2">
              <CheckCircle2 className="w-4 h-4" /> All good, ready to run.
            </p>
          )}
          {sorted.length > 0 && (
            <ul className="max-h-[46vh] overflow-y-auto custom-scrollbar space-y-1.5 pr-0.5" data-lenis-prevent="true">
              {sorted.map((issue, i) => {
                const Icon = ICONS[issue.severity];
                return (
                  <li key={`${issue.code}-${issue.nodeId ?? issue.edgeId ?? ''}-${i}`}>
                    <button
                      type="button"
                      onClick={() => onFocus(issue)}
                      disabled={!issue.nodeId}
                      className="w-full text-left rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] disabled:hover:bg-white/[0.03] px-2.5 py-2 transition-colors"
                    >
                      <span className="flex items-start gap-2">
                        <Icon className={cn('w-3.5 h-3.5 shrink-0 mt-0.5', TONE[issue.severity])} />
                        <span className="space-y-0.5 min-w-0">
                          <span className="block text-[12px] text-gray-100 leading-snug">{issue.message}</span>
                          {issue.fix && <span className="block text-[11px] text-gray-400 leading-snug">{issue.fix}</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Step-by-step mode: what just happened, and the button for the next step. */
export function StepCard({ step, running, nextTitle, onNext, onExit }: { step: StepState | null; running: boolean; nextTitle: string | null; onNext: () => void; onExit: () => void }) {
  const reduce = useReducedMotion();
  const done = step ? step.index >= step.order.length : false;
  return (
    <AnimatePresence>
      {step && (
        <motion.div
          key="step"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.18 }}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 w-[min(92vw,440px)] rounded-2xl border border-copper-500/30 bg-sf-16181d/95 backdrop-blur-2xl shadow-2xl p-3.5 space-y-2.5 nowheel nopan nodrag"
          role="region"
          aria-label="Step-by-step run"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-copper-300 flex items-center gap-1.5">
              <Footprints className="w-3.5 h-3.5" /> Step {Math.min(step.index + (done ? 0 : 1), step.order.length)} of {step.order.length}
            </span>
            <button type="button" onClick={onExit} className="text-[11px] text-gray-400 hover:text-white">
              Exit steps
            </button>
          </div>
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-copper-400 transition-[width] duration-300" style={{ width: `${(step.index / Math.max(1, step.order.length)) * 100}%` }} />
          </div>
          {step.lastMessage ? (
            <p
              className={cn(
                'text-[12px] leading-snug rounded-xl px-3 py-2 border',
                step.lastTone === 'error' && 'text-rose-200 bg-rose-500/10 border-rose-500/25',
                step.lastTone === 'skip' && 'text-gray-300 bg-white/5 border-white/10',
                step.lastTone === 'ok' && 'text-emerald-100 bg-emerald-500/10 border-emerald-500/20'
              )}
              aria-live="polite"
            >
              {step.lastMessage}
            </p>
          ) : (
            <p className="text-[12px] text-gray-300 leading-snug">Each press runs one step. Watch the wires: a decision turns paths on or off.</p>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-gray-400 truncate flex items-center gap-1.5">
              {!done && nextTitle && (
                <>
                  <CircleDot className="w-3 h-3 text-copper-300 shrink-0" /> Next: <span className="text-white truncate">{nextTitle}</span>
                </>
              )}
              {done && 'All steps done.'}
            </span>
            {done ? (
              <button type="button" onClick={onExit} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 text-white hover:bg-white/15">
                Finish
              </button>
            ) : (
              <button
                type="button"
                onClick={onNext}
                disabled={running}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-copper-500/20 text-copper-100 border border-copper-500/40 hover:bg-copper-500/30 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Play className="w-3 h-3 fill-current" />
                {running ? 'Running…' : 'Next step'}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
