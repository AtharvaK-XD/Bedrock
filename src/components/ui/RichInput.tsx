import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Sparkles, Paperclip, Mic, ChevronDown, Bot, Code, Edit3, Settings, Globe, BotMessageSquare, Network, Wind, Compass, Zap, Database, X } from 'lucide-react';
import type { IdeaPayload } from '../../lib/mockApi';

interface RichInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  targetType: IdeaPayload['targetType'];
  onTargetTypeChange: (type: IdeaPayload['targetType']) => void;
}

const targetOptions: { id: IdeaPayload['targetType']; label: string; icon: any }[] = [
  { id: 'coding_agent', label: 'Coding Agent', icon: Code },
  { id: 'freelancer_brief', label: 'Freelancer', icon: Bot },
  { id: 'hackathon_pitch', label: 'Hackathon', icon: Sparkles },
  { id: 'no_code', label: 'No-Code', icon: Edit3 },
];

export const AI_AGENTS = [
  {
    id: 'universal',
    name: 'Universal',
    description: 'Works well across any model',
    icon: Globe,
    models: [{ id: 'auto', name: 'Auto-select best model' }]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter Free',
    description: '100% Free Open-Source Models',
    icon: Globe,
    iconUrl: 'https://icon.horse/icon/openrouter.ai',
    models: [
      { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (Free)' },
      { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (Free)' },
      { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Free)' },
      { id: 'microsoft/phi-3-mini-128k-instruct:free', name: 'Phi-3 Mini (Free)' },
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', name: 'Nvidia Nemotron 70B (Free)' }
    ]
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    description: 'Serverless Inference API (Free)',
    icon: Globe,
    iconUrl: 'https://icon.horse/icon/huggingface.co',
    models: [
      { id: 'hf/mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B v0.3' },
      { id: 'hf/Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B' },
      { id: 'hf/meta-llama/Meta-Llama-3-8B-Instruct', name: 'Llama 3 8B' },
      { id: 'hf/HuggingFaceH4/zephyr-7b-beta', name: 'Zephyr 7B Beta' }
    ]
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    description: 'Versatile all-rounder for most tasks',
    icon: BotMessageSquare,
    iconUrl: 'https://icon.horse/icon/openai.com',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ]
  },
  {
    id: 'nvidia',
    name: 'Nvidia',
    description: 'High-performance reasoning and instruction following',
    icon: Network,
    iconUrl: 'https://icon.horse/icon/nvidia.com',
    models: [
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', name: 'Nemotron 70B (Free)' },
      { id: 'nvidia/nemotron-4-340b-instruct', name: 'Nemotron-4 340B' }
    ]
  },
  {
    id: 'gemini',
    name: 'Gemini',
    description: 'Multimodal and tight Google integration',
    icon: Sparkles,
    iconUrl: 'https://icon.horse/icon/gemini.google.com',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }
    ]
  },
  {
    id: 'llama',
    name: 'Llama',
    description: 'Open-weight and self-hosting friendly',
    icon: Network,
    iconUrl: 'https://icon.horse/icon/meta.com',
    models: [
      { id: 'llama-3-70b', name: 'Llama 3 70B' },
      { id: 'llama-3-8b', name: 'Llama 3 8B' }
    ]
  },
  {
    id: 'mistral',
    name: 'Mistral',
    description: 'Fast, lightweight, and efficient',
    icon: Wind,
    iconUrl: 'https://icon.horse/icon/mistral.ai',
    models: [
      { id: 'mistral-large', name: 'Mistral Large' },
      { id: 'mixtral-8x22b', name: 'Mixtral 8x22B' }
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'Strong reasoning and coding',
    icon: Code,
    iconUrl: 'https://icon.horse/icon/deepseek.com',
    models: [
      { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2' },
      { id: 'deepseek-chat', name: 'DeepSeek Chat' }
    ]
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    description: 'Web search with cited answers',
    icon: Compass,
    iconUrl: 'https://icon.horse/icon/perplexity.ai',
    models: [
      { id: 'sonar-huge', name: 'Sonar Huge' },
      { id: 'sonar-large', name: 'Sonar Large' }
    ]
  },
  {
    id: 'grok',
    name: 'Grok',
    description: 'Real-time, X-aware responses',
    icon: Zap,
    iconUrl: 'https://icon.horse/icon/x.ai',
    models: [
      { id: 'grok-1.5', name: 'Grok-1.5' }
    ]
  },
  {
    id: 'cohere',
    name: 'Cohere',
    description: 'Retrieval and enterprise search',
    icon: Database,
    iconUrl: 'https://icon.horse/icon/cohere.com',
    models: [
      { id: 'command-r-plus', name: 'Command R+' },
      { id: 'command-r', name: 'Command R' }
    ]
  },
  {
    id: 'copilot',
    name: 'Copilot',
    description: 'Microsoft ecosystem integration',
    icon: Sparkles,
    iconUrl: 'https://icon.horse/icon/copilot.microsoft.com',
    models: [{ id: 'copilot-pro', name: 'Copilot Pro' }]
  }
];

export const AgentIcon = ({ agent, className }: { agent: any, className?: string }) => {
  const [error, setError] = useState(false);
  
  if (agent.iconUrl && !error) {
    return (
      <img 
        src={agent.iconUrl} 
        alt={agent.name} 
        className={cn("object-contain rounded-[4px] shrink-0", className)}
        onError={() => setError(true)}
      />
    );
  }
  
  const Icon = agent.icon;
  return <Icon className={cn("shrink-0", className)} />;
};

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

  // Token Tracking State
  const SESSION_LIMIT = 50000;
  const WEEKLY_LIMIT = 200000;
  const [sessionTokens, setSessionTokens] = useState(0);
  const [weeklyTokens, setWeeklyTokens] = useState(0);
  const [, setSessionResetTime] = useState<Date | null>(null);
  const [weeklyResetTime, setWeeklyResetTime] = useState<Date | null>(null);
  const [timeUntilWeekly, setTimeUntilWeekly] = useState("");

  useEffect(() => {
    // Load from local storage and handle resets
    const loadTokens = () => {
      const now = new Date();
      
      // Calculate next 5-hour reset
      const nextSessionReset = new Date(now);
      const currentHour = now.getHours();
      const nextResetHour = Math.floor(currentHour / 5) * 5 + 5;
      nextSessionReset.setHours(nextResetHour, 0, 0, 0);
      setSessionResetTime(nextSessionReset);

      // Calculate next weekly reset (Sunday midnight)
      const nextWeeklyReset = new Date(now);
      nextWeeklyReset.setDate(now.getDate() + ((7 - now.getDay()) % 7));
      if (now.getDay() === 0 && now.getHours() > 0) {
        nextWeeklyReset.setDate(nextWeeklyReset.getDate() + 7);
      }
      nextWeeklyReset.setHours(0, 0, 0, 0);
      setWeeklyResetTime(nextWeeklyReset);

      // Check if we need to reset
      const lastSessionResetStr = localStorage.getItem('lastSessionReset');
      const lastWeeklyResetStr = localStorage.getItem('lastWeeklyReset');
      
      let currentSessionTokens = parseInt(localStorage.getItem('sessionTokens') || '0', 10);
      let currentWeeklyTokens = parseInt(localStorage.getItem('weeklyTokens') || '0', 10);

      // If we passed the reset time, reset tokens
      if (lastSessionResetStr) {
        const lastSessionReset = new Date(lastSessionResetStr);
        if (now > lastSessionReset) {
          currentSessionTokens = 0;
          localStorage.setItem('lastSessionReset', nextSessionReset.toISOString());
        }
      } else {
        localStorage.setItem('lastSessionReset', nextSessionReset.toISOString());
      }

      if (lastWeeklyResetStr) {
        const lastWeeklyReset = new Date(lastWeeklyResetStr);
        if (now > lastWeeklyReset) {
          currentWeeklyTokens = 0;
          localStorage.setItem('lastWeeklyReset', nextWeeklyReset.toISOString());
        }
      } else {
        localStorage.setItem('lastWeeklyReset', nextWeeklyReset.toISOString());
      }

      setSessionTokens(currentSessionTokens);
      setWeeklyTokens(currentWeeklyTokens);
      localStorage.setItem('sessionTokens', currentSessionTokens.toString());
      localStorage.setItem('weeklyTokens', currentWeeklyTokens.toString());
    };

    loadTokens();
    const interval = setInterval(loadTokens, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Update countdown string
  useEffect(() => {
    if (!weeklyResetTime) return;
    
    const updateCountdown = () => {
      const now = new Date();
      const diffMs = weeklyResetTime.getTime() - now.getTime();
      
      if (diffMs <= 0) {
        setTimeUntilWeekly("0h 0m");
        return;
      }
      
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setTimeUntilWeekly(`${hours}h ${minutes}m`);
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [weeklyResetTime]);

  const handleActionSubmit = () => {
    if (value.trim() && !isLoading) {
      // Simulate token usage based on length (1 char ~ 0.25 tokens)
      const usedTokens = Math.max(1, Math.floor(value.length * 0.25));
      const newSessionTokens = Math.min(sessionTokens + usedTokens, SESSION_LIMIT);
      const newWeeklyTokens = Math.min(weeklyTokens + usedTokens, WEEKLY_LIMIT);
      
      setSessionTokens(newSessionTokens);
      setWeeklyTokens(newWeeklyTokens);
      localStorage.setItem('sessionTokens', newSessionTokens.toString());
      localStorage.setItem('weeklyTokens', newWeeklyTokens.toString());
      
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const defaultPlaceholders = [
    "Help me review a tricky pull request in a legacy codebase...",
    "Write a landing page headline that converts...",
    "Explain quantum computing to a 5-year-old...",
    "Create a detailed brief for a UX designer..."
  ];

  const [placeholderText, setPlaceholderText] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    if (isTyping) {
      if (placeholderText.length < defaultPlaceholders[placeholderIndex].length) {
        timeout = setTimeout(() => {
          setPlaceholderText(defaultPlaceholders[placeholderIndex].slice(0, placeholderText.length + 1));
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
        setPlaceholderIndex((prev) => (prev + 1) % defaultPlaceholders.length);
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
      className="glass-card relative rounded-3xl transition-all duration-300 border border-white/[0.09] focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 flex flex-col group overflow-hidden shadow-[0_24px_60px_-12px_rgba(0,0,0,0.95)]"
    >
      {/* Specular top rim highlight line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent z-20" />

      {/* Subtle micro noise grain for frosted glass tactile texture */}
      <div className="pointer-events-none absolute inset-0 glass-noise opacity-25 rounded-3xl z-0" />

      {/* Gentle top specular sheen gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.035] via-transparent to-black/20 rounded-3xl z-0" />

      {/* Content wrapper to stay above background effects */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Top Toolbar */}
        <div className="flex items-center gap-2 p-3 sm:p-3.5 border-b border-white/[0.06] bg-white/[0.015]">
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'target' ? null : 'target')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-zinc-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
            >
              <selectedTarget.icon className="w-4 h-4 text-zinc-400" />
              {selectedTarget.label}
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
            </button>
            
            {activeDropdown === 'target' && (
              <div className="absolute top-full left-0 mt-1.5 w-52 glass-subcard border border-white/10 rounded-2xl shadow-2xl z-50 p-1.5 backdrop-blur-2xl">
                {targetOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onTargetTypeChange(opt.id);
                      setActiveDropdown(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-xs sm:text-sm text-left rounded-xl transition-colors",
                      targetType === opt.id ? "bg-white/10 text-white font-medium" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <opt.icon className="w-4 h-4 text-zinc-400" />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="w-px h-4 bg-white/10"></div>
          
          {/* Agent Selection Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'agent' ? null : 'agent')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-zinc-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
            >
              <AgentIcon agent={selectedAgent} className="w-4 h-4 text-zinc-400" />
              {selectedAgent.name}
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
            </button>
            
            {activeDropdown === 'agent' && (
              <div className="absolute top-full left-0 mt-1.5 w-76 sm:w-80 glass-subcard border border-white/10 rounded-2xl shadow-2xl z-50 p-2 backdrop-blur-2xl">
                <div className="max-h-[350px] overflow-y-auto custom-scrollbar flex flex-col gap-1 p-1" data-lenis-prevent="true">
                  {AI_AGENTS.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        setSelectedModelId(agent.models[0].id);
                        setActiveDropdown(null);
                      }}
                      className={cn(
                        "w-full flex items-start gap-3 px-3 py-2.5 text-left rounded-xl transition-colors",
                        selectedAgentId === agent.id ? "bg-white/10" : "hover:bg-white/5"
                      )}
                    >
                      <AgentIcon agent={agent} className="w-5 h-5 mt-0.5 shrink-0" />
                      <div>
                        <div className={cn("text-xs sm:text-sm font-medium", selectedAgentId === agent.id ? "text-white" : "text-zinc-300")}>{agent.name}</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">{agent.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-white/10"></div>
          
          {/* Model Selection Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'model' ? null : 'model')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-zinc-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
            >
              <Settings className="w-4 h-4 text-zinc-400" />
              {selectedModel.name}
              <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
            </button>

            {activeDropdown === 'model' && (
              <div className="absolute top-full left-0 mt-1.5 w-60 glass-subcard border border-white/10 rounded-2xl shadow-2xl z-50 p-2 backdrop-blur-2xl">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.06] mb-1">
                  {selectedAgent.name} Models
                </div>
                <div className="max-h-[300px] overflow-y-auto px-1 custom-scrollbar" data-lenis-prevent="true">
                  {selectedAgent.models.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        setSelectedModelId(model.id);
                        setActiveDropdown(null);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-xs sm:text-sm text-left rounded-xl transition-colors",
                        selectedModelId === model.id ? "bg-white/10 text-white font-medium" : "text-zinc-300 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {model.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Textarea */}
        {files.length > 0 && (
          <div className="px-6 pt-4 flex flex-wrap gap-2">
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 px-2.5 py-1 rounded-lg text-xs text-zinc-300">
                <span className="truncate max-w-[150px]">{file.name}</span>
                <button type="button" onClick={() => removeFile(idx)} className="text-zinc-500 hover:text-white transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholderText}
          data-lenis-prevent="true"
          className="w-full min-h-[110px] max-h-[500px] resize-none bg-transparent p-6 text-lg text-white placeholder:text-zinc-500 focus:outline-none leading-relaxed"
        />

        {/* Bottom Toolbar */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-t border-white/[0.06] bg-white/[0.015]">
          <div className="flex items-center gap-1">
            <button type="button" className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors tooltip-trigger">
              <Mic className="w-5 h-5" />
            </button>
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
              className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors tooltip-trigger"
              title="Attach files (Max 5MB)"
            >
              <Paperclip className="w-5 h-5" />
            </button>
          </div>
          
          <button
            type="button"
            onClick={handleActionSubmit}
            disabled={!value.trim() || isLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-zinc-950 hover:bg-zinc-100 rounded-xl font-medium transition-all shadow-[0_2px_12px_rgba(255,255,255,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-950 rounded-full animate-spin"></div>
            ) : (
              <Sparkles className="w-4 h-4 text-emerald-600" />
            )}
            Generate
          </button>
        </div>

        {/* Token Quota Progress */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 pb-4 pt-2 text-[11px] text-zinc-500 gap-4 sm:gap-8 border-t border-white/[0.03] bg-black/20">
          <div className="flex items-center gap-3 flex-1 w-full">
            <span className="whitespace-nowrap w-20">Session: {Math.round((sessionTokens / SESSION_LIMIT) * 100)}%</span>
            <div className="h-1.5 flex-1 bg-white/[0.05] rounded-full overflow-hidden border border-white/[0.05]">
              <div 
                className="h-full bg-blue-500/80 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, (sessionTokens / SESSION_LIMIT) * 100)}%` }} 
              />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-1 w-full justify-end">
            <div className="h-1.5 flex-1 bg-white/[0.05] rounded-full overflow-hidden border border-white/[0.05]">
              <div 
                className="h-full bg-blue-500/80 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, (weeklyTokens / WEEKLY_LIMIT) * 100)}%` }} 
              />
            </div>
            <span className="whitespace-nowrap text-right">
              Weekly: {Math.round((weeklyTokens / WEEKLY_LIMIT) * 100)}% · resets in {timeUntilWeekly}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
