import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Sparkles, CheckCircle2, RefreshCcw, Copy } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';

const OPTIMIZATION_RULES = [
  { id: 'concise', label: 'Make it more concise', active: false },
  { id: 'step_by_step', label: 'Force step-by-step reasoning', active: true },
  { id: 'examples', label: 'Ask for examples', active: false },
  { id: 'format', label: 'Enforce JSON output', active: false },
  { id: 'tone', label: 'Professional tone', active: false },
  { id: 'edge_cases', label: 'Consider edge cases', active: true },
];

export default function Optimizer() {
  const [prompt, setPrompt] = useState('');
  const [rules, setRules] = useState(OPTIMIZATION_RULES);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedResult, setOptimizedResult] = useState('');

  const handleToggleRule = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, active: !r.active } : r));
  };

  const handleOptimize = () => {
    if (!prompt.trim()) return;
    setIsOptimizing(true);
    
    // Mock API call
    setTimeout(() => {
      setOptimizedResult(`You are an expert assistant. Follow these instructions carefully:

1. Analyze the core request:
${prompt}

2. Please reason step-by-step before providing your final answer.
3. Make sure to explicitly identify and address any edge cases.

Format your response clearly using markdown.`);
      setIsOptimizing(false);
    }, 1500);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(optimizedResult);
    alert('Copied to clipboard!');
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-12 lg:py-20 min-h-[calc(100vh-80px)]">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-3 bg-copper-500/10 rounded-2xl mb-6 text-copper-500 shadow-inner">
          <Wand2 className="w-8 h-8" />
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-bold text-basalt-900 mb-4 tracking-tight">
          Prompt Optimizer.
        </h1>
        <p className="text-lg text-basalt-600 max-w-2xl mx-auto">
          Paste your existing, messy prompt below. Select the optimization rules you want to apply, and let our engine rewrite it into a highly effective instruction set.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left Column - Input */}
        <div className="lg:col-span-7 flex flex-col h-[600px]">
          <div className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-3xl p-6 flex flex-col flex-1 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/5 pointer-events-none z-0"></div>
            
            <div className="relative z-10 flex flex-col flex-1">
              <h3 className="text-lg font-semibold text-basalt-900 mb-4 flex items-center gap-2">
                Original Prompt
              </h3>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Paste the prompt you want to improve here..."
                className="w-full flex-1 resize-none bg-transparent text-base text-basalt-900 placeholder:text-basalt-400 focus:outline-none custom-scrollbar"
              />
            </div>
          </div>
        </div>

        {/* Right Column - Controls & Output */}
        <div className="lg:col-span-5 flex flex-col h-[600px]">
          <AnimatePresence mode="wait">
            {!optimizedResult ? (
              <motion.div
                key="controls"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20, filter: 'blur(10px)' }}
                className="bg-white/60 backdrop-blur-xl border border-basalt-900/10 rounded-3xl p-8 shadow-sm flex flex-col h-full"
              >
                <h3 className="text-xl font-display font-bold text-basalt-900 mb-6">Optimization Rules</h3>
                
                <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2">
                  {rules.map(rule => (
                    <button
                      key={rule.id}
                      onClick={() => handleToggleRule(rule.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all duration-200",
                        rule.active
                          ? "bg-copper-500/5 border-copper-500/30 shadow-[inset_0_0_0_1px_rgba(207,117,75,0.2)]"
                          : "bg-white border-basalt-900/10 hover:border-basalt-900/20 hover:bg-basalt-900/5"
                      )}
                    >
                      <span className={cn(
                        "font-medium",
                        rule.active ? "text-copper-700" : "text-basalt-700"
                      )}>
                        {rule.label}
                      </span>
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center transition-colors",
                        rule.active ? "bg-copper-500 text-white" : "border-2 border-basalt-900/20"
                      )}>
                        {rule.active && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="pt-6 mt-4 border-t border-basalt-900/5">
                  <button
                    onClick={handleOptimize}
                    disabled={!prompt.trim() || isOptimizing}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-basalt-900 text-white rounded-xl font-medium transition-all hover:bg-basalt-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  >
                    {isOptimizing ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <Sparkles className="w-5 h-5 text-copper-400" />
                    )}
                    {isOptimizing ? 'Optimizing...' : 'Optimize Prompt'}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, x: 20, filter: 'blur(10px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                className="bg-white/80 backdrop-blur-xl border border-basalt-900/10 rounded-3xl p-8 shadow-lg flex flex-col h-full relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-copper-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <h3 className="text-xl font-display font-bold text-basalt-900">Optimized Result</h3>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setOptimizedResult('')}>
                      <RefreshCcw className="w-4 h-4" />
                    </Button>
                    <Button variant="secondary" onClick={handleCopy}>
                      <Copy className="w-4 h-4 mr-2" /> Copy
                    </Button>
                  </div>
                </div>

                <div className="flex-1 bg-[#131518] rounded-xl p-6 overflow-auto custom-scrollbar relative z-10">
                  <pre className="whitespace-pre-wrap font-mono text-[13px] sm:text-sm text-basalt-100 leading-relaxed">
                    {optimizedResult}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
