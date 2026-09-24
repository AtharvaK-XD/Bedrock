import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { AI_AGENTS, AgentIcon } from './RichInput';
import { usePromptQuota } from '../../lib/usePromptQuota';
import { QuotaLimitModal } from './QuotaLimitModal';

interface RefinementInputProps {
  onSubmit?: (text: string, model: string) => void;
  className?: string;
}

export function RefinementInput({ onSubmit, className }: RefinementInputProps) {
  const [input, setInput] = useState('');
  const [model, setModel] = useState('Gemini 2.5 Flash');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const defaultPlaceholders = [
    "What would you like to change or refine in this prompt?",
    "Add a constraint or output format...",
    "Make the tone more direct and concise...",
    "Rewrite this for a production coding agent..."
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

  const expanded = isExpanded || input.trim().length > 0 || files.length > 0;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((input.trim() || files.length > 0) && onSubmit) {
      if (isLimitReached) {
        setShowQuotaModal(true);
        return;
      }

      const allowed = recordPromptUsage(1);
      if (!allowed) {
        setShowQuotaModal(true);
        return;
      }

      onSubmit(input, model);
      setInput('');
      setFiles([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      onFocus={() => setIsExpanded(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsExpanded(false);
        }
      }}
      className={cn(
        "glass-card relative flex flex-col w-full mx-auto border border-white/[0.09] rounded-3xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.95)] transition-all duration-500 ease-[0.22,1,0.36,1] focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10",
        expanded ? "max-w-[700px] min-h-[140px]" : "max-w-[360px] min-h-[60px]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent z-20" />
      <div className="pointer-events-none absolute inset-0 glass-noise opacity-25 rounded-3xl z-0" />

      {/* Input area */}
      <div className={cn("relative z-10 flex flex-col w-full px-5 transition-all duration-500 flex-1", expanded ? "pt-5 justify-start" : "pt-0 justify-center")}>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-white/5 border border-white/10 px-2 py-1 rounded-md text-xs text-gray-300 font-mono">
                <span className="truncate max-w-[150px]">{file.name}</span>
                <button type="button" onClick={() => removeFile(idx)} className="text-gray-500 hover:text-white leading-none">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholderText}
          className={cn(
            "w-full bg-transparent text-white placeholder:text-gray-500 text-[15px] resize-none leading-relaxed transition-all duration-500 border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent p-0 m-0",
            expanded ? "min-h-[44px]" : "h-[22px] overflow-hidden"
          )}
          rows={expanded ? 2 : 1}
        />
      </div>

      {/* Bottom tools row */}
      <div className={cn(
        "flex items-center justify-between px-3 pb-3 mt-auto transition-all duration-500 ease-[0.22,1,0.36,1]",
        expanded ? "opacity-100 max-h-[50px] translate-y-0" : "opacity-0 max-h-0 translate-y-4 pointer-events-none"
      )}>
        {/* Left tools (Attach) */}
        <div className="flex items-center">
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
            className="text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-xl hover:bg-white/10 text-xs font-medium border border-white/5"
            title="Attach files (Max 5MB)"
          >
            Attach
          </button>
        </div>

        {/* Right tools */}
        <div className="flex items-center gap-2">
          {/* Model Selector */}
          <div className="relative group flex items-center" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-xl px-3 py-1.5 border border-white/5 whitespace-nowrap text-xs font-mono"
            >
              <AgentIcon model={model} className="w-3.5 h-3.5" badgeClassName="w-5 h-5" />
              <span className="text-white truncate max-w-[140px]">{model}</span>
              <span className="text-[10px] text-gray-400">▾</span>
            </button>

            {isModelDropdownOpen && (
              <div 
                className="absolute bottom-full right-0 mb-2 w-64 max-h-[300px] overflow-y-auto custom-scrollbar bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl z-50 py-2"
                data-lenis-prevent="true"
              >
                {AI_AGENTS.map((agent) => (
                  <div key={agent.id} className="mb-2 px-2">
                    <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-1 mb-1">
                      <AgentIcon agent={agent} className="w-3 h-3" badgeClassName="w-4 h-4" />
                      <span>{agent.name}</span>
                    </div>
                    {agent.models.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setModel(m.name);
                          setIsModelDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left rounded-lg transition-colors font-mono",
                          model === m.name ? "bg-copper-500/20 text-copper-300 font-medium" : "text-gray-300 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <AgentIcon agent={agent} model={m.id} className="w-3 h-3" badgeClassName="w-4 h-4" />
                        <span className="truncate">{m.name}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button 
            type="submit"
            disabled={!input.trim() && files.length === 0}
            className={cn(
              "px-4 py-1.5 rounded-xl transition-all text-xs font-semibold uppercase tracking-wider",
              isLimitReached
                ? "bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 cursor-pointer"
                : "bg-copper-500 text-white hover:bg-copper-600 disabled:opacity-40 disabled:bg-white/10 disabled:text-gray-500"
            )}
            title={isLimitReached ? `Limit reached. Resets in ${timeUntilSession}` : undefined}
          >
            {isLimitReached ? 'Limit' : 'Refine'}
          </button>
        </div>
      </div>
      
      {/* Token Quota Progress */}
      <div className={cn(
        "flex flex-col sm:flex-row items-center justify-between px-5 pb-3 text-[10px] font-mono text-gray-500 gap-4 sm:gap-6 transition-all duration-500 ease-[0.22,1,0.36,1]",
        expanded ? "opacity-100 max-h-[30px] translate-y-0" : "opacity-0 max-h-0 translate-y-4 pointer-events-none"
      )}>
        <div 
          className="flex items-center gap-2 flex-1 w-full cursor-pointer hover:text-gray-400 transition-colors"
          onClick={() => isLimitReached && setShowQuotaModal(true)}
          title={`Session: ${sessionPrompts}/${sessionLimit} prompts used. Resets every 5 hours (in ${timeUntilSession}).`}
        >
          <span className="whitespace-nowrap">
            Session: {sessionPercent}% {isFreeTier && `(${sessionPrompts}/${sessionLimit})`}
          </span>
          <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                sessionPercent >= 100 ? "bg-red-500 shadow-sm shadow-red-500/50" : sessionPercent >= 80 ? "bg-amber-500" : "bg-blue-500/80"
              )} 
              style={{ width: `${Math.min(100, sessionPercent)}%` }} 
            />
          </div>
        </div>
        <div 
          className="flex items-center gap-2 flex-1 w-full justify-end cursor-pointer hover:text-gray-400 transition-colors"
          onClick={() => isLimitReached && setShowQuotaModal(true)}
          title={`Weekly: ${weeklyPrompts}/${weeklyLimit} prompts used. Resets weekly (in ${timeUntilWeekly}).`}
        >
          <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                weeklyPercent >= 100 ? "bg-red-500 shadow-sm shadow-red-500/50" : weeklyPercent >= 80 ? "bg-amber-500" : "bg-blue-500/80"
              )} 
              style={{ width: `${Math.min(100, weeklyPercent)}%` }} 
            />
          </div>
          <span className="whitespace-nowrap text-right">
            Weekly: {weeklyPercent}% · resets in {timeUntilWeekly}
          </span>
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
    </form>
  );
}

