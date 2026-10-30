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

export const AI_AGENTS = [
  {
    id: 'universal',
    name: 'Universal',
    description: 'Works well across any model',
    models: [{ id: 'auto', name: 'Auto-select best model' }]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (100% Free)',
    description: 'Zero-cost frontier and open models via OpenRouter',
    models: [
      { id: 'openrouter/free', name: 'Free Models Auto-Router ($0)' },
      { id: 'poolside/laguna-s-2.1:free', name: 'Poolside Laguna S 2.1 (Free)' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B' },
      { id: 'mistralai/mistral-large', name: 'Mistral Large' },
    ]
  },
  {
    id: 'huggingface',
    name: 'Open Models / HF',
    description: 'Open-weight foundation models ($0.00)',
    models: [
      { id: 'openrouter/free', name: 'Open Foundation Models Router' },
      { id: 'poolside/laguna-s-2.1:free', name: 'Laguna S 2.1 (Free)' },
      { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra (Free)' },
    ]
  },
  {
    id: 'nvidia',
    name: 'Nvidia (100% Free)',
    description: 'High-parameter frontier reasoning models ($0.00)',
    models: [
      { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra 550B (Free)' },
      { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', name: 'Nemotron 3 Nano Omni (Free Reasoning)' },
    ]
  },
  {
    id: 'gemini',
    name: 'Gemini (100% Free)',
    description: 'Multimodal Google AI Studio models ($0.00)',
    models: [
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (Free)' },
      { id: 'gemini-flash-lite-latest', name: 'Gemini Flash-Lite Latest (Free)' },
      { id: 'gemma-4-26b-a4b-it', name: 'Gemma 4 26B (Free)' },
    ]
  },
  {
    id: 'llama',
    name: 'Groq / LLaMA & OSS',
    description: 'Ultra-low latency open models via Groq LPU',
    models: [
      { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Groq LPU)' },
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B (Groq LPU)' },
      { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B (Groq LPU)' },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct' },
      { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B Instruct' },
    ]
  },
  {
    id: 'mistral',
    name: 'Mistral',
    description: 'Fast, lightweight, and efficient',
    models: [
      { id: 'mistral-large', name: 'Mistral Large' },
      { id: 'mixtral-8x22b', name: 'Mixtral 8x22B' }
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'Strong reasoning and coding',
    models: [
      { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2' },
      { id: 'deepseek-chat', name: 'DeepSeek Chat' }
    ]
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    description: 'Web search with cited answers',
    models: [
      { id: 'sonar-pro', name: 'Sonar Pro' },
      { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro' },
      { id: 'sonar', name: 'Sonar' },
      { id: 'sonar-huge', name: 'Sonar Huge' },
      { id: 'sonar-large', name: 'Sonar Large' }
    ]
  },
  {
    id: 'grok',
    name: 'Grok (xAI)',
    description: 'Real-time reasoning and frontier intelligence',
    models: [
      { id: 'grok-3', name: 'Grok 3' },
      { id: 'grok-2', name: 'Grok 2' },
      { id: 'grok-1.5', name: 'Grok-1.5' }
    ]
  },
  {
    id: 'cohere',
    name: 'Cohere',
    description: 'Retrieval and enterprise search',
    models: [
      { id: 'command-r-plus', name: 'Command R+' },
      { id: 'command-r', name: 'Command R' }
    ]
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    description: 'Versatile all-rounder by OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ]
  },
  {
    id: 'claude',
    name: 'Claude',
    description: 'Nuanced writing and reasoning by Anthropic',
    models: [
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku' }
    ]
  },
  {
    id: 'copilot',
    name: 'Copilot',
    description: 'Microsoft ecosystem integration',
    models: [{ id: 'copilot-pro', name: 'Copilot Pro' }]
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

export function RichInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  targetType,
  onTargetTypeChange,
}: RichInputProps) {
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

      if (isLimitReached) {
        setShowQuotaModal(true);
        return;
      }

      const allowed = recordPromptUsage(1);
      if (!allowed) {
        setShowQuotaModal(true);
        return;
      }

      onSubmit();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const validFiles = selectedFiles.filter(file => {
        if (file.size > MAX_FILE_SIZE) {
          alert(`File ${file.name} is too large. Max size is 5MB.`);
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
  const selectedAgent = AI_AGENTS.find(a => a.id === selectedAgentId) || AI_AGENTS[0];
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
                className="absolute top-full left-0 mt-2 w-84 max-w-[calc(100vw-2rem)] bg-black/95 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-[100] p-2 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150"
                data-lenis-prevent="true"
              >
                <div 
                  className="max-h-[min(380px,50vh)] overflow-y-auto custom-scrollbar overscroll-contain flex flex-col gap-1 p-1" 
                  data-lenis-prevent="true"
                  onWheel={(e) => e.stopPropagation()}
                >
                  {AI_AGENTS.map((agent) => {
                    const hasAccessibleModel = agent.models.some((m) => isModelAllowedForTier(m.id, profile?.plan));
                    const agentRequiredTier = agent.models.some((m) => getModelRequiredTier(m.id) === 'ultimate')
                      ? 'ultimate'
                      : 'pro';

                    return (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => {
                          if (!hasAccessibleModel) {
                            setUpgradeModal({
                              isOpen: true,
                              featureName: `${agent.name} Models`,
                              requiredTier: agentRequiredTier,
                              reason: `${agent.name} frontier models require an active ${agentRequiredTier.toUpperCase()} Plan. Upgrade your plan to get immediate access.`,
                            });
                            setActiveDropdown(null);
                            return;
                          }
                          const firstAllowed = agent.models.find((m) => isModelAllowedForTier(m.id, profile?.plan)) || agent.models[0];
                          if (isDesktopApp() && !isModelKeyConfigured(firstAllowed.id, agent.id)) {
                            setApiKeyModal({
                              isOpen: true,
                              modelId: firstAllowed.id,
                              modelName: firstAllowed.name,
                              agentId: agent.id,
                            });
                            setActiveDropdown(null);
                            return;
                          }
                          setSelectedAgentId(agent.id);
                          setSelectedModelId(firstAllowed.id);
                          setActiveDropdown(null);
                        }}
                        className={cn(
                          "w-full flex items-start justify-between gap-3 px-3 py-2.5 text-left rounded-xl transition-colors",
                          selectedAgentId === agent.id ? "bg-white/10" : "hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <AgentIcon agent={agent} className="w-5 h-5" badgeClassName="w-5 h-5 mt-0.5" />
                          <div className="min-w-0">
                            <div className={cn("text-xs sm:text-sm font-medium flex items-center gap-1.5", selectedAgentId === agent.id ? "text-white" : "text-zinc-300")}>
                              <span className="truncate">{agent.name}</span>
                              {!hasAccessibleModel && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-mono bg-copper-500/15 text-copper-300 border border-copper-500/30 shrink-0 uppercase">
                                  <Lock className="w-2.5 h-2.5 text-copper-400" />
                                  <span>{agentRequiredTier}</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-0.5 truncate">{agent.description}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
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
              <span className="text-[10px] text-zinc-500">▾</span>
            </button>

            {activeDropdown === 'model' && (
              <div 
                className="absolute top-full left-0 mt-2 w-84 max-w-[calc(100vw-2rem)] bg-black/95 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-[100] p-2 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150"
                data-lenis-prevent="true"
              >
                <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.06] mb-1 flex items-center gap-1.5">
                  <AgentIcon agent={selectedAgent} className="w-3.5 h-3.5" badgeClassName="w-4 h-4" />
                  <span>{selectedAgent.name} Models</span>
                </div>
                <div 
                  className="max-h-[min(340px,45vh)] overflow-y-auto px-1 custom-scrollbar overscroll-contain flex flex-col gap-0.5" 
                  data-lenis-prevent="true"
                  onWheel={(e) => e.stopPropagation()}
                >
                  {selectedAgent.models.map((model) => {
                    const isAllowed = isModelAllowedForTier(model.id, profile?.plan);
                    const required = getModelRequiredTier(model.id);

                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          if (!isAllowed) {
                            setUpgradeModal({
                              isOpen: true,
                              featureName: model.name,
                              requiredTier: required === 'ultimate' ? 'ultimate' : 'pro',
                              reason: `${model.name} is a high-capability model requiring an active ${required.toUpperCase()} Plan. Upgrade to unlock full access.`,
                            });
                            setActiveDropdown(null);
                            return;
                          }
                          if (isDesktopApp() && !isModelKeyConfigured(model.id, selectedAgentId)) {
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
                          "w-full flex items-center justify-between px-3 py-2 text-xs sm:text-sm text-left rounded-xl transition-colors font-mono",
                          selectedModelId === model.id ? "bg-white/10 text-white font-medium" : "text-zinc-300 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <AgentIcon agent={selectedAgent} model={model.id} className="w-3.5 h-3.5" badgeClassName="w-4 h-4" />
                          <span className="truncate">{model.name}</span>
                          {!isAllowed && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-copper-500/15 text-copper-300 border border-copper-500/30 shrink-0 uppercase ml-1">
                              <Lock className="w-2.5 h-2.5 text-copper-400" />
                              <span>{required}</span>
                            </span>
                          )}
                        </div>
                        {selectedModelId === model.id && isAllowed && <Check className="w-3.5 h-3.5 text-copper-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
              isLimitReached
                ? "bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 cursor-pointer"
                : "bg-[#2C9A8B] hover:bg-[#1F7A6E] text-white hover:ring-2 hover:ring-copper-400/50 shadow-md shadow-[#2C9A8B]/20 disabled:opacity-40 disabled:cursor-not-allowed"
            )}
            title={isLimitReached ? `Limit reached. Resets in ${timeUntilSession}` : undefined}
          >
            {isLimitReached ? 'Limit Reached' : 'Generate'}
          </StatefulButton>
        </div>

        {/* Token Quota Progress */}
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

      <UpgradeModal
        isOpen={upgradeModal.isOpen}
        onClose={() => setUpgradeModal({ isOpen: false })}
        featureName={upgradeModal.featureName}
        requiredTier={upgradeModal.requiredTier}
        reason={upgradeModal.reason}
      />

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

