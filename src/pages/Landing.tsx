import { motion } from 'framer-motion';
import { AuthCard } from '../components/auth/AuthCard';
import { Layers } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-sandstone-50 text-basalt-900 font-sans selection:bg-copper-500 selection:text-white relative overflow-hidden flex flex-col">
      {/* Immersive Background Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-copper-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-basalt-900/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>

      {/* Simple Header */}
      <header className="relative z-10 p-6 lg:p-8 flex items-center justify-between">
        <div className="flex items-center gap-3 text-basalt-900 group">
          <div className="p-1.5 bg-copper-500/10 rounded-lg">
            <Layers className="w-6 h-6 text-copper-500" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight">Bedrock</span>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="flex-1 relative z-10 flex items-center">
        <div className="max-w-[1400px] mx-auto px-6 w-full py-12 lg:py-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-8 items-center">
            
            {/* Left Column: Huge Typography & Pitch */}
            <div className="max-w-xl mx-auto lg:mx-0 text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-basalt-900/5 text-basalt-700 text-sm font-semibold mb-6">
                  <span className="flex w-2 h-2 rounded-full bg-copper-500"></span>
                  Bedrock 2.0 is live
                </div>
                
                <h1 className="text-6xl sm:text-7xl lg:text-[5.5rem] font-display font-bold leading-[1.05] tracking-tight mb-8">
                  Build the <br className="hidden lg:block" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-copper-500 to-copper-400">
                    Perfect Prompt.
                  </span>
                </h1>
                
                <p className="text-xl text-basalt-600 leading-relaxed mb-10 max-w-md mx-auto lg:mx-0">
                  Stop struggling with AI outputs. Turn your vague ideas into precise, high-fidelity prompts in seconds using our guided refinement engine.
                </p>

                <div className="flex items-center justify-center lg:justify-start gap-6 text-basalt-500">
                  <div className="flex -space-x-4">
                    <img className="w-10 h-10 rounded-full border-2 border-sandstone-50" src="https://i.pravatar.cc/100?img=1" alt="User" />
                    <img className="w-10 h-10 rounded-full border-2 border-sandstone-50" src="https://i.pravatar.cc/100?img=2" alt="User" />
                    <img className="w-10 h-10 rounded-full border-2 border-sandstone-50" src="https://i.pravatar.cc/100?img=3" alt="User" />
                    <div className="w-10 h-10 rounded-full border-2 border-sandstone-50 bg-basalt-100 flex items-center justify-center text-xs font-bold text-basalt-600">
                      +10k
                    </div>
                  </div>
                  <div className="text-sm font-medium">
                    Joined by thousands of creators
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right Column: Auth Card */}
            <div className="w-full">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <AuthCard />
              </motion.div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
