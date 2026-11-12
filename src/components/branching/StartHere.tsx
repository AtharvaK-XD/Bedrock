import { motion } from 'framer-motion';
import { LayoutTemplate, Wand2, SquareDashed } from 'lucide-react';

interface StartHereProps {
  onStarter: () => void;
  onBlank: () => void;
  /** Wave 2: "Build it for me (AI)". The card only shows when this is given, so it stays hidden until the backend is ready. */
  onBuildForMe?: () => void;
}

/** Shown over an empty canvas so a first-time user always has an obvious next step. */
export function StartHere({ onStarter, onBlank, onBuildForMe }: StartHereProps) {
  const cards = [
    {
      key: 'starter',
      icon: LayoutTemplate,
      title: 'Try a 3-node starter',
      text: 'A ready-made pipeline you can run in one click. Change the question and press Run.',
      cta: 'Load the starter',
      onClick: onStarter,
      primary: true,
    },
    ...(onBuildForMe
      ? [
          {
            key: 'ai',
            icon: Wand2,
            title: 'Build it for me (AI)',
            text: 'Describe what you want in a sentence and Bedrock drafts the pipeline.',
            cta: 'Describe it',
            onClick: onBuildForMe,
            primary: false,
          },
        ]
      : []),
    {
      key: 'blank',
      icon: SquareDashed,
      title: 'Blank canvas',
      text: 'Start from nothing. Add nodes from the palette on the right.',
      cta: 'Start empty',
      onClick: onBlank,
      primary: false,
    },
  ];

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-6 pointer-events-none nowheel nopan nodrag">
      <div className="pointer-events-auto max-w-4xl w-full">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <h2 className="font-display text-2xl text-white tracking-tight">Start here</h2>
          <p className="text-sm text-gray-400 mt-1">A pipeline is a few steps joined by wires. Pick how you would like to begin.</p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.button
                key={card.key}
                type="button"
                onClick={card.onClick}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i, type: 'spring', stiffness: 260, damping: 24 }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                className={
                  card.primary
                    ? 'text-left rounded-2xl border border-copper-500/40 bg-copper-500/10 hover:bg-copper-500/15 p-5 backdrop-blur-xl shadow-xl shadow-copper-500/10 cursor-pointer'
                    : 'text-left rounded-2xl border border-white/10 bg-sf-16181d/80 hover:bg-white/[0.06] p-5 backdrop-blur-xl shadow-xl cursor-pointer'
                }
              >
                <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-copper-400 mb-3">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-display text-base text-white">{card.title}</h3>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{card.text}</p>
                <span className="inline-block mt-3 text-xs font-semibold text-copper-300">{card.cta} &rarr;</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
