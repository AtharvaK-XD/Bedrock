import { ANTHROPIC_MODELS_EVENT } from '../../lib/anthropicModels';
import { getCachedProviderModels, DYNAMIC_MODELS_UPDATED_EVENT } from '../../lib/dynamicModelDiscovery';
import React, { useState, useRef, useEffect } from 'react';
import { Plus, Check, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { IdeaPayload } from '../../lib/mockApi';
import { usePromptQuota } from '../../lib/usePromptQuota';
import { useUserProfile } from '../../lib/useUserProfile';
import { isModelAllowedForTier, getModelRequiredTier } from '../../lib/subscriptionTiers';
import { isDesktopApp } from '../../lib/platform';
import { isModelKeyConfigured } from '../../lib/apiKeysHelper';
import { QuotaLimitModal } from './QuotaLimitModal';
import { UpgradeModal } from './UpgradeModal';
import { showToast } from '../../lib/notify';
import { ApiKeyPromptModal } from './ApiKeyPromptModal';
import { Button as StatefulButton } from './stateful-button';

interface RichInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  targetType: IdeaPayload['targetType'];
  onTargetTypeChange: (type: IdeaPayload['targetType']) => void;
}

const targetOptions: { id: IdeaPayload['targetType']; label: string; tag: string }[] = [
  { id: 'coding_agent', label: 'Coding Agent', tag: 'DEV' },
  { id: 'image_generation', label: 'Image Generation', tag: 'IMG' },
  { id: 'video_generation', label: 'Video Generation', tag: 'VIDEO' },
  { id: 'freelancer_brief', label: 'Freelancer', tag: 'BRIEF' },
  { id: 'hackathon_pitch', label: 'Hackathon', tag: 'PITCH' },
  { id: 'no_code', label: 'No-Code', tag: 'NOCODE' },
];

export interface AgentModel {
  id: string;
  name: string;
  tier: 'free' | 'pro' | 'ultimate';
  tag?: string;
}

export interface AIAgent {
  id: string;
  name: string;
  description: string;
  models: AgentModel[];
}

export const AI_AGENTS: AIAgent[] = [
  {
    id: 'universal',
    name: 'Universal',
    description: 'Works well across any model & provider',
    models: [
      { id: 'auto', name: 'Auto-select Best Model', tier: 'free', tag: 'Smart Routing' }
    ]
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT (OpenAI)',
    description: 'Frontier reasoning & agentic coding by OpenAI',
    models: [
      { id: 'openai/gpt-6-astra', name: 'GPT-6 Astra', tier: 'ultimate', tag: 'Apex Flagship' },
      { id: 'openai/o1', name: 'OpenAI o1', tier: 'ultimate', tag: 'Autonomous Reasoning' },
      { id: 'openai/gpt-6.1-sol', name: 'GPT-6.1 Sol', tier: 'pro', tag: 'Agentic Coding' },
      { id: 'openai/gpt-6-luna', name: 'GPT-6 Luna', tier: 'pro', tag: 'Fast 1.05M Context' },
      { id: 'openai/gpt-5.6-luna', name: 'GPT-5.6 Luna', tier: 'pro', tag: 'Balanced Reasoning' },
      { id: 'openai/o3-mini', name: 'OpenAI o3-mini', tier: 'pro', tag: 'High-Speed STEM' },
      { id: 'openai/gpt-4o', name: 'GPT-4o', tier: 'pro', tag: 'Omni Benchmark' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', tier: 'pro', tag: 'Fast & Lightweight' },
    ]
  },
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    description: 'Nuanced reasoning, coding & architecture by Anthropic',
    models: [
      { id: 'anthropic/claude-opus-5.5', name: 'Claude Opus 5.5', tier: 'ultimate', tag: 'Apex Architecture & Code' },
      { id: 'anthropic/claude-sonnet-5.5', name: 'Claude Sonnet 5.5', tier: 'pro', tag: 'Deep Reasoning & Coding' },
      { id: 'anthropic/claude-haiku-5.5', name: 'Claude Haiku 5.5', tier: 'pro', tag: 'Ultra-Fast 1M Context' },
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', tier: 'pro', tag: 'Hybrid Reasoning' },
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', tier: 'pro', tag: 'Pro Benchmark' },
      { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', tier: 'pro', tag: 'Fast & Lightweight' },
    ]
  },
  {
    id: 'gemini',
    name: 'Gemini (Google DeepMind)',
    description: 'Multimodal frontier intelligence & reasoning',
    models: [
      { id: 'google/gemini-4-argon', name: 'Gemini 4 Argon', tier: 'ultimate', tag: 'Autonomous Reasoning 1M+' },
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', tier: 'pro', tag: 'Deep Multimodal 1M+' },
      { id: 'google/gemini-3.6-flash', name: 'Gemini 3.6 Flash', tier: 'pro', tag: 'High-Speed Coding' },
      { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', tier: 'pro', tag: 'Workhorse Multimodal' },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', tier: 'free', tag: 'Zero-Cost Free' },
      { id: 'gemini-flash-lite-latest', name: 'Gemini Flash-Lite Latest', tier: 'free', tag: 'Zero-Cost Free' },
      { id: 'gemma-4-26b-a4b-it', name: 'Gemma 4 26B', tier: 'free', tag: 'Free Open Weights' },
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'Deep reasoning & state-of-the-art coding',
    models: [
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', tier: 'pro', tag: '671B Reasoning Flagship' },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 Chat', tier: 'pro', tag: '671B MoE General Benchmark' },
      { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2', tier: 'pro', tag: 'Code Specialist' },
    ]
  },
  {
    id: 'llama',
    name: 'Groq / LLaMA & OSS',
    description: 'Ultra-low latency open models via Groq LPU',
    models: [
      { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B Instruct', tier: 'ultimate', tag: '405B Parameter Giant' },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', tier: 'pro', tag: 'Groq LPU High Speed' },
      { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B Instruct', tier: 'pro', tag: 'Ultra-Fast Low Latency' },
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', tier: 'free', tag: 'Zero-Cost Flagship' },
      { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', tier: 'free', tag: 'Zero-Cost Ultra-Fast' },
      { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', tier: 'free', tag: 'Groq LPU Free' },
    ]
  },
  {
    id: 'perplexity',
    name: 'Perplexity AI',
    description: 'Live web search with grounded citations',
    models: [
      { id: 'perplexity/sonar-reasoning-pro', name: 'Sonar Reasoning Pro', tier: 'ultimate', tag: 'Chain-of-Thought Search' },
      { id: 'perplexity/sonar-pro', name: 'Sonar Pro', tier: 'pro', tag: 'Live Web Grounding' },
      { id: 'sonar', name: 'Sonar', tier: 'pro', tag: 'Fast Web Search' },
      { id: 'sonar-huge', name: 'Sonar Huge', tier: 'pro', tag: 'Deep Synthesis' },
    ]
  },
  {
    id: 'grok',
    name: 'Grok (xAI)',
    description: 'Real-time reasoning & frontier intelligence',
    models: [
      { id: 'x-ai/grok-4.7', name: 'Grok 4.7', tier: 'pro', tag: 'Flagship Real-Time' },
      { id: 'x-ai/grok-latest', name: 'Grok Latest', tier: 'pro', tag: 'Auto-Redirect Flagship' },
      { id: 'grok-3', name: 'Grok 3', tier: 'pro', tag: 'Flagship Reasoning' },
      { id: 'grok-2-1212', name: 'Grok 2', tier: 'pro', tag: 'Real-Time X Data' },
    ]
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    description: 'Fast, European frontier reasoning & coding',
    models: [
      { id: 'mistralai/mistral-large-2411', name: 'Mistral Large 2411', tier: 'pro', tag: 'European Flagship' },
      { id: 'mistral-large', name: 'Mistral Large 2', tier: 'pro', tag: 'Flagship Benchmark' },
      { id: 'codestral-latest', name: 'Codestral', tier: 'pro', tag: 'Code Specialist' },
      { id: 'mixtral-8x22b', name: 'Mixtral 8x22B', tier: 'pro', tag: 'Sparse MoE' },
    ]
  },
  {
    id: 'nvidia',
    name: 'Nvidia NIM',
    description: 'High-parameter frontier reasoning & NIM models',
    models: [
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', name: 'Llama 3.1 Nemotron 70B', tier: 'pro', tag: 'Pro Reasoning' },
      { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra 550B', tier: 'free', tag: 'Free Frontier' },
      { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', name: 'Nemotron 3 Nano Omni', tier: 'free', tag: 'Free Reasoning' },
    ]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Frontier, open-weight & unified multi-provider routing',
    models: [
      { id: 'anthropic/claude-opus-5.5', name: 'Claude Opus 5.5', tier: 'ultimate', tag: 'OpenRouter Flagship' },
      { id: 'openai/gpt-6-astra', name: 'GPT-6 Astra', tier: 'ultimate', tag: 'OpenRouter Flagship' },
      { id: 'anthropic/claude-sonnet-5.5', name: 'Claude Sonnet 5.5', tier: 'pro', tag: 'OpenRouter Pro' },
      { id: 'openai/gpt-6.1-sol', name: 'GPT-6.1 Sol', tier: 'pro', tag: 'Agentic Coding' },
      { id: 'openai/gpt-6-luna', name: 'GPT-6 Luna', tier: 'pro', tag: 'Fast 1.05M Context' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', tier: 'pro', tag: '671B MoE' },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', tier: 'pro', tag: 'Open Weights' },
      { id: 'openrouter/free', name: 'Free Models Auto-Router', tier: 'free', tag: 'Zero-Cost Router' },
      { id: 'poolside/laguna-s-2.1:free', name: 'Poolside Laguna S 2.1', tier: 'free', tag: 'Zero-Cost Free' },
    ]
  },
  {
    id: 'huggingface',
    name: 'Open Models / HF',
    description: 'Open-weight foundation & open research models',
    models: [
      { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B Instruct', tier: 'ultimate', tag: 'HF Giant' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', tier: 'pro', tag: 'HF Reasoning' },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', tier: 'pro', tag: 'HF Weights' },
      { id: 'openrouter/free', name: 'Open Foundation Models Router', tier: 'free', tag: 'Zero-Cost Router' },
      { id: 'poolside/laguna-s-2.1:free', name: 'Laguna S 2.1', tier: 'free', tag: 'Zero-Cost Free' },
    ]
  },
  {
    id: 'cohere',
    name: 'Cohere',
    description: 'Enterprise search, retrieval & RAG models',
    models: [
      { id: 'command-r-plus', name: 'Command R+', tier: 'ultimate', tag: 'Enterprise Search & RAG' },
      { id: 'command-r', name: 'Command R', tier: 'pro', tag: 'Fast RAG Specialist' },
    ]
  },
  {
    id: 'copilot',
    name: 'Microsoft Copilot',
    description: 'Microsoft ecosystem & enterprise intelligence',
    models: [
      { id: 'copilot-pro', name: 'Copilot Pro', tier: 'ultimate', tag: 'Ecosystem Flagship' },
    ]
  }
];

import { AgentIcon, ModelLogo, getLogoComponent } from './ModelLogos';
export { AgentIcon, ModelLogo, getLogoComponent };

const DEFAULT_GENERATOR_PLACEHOLDERS = [
  "Describe the prompt, agent persona, or pipeline you want to construct...",
  "Help me review a tricky pull request in a legacy codebase...",
  "Write a landing page headline that converts...",
  "Create a detailed brief for a UX designer..."
];

const AGENT_PROVIDER_MAP: Record<string, string> = {
  claude: 'anthropic',
  chatgpt: 'openai',
  llama: 'groq',
  gemini: 'gemini',
  mistral: 'mistral',
  deepseek: 'deepseek',
  grok: 'xai',
  openrouter: 'openrouter',
  cohere: 'cohere',
  nvidia: 'nvidia',
  huggingface: 'huggingface',
  perplexity: 'perplexity',
  copilot: 'openai',
};

export function RichInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  targetType,
  onTargetTypeChange,
}: RichInputProps) {
  const isDesktop = isDesktopApp();
  const [discoveredModelsVersion, setDiscoveredModelsVersion] = useState(0);

  useEffect(() => {
    if (!isDesktop) return;
    const onUpdated = () => {
      setDiscoveredModelsVersion((v) => v + 1);
    };
    window.addEventListener(DYNAMIC_MODELS_UPDATED_EVENT, onUpdated);
    window.addEventListener(ANTHROPIC_MODELS_EVENT, onUpdated);
    return () => {
      window.removeEventListener(DYNAMIC_MODELS_UPDATED_EVENT, onUpdated);
      window.removeEventListener(ANTHROPIC_MODELS_EVENT, onUpdated);
    };
  }, [isDesktop]);

  const activeAiAgents = React.useMemo(() => {
    if (!isDesktop) return AI_AGENTS;

    return AI_AGENTS.map((agent) => {
      const provider = AGENT_PROVIDER_MAP[agent.id];
      if (!provider) return agent;
      const dynamicModels = getCachedProviderModels(provider);
      if (!dynamicModels || dynamicModels.length === 0) return agent;

      const map = new Map<string, AgentModel>();
      for (const m of agent.models) map.set(m.id.toLowerCase(), m);
      for (const dm of dynamicModels) {
        const k = dm.id.toLowerCase();
        if (!map.has(k)) {
          map.set(k, {
            id: dm.id,
            name: dm.name,
            tier: getModelRequiredTier(dm.id),
            tag: 'Discovered Model',
          });
        }
      }
      return {
        ...agent,
        models: Array.from(map.values()),
      };
    });
  }, [isDesktop, discoveredModelsVersion]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  // Prompt Quota Hook
  const {
    sessionPrompts,
    weeklyPrompts,
    sessionLimit,
    weeklyLimit,
    sessionPercent,
    weeklyPercent,
    timeUntilSession,
    timeUntilWeekly,
    isFreeTier,
    isWeeklyLimitReached,
    isLimitReached,
    recordPromptUsage,
  } = usePromptQuota();

  const [showQuotaModal, setShowQuotaModal] = useState(false);

  const [apiKeyModal, setApiKeyModal] = useState<{
    isOpen: boolean;
    modelId?: string;
    modelName?: string;
    agentId?: string;
  }>({ isOpen: false });

  const handleActionSubmit = () => {
    if (value.trim() && !isLoading) {
      if (isDesktopApp()) {
        if (!isModelKeyConfigured(selectedModelId, selectedAgentId)) {
          setApiKeyModal({
            isOpen: true,
            modelId: selectedModelId,
            modelName: selectedModel.name,
            agentId: selectedAgentId,
          });
          return;
        }
      }

      if (!isDesktop && isLimitReached) {
        setShowQuotaModal(true);
        return;
      }

      if (!isDesktop) {
        const allowed = recordPromptUsage(1);
        if (!allowed) {
          setShowQuotaModal(true);
          return;
        }
      }

      onSubmit();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const validFiles = selectedFiles.filter(file => {
        if (file.size > MAX_FILE_SIZE) {
          showToast(`${file.name} is too large. The limit is 5 MB.`, 'warning');
          return false;
        }
        return true;
      });
      setFiles(prev => [...prev, ...validFiles]);
      e.target.value = '';
    }
  };

  const removeFile = (indexToRemove: number) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
  };
  
  const [activeDropdown, setActiveDropdown] = useState<'target' | 'agent' | 'model' | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState(AI_AGENTS[0].id);
  const [selectedModelId, setSelectedModelId] = useState(AI_AGENTS[0].models[0].id);
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
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const [placeholderText, setPlaceholderText] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    if (isTyping) {
      if (placeholderText.length < DEFAULT_GENERATOR_PLACEHOLDERS[placeholderIndex].length) {
        timeout = setTimeout(() => {
          setPlaceholderText(DEFAULT_GENERATOR_PLACEHOLDERS[placeholderIndex].slice(0, placeholderText.length + 1));
        }, 40);
      } else {
        timeout = setTimeout(() => {
          setIsTyping(false);
        }, 2000);
      }
    } else {
      if (placeholderText.length > 0) {
        timeout = setTimeout(() => {
          setPlaceholderText(placeholderText.slice(0, -1));
        }, 20);
      } else {
        setPlaceholderIndex((prev) => (prev + 1) % DEFAULT_GENERATOR_PLACEHOLDERS.length);
        setIsTyping(true);
      }
    }

    return () => clearTimeout(timeout);
  }, [placeholderText, isTyping, placeholderIndex]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleActionSubmit();
    }
  };

  const selectedTarget = targetOptions.find(t => t.id === targetType) || targetOptions[0];
  const selectedAgent = activeAiAgents.find(a => a.id === selectedAgentId) || activeAiAgents[0];
  const selectedModel = selectedAgent.models.find(m => m.id === selectedModelId) || selectedAgent.models[0];

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative rounded-3xl transition-all duration-300 border border-white/[0.10] focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 flex flex-col group bg-black/85 backdrop-blur-2xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.98)] overflow-visible",
        activeDropdown ? "z-50" : "z-0"
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] glass-specular-line pointer-events-none z-20 rounded-t-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/80 to-black/95 rounded-3xl z-0" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Top Toolbar */}
        <div className="flex flex-wrap items-center gap-2 p-3.5 sm:p-4 bg-transparent rounded-t-3xl">
          {/* Target Dropdown */}
          <div className={cn("relative", activeDropdown === 'target' ? "z-30" : "z-10")}>
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'target' ? null : 'target')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-zinc-300 hover:text-white bg-black/60 hover:bg-black/90 border border-white/[0.08] hover:border-white/[0.16] shadow-sm transition-all duration-200 backdrop-blur-md"
            >
              <span className="font-mono text-[10px] text-zinc-400 font-semibold">{selectedTarget.tag}</span>
              <span>{selectedTarget.label}</span>
              <span className="text-[10px] text-zinc-500">▾</span>
            </button>
            
            {activeDropdown === 'target' && (
              <div 
                className="absolute top-full left-0 mt-2 w-56 max-w-[calc(100vw-2rem)] bg-black/95 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-[100] p-1.5 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150"
                data-lenis-prevent="true"
              >
                <div 
                  className="max-h-[280px] overflow-y-auto custom-scrollbar overscroll-contain flex flex-col gap-0.5 p-0.5"
                  data-lenis-prevent="true"
                  onWheel={(e) => e.stopPropagation()}
                >
                  {targetOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onTargetTypeChange(opt.id);
                        setActiveDropdown(null);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-xs sm:text-sm text-left rounded-xl transition-colors",
                        targetType === opt.id ? "bg-white/10 text-white font-medium" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <span>{opt.label}</span>
                      <span className="font-mono text-[9px] text-zinc-500 uppercase">{opt.tag}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="w-px h-4 bg-white/10"></div>
          
          {/* Agent Selection Dropdown */}
          <div className={cn("relative", activeDropdown === 'agent' ? "z-30" : "z-10")}>
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'agent' ? null : 'agent')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-zinc-300 hover:text-white bg-black/60 hover:bg-black/90 border border-white/[0.08] hover:border-white/[0.16] shadow-sm transition-all duration-200 backdrop-blur-md"
            >
              <AgentIcon agent={selectedAgent} className="w-4 h-4" badgeClassName="w-4 h-4" />
              <span className="text-zinc-500 text-xs">Provider:</span>
              <span>{selectedAgent.name}</span>
              <span className="text-[10px] text-zinc-500">▾</span>
            </button>
            
            {activeDropdown === 'agent' && (
              <div 
                className="absolute top-full left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-black/95 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-[100] p-2 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150"
                data-lenis-prevent="true"
              >
                <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.06] mb-1">
                  AI Model Providers
                </div>
                <div 
                  className="max-h-[min(380px,50vh)] overflow-y-auto custom-scrollbar overscroll-contain flex flex-col gap-0.5 p-1" 
                  data-lenis-prevent="true"
                  onWheel={(e) => e.stopPropagation()}
                >
                  {activeAiAgents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        const firstAllowed = agent.models.find((m) => isModelAllowedForTier(m.id, profile?.plan)) || agent.models[0];
                        setSelectedModelId(firstAllowed.id);
                        // Once user selects the provider, immediately open model chooser!
                        setActiveDropdown('model');
                      }}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 px-3 py-2 text-left rounded-xl transition-all duration-150",
                        selectedAgentId === agent.id ? "bg-white/10 text-white" : "hover:bg-white/5 text-zinc-300 hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <AgentIcon agent={agent} className="w-5 h-5 shrink-0" badgeClassName="w-5 h-5" />
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-medium truncate">{agent.name}</div>
                          <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{agent.description}</div>
                        </div>
                      </div>
                      {selectedAgentId === agent.id && <Check className="w-4 h-4 text-teal-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-white/10"></div>
          
          {/* Model Selection Dropdown */}
          <div className={cn("relative", activeDropdown === 'model' ? "z-30" : "z-10")}>
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'model' ? null : 'model')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-zinc-300 hover:text-white bg-black/60 hover:bg-black/90 border border-white/[0.08] hover:border-white/[0.16] shadow-sm transition-all duration-200 backdrop-blur-md"
            >
              <AgentIcon agent={selectedAgent} model={selectedModel.id} className="w-4 h-4" badgeClassName="w-4 h-4" />
              <span className="text-zinc-500 text-xs">Model:</span>
              <span className="font-mono text-xs">{selectedModel.name}</span>
              {!isDesktopApp() && (
                <span className="text-[10px] font-mono text-teal-400 uppercase">
                  {((selectedModel as AgentModel).tier || getModelRequiredTier(selectedModel.id))}
                </span>
              )}
              <span className="text-[10px] text-zinc-500">▾</span>
            </button>

            {activeDropdown === 'model' && (() => {
              const isDesktop = isDesktopApp();
              const ultimateModels = selectedAgent.models.filter(
                (m) => ((m as AgentModel).tier || getModelRequiredTier(m.id)) === 'ultimate'
              );
              const proModels = selectedAgent.models.filter(
                (m) => ((m as AgentModel).tier || getModelRequiredTier(m.id)) === 'pro'
              );
              const freeModels = selectedAgent.models.filter(
                (m) => ((m as AgentModel).tier || getModelRequiredTier(m.id)) === 'free'
              );

              const renderModelButton = (model: AgentModel, tierType: 'ultimate' | 'pro' | 'free') => {
                const isAllowed = isDesktop || isModelAllowedForTier(model.id, profile?.plan);
                const required = model.tier || getModelRequiredTier(model.id);
                const isSelected = selectedModelId === model.id;

                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => {
                      if (!isDesktop && !isAllowed) {
                        setUpgradeModal({
                          isOpen: true,
                          featureName: model.name,
                          requiredTier: required === 'ultimate' ? 'ultimate' : 'pro',
                          reason: `${model.name} requires an active ${required.toUpperCase()} Plan ($${required === 'ultimate' ? '50' : '20'} / month). Upgrade your plan to get full access.`,
                        });
                        setActiveDropdown(null);
                        return;
                      }
                      if (isDesktop && !isModelKeyConfigured(model.id, selectedAgentId)) {
                        setApiKeyModal({
                          isOpen: true,
                          modelId: model.id,
                          modelName: model.name,
                          agentId: selectedAgentId,
                        });
                        setActiveDropdown(null);
                        return;
                      }
                      setSelectedModelId(model.id);
                      setActiveDropdown(null);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-xs text-left rounded-xl transition-all duration-150 font-mono",
                      isSelected
                        ? "bg-white/10 text-white font-medium"
                        : "text-zinc-300 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AgentIcon agent={selectedAgent} model={model.id} className="w-3.5 h-3.5 shrink-0" badgeClassName="w-4 h-4" />
                      <div className="flex flex-col min-w-0 text-left">
                        <span className="truncate">{model.name}</span>
                        {model.tag && (
                          <span className="text-[10px] text-zinc-500 font-sans truncate">{model.tag}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {!isDesktop && (
                        !isAllowed ? (
                          <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5 text-zinc-400" />
                            <span className="uppercase">{required}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono font-medium text-teal-400 uppercase tracking-wide">
                            {tierType}
                          </span>
                        )
                      )}
                      {isSelected && isAllowed && <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />}
                    </div>
                  </button>
                );
              };

              return (
                <div 
                  className="absolute top-full left-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-black/95 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-[100] p-2 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150"
                  data-lenis-prevent="true"
                >
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.06] mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <AgentIcon agent={selectedAgent} className="w-3.5 h-3.5" badgeClassName="w-4 h-4" />
                      <span>{selectedAgent.name} Models</span>
                    </div>
                    <span className="text-[9px] text-zinc-500 font-mono font-normal">Choose Model</span>
                  </div>

                  <div 
                    className="max-h-[min(380px,50vh)] overflow-y-auto px-1 custom-scrollbar overscroll-contain flex flex-col gap-1" 
                    data-lenis-prevent="true"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {isDesktop ? (
                      /* Desktop Mode: 100% Free BYOK model catalog with zero tier grouping or pricing */
                      <div className="flex flex-col gap-0.5">
                        {selectedAgent.models.map((m) => renderModelButton(m as AgentModel, 'free'))}
                      </div>
                    ) : (
                      /* Web Mode: Tiered sections with pricing and plan badges */
                      <>
                        {/* Ultimate Tier Models */}
                        {ultimateModels.length > 0 && (
                          <div className="flex flex-col gap-0.5 mb-1.5">
                            <div className="flex items-center justify-between px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-teal-400">
                              <span>Ultimate Tier</span>
                              <span className="text-[9px] font-mono text-zinc-500 font-normal">$50/mo</span>
                            </div>
                            {ultimateModels.map((m) => renderModelButton(m as AgentModel, 'ultimate'))}
                          </div>
                        )}

                        {/* Pro Tier Models */}
                        {proModels.length > 0 && (
                          <div className="flex flex-col gap-0.5 mb-1.5">
                            <div className="flex items-center justify-between px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-teal-400">
                              <span>Pro Tier</span>
                              <span className="text-[9px] font-mono text-zinc-500 font-normal">$20/mo</span>
                            </div>
                            {proModels.map((m) => renderModelButton(m as AgentModel, 'pro'))}
                          </div>
                        )}

                        {/* Free Tier Models */}
                        {freeModels.length > 0 && (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center justify-between px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-teal-400">
                              <span>Free Tier</span>
                              <span className="text-[9px] font-mono text-zinc-500 font-normal">$0/mo</span>
                            </div>
                            {freeModels.map((m) => renderModelButton(m as AgentModel, 'free'))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Main Textarea */}
        {files.length > 0 && (
          <div className="px-6 pt-4 flex flex-wrap gap-2">
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-white/[0.04] border border-white/10 px-2.5 py-1 rounded-lg text-xs text-zinc-300">
                <span className="truncate max-w-[150px] font-mono text-[11px]">{file.name}</span>
                <button aria-label="Remove file" type="button" onClick={() => removeFile(idx)} className="text-zinc-500 hover:text-white transition-colors text-sm leading-none">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          maxLength={4000}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholderText}
          data-lenis-prevent="true"
          className="w-full min-h-[110px] max-h-[500px] resize-none bg-transparent p-6 text-lg text-white placeholder:text-zinc-500 focus:outline-none leading-relaxed"
        />

        {/* Bottom Toolbar */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 bg-transparent">
          <div className="flex items-center gap-1.5">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              multiple 
              onChange={handleFileChange} 
            />
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors"
              title="Attach files (Max 5MB)"
              aria-label="Attach files"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          
          <StatefulButton
            type="button"
            onClick={handleActionSubmit}
            disabled={!value.trim() || isLoading}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-400/50 active:scale-[0.98]",
              !isDesktop && isLimitReached
                ? "bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 cursor-pointer"
                : "bg-copper-500 hover:bg-copper-600 text-white hover:ring-2 hover:ring-copper-400/50 shadow-md shadow-copper-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
            )}
            title={!isDesktop && isLimitReached ? `Limit reached. Resets in ${timeUntilSession}` : undefined}
          >
            {!isDesktop && isLimitReached ? 'Limit Reached' : 'Generate'}
          </StatefulButton>
        </div>

        {/* Token Quota Progress: WEBSITE ONLY (Desktop uses BYOK keys with zero limits) */}
        {!isDesktop && (
  
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 pb-4 pt-1 text-[11px] font-mono text-zinc-500 gap-4 sm:gap-8 bg-transparent">
          <div 
            className="flex items-center gap-3 flex-1 w-full cursor-pointer hover:text-zinc-400 transition-colors"
            onClick={() => isLimitReached && setShowQuotaModal(true)}
            title={`Session: ${sessionPrompts}/${sessionLimit} prompts used. Resets every 5 hours (in ${timeUntilSession}).`}
          >
            <span className="whitespace-nowrap">
              Session: {sessionPercent}% {isFreeTier && `(${sessionPrompts}/${sessionLimit})`}
            </span>
            <div className="h-1.5 flex-1 bg-black/70 rounded-full overflow-hidden border border-white/[0.08]">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  sessionPercent >= 100 ? "bg-red-500 shadow-sm shadow-red-500/50" : sessionPercent >= 80 ? "bg-copper-300" : "bg-copper-500/80"
                )} 
                style={{ width: `${Math.min(100, sessionPercent)}%` }} 
              />
            </div>
          </div>
          <div 
            className="flex items-center gap-3 flex-1 w-full justify-end cursor-pointer hover:text-zinc-400 transition-colors"
            onClick={() => isLimitReached && setShowQuotaModal(true)}
            title={`Weekly: ${weeklyPrompts}/${weeklyLimit} prompts used. Resets weekly (in ${timeUntilWeekly}).`}
          >
            <div className="h-1.5 flex-1 bg-black/70 rounded-full overflow-hidden border border-white/[0.08]">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  weeklyPercent >= 100 ? "bg-red-500 shadow-sm shadow-red-500/50" : weeklyPercent >= 80 ? "bg-copper-300" : "bg-copper-500/80"
                )} 
                style={{ width: `${Math.min(100, weeklyPercent)}%` }} 
              />
            </div>
            <span className="whitespace-nowrap text-right">
              Weekly: {weeklyPercent}% · resets in {timeUntilWeekly}
            </span>
          </div>
        </div>
        )}
      </div>

      <QuotaLimitModal
        isOpen={showQuotaModal}
        onClose={() => setShowQuotaModal(false)}
        sessionPrompts={sessionPrompts}
        sessionLimit={sessionLimit}
        weeklyPrompts={weeklyPrompts}
        weeklyLimit={weeklyLimit}
        timeUntilSession={timeUntilSession}
        timeUntilWeekly={timeUntilWeekly}
        isWeeklyLimitReached={isWeeklyLimitReached}
      />

      {!isDesktopApp() && (
        <UpgradeModal
          isOpen={upgradeModal.isOpen}
          onClose={() => setUpgradeModal({ isOpen: false })}
          featureName={upgradeModal.featureName}
          requiredTier={upgradeModal.requiredTier}
          reason={upgradeModal.reason}
        />
      )}

      <ApiKeyPromptModal
        isOpen={apiKeyModal.isOpen}
        onClose={() => setApiKeyModal({ isOpen: false })}
        modelId={apiKeyModal.modelId}
        modelName={apiKeyModal.modelName}
        agentId={apiKeyModal.agentId}
        onKeySaved={() => {
          if (apiKeyModal.agentId) setSelectedAgentId(apiKeyModal.agentId);
          if (apiKeyModal.modelId) setSelectedModelId(apiKeyModal.modelId);
        }}
      />
    </div>
  );
}

