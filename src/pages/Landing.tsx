import { useEffect, useRef } from 'react';
import { AuthCard } from '../components/auth/AuthCard';
import { Zap, Shield, Sparkles, Layout, Layers, ArrowRight } from 'lucide-react';
import { PageTransition } from '../components/layout/PageTransition';
import { Scene3D } from '../components/landing/Scene3D';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Landing() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Clean, elegant fade up for hero elements
      gsap.fromTo('.hero-fade-up', 
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.2, stagger: 0.15, ease: 'power4.out', delay: 0.2 }
      );

      // Parallax text
      gsap.to('.hero-title-parallax', {
        y: -100,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-section',
          start: 'top top',
          end: 'bottom top',
          scrub: true
        }
      });

      // Smooth section reveals
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

    }, containerRef);
    
    return () => ctx.revert();
  }, []);

  return (
    <PageTransition className="bg-[#050505] text-white font-sans selection:bg-copper-500/40 selection:text-white relative overflow-hidden flex flex-col min-h-screen">
      <div ref={containerRef} className="relative z-10 w-full h-full flex flex-col items-center">
        
        {/* Realistic 3D Background Element */}
        <div className="fixed inset-0 w-full h-screen pointer-events-none z-0 overflow-hidden">
          {/* Subtle noise for photorealistic texture */}
          <div className="absolute inset-0 opacity-[0.015] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay z-10"></div>
          {/* Subtle ambient lighting spot */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-copper-500/10 blur-[150px] z-0"></div>
          <Scene3D />
        </div>

        {/* Hero Section */}
        <section className="hero-section relative z-10 w-full min-h-screen flex items-center justify-center pt-32 pb-20 px-6 sm:px-12 max-w-[1600px]">
          <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-16 lg:gap-8">
            
            {/* Left Content */}
            <div className="w-full lg:w-[50%] flex flex-col justify-center max-w-2xl lg:pr-10 z-10 mix-blend-difference">
              <div className="hero-fade-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-white/5 backdrop-blur-md text-gray-300 text-xs font-medium tracking-wide uppercase mb-8">
                <div className="w-1.5 h-1.5 rounded-full bg-copper-500"></div>
                Bedrock 2.0 Available
              </div>
              
              <h1 className="hero-title-parallax font-display font-medium text-[clamp(3.5rem,7vw,7rem)] leading-[0.95] tracking-tight mb-8 text-white">
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
                  className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-white text-black rounded-full font-medium text-base hover:bg-gray-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                >
                  Download for Windows
                </a>
                <div className="flex flex-col text-sm text-gray-500 font-medium">
                  <span>Version 2.0.1</span>
                  <span>Native Desktop Experience</span>
                </div>
              </div>
            </div>

            {/* Right Content - Auth/Interactive Element */}
            <div className="hero-fade-up w-full lg:w-[40%] max-w-[440px] flex justify-center lg:justify-end z-20">
              <div className="w-full rounded-[2rem] p-1 bg-gradient-to-b from-white/10 to-transparent shadow-2xl backdrop-blur-xl">
                <AuthCard />
              </div>
            </div>

          </div>
        </section>

        {/* Statement Section */}
        <section className="reveal-section relative z-10 w-full py-32 px-6 sm:px-12 bg-gradient-to-b from-transparent to-[#050505]">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="font-display font-medium text-3xl md:text-5xl leading-tight tracking-tight text-white mb-6">
              Stop guessing with LLMs. <br />
              Start engineering with precision.
            </h2>
            <p className="text-xl text-gray-400 font-light max-w-2xl mx-auto">
              Bedrock bridges the gap between human intent and machine understanding, turning chaotic ideas into structured, high-performance prompts.
            </p>
          </div>
        </section>

        {/* Realistic Feature Grid */}
        <section className="relative z-10 w-full py-24 px-6 sm:px-12 max-w-[1400px]">
          <div className="features-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {[
              {
                icon: <Sparkles className="w-6 h-6" />,
                title: "Semantic Analysis",
                desc: "Our engine evaluates your initial thought and identifies missing context, edge cases, and structural weaknesses automatically."
              },
              {
                icon: <Layers className="w-6 h-6" />,
                title: "Structured Frameworks",
                desc: "Outputs are formatted using industry-standard prompt structures (few-shot, chain-of-thought) for maximum reliability."
              },
              {
                icon: <Layout className="w-6 h-6" />,
                title: "Side-by-Side Arena",
                desc: "Instantly benchmark your refined prompt across GPT-4, Claude 3.5, and Llama 3 to validate real-world performance."
              },
              {
                icon: <Shield className="w-6 h-6" />,
                title: "Local Privacy",
                desc: "Built as a native desktop application. Your proprietary prompts and sensitive logic never leak into unauthorized training data."
              },
              {
                icon: <Zap className="w-6 h-6" />,
                title: "Zero Latency",
                desc: "A native Rust core wrapped in Tauri means instant startup, negligible memory footprint, and lightning-fast interactions."
              },
              {
                icon: <ArrowRight className="w-6 h-6" />,
                title: "Frictionless Export",
                desc: "One-click copy, JSON export, or direct API integration. Move your engineered prompts into your codebase effortlessly."
              }
            ].map((feature, idx) => (
              <div 
                key={idx}
                className="feature-card group flex flex-col p-8 rounded-3xl bg-[#0a0a0a] border border-white/5 hover:border-white/10 transition-colors duration-500"
              >
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-gray-300 mb-6 group-hover:text-copper-400 group-hover:bg-copper-500/10 transition-colors duration-500">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-medium text-white mb-3">{feature.title}</h3>
                <p className="text-gray-400 font-light leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}

          </div>
        </section>

        {/* Immersive CTA */}
        <section className="reveal-section relative z-10 w-full py-40 px-6 sm:px-12 flex flex-col items-center text-center">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
             <div className="w-full max-w-[1000px] h-[1px] bg-gradient-to-r from-transparent via-white to-transparent"></div>
          </div>
          
          <h2 className="font-display font-medium text-5xl md:text-7xl tracking-tight text-white mb-8">
            Ready to build?
          </h2>
          <a 
            href="/Bedrock-Windows.zip" 
            download
            className="inline-flex items-center justify-center gap-2 px-10 py-5 bg-white text-black rounded-full font-medium text-lg hover:bg-gray-100 hover:scale-105 transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
          >
            Download Bedrock Free
          </a>
        </section>

        {/* Minimal Footer */}
        <footer className="relative z-10 w-full py-8 px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between border-t border-white/5 text-sm text-gray-500 font-light">
          <p>© 2026 Bedrock. All rights reserved.</p>
          <div className="flex gap-6 mt-4 sm:mt-0">
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
          </div>
        </footer>

      </div>
    </PageTransition>
  );
}
