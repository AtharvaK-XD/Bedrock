import { useState, useRef, useEffect } from 'react';
import { AI_AGENTS, AgentIcon } from '../components/ui/RichInput';
import { cn } from '../lib/utils';
import { testPrompt } from '../lib/api';
import { openApiKeyModal } from '../lib/apiKeyEvents';
import { PageTransition } from '../components/layout/PageTransition';

export default function PromptTester() {
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.');
  const [isTesting, setIsTesting] = useState(false);
  const [result1, setResult1] = useState('');
  const [result2, setResult2] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeDropdown, setActiveDropdown] = useState<'agent1' | 'model1' | 'agent2' | 'model2' | null>(null);
  
  // Default to Llama vs Gemini
  const defaultGeminiAgent = AI_AGENTS.find(a => a.id === 'gemini') || AI_AGENTS[0];
  const defaultLlamaAgent = AI_AGENTS.find(a => a.id === 'llama') || AI_AGENTS[0];

  const [agent1Id, setAgent1Id] = useState(defaultGeminiAgent.id);
  const [model1Id, setModel1Id] = useState(defaultGeminiAgent.models[1]?.id || defaultGeminiAgent.models[0].id);
  
  const [agent2Id, setAgent2Id] = useState(defaultLlamaAgent.id);
  const [model2Id, setModel2Id] = useState(defaultLlamaAgent.models[0]?.id || 'openai/gpt-oss-120b');

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTest = async () => {
    if (!prompt.trim()) return;
    setIsTesting(true);
    setResult1('');
    setResult2('');
    
    try {
      const [res1, res2] = await Promise.allSettled([
        testPrompt(model1Id, systemPrompt, prompt),
        testPrompt(model2Id, systemPrompt, prompt)
      ]);

      if (res1.status === 'fulfilled') {
        setResult1(res1.value);
      } else {
        const msg = res1.reason?.message || 'Failed';
        setResult1(`Error: ${msg}`);
        if (res1.reason?.isApiKeyError || msg.toLowerCase().includes('api key')) {
          openApiKeyModal(msg);
        }
      }

      if (res2.status === 'fulfilled') {
        setResult2(res2.value);
      } else {
        const msg = res2.reason?.message || 'Failed';
        setResult2(`Error: ${msg}`);
        if (res2.reason?.isApiKeyError || msg.toLowerCase().includes('api key')) {
          openApiKeyModal(msg);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTesting(false);
    }
  };

  const agent1 = AI_AGENTS.find(a => a.id === agent1Id) || AI_AGENTS[0];
  const model1 = agent1.models.find(m => m.id === model1Id) || agent1.models[0];

  const agent2 = AI_AGENTS.find(a => a.id === agent2Id) || AI_AGENTS[0];
  const model2 = agent2.models.find(m => m.id === model2Id) || agent2.models[0];

  const renderDropdown = (
    type: 'agent' | 'model', 
    id: 1 | 2, 
    currentAgent: any, 
    currentModel: any, 
    setAgentId: (id: string) => void, 
    setModelId: (id: string) => void
  ) => {
    const dropdownId = `${type}${id}` as any;
    const isActive = activeDropdown === dropdownId;

    if (type === 'agent') {
      return (
        <div className="relative flex-1 min-w-[140px]">
          <button
            type="button"
            onClick={() => setActiveDropdown(isActive ? null : dropdownId)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-[#0e1117]/70 backdrop-blur-xl border border-white/10 rounded-xl text-xs font-medium text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-md shadow-black/20"
          >
            <div className="flex items-center gap-2 truncate">
              <AgentIcon agent={currentAgent} />
              <span className="truncate">{currentAgent.name}</span>
            </div>
            <span className="text-[10px] text-gray-500 shrink-0">▾</span>
          </button>
          
          {isActive && (
            <div className="absolute top-full mt-2 left-0 w-64 bg-[#0e1117]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl z-50 py-2 overflow-hidden">
              <div className="max-h-[300px] overflow-y-auto px-1 custom-scrollbar" data-lenis-prevent="true">
                {AI_AGENTS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setAgentId(a.id);
                      setModelId(a.models[0].id);
                      setActiveDropdown(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors",
                      currentAgent.id === a.id ? "bg-white/10" : "hover:bg-white/10"
                    )}
                  >
                    <AgentIcon agent={a} className="w-3.5 h-3.5" badgeClassName="w-5 h-5" />
                    <div className="min-w-0">
                      <div className={cn("text-xs font-medium truncate", currentAgent.id === a.id ? "text-white" : "text-gray-300")}>{a.name}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="relative flex-1 min-w-[140px]">
        <button
          type="button"
          onClick={() => setActiveDropdown(isActive ? null : dropdownId)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-[#0e1117]/70 backdrop-blur-xl border border-white/10 rounded-xl text-xs font-medium text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-md shadow-black/20 font-mono"
        >
          <div className="flex items-center gap-2 truncate">
            <AgentIcon agent={currentAgent} model={currentModel.id} className="w-3 h-3" badgeClassName="w-4 h-4" />
            <span className="truncate">{currentModel.name}</span>
          </div>
          <span className="text-[10px] text-gray-500 shrink-0">▾</span>
        </button>

        {isActive && (
          <div className="absolute top-full mt-2 left-0 w-full bg-[#0e1117]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl z-50 py-2 font-mono">
            <div className="px-3 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-white/10 mb-2 flex items-center gap-1.5">
              <AgentIcon agent={currentAgent} className="w-3 h-3" badgeClassName="w-4 h-4" />
              <span>{currentAgent.name} Models</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto px-1.5 custom-scrollbar" data-lenis-prevent="true">
              {currentAgent.models.map((m: any) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setModelId(m.id);
                    setActiveDropdown(null);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-2 py-1.5 text-xs text-left rounded-lg transition-colors",
                    currentModel.id === m.id ? "bg-white/10 text-white font-medium" : "text-gray-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AgentIcon agent={currentAgent} model={m.id} className="w-3 h-3" badgeClassName="w-4 h-4" />
                    <span className="truncate">{m.name}</span>
                  </div>
                  {currentModel.id === m.id && <span className="w-1.5 h-1.5 rounded-full bg-copper-400 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <PageTransition>
      <div className="w-full px-4 sm:px-8 py-6 lg:py-10 min-h-[calc(100vh-80px)] relative overflow-hidden">
        {/* Subtle ambient illumination behind the arena for realistic glass refraction */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[500px] bg-gradient-to-tr from-copper-500/5 via-white/[0.015] to-transparent blur-[160px] pointer-events-none rounded-full" />
        
        <div className="text-center mb-10 relative z-10">
          <h1 className="text-4xl md:text-5xl font-editorial font-bold text-white mb-4 tracking-tight leading-[1.1]">
            The Arena.
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Test your prompts instantly against multiple LLMs side-by-side to compare performance.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 lg:gap-8 h-[700px] relative z-10">
          {/* Left: Input Glass Card */}
          <div className="flex flex-col gap-6 h-full">
            <div className="relative rounded-3xl p-5 sm:p-6 flex flex-col flex-1 overflow-hidden group bg-gradient-to-b from-white/[0.05] via-white/[0.015] to-white/[0.025] bg-[#0c0e14]/75 backdrop-blur-3xl border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_20px_50px_rgba(0,0,0,0.55)]">
              {/* Glass specular top rim */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
              {/* Ambient glass sheen */}
              <div className="absolute -top-24 -left-24 w-52 h-52 bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />
              
              <h3 className="text-xs font-mono font-semibold text-gray-400 mb-2 uppercase tracking-wider relative z-10">System Prompt (Optional)</h3>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                data-lenis-prevent="true"
                className="w-full h-24 resize-none bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-copper-500/50 focus:ring-1 focus:ring-copper-500/50 mb-6 custom-scrollbar font-mono text-xs backdrop-blur-md shadow-inner relative z-10 transition-colors"
              />
              
              <h3 className="text-xs font-mono font-semibold text-gray-400 mb-2 uppercase tracking-wider relative z-10">User Prompt</h3>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter the prompt you want to test..."
                data-lenis-prevent="true"
                className="w-full flex-1 resize-none bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none custom-scrollbar leading-relaxed relative z-10"
              />
            </div>

            <button
              onClick={handleTest}
              disabled={!prompt.trim() || isTesting}
              className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-copper-500 text-white rounded-xl font-semibold text-sm uppercase tracking-wider transition-all hover:bg-copper-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-copper-500/20 active:scale-[0.98]"
            >
              {isTesting && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block"></span>
              )}
              {isTesting ? 'Running Battle...' : 'Run Arena'}
            </button>
          </div>

          {/* Right: Output Arena Glass Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full" ref={containerRef}>
            {/* Model 1 Column */}
            <div className="flex flex-col gap-3 h-full">
              <div className="flex items-center gap-2">
                {renderDropdown('agent', 1, agent1, model1, setAgent1Id, setModel1Id)}
                {renderDropdown('model', 1, agent1, model1, setAgent1Id, setModel1Id)}
              </div>
              <div className="relative rounded-3xl p-6 flex flex-col flex-1 overflow-hidden group transition-all duration-300 bg-gradient-to-b from-white/[0.05] via-white/[0.015] to-white/[0.025] bg-[#0c0e14]/75 backdrop-blur-3xl border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_24px_60px_rgba(0,0,0,0.55)]">
                {/* Glass specular top rim */}
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                {/* Ambient glass sheen */}
                <div className="absolute -top-24 -right-24 w-52 h-52 bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex-1 overflow-auto custom-scrollbar relative z-10" data-lenis-prevent="true">
                  {isTesting ? (
                    <div className="h-full flex items-center justify-center text-gray-400">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-6 h-6 border-2 border-gray-700 border-t-copper-500 rounded-full animate-spin"></div>
                      </div>
                    </div>
                  ) : result1 ? (
                    <pre className="whitespace-pre-wrap font-mono text-xs sm:text-[13px] text-gray-300 leading-relaxed">
                      {result1}
                    </pre>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-600 italic text-sm text-center px-4 font-mono text-xs">
                      Run a test to see Model A's output here.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Model 2 Column */}
            <div className="flex flex-col gap-3 h-full">
              <div className="flex items-center gap-2">
                {renderDropdown('agent', 2, agent2, model2, setAgent2Id, setModel2Id)}
                {renderDropdown('model', 2, agent2, model2, setAgent2Id, setModel2Id)}
              </div>
              <div className="relative rounded-3xl p-6 flex flex-col flex-1 overflow-hidden group transition-all duration-300 bg-gradient-to-b from-white/[0.05] via-white/[0.015] to-white/[0.025] bg-[#0c0e14]/75 backdrop-blur-3xl border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_24px_60px_rgba(0,0,0,0.55)]">
                {/* Glass specular top rim */}
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                {/* Ambient glass sheen */}
                <div className="absolute -top-24 -right-24 w-52 h-52 bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex-1 overflow-auto custom-scrollbar relative z-10" data-lenis-prevent="true">
                  {isTesting ? (
                    <div className="h-full flex items-center justify-center text-gray-400">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-6 h-6 border-2 border-gray-700 border-t-copper-500 rounded-full animate-spin"></div>
                      </div>
                    </div>
                  ) : result2 ? (
                    <pre className="whitespace-pre-wrap font-mono text-xs sm:text-[13px] text-gray-300 leading-relaxed">
                      {result2}
                    </pre>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-600 italic text-sm text-center px-4 font-mono text-xs">
                      Run a test to see Model B's output here.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
