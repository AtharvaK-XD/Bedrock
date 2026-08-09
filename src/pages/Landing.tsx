import { motion } from 'framer-motion';
import { AuthCard } from '../components/auth/AuthCard';
import { Zap, Shield, Sparkles } from 'lucide-react';
import { AI_AGENTS, AgentIcon } from '../components/ui/RichInput';

export default function Landing() {
  return (
    <div className="bg-black text-white font-sans selection:bg-copper-500 selection:text-white relative overflow-hidden flex flex-col">
      {/* Immersive Background Effects */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [0, 50, 0],
          y: [0, 30, 0]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-copper-500/20 rounded-full blur-[120px] pointer-events-none z-0"
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.4, 0.2],
          x: [0, -60, 0],
          y: [0, -40, 0]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-basalt-900/20 rounded-full blur-[120px] pointer-events-none z-0"
      />
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay z-0"></div>


      {/* Hero Section (100vh) */}
      <section className="relative z-10 min-h-screen flex items-center pt-24 pb-12">
        <div className="max-w-[1400px] w-full px-6 lg:px-12 mx-auto">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-8 items-center justify-between w-full mx-auto">
            
            {/* Left Column: Massive Typography */}
            <div className="w-full lg:w-[55%] flex flex-col justify-center">
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-gray-300 text-sm md:text-base font-semibold mb-6 lg:mb-8 uppercase tracking-widest">
                  <span className="flex w-2.5 h-2.5 rounded-full bg-copper-500 animate-pulse"></span>
                  Bedrock 2.0 is live
                </div>
                
                {/* Dynamically scaling massive font */}
                <h1 className="font-editorial font-bold leading-[0.85] tracking-tighter mb-6 lg:mb-8 uppercase text-[clamp(4rem,9vw,11rem)] text-white flex flex-col">
                  <motion.span
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  >BUILD</motion.span>
                  <motion.span
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  >THE</motion.span>
                  <motion.span 
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="text-copper-600 italic font-medium"
                  >
                    PROMPT.
                  </motion.span>
                </h1>
                
                <p className="text-lg lg:text-2xl text-gray-400 leading-relaxed max-w-2xl font-medium mb-10">
                  Stop struggling with AI outputs. Turn your vague ideas into precise, high-fidelity prompts in seconds using our guided refinement engine.
                </p>

                <div className="flex flex-wrap items-center gap-4">
                  <a 
                    href="/Bedrock-Windows.zip" 
                    download
                    className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-white text-black rounded-2xl font-semibold text-lg hover:bg-gray-200 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download for Windows (.zip)
                  </a>
                  <p className="text-sm text-gray-500 font-medium">Native Desktop App • ~10MB • Windows 10+</p>
                </div>
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

      {/* AI Models Marquee Section */}
      <section className="relative z-10 py-12 border-y border-white/5 bg-black overflow-hidden">
        <div className="text-center mb-8 px-6">
          <p className="text-sm font-semibold tracking-widest uppercase text-gray-500">
            Powered by the world's best models. Use whatever you need.
          </p>
        </div>
        
        {/* Infinite Marquee Container */}
        <div className="relative flex overflow-hidden w-full group">
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none"></div>
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none"></div>
          
          <motion.div 
            className="flex w-max"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ ease: "linear", duration: 30, repeat: Infinity }}
          >
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center gap-32 px-16">
                {AI_AGENTS.filter(a => a.id !== 'universal').map((agent) => (
                  <div key={agent.id} className="flex flex-col items-center gap-6 opacity-80 hover:opacity-100 transition-opacity">
                    <AgentIcon agent={agent} className="w-32 h-32 drop-shadow-md" />
                    <span className="text-xl font-bold text-gray-300 uppercase tracking-widest">{agent.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section to make page longer */}
      <section className="relative z-10 py-32 bg-[#111] border-t border-white/5 backdrop-blur-sm">
        <div className="max-w-[1400px] w-full mx-auto px-6 lg:px-12">
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <h2 className="text-[clamp(2.5rem,5vw,5rem)] font-display font-black leading-none tracking-tighter uppercase mb-6 text-white">
              Why use Bedrock?
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              We built the ultimate toolset to help you communicate perfectly with large language models.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Zap className="w-7 h-7" />,
                title: "Instant Generation",
                desc: "Type a one-liner and watch as Bedrock instantly expands it into a fully structured, multi-shot prompt ready for any AI model."
              },
              {
                icon: <Shield className="w-7 h-7" />,
                title: "Enterprise Ready",
                desc: "Secure, private, and built for teams. Keep your proprietary prompts and frameworks organized in one centralized library."
              },
              {
                icon: <Sparkles className="w-7 h-7" />,
                title: "Context Aware",
                desc: "Our engine asks you the right clarifying questions to ensure every edge case is covered before generating the final output."
              }
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.7, delay: idx * 0.2 }}
                whileHover={{ y: -10, transition: { duration: 0.2 } }}
                className="bg-black p-10 rounded-[2rem] border border-white/10 shadow-sm hover:shadow-xl hover:shadow-copper-500/10 transition-all duration-300 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-copper-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="w-14 h-14 bg-copper-500/10 rounded-2xl flex items-center justify-center text-copper-500 mb-6 relative z-10 group-hover:scale-110 group-hover:bg-copper-500/20 transition-all duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-display font-bold mb-4 tracking-tight relative z-10">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed relative z-10">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-12 text-center border-t border-white/5">
        <p className="text-gray-500 font-medium">© 2026 Bedrock Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
