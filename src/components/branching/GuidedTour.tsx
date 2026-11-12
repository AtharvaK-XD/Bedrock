import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/utils';

interface TourStep {
  title: string;
  text: string;
  /** CSS selector of what to point at. The first match is highlighted. */
  target: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'This is a node',
    text: 'Each box is one step. It takes something in, does one job, and passes the result on.',
    target: '.react-flow__node',
  },
  {
    title: 'Join nodes with a wire',
    text: 'Drag from a dot on one node to a dot on another. Whatever the first node makes flows along the wire.',
    target: '.react-flow__node .react-flow__handle',
  },
  {
    title: 'Click a node to edit it',
    text: 'Click any node and its settings open on the left. Change the text, the AI model or the rules.',
    target: '.react-flow__node',
  },
  {
    title: 'Press Run',
    text: 'Run a node to see it work. Run the early steps first, then the ones after them.',
    target: '[data-tour="run"]',
  },
  {
    title: 'See the result',
    text: 'The answer appears inside the node. Use "View" to read it in full, copy it, or see it as JSON or a table.',
    target: '[data-tour="result"], [data-tour="run"]',
  },
];

const SPOT_CLASS = 'branch-tour-spot';

interface GuidedTourProps {
  open: boolean;
  onClose: () => void;
}

/** Five short steps, shown once. Each step outlines the part of the screen it talks about. */
export function GuidedTour({ open, onClose }: GuidedTourProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  // Outline the target of the current step (and remove the outline again when the step changes or the tour closes)
  useEffect(() => {
    if (!open) return;
    const el = document.querySelector<HTMLElement>(TOUR_STEPS[step].target);
    el?.classList.add(SPOT_CLASS);
    return () => el?.classList.remove(SPOT_CLASS);
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const last = step === TOUR_STEPS.length - 1;
  const current = TOUR_STEPS[step];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-label="Branching tour"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="absolute left-1/2 -translate-x-1/2 bottom-24 z-40 w-[min(92vw,420px)] rounded-2xl border border-copper-500/40 bg-sf-16181d/95 backdrop-blur-2xl shadow-2xl p-4 nowheel nopan nodrag"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-copper-400">
              Step {step + 1} of {TOUR_STEPS.length}
            </span>
            <div className="flex items-center gap-1" aria-hidden="true">
              {TOUR_STEPS.map((_, i) => (
                <span key={i} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-5 bg-copper-500' : i < step ? 'w-2 bg-emerald-500' : 'w-2 bg-white/15')} />
              ))}
            </div>
          </div>
          <h3 className="font-display text-base text-white">{current.title}</h3>
          <p className="text-xs text-gray-300 mt-1 leading-relaxed">{current.text}</p>
          <div className="flex items-center justify-between mt-3">
            <button type="button" onClick={onClose} className="text-xs text-gray-500 hover:text-gray-300 underline-offset-2 hover:underline cursor-pointer">
              Skip
            </button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button type="button" onClick={() => setStep((s) => s - 1)} className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-gray-300 hover:bg-white/5 cursor-pointer">
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={() => (last ? onClose() : setStep((s) => s + 1))}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-copper-500 hover:bg-copper-600 text-white shadow-md shadow-copper-500/20 cursor-pointer active:scale-[0.97]"
              >
                {last ? 'Done' : 'Next'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
