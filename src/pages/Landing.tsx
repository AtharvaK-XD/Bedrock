import { motion } from 'framer-motion';
import { AuthCard } from '../components/auth/AuthCard';
import { Layers, Zap, Shield, Sparkles } from 'lucide-react';

export default function Landing() {
  return (
    <div className="bg-sandstone-50 text-basalt-900 font-sans selection:bg-copper-500 selection:text-white relative overflow-hidden flex flex-col">
      {/* Immersive Background Effects */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-copper-500/10 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-basalt-900/10 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay z-0"></div>

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50 p-6 lg:p-8 flex items-center justify-between">
        <div className="flex items-center gap-3 text-basalt-900 group">
          <div className="p-1.5 bg-copper-500/10 rounded-lg">
            <Layers className="w-6 h-6 text-copper-500" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight">Bedrock</span>
        </div>
      </header>

      {/* Hero Section (100vh) */}
      <section className="relative z-10 min-h-screen flex items-center pt-24 pb-12">
        <div className="w-full px-6 lg:px-12 mx-auto">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-8 items-center justify-between w-full mx-auto">
            
            {/* Left Column: Massive Typography */}
            <div className="w-full lg:w-[55%] flex flex-col justify-center">
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-basalt-900/5 text-basalt-800 text-sm md:text-base font-semibold mb-6 lg:mb-8 uppercase tracking-widest">
                  <span className="flex w-2.5 h-2.5 rounded-full bg-copper-500 animate-pulse"></span>
                  Bedrock 2.0 is live
                </div>
                
                {/* Dynamically scaling massive font */}
                <h1 className="font-editorial font-bold leading-[0.85] tracking-tighter mb-6 lg:mb-8 uppercase text-[clamp(4rem,9vw,11rem)] text-basalt-900">
                  BUILD <br />
                  THE <br />
                  <span className="text-copper-600 italic font-medium">
                    PROMPT.
                  </span>
                </h1>
                
                <p className="text-lg lg:text-2xl text-basalt-600 leading-relaxed max-w-2xl font-medium">
                  Stop struggling with AI outputs. Turn your vague ideas into precise, high-fidelity prompts in seconds using our guided refinement engine.
                </p>
              </motion.div>
            </div>

            {/* Right Column: Auth Card */}
            <div className="w-full lg:w-[40%] max-w-lg mx-auto lg:mx-0">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, filter: 'blur(20px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <AuthCard />
              </motion.div>
            </div>

          </div>
        </div>
      </section>

      {/* Features Section to make page longer */}
      <section className="relative z-10 py-32 bg-white/40 border-t border-basalt-900/5 backdrop-blur-sm">
        <div className="w-full mx-auto px-6 lg:px-12">
          <div className="text-center mb-20">
            <h2 className="text-[clamp(2.5rem,5vw,5rem)] font-display font-black leading-none tracking-tighter uppercase mb-6 text-basalt-900">
              Why use Bedrock?
            </h2>
            <p className="text-xl text-basalt-600 max-w-2xl mx-auto">
              We built the ultimate toolset to help you communicate perfectly with large language models.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white/60 p-10 rounded-[2rem] border border-basalt-900/5 shadow-sm">
              <div className="w-14 h-14 bg-copper-500/10 rounded-2xl flex items-center justify-center text-copper-500 mb-6">
                <Zap className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-display font-bold mb-4 tracking-tight">Instant Generation</h3>
              <p className="text-basalt-600 leading-relaxed">
                Type a one-liner and watch as Bedrock instantly expands it into a fully structured, multi-shot prompt ready for any AI model.
              </p>
            </div>

            <div className="bg-white/60 p-10 rounded-[2rem] border border-basalt-900/5 shadow-sm">
              <div className="w-14 h-14 bg-copper-500/10 rounded-2xl flex items-center justify-center text-copper-500 mb-6">
                <Shield className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-display font-bold mb-4 tracking-tight">Enterprise Ready</h3>
              <p className="text-basalt-600 leading-relaxed">
                Secure, private, and built for teams. Keep your proprietary prompts and frameworks organized in one centralized library.
              </p>
            </div>

            <div className="bg-white/60 p-10 rounded-[2rem] border border-basalt-900/5 shadow-sm">
              <div className="w-14 h-14 bg-copper-500/10 rounded-2xl flex items-center justify-center text-copper-500 mb-6">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-display font-bold mb-4 tracking-tight">Context Aware</h3>
              <p className="text-basalt-600 leading-relaxed">
                Our engine asks you the right clarifying questions to ensure every edge case is covered before generating the final output.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 text-center border-t border-basalt-900/5">
        <p className="text-basalt-500 font-medium">© 2026 Bedrock Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
