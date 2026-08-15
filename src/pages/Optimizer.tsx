import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CheckCircle2, RefreshCcw, Copy } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import { PageTransition } from '../components/layout/PageTransition';

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
    <PageTransition>
      <div className="w-full px-4 sm:px-8 py-6 lg:py-10 min-h-[calc(100vh-80px)]">
      <div className="text-center mb-12">

        <h1 className="text-5xl md:text-6xl font-editorial font-bold text-white mb-6 tracking-tight leading-[1.1]">
          Prompt Optimizer.
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Paste your existing, messy prompt below. Select the optimization rules you want to apply, and let our engine rewrite it into a highly effective instruction set.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left Column - Input */}
        <div className="lg:col-span-7 flex flex-col h-[600px]">
          <div className="bg-[#1a1a1a]/60 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-3xl p-6 flex flex-col flex-1 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none z-0"></div>
            
            <div className="relative z-10 flex flex-col flex-1">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                Original Prompt
              </h3>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Paste the prompt you want to improve here..."
                data-lenis-prevent="true"
                className="w-full flex-1 resize-none bg-transparent text-base text-white placeholder:text-gray-500 focus:outline-none custom-scrollbar"
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
                className="bg-[#1a1a1a]/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-sm flex flex-col h-full"
              >
                <h3 className="text-xl font-display font-bold text-white mb-6">Optimization Rules</h3>
                
                <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2" data-lenis-prevent="true">
                  {rules.map(rule => (
                    <button
                      key={rule.id}
                      onClick={() => handleToggleRule(rule.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all duration-200",
                        rule.active
                          ? "bg-teal-500/10 border-teal-500/30 shadow-[inset_0_0_0_1px_rgba(20,184,166,0.2)]"
                          : "bg-[#111] border-white/10 hover:border-white/20 hover:bg-white/5 text-gray-300"
                      )}
                    >
                      <span className={cn(
                        "font-medium",
                        rule.active ? "text-teal-400" : "text-gray-400"
                      )}>
                        {rule.label}
                      </span>
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center transition-colors",
                        rule.active ? "bg-teal-500 text-white" : "border-2 border-white/20"
                      )}>
                        {rule.active && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="pt-6 mt-4 border-t border-white/10">
                  <button
                    onClick={handleOptimize}
                    disabled={!prompt.trim() || isOptimizing}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white text-black rounded-xl font-medium transition-all hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  >
                    {isOptimizing ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <Sparkles className="w-5 h-5 text-black" />
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
                className="bg-[#1a1a1a]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-lg flex flex-col h-full relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <h3 className="text-xl font-display font-bold text-white">Optimized Result</h3>
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setOptimizedResult('')}>
                      <RefreshCcw className="w-4 h-4" />
                    </Button>
                    <Button variant="secondary" onClick={handleCopy}>
                      <Copy className="w-4 h-4 mr-2" /> Copy
                    </Button>
                  </div>
                </div>

                <div className="flex-1 bg-[#131518] rounded-xl p-6 overflow-auto custom-scrollbar relative z-10" data-lenis-prevent="true">
                  <pre className="whitespace-pre-wrap font-mono text-[13px] sm:text-sm text-basalt-100 leading-relaxed">
                    {optimizedResult}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}
