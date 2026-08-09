import { Check, X, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

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
    price: '400',
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
    price: '1,000',
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
  return (
    <div className="w-full px-6 lg:px-12 2xl:px-24 py-12 lg:py-16 min-h-[calc(100vh-80px)]">
      <div className="text-center mb-16">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-editorial font-bold text-white mb-6"
        >
          Upgrade your plan
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg text-gray-400 max-w-xl mx-auto mb-8"
        >
          Find your best fit.
        </motion.p>
        

      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {TIERS.map((tier, idx) => (
          <motion.div
            key={tier.name}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * (idx + 1) }}
            className={cn(
              "relative flex flex-col p-8 rounded-3xl transition-all duration-300",
              tier.isPopular 
                ? "bg-teal-500/10 backdrop-blur-xl text-white shadow-2xl scale-[1.02] border border-teal-500/30 z-10" 
                : "bg-[#1a1a1a]/80 backdrop-blur-xl text-white border border-white/10 hover:border-white/20 shadow-sm"
            )}
          >
            {tier.isPopular && (
              <div className="absolute top-6 right-6">
                <span className="bg-teal-500/10 text-teal-400 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-teal-500/20">
                  Recommended
                </span>
              </div>
            )}
            
            <div className="mb-8 mt-2">
              <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
              <p className={cn("text-sm min-h-[40px]", tier.isPopular ? "text-gray-300" : "text-gray-400")}>
                {tier.description}
              </p>
            </div>
            
            <div className="mb-8 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white">₹{tier.price}</span>
              <span className={cn("text-sm", tier.isPopular ? "text-gray-400" : "text-gray-500")}>/ month</span>
            </div>

            <button 
              className={cn(
                "w-full py-3 px-4 rounded-xl font-semibold transition-colors mb-8 flex items-center justify-center gap-2",
                tier.buttonVariant === 'outline' 
                  ? "bg-transparent border border-white/20 text-gray-300 hover:bg-white/10 hover:border-white/30"
                  : tier.buttonVariant === 'primary'
                    ? "bg-teal-500 hover:bg-teal-600 text-white border border-transparent shadow-lg shadow-teal-500/20"
                    : "bg-white text-black hover:bg-gray-200 border border-transparent shadow-md"
              )}
            >
              {tier.isPopular && <Sparkles className="w-4 h-4" />}
              {tier.buttonText}
            </button>

            <div className="flex-1">
              <ul className="space-y-4">
                {tier.features.map((feature, fIdx) => (
                  <li key={fIdx} className="flex items-start gap-3 text-sm">
                    {feature.active ? (
                      <Check className={cn("w-5 h-5 shrink-0 mt-0.5", tier.isPopular ? "text-teal-400" : "text-copper-500")} />
                    ) : (
                      <X className={cn("w-5 h-5 shrink-0 mt-0.5 opacity-40", tier.isPopular ? "text-teal-500/50" : "text-gray-600")} />
                    )}
                    <span className={cn(
                      (feature as any).bold && "font-semibold",
                      !feature.active && (tier.isPopular ? "text-gray-400 opacity-80" : "text-gray-500")
                    )}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
