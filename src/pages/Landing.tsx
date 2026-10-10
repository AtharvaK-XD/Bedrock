import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AuthCard } from '../components/auth/AuthCard';
import { Shield, Sparkles, Layout, Layers, Database, Globe } from 'lucide-react';
import { PageTransition } from '../components/layout/PageTransition';
import { Scene3D } from '../components/landing/Scene3D';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { cn } from '../lib/utils';

gsap.registerPlugin(ScrollTrigger);

const RevealText = ({ text, className, containerClassName }: { text: string, className?: string, containerClassName?: string }) => (
  <span className={cn(containerClassName)}>
    {text.split(" ").map((word, i, arr) => {
      const isLast = i === arr.length - 1;
      return (
        <span key={i}>
          <span className={cn("reveal-word inline-block", className)}>{word}</span>
          {!isLast && " "}
        </span>
      );
    })}
  </span>
);

export default function Landing() {
  const containerRef = useRef<HTMLDivElement>(null);
  const horizontalScrollRef = useRef<HTMLDivElement>(null);
  
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

      // Vertical Reveal Containers
      gsap.utils.toArray('.reveal-container:not(.horizontal-reveal)').forEach((container: any) => {
        const words = container.querySelectorAll('.reveal-word');
        if (words.length === 0) return;

        gsap.fromTo(words, 
          { opacity: 0, y: 20, filter: 'blur(8px)' },
          {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            stagger: 0.1,
            ease: 'none',
            scrollTrigger: {
              trigger: container,
              start: 'top 85%',
              end: 'bottom 60%',
              scrub: 1.5,
            }
          }
        );
      });

      // Horizontal Scroll Pinned Gallery
      if (horizontalScrollRef.current) {
        const sections = gsap.utils.toArray('.horizontal-panel');
        const scrollTween = gsap.to(sections, {
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

        // Horizontal Reveal Containers
        gsap.utils.toArray('.horizontal-reveal').forEach((container: any) => {
          const words = container.querySelectorAll('.reveal-word');
          if (words.length === 0) return;
          
          gsap.fromTo(words, 
            { opacity: 0, x: 20, filter: 'blur(8px)' },
            {
              opacity: 1,
              x: 0,
              filter: 'blur(0px)',
              stagger: 0.1,
              ease: 'none',
              scrollTrigger: {
                trigger: container,
                containerAnimation: scrollTween,
                start: 'left 85%',
                end: 'left 40%',
                scrub: 1.5,
              }
            }
          );
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
  const statementText = "Bedrock bridges the gap between raw human concepts and machine execution, transforming chaotic ideas into production-grade agent directives, visual media prompts, and orchestrated DAG pipelines.";

  return (
    <PageTransition className="bg-black text-white font-sans selection:bg-copper-500/40 selection:text-white relative overflow-hidden flex flex-col min-h-screen">
      <div ref={containerRef} className="relative z-10 w-full">
        
        {/* Realistic 3D Background Element */}
        <div className="fixed inset-0 w-full h-screen pointer-events-none z-0 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-10"></div>
          <Scene3D />
        </div>

        {/* Hero Section */}
        <section className="hero-section relative z-10 w-full min-h-screen flex items-center justify-center py-6 px-8 lg:px-24">
          <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-16 lg:gap-8">
            <div className="w-full lg:w-[50%] flex flex-col justify-center max-w-2xl lg:pr-10 z-10 mix-blend-difference">
              <h1 className="hero-title-parallax font-display font-medium text-[clamp(4.5rem,9vw,9rem)] leading-[0.85] tracking-tight mb-8 text-white -ml-1">
                Intelligence, <br />
                <span className="text-gray-400">shaped by you.</span>
              </h1>
              
              <p className="hero-fade-up text-lg md:text-xl text-gray-400 leading-relaxed max-w-xl font-light mb-12">
                The unified workstation for frontier prompt engineering. Synthesize autonomous agent directives, orchestrate visual DAG workflows, and benchmark across 10 AI providers.
              </p>

              <div className="hero-fade-up flex flex-col items-start gap-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <a 
                    href="https://github.com/AtharvaK-XD/Bedrock/releases/latest/download/Bedrock-Setup.exe" 
                    download
                    className="inline-flex items-center justify-center gap-3 px-10 py-5 bg-white text-black rounded-full font-semibold text-lg hover:bg-gray-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                  >
                    Download for Windows
                  </a>
                  <div className="flex flex-col text-sm text-gray-500 font-medium">
                    <span>Version 1.2.4</span>
                    <span>Native Desktop Experience</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pl-1">
                  <span className="text-xs text-gray-500 font-light">Available for macOS:</span>
                  <a
                    href="https://github.com/AtharvaK-XD/Bedrock/releases/download/v1.2.4-mac/Bedrock-Mac.dmg"
                    download
                    data-cursor="hover"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-200"
                  >
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 170 170">
                      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.6-7.77-11.73-14.19-5.99-9.35-10.74-20.2-14.25-32.55-3.51-12.35-5.27-24.08-5.27-35.18 0-14.68 3.73-26.68 11.19-36 7.46-9.31 16.73-14.07 27.81-14.27 4.9 0 10.42 1.25 16.56 3.75 6.14 2.5 10.15 3.79 12.04 3.86 1.48 0 5.66-1.39 12.56-4.16 6.9-2.78 12.7-3.95 17.4-3.52 13.51 1.07 24.16 6.36 31.95 15.86-11.97 7.24-17.84 17.3-17.62 30.17.21 10.22 4.1 18.73 11.66 25.53 7.56 6.8 16.64 10.59 27.24 11.37-2.58 8.04-5.83 16.14-9.76 24.31zM119.22 31.84c0-7.39 2.66-14.28 7.97-20.67 5.32-6.39 11.83-10.45 19.55-12.17.64 1.71.96 3.42.96 5.13 0 7.39-2.77 14.33-8.31 20.84-5.54 6.5-12.18 10.4-19.92 11.7-.1-.95-.25-2.57-.25-4.83z" />
                    </svg>
                    Download for Mac (.dmg)
                  </a>
                  <span className="text-xs text-gray-500 font-light">(Beta Version)</span>
                </div>
              </div>
            </div>

            <div className="hero-fade-up w-full lg:w-[40%] max-w-[440px] flex justify-center lg:justify-end z-20">
              <div data-cursor="hover" className="w-full rounded-[2rem] p-1 bg-gradient-to-b from-white/10 to-transparent shadow-2xl backdrop-blur-xl">
                <AuthCard />
              </div>
            </div>
          </div>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 opacity-40 z-20 hero-fade-up animate-bounce">
            <div className="text-[9px] uppercase tracking-[0.2em] text-white font-medium">Scroll</div>
            <div className="w-[1px] h-6 bg-gradient-to-b from-white/50 to-transparent"></div>
          </div>
        </section>

        {/* Text Reveal Statement Section */}
        <section className="relative z-10 w-full min-h-screen flex flex-col items-center justify-center px-6 sm:px-12 py-32">
          <div className="reveal-container max-w-5xl mx-auto text-center flex flex-col gap-12">
            <h2 className="font-display font-medium text-4xl md:text-6xl leading-tight tracking-tight text-white flex flex-wrap justify-center gap-x-3 gap-y-2 md:gap-x-4">
              <RevealText text="Stop guessing with LLMs." />
              <div className="basis-full h-0 hidden md:block"></div>
              <RevealText text="Start engineering." className="text-copper-500 italic" />
            </h2>
            
            <p className="relative text-2xl md:text-4xl font-light leading-relaxed max-w-4xl mx-auto flex flex-wrap justify-center gap-x-3 gap-y-2 mt-8">
              <RevealText text={statementText} className="font-editorial" />
            </p>
          </div>
        </section>

        {/* Horizontal Scroll Gallery (Pinned) */}
        <section className="horizontal-container relative z-10 w-full h-screen overflow-hidden">
          <div ref={horizontalScrollRef} className="h-full w-[300vw] flex">
            
            <div className="horizontal-panel w-screen h-full flex flex-col justify-center px-6 sm:px-12">
              <div className="max-w-7xl mx-auto w-full">
                <div className="reveal-container max-w-2xl">
                  <h3 className="font-display text-[clamp(4rem,8vw,10rem)] leading-[0.9] tracking-tight mb-8"><RevealText text="The Arena" /></h3>
                  <p className="text-2xl text-gray-400 font-light"><RevealText text="Benchmark your prompts side-by-side across 10 frontier models in real time. Compare Claude 3.7, GPT-4o, DeepSeek-R1, and Gemini 2.5 with live latency and token telemetry." /></p>
                </div>
              </div>
            </div>
            
            <div className="horizontal-panel w-screen h-full flex flex-col justify-center px-6 sm:px-12">
              <div className="max-w-7xl mx-auto w-full">
                <div className="horizontal-reveal reveal-container max-w-2xl">
                  <h3 className="font-display text-[clamp(4rem,8vw,10rem)] leading-[0.9] tracking-tight mb-8"><RevealText text="Branching Canvas" /></h3>
                  <p className="text-2xl text-gray-400 font-light"><RevealText text="Orchestrate non-linear prompt pipelines on a visual DAG canvas. Build complex logic with condition routers, dynamic data stores, script transforms, and consensus merges." /></p>
                </div>
              </div>
            </div>
            
            <div className="horizontal-panel w-screen h-full flex flex-col justify-center px-6 sm:px-12">
              <div className="max-w-7xl mx-auto w-full">
                <div className="horizontal-reveal reveal-container max-w-2xl">
                  <h3 className="font-display text-[clamp(4rem,8vw,10rem)] leading-[0.9] tracking-tight mb-8"><RevealText text="Physics Deck" /></h3>
                  <p className="text-2xl text-gray-400 font-light"><RevealText text="Explore curated blueprints on an expansive physics deck with infinite zoom from 5% to 300%. Drag blueprints with 1:1 inertia and compile directly into 15 IDE rules and SDKs." /></p>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Code / API IDE Section */}
        <section className="ide-section relative z-10 w-full min-h-screen flex items-center justify-center py-40 px-6 sm:px-12">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
            <div className="reveal-container w-full lg:w-1/2 flex flex-col gap-8">
              <h2 className="font-display text-5xl md:text-6xl tracking-tight"><RevealText text="Multi-Target Export." /> <br/><RevealText text="15 Ready Formats." /></h2>
              <p className="text-xl text-gray-400 font-light max-w-lg">
                <RevealText text="Bedrock compiles any prompt into native .cursorrules, CLAUDE.md, Windsurf Cascade, GitHub Copilot instructions, Vercel AI SDK routes, Python clients, and raw cURL payloads with a single click." />
              </p>
            </div>
            <div className="w-full lg:w-1/2">
              <div className="w-full rounded-2xl bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden font-mono text-sm leading-relaxed" data-cursor="hover">
                <div className="flex items-center gap-2.5 px-4 py-3 bg-white/[0.03] border-b border-white/10">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                  </div>
                  <span className="text-xs text-gray-400 font-mono ml-1">export_agent.py</span>
                </div>
                <div className="p-6 text-gray-300">
                  <div className="code-line"><span className="text-pink-400">import</span> anthropic</div>
                  <div className="code-line"><span className="text-pink-400">import</span> json</div>
                  <div className="code-line mb-4"></div>
                  <div className="code-line text-gray-500"># Compiled via Bedrock Multi-Target Exporter</div>
                  <div className="code-line"><span className="text-blue-400">BEDROCK_DIRECTIVE</span> = <span className="text-yellow-300">"""</span></div>
                  <div className="code-line text-yellow-300">&lt;role&gt;Autonomous Senior Software Engineer&lt;/role&gt;</div>
                  <div className="code-line text-yellow-300">&lt;negative_constraints&gt;No any types. Zero unhandled rejections.&lt;/negative_constraints&gt;</div>
                  <div className="code-line text-yellow-300">&lt;verification_protocol&gt;tsc --noEmit &amp;&amp; npm run build&lt;/verification_protocol&gt;</div>
                  <div className="code-line text-yellow-300">"""</div>
                  <div className="code-line mb-4"></div>
                  <div className="code-line">client = anthropic.Anthropic()</div>
                  <div className="code-line">stream = client.messages.stream(</div>
                  <div className="code-line pl-4">model=<span className="text-yellow-300">"claude-3-7-sonnet"</span>,</div>
                  <div className="code-line pl-4">max_tokens=<span className="text-purple-400">4096</span>,</div>
                  <div className="code-line pl-4">system=BEDROCK_DIRECTIVE,</div>
                  <div className="code-line pl-4">messages=[{`{"role": "user", "content": "Build feature"}`}]</div>
                  <div className="code-line">)</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Realistic Feature Grid */}
        <section className="relative z-10 w-full min-h-screen flex flex-col justify-center py-32 px-6 sm:px-12 max-w-7xl mx-auto">
          <div className="reveal-container text-center mb-24">
            <h2 className="font-display text-5xl md:text-7xl tracking-tight mb-6"><RevealText text="Everything you need." /></h2>
            <p className="text-xl text-gray-400 font-light"><RevealText text="A unified workstation for modern prompt and agent engineering." /></p>
          </div>
          <div className="features-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <Sparkles className="w-5 h-5" />, title: "Multi-Agent Synthesis", desc: "Transforms raw briefs into production directives with clarifying questions across 7 archetypes including Coding, Image, and Video Generation." },
              { icon: <Layers className="w-5 h-5" />, title: "Visual DAG Branching", desc: "Node-based canvas for non-linear prompt orchestration. Build complex logic with condition routers, dynamic data stores, and consensus merges." },
              { icon: <Layout className="w-5 h-5" />, title: "Side-by-Side Arena", desc: "Instantly benchmark your refined prompts across 10 frontier models including Claude 3.7, GPT-4o, DeepSeek-R1, and Gemini 2.5." },
              { icon: <Shield className="w-5 h-5" />, title: "Local Privacy & BYOK", desc: "Built as a native desktop application with client-side credential encryption. Your proprietary prompts and API keys never leak." },
              { icon: <Database className="w-5 h-5" />, title: "Tactile Physics Deck", desc: "Interactive blueprint catalog featuring infinite zoom from 5% to 300%, freeform 1:1 momentum physics, and curated engineering patterns." },
              { icon: <Globe className="w-5 h-5" />, title: "15-Target Exporters", desc: "Export directly into .cursorrules, CLAUDE.md, Windsurf, Copilot, Vercel AI SDK, Python, cURL, and typed JSON API payloads." }
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
          
          <h2 className="reveal-container font-display font-medium text-5xl md:text-8xl tracking-tight text-white mb-8">
            <RevealText text="Ready to build?" />
          </h2>
          <a 
            href="https://github.com/AtharvaK-XD/Bedrock/releases/latest/download/Bedrock-Setup.exe" 
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
            <a 
              href="https://github.com/AtharvaK-XD/Bedrock" 
              target="_blank" 
              rel="noopener noreferrer" 
              data-cursor="hover" 
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
            <Link to="/privacy" data-cursor="hover" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link to="/terms" data-cursor="hover" className="hover:text-white transition-colors">
              Terms
            </Link>
          </div>
        </footer>

      </div>
    </PageTransition>
  );
}
