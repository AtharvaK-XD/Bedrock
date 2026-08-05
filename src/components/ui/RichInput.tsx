import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Sparkles, Paperclip, Mic, ChevronDown, Bot, Code, Edit3, Settings, Cpu, Globe, BotMessageSquare, Feather, Network, Wind, Compass, Zap, Database } from 'lucide-react';
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
    id: 'chatgpt',
    name: 'ChatGPT',
    description: 'Versatile all-rounder for most tasks',
    icon: BotMessageSquare,
    iconUrl: 'https://www.google.com/s2/favicons?domain=openai.com&sz=128',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ]
  },
  {
    id: 'claude',
    name: 'Claude',
    description: 'Long documents and careful writing',
    icon: Feather,
    iconUrl: 'https://www.google.com/s2/favicons?domain=anthropic.com&sz=128',
    models: [
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-opus', name: 'Claude 3 Opus' },
      { id: 'claude-3-haiku', name: 'Claude 3 Haiku' }
    ]
  },
  {
    id: 'gemini',
    name: 'Gemini',
    description: 'Multimodal and tight Google integration',
    icon: Sparkles,
    iconUrl: 'https://www.google.com/s2/favicons?domain=gemini.google.com&sz=128',
    models: [
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
    ]
  },
  {
    id: 'llama',
    name: 'Llama',
    description: 'Open-weight and self-hosting friendly',
    icon: Network,
    iconUrl: 'https://www.google.com/s2/favicons?domain=meta.com&sz=128',
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
    iconUrl: 'https://www.google.com/s2/favicons?domain=mistral.ai&sz=128',
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
    iconUrl: 'https://www.google.com/s2/favicons?domain=deepseek.com&sz=128',
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
    iconUrl: 'https://www.google.com/s2/favicons?domain=perplexity.ai&sz=128',
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
    iconUrl: 'https://www.google.com/s2/favicons?domain=x.ai&sz=128',
    models: [
      { id: 'grok-1.5', name: 'Grok-1.5' }
    ]
  },
  {
    id: 'cohere',
    name: 'Cohere',
    description: 'Retrieval and enterprise search',
    icon: Database,
    iconUrl: 'https://www.google.com/s2/favicons?domain=cohere.com&sz=128',
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
    iconUrl: 'https://www.google.com/s2/favicons?domain=copilot.microsoft.com&sz=128',
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
  }, []);

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
      if (value.trim() && !isLoading) {
        onSubmit();
      }
    }
  };

  const selectedTarget = targetOptions.find(t => t.id === targetType) || targetOptions[0];
  const selectedAgent = AI_AGENTS.find(a => a.id === selectedAgentId) || AI_AGENTS[0];
  const selectedModel = selectedAgent.models.find(m => m.id === selectedModelId) || selectedAgent.models[0];

  return (
    <div ref={containerRef} className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-3xl transition-all focus-within:ring-4 focus-within:ring-copper-500/20 focus-within:border-copper-500/30 flex flex-col relative group">
      {/* Subtle gradient overlay for extra glass texture */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/5 pointer-events-none z-0 rounded-3xl"></div>
      
      {/* Content wrapper to stay above background effects */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Top Toolbar */}
        <div className="flex items-center gap-2 p-3 border-b border-basalt-900/5 bg-white/20">
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'target' ? null : 'target')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-basalt-700 hover:bg-basalt-900/5 transition-colors"
            >
              <selectedTarget.icon className="w-4 h-4 text-basalt-500" />
              {selectedTarget.label}
              <ChevronDown className="w-4 h-4 text-basalt-400" />
            </button>
            
            {activeDropdown === 'target' && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-basalt-900/10 rounded-xl shadow-xl z-50 py-1">
                {targetOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onTargetTypeChange(opt.id);
                      setActiveDropdown(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors",
                      targetType === opt.id ? "bg-basalt-900/5 text-basalt-900 font-medium" : "text-basalt-700 hover:bg-basalt-900/5 hover:text-basalt-900"
                    )}
                  >
                    <opt.icon className="w-4 h-4 text-basalt-500" />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="w-px h-4 bg-basalt-900/10"></div>
          
          {/* Agent Selection Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'agent' ? null : 'agent')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-basalt-700 hover:bg-basalt-900/5 transition-colors"
            >
              <AgentIcon agent={selectedAgent} className="w-4 h-4 text-basalt-500" />
              {selectedAgent.name}
              <ChevronDown className="w-4 h-4 text-basalt-400" />
            </button>
            
            {activeDropdown === 'agent' && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-basalt-900/10 rounded-xl shadow-xl z-50 py-2">
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
                        "w-full flex items-start gap-3 px-3 py-2.5 text-left rounded-lg transition-colors",
                        selectedAgentId === agent.id ? "bg-basalt-900/5" : "hover:bg-basalt-900/5"
                      )}
                    >
                      <AgentIcon agent={agent} className="w-5 h-5 mt-0.5 shrink-0" />
                      <div>
                        <div className={cn("text-sm font-medium", selectedAgentId === agent.id ? "text-basalt-900" : "text-basalt-800")}>{agent.name}</div>
                        <div className="text-xs text-basalt-500 mt-0.5">{agent.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-basalt-900/10"></div>
          
          {/* Model Selection Dropdown (Replacing Advanced) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveDropdown(activeDropdown === 'model' ? null : 'model')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-basalt-700 hover:bg-basalt-900/5 transition-colors"
            >
              <Settings className="w-4 h-4 text-basalt-500" />
              {selectedModel.name}
              <ChevronDown className="w-4 h-4 text-basalt-400" />
            </button>

            {activeDropdown === 'model' && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-basalt-900/10 rounded-xl shadow-xl z-50 py-2">
                <div className="px-3 py-2 text-xs font-semibold text-basalt-400 uppercase tracking-wider border-b border-basalt-900/5 mb-2">
                  {selectedAgent.name} Models
                </div>
                <div className="max-h-[300px] overflow-y-auto px-2 custom-scrollbar" data-lenis-prevent="true">
                  {selectedAgent.models.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        setSelectedModelId(model.id);
                        setActiveDropdown(null);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-2 text-sm text-left rounded-lg transition-colors",
                        selectedModelId === model.id ? "bg-basalt-900/5 text-basalt-900 font-medium" : "text-basalt-700 hover:bg-basalt-900/5 hover:text-basalt-900"
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
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholderText}
          data-lenis-prevent="true"
          className="w-full min-h-[100px] max-h-[500px] resize-none bg-transparent p-6 text-lg text-basalt-900 placeholder:text-basalt-400 focus:outline-none"
        />

        {/* Bottom Toolbar */}
        <div className="flex items-center justify-between p-4 border-t border-white/20 bg-white/30 rounded-b-3xl">
          <div className="flex items-center gap-1">
            <button type="button" className="p-2 text-basalt-500 hover:text-basalt-900 hover:bg-white rounded-lg transition-colors tooltip-trigger">
              <Mic className="w-5 h-5" />
            </button>
            <button type="button" className="p-2 text-basalt-500 hover:text-basalt-900 hover:bg-white rounded-lg transition-colors">
              <Paperclip className="w-5 h-5" />
            </button>
          </div>
          
          <button
            type="button"
            onClick={() => {
              if (value.trim() && !isLoading) onSubmit();
            }}
            disabled={!value.trim() || isLoading}
            className="flex items-center gap-2 px-5 py-2 bg-basalt-900 text-white rounded-xl font-medium transition-all hover:bg-basalt-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <Sparkles className="w-5 h-5 text-copper-400" />
            )}
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
