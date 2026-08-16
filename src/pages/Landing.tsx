import { useEffect, useRef } from 'react';
import { AuthCard } from '../components/auth/AuthCard';
import { Zap, Shield, Sparkles, Layout, Layers, ArrowRight, Code, Database, Globe } from 'lucide-react';
import { PageTransition } from '../components/layout/PageTransition';
import { Scene3D } from '../components/landing/Scene3D';
import { CustomCursor } from '../components/ui/CustomCursor';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Landing() {
  const containerRef = useRef<HTMLDivElement>(null);
  const horizontalScrollRef = useRef<HTMLDivElement>(null);
  const textRevealRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero Animation
      gsap.fromTo('.hero-fade-up', 
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.2, stagger: 0.15, ease: 'power4.out', delay: 0.2 }
      );

      gsap.to('.hero-title-parallax', {
        y: -150,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-section',
          start: 'top top',
          end: 'bottom top',
          scrub: true
        }
      });

      // Text Reveal Scrub Animation
      if (textRevealRef.current) {
        const words = textRevealRef.current.querySelectorAll('.reveal-word');

        gsap.fromTo(words, 
          { opacity: 0, y: 20, filter: 'blur(8px)' },
          {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            stagger: 0.1,
            ease: 'none',
            scrollTrigger: {
              trigger: textRevealRef.current,
              start: 'top 80%',
              end: 'bottom 40%',
              scrub: true,
            }
          }
        );
      }

      // Horizontal Scroll Pinned Gallery
      if (horizontalScrollRef.current) {
        const sections = gsap.utils.toArray('.horizontal-panel');
        gsap.to(sections, {
          xPercent: -100 * (sections.length - 1),
          ease: 'none',
          scrollTrigger: {
            trigger: '.horizontal-container',
            pin: true,
            scrub: 1,
            snap: 1 / (sections.length - 1),
            end: () => "+=" + horizontalScrollRef.current?.offsetWidth
          }
        });
      }

      // Standard reveals
      gsap.utils.toArray('.reveal-section').forEach((section: any) => {
        gsap.fromTo(section,
          { opacity: 0, y: 50 },
          { 
            opacity: 1, 
            y: 0, 
            duration: 1.2, 
            ease: 'power3.out',
            scrollTrigger: {
              trigger: section,
              start: 'top 85%',
            }
          }
        );
      });

      // Staggered feature cards
      gsap.fromTo('.feature-card',
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.features-grid',
            start: 'top 80%',
          }
        }
      );

      // IDE Code Line typing effect on scroll
      gsap.fromTo('.code-line',
        { opacity: 0, x: -20 },
        {
          opacity: 1,
          x: 0,
          stagger: 0.2,
          duration: 0.5,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.ide-section',
            start: 'top 60%',
          }
        }
      );

    }, containerRef);
    
    return () => ctx.revert();
  }, []);

  // Split text for scrub reveal
  const statementText = "Bedrock bridges the gap between human intent and machine understanding, turning chaotic ideas into structured, high-performance prompts.";
  const words = statementText.split(" ");

  return (
    <PageTransition className="bg-[#050505] text-white font-sans selection:bg-copper-500/40 selection:text-white relative overflow-hidden flex flex-col min-h-screen cursor-none">
      <CustomCursor />
      <div ref={containerRef} className="relative z-10 w-full">
        
        {/* Realistic 3D Background Element */}
        <div className="fixed inset-0 w-full h-screen pointer-events-none z-0 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.015] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay z-10"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-copper-500/10 blur-[150px] z-0"></div>
          <Scene3D />
        </div>

        {/* Hero Section */}
        <section className="hero-section relative z-10 w-full min-h-screen flex items-center justify-center pt-32 pb-20 px-8 lg:px-24">
          <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-16 lg:gap-8">
            <div className="w-full lg:w-[50%] flex flex-col justify-center max-w-2xl lg:pr-10 z-10 mix-blend-difference">
              <div className="hero-fade-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-white/5 backdrop-blur-md text-gray-300 text-xs font-medium tracking-wide uppercase mb-8">
                <div className="w-1.5 h-1.5 rounded-full bg-copper-500"></div>
                Bedrock 2.0 Available
              </div>
              
              <h1 className="hero-title-parallax font-display font-medium text-[clamp(4.5rem,9vw,9rem)] leading-[0.85] tracking-tight mb-8 text-white -ml-1">
                Intelligence, <br />
                <span className="text-gray-400">shaped by you.</span>
              </h1>
              
              <p className="hero-fade-up text-lg md:text-xl text-gray-400 leading-relaxed max-w-xl font-light mb-12">
                The most advanced environment for prompt engineering. Refine your thoughts into precise instructions with unparalleled clarity.
              </p>

              <div className="hero-fade-up flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <a 
                  href="/Bedrock-Windows.zip" 
                  download
                  className="inline-flex items-center justify-center gap-3 px-10 py-5 bg-white text-black rounded-full font-semibold text-lg hover:bg-gray-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                >
                  Download for Windows
                </a>
                <div className="flex flex-col text-sm text-gray-500 font-medium">
                  <span>Version 2.0.1</span>
                  <span>Native Desktop Experience</span>
                </div>
              </div>
            </div>

            <div className="hero-fade-up w-full lg:w-[40%] max-w-[440px] flex justify-center lg:justify-end z-20">
              <div data-cursor="hover" className="w-full rounded-[2rem] p-1 bg-gradient-to-b from-white/10 to-transparent shadow-2xl backdrop-blur-xl">
                <AuthCard />
              </div>
            </div>
          </div>
        </section>

        {/* Text Reveal Statement Section */}
        <section className="relative z-10 w-full min-h-screen flex flex-col items-center justify-center px-6 sm:px-12 py-32">
          <div className="max-w-5xl mx-auto text-center flex flex-col gap-12">
            <h2 className="font-display font-medium text-4xl md:text-6xl leading-tight tracking-tight text-white">
              Stop guessing with LLMs. <br />
              <span className="text-copper-500 italic">Start engineering.</span>
            </h2>
            
            <p ref={textRevealRef} className="relative text-2xl md:text-4xl font-light leading-relaxed max-w-4xl mx-auto flex flex-wrap justify-center gap-x-3 gap-y-2">
              {words.map((word, i) => (
                <span key={i} className="reveal-word font-editorial">{word}</span>
              ))}
            </p>
          </div>
        </section>

        {/* Horizontal Scroll Gallery (Pinned) */}
        <section className="horizontal-container relative z-10 w-full h-screen overflow-hidden">
          <div ref={horizontalScrollRef} className="h-full w-[300vw] flex">
            
            <div className="horizontal-panel w-screen h-full flex flex-col justify-center px-6 sm:px-12">
              <div className="max-w-7xl mx-auto w-full">
                <div className="max-w-2xl">
                  <h3 className="font-display text-[clamp(4rem,8vw,10rem)] leading-[0.9] tracking-tight mb-8">The Arena</h3>
                  <p className="text-2xl text-gray-400 font-light">Test your prompts against multiple models simultaneously. See how GPT-4, Claude 3.5, and Llama 3 interpret the exact same instructions, side by side.</p>
                </div>
              </div>
            </div>
            
            <div className="horizontal-panel w-screen h-full flex flex-col justify-center px-6 sm:px-12">
              <div className="max-w-7xl mx-auto w-full">
                <div className="max-w-2xl">
                  <h3 className="font-display text-[clamp(4rem,8vw,10rem)] leading-[0.9] tracking-tight mb-8">Prompt Optimizer</h3>
                  <p className="text-2xl text-gray-400 font-light">Our meta-prompting engine analyzes your draft and automatically rewrites it using advanced techniques like Chain-of-Thought and Role Prompting.</p>
                </div>
              </div>
            </div>
            
            <div className="horizontal-panel w-screen h-full flex flex-col justify-center px-6 sm:px-12">
              <div className="max-w-7xl mx-auto w-full">
                <div className="max-w-2xl">
                  <h3 className="font-display text-[clamp(4rem,8vw,10rem)] leading-[0.9] tracking-tight mb-8">Library Sync</h3>
                  <p className="text-2xl text-gray-400 font-light">Save your best performing prompts in a searchable local database. Tag, categorize, and instantly copy them directly to your clipboard.</p>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Code / API IDE Section */}
        <section className="ide-section relative z-10 w-full min-h-screen flex items-center justify-center py-40 px-6 sm:px-12">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
            <div className="w-full lg:w-1/2 flex flex-col gap-8">
              <h2 className="font-display text-5xl md:text-6xl tracking-tight">Structured Output. <br/>Ready for Code.</h2>
              <p className="text-xl text-gray-400 font-light max-w-lg">
                Bedrock doesn't just give you a block of text. It generates structured JSON schemas and exact system instructions ready to be embedded directly into your Python or Node.js applications.
              </p>
            </div>
            <div className="w-full lg:w-1/2">
              <div className="w-full rounded-2xl bg-[#0d0d0d] border border-white/10 shadow-2xl overflow-hidden font-mono text-sm leading-relaxed" data-cursor="hover">
                <div className="flex items-center px-4 py-3 bg-white/5 border-b border-white/10 gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  <div className="ml-4 text-xs text-gray-500">app.py</div>
                </div>
                <div className="p-6 text-gray-300">
                  <div className="code-line"><span className="text-pink-400">import</span> openai</div>
                  <div className="code-line"><span className="text-pink-400">import</span> json</div>
                  <div className="code-line mb-4"></div>
                  <div className="code-line"><span className="text-blue-400">const</span> BEDROCK_PROMPT = <span className="text-yellow-300">"""</span></div>
                  <div className="code-line text-yellow-300">System: You are an expert data analyst.</div>
                  <div className="code-line text-yellow-300">Context: The user will provide raw CSV data.</div>
                  <div className="code-line text-yellow-300">Task: Extract the key metrics and format as JSON.</div>
                  <div className="code-line text-yellow-300">"""</div>
                  <div className="code-line mb-4"></div>
                  <div className="code-line"><span className="text-pink-400">def</span> <span className="text-green-400">process_data</span>(data):</div>
                  <div className="code-line pl-4"><span className="text-pink-400">return</span> openai.ChatCompletion.create(</div>
                  <div className="code-line pl-8">model=<span className="text-yellow-300">"gpt-4"</span>,</div>
                  <div className="code-line pl-8">messages=[</div>
                  <div className="code-line pl-12">{`{"role": "system", "content": BEDROCK_PROMPT},`}</div>
                  <div className="code-line pl-12">{`{"role": "user", "content": data}`}</div>
                  <div className="code-line pl-8">]</div>
                  <div className="code-line pl-4">)</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Realistic Feature Grid */}
        <section className="relative z-10 w-full min-h-screen flex flex-col justify-center py-32 px-6 sm:px-12 max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="font-display text-5xl md:text-7xl tracking-tight mb-6">Everything you need.</h2>
            <p className="text-xl text-gray-400 font-light">A comprehensive suite of tools for prompt engineers.</p>
          </div>
          <div className="features-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <Sparkles className="w-5 h-5" />, title: "Semantic Analysis", desc: "Our engine evaluates your initial thought and identifies missing context automatically." },
              { icon: <Layers className="w-5 h-5" />, title: "Structured Frameworks", desc: "Outputs are formatted using industry-standard prompt structures for maximum reliability." },
              { icon: <Layout className="w-5 h-5" />, title: "Side-by-Side Arena", desc: "Instantly benchmark your refined prompt across GPT-4, Claude 3.5, and Llama 3." },
              { icon: <Shield className="w-5 h-5" />, title: "Local Privacy", desc: "Built as a native desktop application. Your proprietary prompts never leak." },
              { icon: <Database className="w-5 h-5" />, title: "Vector DB Sync", desc: "Coming soon: Sync your prompt library with your local RAG databases." },
              { icon: <Globe className="w-5 h-5" />, title: "API Integration", desc: "Export straight to your codebase or call the Bedrock proxy API." }
            ].map((feature, idx) => (
              <div key={idx} data-cursor="hover" className="feature-card group flex flex-col p-8 rounded-3xl bg-[#0a0a0a]/80 backdrop-blur-md border border-white/5 hover:border-white/10 transition-colors duration-500">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-300 mb-6 group-hover:text-copper-400 group-hover:bg-copper-500/10 transition-colors duration-500">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-medium text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm font-light leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Immersive CTA */}
        <section className="reveal-section relative z-10 w-full min-h-screen flex flex-col items-center justify-center py-40 px-6 sm:px-12 text-center">
          
          <h2 className="font-display font-medium text-5xl md:text-8xl tracking-tight text-white mb-8">
            Ready to build?
          </h2>
          <a 
            href="/Bedrock-Windows.zip" 
            download
            data-cursor="hover"
            className="inline-flex items-center justify-center gap-2 px-12 py-6 bg-white text-black rounded-full font-bold text-xl hover:bg-gray-100 hover:scale-[1.02] transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.15)]"
          >
            Download Bedrock Free
          </a>
        </section>

        {/* Minimal Footer */}
        <footer className="relative z-10 w-full py-12 px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between text-sm text-gray-500 font-light">
          <p>© 2026 Bedrock. All rights reserved.</p>
          <div className="flex gap-6 mt-4 sm:mt-0">
            <a href="#" data-cursor="hover" className="hover:text-white transition-colors">Twitter</a>
            <a href="#" data-cursor="hover" className="hover:text-white transition-colors">GitHub</a>
            <a href="#" data-cursor="hover" className="hover:text-white transition-colors">Privacy</a>
          </div>
        </footer>

      </div>
    </PageTransition>
  );
}
