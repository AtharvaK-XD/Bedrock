import { useState, useRef, useEffect } from 'react';
import { 
  Check, 
  Copy, 
  Zap, 
  Gauge, 
  RotateCcw, 
  ChevronDown, 
  Trophy, 
  Lock
} from 'lucide-react';
import { AI_AGENTS, AgentIcon } from '../components/ui/RichInput';
import { cn } from '../lib/utils';
import { testPromptWithMetrics, type ArenaBenchmarkMetrics } from '../lib/api';
import { recordExecutionTrace } from '../lib/telemetry';
import { openApiKeyModal } from '../lib/apiKeyEvents';
import { PageTransition } from '../components/layout/PageTransition';
import { isDesktopApp } from '../lib/platform';
import { Button as StatefulButton } from '../components/ui/stateful-button';
import { EncryptedText } from '../components/ui/encrypted-text';
import { useUserProfile } from '../lib/useUserProfile';
import { isModelAllowedForTier, getModelRequiredTier } from '../lib/subscriptionTiers';
import { UpgradeModal } from '../components/ui/UpgradeModal';
import { getActiveModelSettings } from '../lib/appSettings';


const ARENA_PROMPT_PRESETS = [
  {
    label: 'Code Refactor',
    prompt: 'Refactor this async function to handle concurrent retries with exponential backoff and typed errors in TypeScript.',
  },
  {
    label: 'Security Guardrails',
    prompt: 'Generate an impenetrable system instruction boundary protecting against prompt injection and delimiter evasion.',
  },
  {
    label: 'API Contract',
    prompt: 'Design a strict REST & Zod schema contract for a high-concurrency multi-tenant billing webhook handler.',
  },
  {
    label: 'System Persona',
    prompt: 'Define a Principal Systems Architect AI persona with strict negative constraints and production-grade code standards.',
  },
];

export default function PromptTester() {
  const isDesktop = isDesktopApp();
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful, technically rigorous engineering assistant.');
  const [isTesting, setIsTesting] = useState(false);
  const [result1, setResult1] = useState('');
  const [result2, setResult2] = useState('');
  const [metrics1, setMetrics1] = useState<ArenaBenchmarkMetrics | null>(null);
  const [metrics2, setMetrics2] = useState<ArenaBenchmarkMetrics | null>(null);
  const [copied1, setCopied1] = useState(false);
  const [copied2, setCopied2] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeDropdown, setActiveDropdown] = useState<'agent1' | 'model1' | 'agent2' | 'model2' | null>(null);
  
  // Default to Gemini vs Groq
  const defaultGeminiAgent = AI_AGENTS.find(a => a.id === 'gemini') || AI_AGENTS[0];
  const defaultGroqAgent = AI_AGENTS.find(a => a.id === 'llama') || AI_AGENTS[0];

  const [agent1Id, setAgent1Id] = useState(defaultGeminiAgent.id);
  const [model1Id, setModel1Id] = useState(() => getActiveModelSettings().defaultModel || 'gemini-3.5-flash-lite');

  
  const [agent2Id, setAgent2Id] = useState(defaultGroqAgent.id);
  const [model2Id, setModel2Id] = useState(defaultGroqAgent.models[0]?.id || 'qwen/qwen3.8-27b');

  const { profile } = useUserProfile();
  const [upgradeModal, setUpgradeModal] = useState<{
    isOpen: boolean;
    featureName?: string;
    requiredTier?: 'pro' | 'ultimate';
    reason?: string;
  }>({ isOpen: false });

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

    // Strict subscription tier gate for Duel models
    const allowed1 = isModelAllowedForTier(model1Id, profile?.plan);
    if (!allowed1) {
      const req1 = getModelRequiredTier(model1Id);
      setUpgradeModal({
        isOpen: true,
        featureName: `Model: ${model1Id}`,
        requiredTier: req1 === 'ultimate' ? 'ultimate' : 'pro',
        reason: `Model ${model1Id} is restricted to ${req1.toUpperCase()} subscribers. Upgrade your plan to run dual benchmarks with this frontier model.`,
      });
      return;
    }

    const allowed2 = isModelAllowedForTier(model2Id, profile?.plan);
    if (!allowed2) {
      const req2 = getModelRequiredTier(model2Id);
      setUpgradeModal({
        isOpen: true,
        featureName: `Model: ${model2Id}`,
        requiredTier: req2 === 'ultimate' ? 'ultimate' : 'pro',
        reason: `Model ${model2Id} is restricted to ${req2.toUpperCase()} subscribers. Upgrade your plan to run dual benchmarks with this frontier model.`,
      });
      return;
    }

    setIsTesting(true);
    setResult1('');
    setResult2('');
    setMetrics1(null);
    setMetrics2(null);
    
    try {
      const [res1, res2] = await Promise.allSettled([
        testPromptWithMetrics(model1Id, systemPrompt, prompt, (token) => {
          setResult1(prev => prev + token);
        }),
        testPromptWithMetrics(model2Id, systemPrompt, prompt, (token) => {
          setResult2(prev => prev + token);
        })
      ]);

      if (res1.status === 'fulfilled') {
        setResult1(res1.value.text);
        setMetrics1(res1.value.metrics);
        recordExecutionTrace({
          node: 'ARENA_MODEL_A',
          model: model1Id,
          tokens: res1.value.metrics.tokenCount,
          latency: res1.value.metrics.latencyMs,
          status: 'OK',
        });
      } else {
        const msg = res1.reason?.message || 'Failed';
        setResult1(`Error: ${msg}`);
        recordExecutionTrace({
          node: 'ARENA_MODEL_A',
          model: model1Id,
          tokens: 0,
          latency: 0,
          status: 'ERR',
        });
        if (res1.reason?.isApiKeyError || msg.toLowerCase().includes('api key')) {
          openApiKeyModal(msg);
        }
      }

      if (res2.status === 'fulfilled') {
        setResult2(res2.value.text);
        setMetrics2(res2.value.metrics);
        recordExecutionTrace({
          node: 'ARENA_MODEL_B',
          model: model2Id,
          tokens: res2.value.metrics.tokenCount,
          latency: res2.value.metrics.latencyMs,
          status: 'OK',
        });
      } else {
        const msg = res2.reason?.message || 'Failed';
        setResult2(`Error: ${msg}`);
        recordExecutionTrace({
          node: 'ARENA_MODEL_B',
          model: model2Id,
          tokens: 0,
          latency: 0,
          status: 'ERR',
        });
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

  const copyResult = (text: string, side: 1 | 2) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (side === 1) {
      setCopied1(true);
      setTimeout(() => setCopied1(false), 2000);
    } else {
      setCopied2(true);
      setTimeout(() => setCopied2(false), 2000);
    }
  };

  const resetArena = () => {
    setResult1('');
    setResult2('');
    setMetrics1(null);
    setMetrics2(null);
  };

  const agent1 = AI_AGENTS.find(a => a.id === agent1Id) || AI_AGENTS[0];
  const model1 = agent1.models.find(m => m.id === model1Id) || agent1.models[0];

  const agent2 = AI_AGENTS.find(a => a.id === agent2Id) || AI_AGENTS[0];
  const model2 = agent2.models.find(m => m.id === model2Id) || agent2.models[0];

  // Winner calculation
  const sideAFaster = metrics1 && metrics2 && metrics1.latencyMs < metrics2.latencyMs;
  const sideBFaster = metrics1 && metrics2 && metrics2.latencyMs < metrics1.latencyMs;
  const latencyDiff = metrics1 && metrics2 ? Math.abs(metrics1.latencyMs - metrics2.latencyMs) : 0;

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
              <AgentIcon agent={currentAgent} className="w-4 h-4" badgeClassName="w-4 h-4" />
              <span className="truncate">{currentAgent.name}</span>
            </div>
            <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
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
                    <AgentIcon agent={a} className="w-4 h-4" badgeClassName="w-4 h-4" />
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
            <AgentIcon agent={currentAgent} model={currentModel.id} className="w-3.5 h-3.5" badgeClassName="w-4 h-4" />
            <span className="truncate">{currentModel.name}</span>
          </div>
          <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
        </button>

        {isActive && (
          <div className="absolute top-full mt-2 left-0 w-full bg-[#0e1117]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl z-50 py-2 font-mono">
            <div className="px-3 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-white/10 mb-2 flex items-center gap-1.5">
              <AgentIcon agent={currentAgent} className="w-3.5 h-3.5" badgeClassName="w-4 h-4" />
              <span>{currentAgent.name} Models</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto px-1.5 custom-scrollbar" data-lenis-prevent="true">
              {currentAgent.models.map((m: any) => {
                const isAllowed = isModelAllowedForTier(m.id, profile?.plan);
                const required = getModelRequiredTier(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (!isAllowed) {
                        setUpgradeModal({
                          isOpen: true,
                          featureName: m.name,
                          requiredTier: required === 'ultimate' ? 'ultimate' : 'pro',
                          reason: `${m.name} is reserved for ${required.toUpperCase()} Plan members. Upgrade to benchmark with this model.`,
                        });
                        setActiveDropdown(null);
                        return;
                      }
                      setModelId(m.id);
                      setActiveDropdown(null);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-1.5 text-xs text-left rounded-lg transition-colors",
                      currentModel.id === m.id ? "bg-white/10 text-white font-medium" : "text-gray-300 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AgentIcon agent={currentAgent} model={m.id} className="w-3.5 h-3.5" badgeClassName="w-4 h-4" />
                      <span className="truncate">{m.name}</span>
                      {!isAllowed && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-copper-500/15 text-copper-300 border border-copper-500/30 shrink-0 uppercase ml-1">
                          <Lock className="w-2.5 h-2.5 text-copper-400" />
                          <span>{required}</span>
                        </span>
                      )}
                    </div>
                    {currentModel.id === m.id && isAllowed && <Check className="w-3.5 h-3.5 text-copper-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <PageTransition className={cn(isDesktop ? "h-full" : "")}>
      <div className={cn(
        "w-full px-4 sm:px-8 py-6 lg:py-10 relative overflow-hidden",
        isDesktop ? "min-h-full" : "min-h-[calc(100vh-80px)]"
      )}>
        {/* Subtle ambient illumination behind the arena for realistic glass refraction */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[500px] bg-gradient-to-tr from-copper-500/5 via-white/[0.015] to-transparent blur-[160px] pointer-events-none rounded-full" />
        
        {/* Arena Header */}
        <div className="text-center mb-8 relative z-10">
          <h1 className="text-4xl md:text-5xl font-editorial font-bold text-white mb-3 tracking-tight leading-[1.1]">
            The Arena.
          </h1>
          <p className="text-sm md:text-base text-gray-400 max-w-2xl mx-auto">
            Test prompt architectures simultaneously against dual frontier LLMs to benchmark latency, TTFT, token throughput, and adherence.
          </p>

          {/* Quick Controls Bar */}
          {(result1 || result2) && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                type="button"
                onClick={resetArena}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white text-xs font-mono transition-all backdrop-blur-md cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Results</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 lg:gap-8 min-h-[720px] relative z-10">
          {/* Left: Input Glass Card */}
          <div className="flex flex-col gap-4 h-full">
            <div className="relative rounded-3xl p-5 sm:p-6 flex flex-col flex-1 overflow-hidden group bg-gradient-to-b from-white/[0.05] via-white/[0.015] to-white/[0.025] bg-[#0c0e14]/75 backdrop-blur-3xl border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_20px_50px_rgba(0,0,0,0.55)]">
              {/* Glass specular top rim */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
              {/* Ambient glass sheen */}
              <div className="absolute -top-24 -left-24 w-52 h-52 bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center justify-between mb-2 relative z-10">
                <h3 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider">
                  System Directive (Optional)
                </h3>
                <span className="text-[10px] font-mono text-gray-500">Shared Context</span>
              </div>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                data-lenis-prevent="true"
                rows={3}
                className="w-full resize-none bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-copper-500/50 focus:ring-1 focus:ring-copper-500/50 mb-4 custom-scrollbar font-mono backdrop-blur-md shadow-inner relative z-10 transition-colors leading-relaxed"
              />
              
              <div className="flex items-center justify-between mb-2 relative z-10">
                <h3 className="text-xs font-mono font-semibold text-gray-400 uppercase tracking-wider">
                  Test Prompt
                </h3>
                <span className="text-[10px] font-mono text-gray-500">{prompt.length} chars</span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter or select a prompt to benchmark head-to-head..."
                data-lenis-prevent="true"
                className="w-full flex-1 min-h-[140px] resize-none bg-black/20 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-copper-500/50 focus:ring-1 focus:ring-copper-500/50 custom-scrollbar font-mono leading-relaxed relative z-10"
              />

              {/* Quick Presets */}
              <div className="mt-3 pt-3 border-t border-white/[0.06] relative z-10">
                <div className="text-[10px] font-mono text-gray-500 mb-2 uppercase tracking-wider">Quick Presets:</div>
                <div className="flex flex-wrap gap-1.5">
                  {ARENA_PROMPT_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPrompt(p.prompt)}
                      className="px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[11px] font-mono text-gray-300 hover:text-white transition-all text-left truncate max-w-full"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <StatefulButton
              onClick={handleTest}
              disabled={!prompt.trim() || isTesting}
              className="w-full rounded-xl px-8 py-4 text-sm font-semibold uppercase tracking-wider bg-[#2C9A8B] hover:bg-[#1F7A6E] text-white shadow-md shadow-[#2C9A8B]/25 active:scale-[0.98] transition-all"
            >
              {isTesting ? 'Benchmarking Battle...' : 'Run Arena Duel'}
            </StatefulButton>
          </div>

          {/* Right: Output Arena Glass Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full" ref={containerRef}>
            {/* Model 1 Column */}
            <div className="flex flex-col gap-3 h-full">
              <div className="flex items-center gap-2">
                {renderDropdown('agent', 1, agent1, model1, setAgent1Id, setModel1Id)}
                {renderDropdown('model', 1, agent1, model1, setAgent1Id, setModel1Id)}
              </div>
              <div className="relative rounded-3xl p-5 sm:p-6 flex flex-col flex-1 overflow-hidden group transition-all duration-300 bg-gradient-to-b from-white/[0.05] via-white/[0.015] to-white/[0.025] bg-[#0c0e14]/75 backdrop-blur-3xl border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_24px_60px_rgba(0,0,0,0.55)]">
                {/* Glass specular top rim */}
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                {/* Ambient glass sheen */}
                <div className="absolute -top-24 -right-24 w-52 h-52 bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />
                
                {/* Branded Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 relative z-10 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <AgentIcon agent={agent1} model={model1.id} className="w-4 h-4" badgeClassName="w-4 h-4" />
                    <span className="text-xs font-semibold text-white truncate">{agent1.name} · {model1.name}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {sideAFaster && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <Trophy className="w-3 h-3 text-emerald-400" />
                        <span>+{latencyDiff}ms faster</span>
                      </span>
                    )}
                    {result1 && (
                      <button
                        type="button"
                        onClick={() => copyResult(result1, 1)}
                        className="p-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors"
                        title="Copy Model A Output"
                      >
                        {copied1 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400 shrink-0 uppercase">
                      Side A
                    </span>
                  </div>
                </div>

                {/* Metrics Bar */}
                {metrics1 && (
                  <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-white/[0.06] text-[11px] font-mono text-gray-400 relative z-10 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      <Zap className="w-3 h-3" />
                      <span>{metrics1.latencyMs}ms</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                      <Gauge className="w-3 h-3" />
                      <span>TTFT: {metrics1.ttftMs}ms</span>
                    </span>
                    <span className="text-gray-400 text-[10px] ml-auto">
                      {metrics1.tokensPerSec} tok/s · {metrics1.tokenCount} tokens
                    </span>
                  </div>
                )}

                <div className="flex-1 overflow-auto custom-scrollbar relative z-10" data-lenis-prevent="true">
                  {isTesting ? (
                    <div className="h-full flex items-center justify-center text-gray-400 min-h-[220px]">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-6 h-6 border-2 border-gray-700 border-t-emerald-400 rounded-full animate-spin"></div>
                        <EncryptedText 
                          text="STREAMING MODEL INFERENCE..." 
                          encryptedClassName="text-copper-500/60 font-mono text-xs"
                          revealedClassName="text-emerald-400 font-mono text-xs font-medium"
                          revealDelayMs={30}
                          flipDelayMs={30}
                        />
                      </div>
                    </div>
                  ) : result1 ? (
                    <pre className="whitespace-pre-wrap font-mono text-xs text-gray-300 leading-relaxed">
                      {result1}
                    </pre>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-600 italic text-sm text-center px-4 font-mono text-xs min-h-[220px]">
                      Select models and enter a prompt to initiate duel.
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
              <div className="relative rounded-3xl p-5 sm:p-6 flex flex-col flex-1 overflow-hidden group transition-all duration-300 bg-gradient-to-b from-white/[0.05] via-white/[0.015] to-white/[0.025] bg-[#0c0e14]/75 backdrop-blur-3xl border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_24px_60px_rgba(0,0,0,0.55)]">
                {/* Glass specular top rim */}
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                {/* Ambient glass sheen */}
                <div className="absolute -top-24 -right-24 w-52 h-52 bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />
                
                {/* Branded Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 relative z-10 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <AgentIcon agent={agent2} model={model2.id} className="w-4 h-4" badgeClassName="w-4 h-4" />
                    <span className="text-xs font-semibold text-white truncate">{agent2.name} · {model2.name}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {sideBFaster && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <Trophy className="w-3 h-3 text-emerald-400" />
                        <span>+{latencyDiff}ms faster</span>
                      </span>
                    )}
                    {result2 && (
                      <button
                        type="button"
                        onClick={() => copyResult(result2, 2)}
                        className="p-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors"
                        title="Copy Model B Output"
                      >
                        {copied2 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400 shrink-0 uppercase">
                      Side B
                    </span>
                  </div>
                </div>

                {/* Metrics Bar */}
                {metrics2 && (
                  <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-white/[0.06] text-[11px] font-mono text-gray-400 relative z-10 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      <Zap className="w-3 h-3" />
                      <span>{metrics2.latencyMs}ms</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                      <Gauge className="w-3 h-3" />
                      <span>TTFT: {metrics2.ttftMs}ms</span>
                    </span>
                    <span className="text-gray-400 text-[10px] ml-auto">
                      {metrics2.tokensPerSec} tok/s · {metrics2.tokenCount} tokens
                    </span>
                  </div>
                )}

                <div className="flex-1 overflow-auto custom-scrollbar relative z-10" data-lenis-prevent="true">
                  {isTesting ? (
                    <div className="h-full flex items-center justify-center text-gray-400 min-h-[220px]">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-6 h-6 border-2 border-gray-700 border-t-emerald-400 rounded-full animate-spin"></div>
                        <EncryptedText 
                          text="BENCHMARKING LATENCY & TOKENS..." 
                          encryptedClassName="text-copper-500/60 font-mono text-xs"
                          revealedClassName="text-emerald-400 font-mono text-xs font-medium"
                          revealDelayMs={30}
                          flipDelayMs={30}
                        />
                      </div>
                    </div>
                  ) : result2 ? (
                    <pre className="whitespace-pre-wrap font-mono text-xs text-gray-300 leading-relaxed">
                      {result2}
                    </pre>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-600 italic text-sm text-center px-4 font-mono text-xs min-h-[220px]">
                      Select models and enter a prompt to initiate duel.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <UpgradeModal
        isOpen={upgradeModal.isOpen}
        onClose={() => setUpgradeModal({ isOpen: false })}
        featureName={upgradeModal.featureName}
        requiredTier={upgradeModal.requiredTier}
        reason={upgradeModal.reason}
      />
    </PageTransition>
  );
}
