import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MessageCircleQuestion } from 'lucide-react';

export interface AskPending {
  question: string;
  answer: string;
  resolve: (value: string | null) => void;
}

/** The window itself (useAskDialog.tsx owns the state). */
export function AskWindow({ pending, onAnswer, onCancel, onChange }: { pending: AskPending | null; onAnswer: (a: string) => void; onCancel: () => void; onChange: (a: string) => void }) {
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (pending) setTimeout(() => inputRef.current?.focus(), 50);
  }, [pending]);

  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          key="ask"
          className="absolute inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 nowheel nopan nodrag"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel();
          }}
        >
          <motion.form
            role="dialog"
            aria-modal="true"
            aria-labelledby="branch-ask-title"
            initial={reduce ? false : { y: 12, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={reduce ? undefined : { y: 8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onSubmit={(e) => {
              e.preventDefault();
              onAnswer(pending.answer);
            }}
            className="w-full max-w-[420px] rounded-2xl border border-pink-400/30 bg-sf-16181d/95 shadow-2xl p-4 space-y-3"
          >
            <div className="flex items-start gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-pink-500/15 border border-pink-400/30 flex items-center justify-center shrink-0">
                <MessageCircleQuestion className="w-4 h-4 text-pink-300" />
              </span>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-pink-300/80">Your workflow is asking</p>
                <h3 id="branch-ask-title" className="text-sm font-semibold text-white leading-snug">
                  {pending.question}
                </h3>
              </div>
            </div>
            <textarea
              ref={inputRef}
              value={pending.answer}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onAnswer(pending.answer);
                }
              }}
              rows={3}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-pink-400/60 resize-y custom-scrollbar"
              placeholder="Type your answer"
              aria-label="Your answer"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono text-gray-500">Enter to send · Esc to stop the run</span>
              <div className="flex gap-2">
                <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-white/10 transition-colors">
                  Stop run
                </button>
                <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-pink-500/20 text-pink-100 border border-pink-400/40 hover:bg-pink-500/30 transition-colors">
                  Continue
                </button>
              </div>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
