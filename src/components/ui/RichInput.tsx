import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Sparkles, Paperclip, Mic, ChevronDown, Bot, Code, Edit3, Settings, Cpu } from 'lucide-react';
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
export const AI_MODELS = [
  { provider: 'Groq', models: [
      { id: 'llama3-8b-8192', name: 'Llama 3 8B' },
      { id: 'llama3-70b-8192', name: 'Llama 3 70B' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
      { id: 'gemma-7b-it', name: 'Gemma 7B' }
  ]},
  { provider: 'Gemini', models: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' }
  ]},
  { provider: 'Mistral', models: [
      { id: 'open-mistral-7b', name: 'Mistral 7B' },
      { id: 'open-mixtral-8x7b', name: 'Mixtral 8x7B' }
  ]},
  { provider: 'Nvidia', models: [
      { id: 'meta/llama3-70b-instruct', name: 'Llama 3 70B Instruct' },
      { id: 'mistralai/mixtral-8x22b-instruct-v0.1', name: 'Mixtral 8x22B' }
  ]}
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('llama3-8b-8192');

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

  return (
    <div className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-3xl transition-all focus-within:ring-4 focus-within:ring-copper-500/20 focus-within:border-copper-500/30 flex flex-col relative overflow-hidden group">
      {/* Subtle gradient overlay for extra glass texture */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/5 pointer-events-none z-0"></div>
      
      {/* Content wrapper to stay above background effects */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Top Toolbar */}
        <div className="flex items-center gap-2 p-3 border-b border-basalt-900/5 bg-white/20">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-basalt-700 hover:bg-basalt-900/5 transition-colors"
          >
            <selectedTarget.icon className="w-4 h-4 text-basalt-500" />
            {selectedTarget.label}
            <ChevronDown className="w-4 h-4 text-basalt-400" />
          </button>
          
          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-basalt-900/10 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
              {targetOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onTargetTypeChange(opt.id);
                    setIsDropdownOpen(false);
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
        
        {/* Model Selection Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-basalt-700 hover:bg-basalt-900/5 transition-colors"
          >
            <Cpu className="w-4 h-4 text-basalt-500" />
            {AI_MODELS.flatMap(p => p.models).find(m => m.id === selectedModelId)?.name || 'Select Model'}
            <ChevronDown className="w-4 h-4 text-basalt-400" />
          </button>
          
          {isModelDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-basalt-900/10 rounded-xl shadow-xl z-20 py-2 overflow-hidden">
              <div className="max-h-[300px] overflow-y-auto px-2">
                {AI_MODELS.map((provider) => (
                  <div key={provider.provider} className="mb-2 last:mb-0">
                    <div className="px-2 py-1 text-xs font-semibold text-basalt-400 uppercase tracking-wider">
                      {provider.provider}
                    </div>
                    {provider.models.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          setSelectedModelId(model.id);
                          setIsModelDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded-lg transition-colors",
                          selectedModelId === model.id ? "bg-basalt-900/5 text-basalt-900 font-medium" : "text-basalt-700 hover:bg-basalt-900/5 hover:text-basalt-900"
                        )}
                      >
                        {model.name}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-basalt-900/10"></div>
        
        <button type="button" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-basalt-700 hover:bg-basalt-900/5 transition-colors">
          <Settings className="w-4 h-4 text-basalt-500" />
          Advanced
        </button>
      </div>

      {/* Main Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholderText}
        className="w-full min-h-[250px] max-h-[500px] resize-none bg-transparent p-6 text-lg text-basalt-900 placeholder:text-basalt-400 focus:outline-none"
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
