import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import type { IdeaPayload } from '../../lib/mockApi';

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
    name: 'OpenRouter Free',
    description: '100% Free Open-Source Models',
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
    models: [
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct:free', name: 'Nemotron 70B (Free)' },
      { id: 'nvidia/nemotron-4-340b-instruct', name: 'Nemotron-4 340B' }
    ]
  },
  {
    id: 'gemini',
    name: 'Gemini',
    description: 'Multimodal and tight Google integration',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }
    ]
  },
  {
    id: 'llama',
    name: 'Llama',
    description: 'Open-weight and self-hosting friendly',
    models: [
      { id: 'llama-3-70b', name: 'Llama 3 70B' },
      { id: 'llama-3-8b', name: 'Llama 3 8B' }
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
      { id: 'sonar-huge', name: 'Sonar Huge' },
      { id: 'sonar-large', name: 'Sonar Large' }
    ]
  },
  {
    id: 'grok',
    name: 'Grok',
    description: 'Real-time, X-aware responses',
    models: [
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
    id: 'copilot',
    name: 'Copilot',
    description: 'Microsoft ecosystem integration',
    models: [{ id: 'copilot-pro', name: 'Copilot Pro' }]
  }
];

export const AgentIcon = ({ agent, className }: { agent: any; className?: string }) => {
  const short = (agent?.name || '').slice(0, 3).toUpperCase();
  return (
    <span className={cn("font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/80 border border-white/10 shrink-0 select-none", className)}>
      {short}
    </span>
  );
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
    const loadTokens = () => {
      const now = new Date();
      
      const nextSessionReset = new Date(now);
      const currentHour = now.getHours();
      const nextResetHour = Math.floor(currentHour / 5) * 5 + 5;
      nextSessionReset.setHours(nextResetHour, 0, 0, 0);
      setSessionResetTime(nextSessionReset);

      const nextWeeklyReset = new Date(now);
      nextWeeklyReset.setDate(now.getDate() + ((7 - now.getDay()) % 7));
      if (now.getDay() === 0 && now.getHours() > 0) {
        nextWeeklyReset.setDate(nextWeeklyReset.getDate() + 7);
      }
      nextWeeklyReset.setHours(0, 0, 0, 0);
      setWeeklyResetTime(nextWeeklyReset);

      const lastSessionResetStr = localStorage.getItem('lastSessionReset');
      const lastWeeklyResetStr = localStorage.getItem('lastWeeklyReset');
      
      let currentSessionTokens = parseInt(localStorage.getItem('sessionTokens') || '0', 10);
      let currentWeeklyTokens = parseInt(localStorage.getItem('weeklyTokens') || '0', 10);

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
    const interval = setInterval(loadTokens, 60000);
    return () => clearInterval(interval);
  }, []);

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
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [weeklyResetTime]);

  const handleActionSubmit = () => {
    if (value.trim() && !isLoading) {
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
    "Describe the prompt, agent persona, or pipeline you want to construct...",
    "Help me review a tricky pull request in a legacy codebase...",
    "Write a landing page headline that converts...",
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
      className={cn(
        "glass-card relative rounded-3xl transition-all duration-300 border border-white/[0.09] focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 flex flex-col group shadow-[0_24px_60px_-12px_rgba(0,0,0,0.95)]",
        activeDropdown ? "z-50" : "z-0"
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent z-20 rounded-t-3xl" />
      <div className="pointer-events-none absolute inset-0 glass-noise opacity-25 rounded-3xl z-0" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.035] via-transparent to-black/20 rounded-3xl z-0" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Top Toolbar */}
        <div className="flex flex-wrap items-center gap-2 p-3 sm:p-3.5 border-b border-white/[0.06] bg-white/[0.015] rounded-t-3xl">
          {/* Target Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'target' ? null : 'target')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-zinc-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200"
            >
              <span className="font-mono text-[10px] text-zinc-400 font-semibold">{selectedTarget.tag}</span>
              <span>{selectedTarget.label}</span>
              <span className="text-[10px] text-zinc-500">▾</span>
            </button>
            
            {activeDropdown === 'target' && (
              <div className="absolute top-full left-0 mt-2 w-52 glass-subcard border border-white/10 rounded-2xl shadow-2xl z-[100] p-1.5 backdrop-blur-2xl">
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
            )}
          </div>
          
          <div className="w-px h-4 bg-white/10"></div>
          
          {/* Agent Selection Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'agent' ? null : 'agent')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-zinc-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200"
            >
              <span className="text-zinc-500 text-xs">Provider:</span>
              <span>{selectedAgent.name}</span>
              <span className="text-[10px] text-zinc-500">▾</span>
            </button>
            
            {activeDropdown === 'agent' && (
              <div className="absolute top-full left-0 mt-2 w-80 glass-subcard border border-white/10 rounded-2xl shadow-2xl z-[100] p-2 backdrop-blur-2xl">
                <div className="max-h-[380px] overflow-y-auto custom-scrollbar flex flex-col gap-1 p-1" data-lenis-prevent="true">
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
                      <AgentIcon agent={agent} className="mt-0.5" />
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-zinc-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200"
            >
              <span className="text-zinc-500 text-xs">Model:</span>
              <span className="font-mono text-xs">{selectedModel.name}</span>
              <span className="text-[10px] text-zinc-500">▾</span>
            </button>

            {activeDropdown === 'model' && (
              <div className="absolute top-full left-0 mt-2 w-64 glass-subcard border border-white/10 rounded-2xl shadow-2xl z-[100] p-2 backdrop-blur-2xl">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-white/[0.06] mb-1">
                  {selectedAgent.name} Models
                </div>
                <div className="max-h-[340px] overflow-y-auto px-1 custom-scrollbar" data-lenis-prevent="true">
                  {selectedAgent.models.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        setSelectedModelId(model.id);
                        setActiveDropdown(null);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-xs sm:text-sm text-left rounded-xl transition-colors font-mono",
                        selectedModelId === model.id ? "bg-white/10 text-white font-medium" : "text-zinc-300 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <span>{model.name}</span>
                      {selectedModelId === model.id && <span className="w-1.5 h-1.5 rounded-full bg-copper-400" />}
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
              <div key={idx} className="flex items-center gap-2 bg-white/[0.04] border border-white/10 px-2.5 py-1 rounded-lg text-xs text-zinc-300">
                <span className="truncate max-w-[150px] font-mono text-[11px]">{file.name}</span>
                <button type="button" onClick={() => removeFile(idx)} className="text-zinc-500 hover:text-white transition-colors text-sm leading-none">
                  ×
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
          <div className="flex items-center gap-2">
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
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-xl border border-white/5 hover:border-white/10 transition-colors font-medium"
            >
              Attach File
            </button>
            <button 
              type="button" 
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-xl border border-white/5 hover:border-white/10 transition-colors font-medium"
            >
              Voice Dictate
            </button>
          </div>
          
          <button
            type="button"
            onClick={handleActionSubmit}
            disabled={!value.trim() || isLoading}
            className="flex items-center gap-2 px-6 py-2.5 bg-white text-zinc-950 hover:bg-zinc-100 rounded-xl text-sm font-semibold transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {isLoading && (
              <span className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-zinc-950 rounded-full animate-spin inline-block"></span>
            )}
            Generate
          </button>
        </div>

        {/* Token Quota Progress */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 pb-4 pt-2 text-[11px] font-mono text-zinc-500 gap-4 sm:gap-8 border-t border-white/[0.03] bg-black/20">
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
