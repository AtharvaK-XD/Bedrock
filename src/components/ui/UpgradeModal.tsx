import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Check, X, ArrowRight, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  requiredTier?: 'pro' | 'ultimate';
  reason?: string;
}

export function UpgradeModal({
  isOpen,
  onClose,
  featureName = 'Frontier Intelligence Model',
  requiredTier = 'pro',
  reason,
}: UpgradeModalProps) {
  const navigate = useNavigate();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isUltimate = requiredTier === 'ultimate';
  const planTitle = isUltimate ? 'Ultimate Plan' : 'Pro Plan';
  const planPrice = isUltimate ? '₹999' : '₹399';
  const planUsd = isUltimate ? '~$12' : '~$5';

  const proFeatures = [
    'Unlock GPT-4o Mini, Claude 3.5 Haiku & Llama 3.3 70B',
    'Unlimited daily prompt generations (No quota limits)',
    'Up to 15 nodes in Branching DAG visual editor',
    'One-click export to .cursorrules & .windsurfrules',
    'Save up to 100 prompts in private Library with search',
  ];

  const ultimateFeatures = [
    'Unlock Claude 3.5 Sonnet & OpenAI GPT-4o Flagship',
    'Unlock o3-mini & Perplexity Sonar Pro live web grounding',
    'Unlimited nodes in Branching DAG visual pipelines',
    'Automated Eval Assertions & Prompt benchmarking reports',
    'Priority high-throughput LPU execution queue',
    'Lifetime execution trace retention in Neon Postgres',
  ];

  const features = isUltimate ? ultimateFeatures : proFeatures;

  const handleUpgradeClick = () => {
    onClose();
    navigate('/app/pricing');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
        {/* Backdrop click to close */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg rounded-3xl bg-[#0c0e14]/95 border border-white/10 shadow-[0_25px_65px_-12px_rgba(0,0,0,0.95),0_0_40px_rgba(200,168,107,0.15)] overflow-hidden z-10 p-6 sm:p-8"
        >
          {/* Ambient Glows */}
          <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-copper-400/50 to-transparent pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-copper-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header Badge */}
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-amber-500/10 border border-amber-500/25 text-amber-300 uppercase tracking-wider">
              {isUltimate ? <Crown className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
              <span>{isUltimate ? 'Ultimate Feature' : 'Pro Feature'}</span>
            </span>
          </div>

          {/* Title */}
          <h2 className="text-xl sm:text-2xl font-bold font-editorial text-white tracking-tight mb-2">
            Unlock {featureName}
          </h2>

          <p className="text-xs sm:text-sm text-gray-400 mb-6 leading-relaxed">
            {reason || (
              <>
                <strong className="text-white">{featureName}</strong> is reserved for our{' '}
                <span className="text-copper-300 font-medium">{planTitle}</span> members. Upgrade your plan to get immediate access.
              </>
            )}
          </p>

          {/* Plan Highlights Box */}
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4 sm:p-5 mb-6">
            <div className="flex items-baseline justify-between mb-3 pb-3 border-b border-white/[0.06]">
              <div>
                <span className="text-sm font-semibold text-white">{planTitle}</span>
                <span className="text-[11px] text-gray-400 block">Flat monthly subscription</span>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold font-mono text-white">{planPrice}</span>
                <span className="text-xs text-gray-400">/mo ({planUsd})</span>
              </div>
            </div>

            <ul className="space-y-2.5 text-xs text-gray-300 font-sans">
              {features.map((feat, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleUpgradeClick}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-copper-500 via-copper-400 to-amber-500 text-black font-semibold text-xs sm:text-sm uppercase tracking-wider font-mono hover:brightness-110 transition-all shadow-[0_4px_20px_rgba(200,168,107,0.3)] cursor-pointer"
            >
              <span>Upgrade to {planTitle}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-mono uppercase tracking-wider transition-colors border border-white/10"
            >
              Keep Free
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
