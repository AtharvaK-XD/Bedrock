import { motion, AnimatePresence } from 'framer-motion';
import { Hourglass, Sparkles, X, ArrowRight, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuotaLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionPrompts: number;
  sessionLimit: number;
  weeklyPrompts: number;
  weeklyLimit: number;
  timeUntilSession: string;
  timeUntilWeekly: string;
  isWeeklyLimitReached?: boolean;
}

export function QuotaLimitModal({
  isOpen,
  onClose,
  sessionPrompts,
  sessionLimit,
  weeklyPrompts,
  weeklyLimit,
  timeUntilSession,
  timeUntilWeekly,
  isWeeklyLimitReached = false,
}: QuotaLimitModalProps) {
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-[#0c0e14]/95 p-6 sm:p-8 backdrop-blur-2xl border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.15)] text-white z-10"
          >
            {/* Top specular hairline */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent pointer-events-none" />
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/5 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                {isWeeklyLimitReached ? <ShieldAlert className="w-6 h-6" /> : <Hourglass className="w-6 h-6 animate-pulse" />}
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
                  Free Tier Quota
                </span>
                <h3 className="text-xl font-bold font-editorial text-white tracking-tight">
                  {isWeeklyLimitReached ? 'Weekly Prompt Limit Reached' : '5-Hour Session Limit Reached'}
                </h3>
              </div>
            </div>

            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
              {isWeeklyLimitReached ? (
                <>You have reached your free tier weekly limit of <strong>{weeklyLimit} prompts</strong>. Your quota will refresh in <strong>{timeUntilWeekly}</strong>.</>
              ) : (
                <>Free tier accounts can generate up to <strong>{sessionLimit} prompts</strong> per 5-hour session. Your session limit will reset in <strong>{timeUntilSession}</strong> with 10 fresh prompts.</>
              )}
            </p>

            {/* Quota breakdown box */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 mb-6 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-gray-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  5-Hour Session Quota:
                </span>
                <span className="font-semibold text-white">
                  {sessionPrompts} / {sessionLimit} prompts ({Math.min(100, Math.round((sessionPrompts / sessionLimit) * 100))}%)
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-400 text-[11px]">
                <span>Session Resets In:</span>
                <span className="text-amber-300 font-medium">{timeUntilSession}</span>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-gray-300">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  Weekly Quota:
                </span>
                <span className="font-semibold text-white">
                  {weeklyPrompts} / {weeklyLimit} prompts ({Math.min(100, Math.round((weeklyPrompts / weeklyLimit) * 100))}%)
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-400 text-[11px]">
                <span>Weekly Resets In:</span>
                <span className="text-blue-300 font-medium">{timeUntilWeekly}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/app/pricing');
                }}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-copper-500 to-amber-600 hover:from-copper-600 hover:to-amber-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-copper-500/20 transition-all active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4" />
                Upgrade for Unlimited
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-colors"
              >
                Wait for Reset
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
