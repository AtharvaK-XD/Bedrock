import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '../components/layout/PageTransition';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TIERS = [
  {
    name: 'Free',
    description: 'For quick, everyday help',
    price: '0',
    buttonText: 'Your current plan',
    buttonVariant: 'outline',
    features: [
      { text: 'Core model', active: true },
      { text: 'Limited messages and uploads (10/day)', active: true },
      { text: 'Limited prompt memory', active: true },
      { text: 'Standard generation speed', active: true },
      { text: 'Advanced image creation with Thinking', active: false },
      { text: 'Expanded memory across chats', active: false },
      { text: 'Work agent for multi-step tasks', active: false },
      { text: 'Zero wait times', active: false },
    ],
  },
  {
    name: 'Advanced',
    description: 'Save personal context with an AI assistant for ongoing work',
    price: '399',
    buttonText: 'Upgrade to Advanced',
    buttonVariant: 'primary',
    isPopular: true,
    features: [
      { text: 'Advanced models', active: true },
      { text: 'Unlimited messages and uploads', active: true },
      { text: 'Advanced image creation with Thinking', active: true },
      { text: 'Expanded memory across chats', active: true },
      { text: 'Work agent for multi-step tasks', active: true },
      { text: 'Zero wait times', active: false },
      { text: 'Early access to new features', active: false },
    ],
  },
  {
    name: 'Ultimate',
    description: 'State-of-the-art intelligence to automate your most ambitious work',
    price: '999',
    buttonText: 'Upgrade to Ultimate',
    buttonVariant: 'secondary',
    features: [
      { text: 'Everything in Advanced, plus:', active: true, bold: true },
      { text: '5x or 20x more usage than Advanced', active: true },
      { text: 'Frontier Pro model', active: true },
      { text: 'Maximum access to complex agents', active: true },
      { text: 'Zero wait times', active: true },
      { text: 'Early access to new features', active: true },
    ],
  }
];

export default function Pricing() {
  const [isUpgrading, setIsUpgrading] = useState(false);
  const navigate = useNavigate();

  const handleUpgrade = (tierName: string) => {
    if (tierName === 'Free') return;
    setIsUpgrading(true);
    setTimeout(() => {
      navigate('/app/billing');
    }, 1800);
  };

  return (
    <PageTransition>
      {/* Loading Overlay */}
      <AnimatePresence>
        {isUpgrading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="w-14 h-14 border-2 border-teal-500/20 border-t-teal-400 rounded-full animate-spin"></div>
              <p className="text-lg font-mono text-white tracking-wide uppercase text-xs">
                Setting up your billing account...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full px-4 sm:px-8 py-12 lg:py-16 min-h-[calc(100vh-80px)]">
      <div className="text-center mb-16">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-editorial font-bold text-white mb-4 tracking-tight"
        >
          Upgrade your plan
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg text-gray-400 max-w-xl mx-auto mb-8 font-light"
        >
          Predictable flat-rate pricing for high-throughput prompt engineering.
        </motion.p>
      </div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
          }}
        >
          {TIERS.map((tier) => (
            <motion.div
              key={tier.name}
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0 }
              }}
              whileHover={{ y: -4 }}
              className={cn(
                "relative flex flex-col p-8 rounded-3xl border transition-all duration-300",
                tier.isPopular 
                  ? "bg-[#14181a]/60 border-teal-500/40 shadow-2xl shadow-teal-500/5" 
                  : "bg-black/40 border-white/10 hover:border-white/20 hover:bg-[#111]"
              )}
            >
            {tier.isPopular && (
              <div className="absolute top-6 right-6">
                <span className="bg-teal-500/10 text-teal-400 text-[10px] font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-teal-500/20">
                  Recommended
                </span>
              </div>
            )}

            <div className="mb-8 mt-2">
              <h3 className="text-2xl font-bold font-display mb-2">{tier.name}</h3>
              <p className={cn("text-xs leading-relaxed min-h-[36px]", tier.isPopular ? "text-gray-300" : "text-gray-400")}>
                {tier.description}
              </p>
            </div>

            <div className="mb-8 flex items-baseline gap-1 font-mono">
              <span className="text-4xl font-bold text-white tracking-tight">₹{tier.price}</span>
              <span className={cn("text-xs uppercase tracking-wider", tier.isPopular ? "text-gray-400" : "text-gray-500")}>/ month</span>
            </div>

            <button
              onClick={() => handleUpgrade(tier.name)}
              className={cn(
                "w-full py-3 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all mb-8 shadow-sm",
                tier.buttonVariant === 'outline'
                  ? "bg-transparent border border-white/20 text-gray-300 hover:bg-white/10 hover:border-white/30"
                  : tier.buttonVariant === 'primary'
                    ? "bg-teal-500 hover:bg-teal-400 text-black font-bold shadow-lg shadow-teal-500/20"
                    : "bg-white text-black hover:bg-gray-200"
              )}
            >
              {tier.buttonText}
            </button>

            <div className="flex-1">
              <ul className="space-y-3.5">
                {tier.features.map((feature, fIdx) => (
                  <li key={fIdx} className="flex items-start gap-2.5 text-xs">
                    <span className={cn(
                      "font-mono text-xs select-none shrink-0",
                      feature.active ? (tier.isPopular ? "text-teal-400 font-bold" : "text-copper-400 font-bold") : "text-gray-600 opacity-40"
                    )}>
                      {feature.active ? "—" : "·"}
                    </span>
                    <span className={cn(
                      (feature as any).bold && "font-semibold text-white",
                      !feature.active ? "text-gray-600 line-through opacity-40 font-mono" : "text-gray-300 font-sans"
                    )}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
          ))}
        </motion.div>
      </div>
    </PageTransition>
  );
}
