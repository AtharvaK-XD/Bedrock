import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AI_AGENTS, AgentIcon } from './RichInput';
import { Button as StatefulButton } from './stateful-button';
import { usePromptQuota } from '../../lib/usePromptQuota';
import { QuotaLimitModal } from './QuotaLimitModal';
import { playUiAudio } from '../../lib/appSettings';

interface RefinementInputProps {
  onSubmit?: (text: string, model: string) => void;
  className?: string;
}

const DEFAULT_PLACEHOLDERS = [
  "What would you like to change or refine in this prompt?",
  "Add a constraint or output format...",
  "Make the tone more direct and concise...",
  "Rewrite this for a production coding agent..."
];

export function RefinementInput({ onSubmit, className }: RefinementInputProps) {
  const [input, setInput] = useState('');
  const [model, setModel] = useState('Gemini 2.5 Flash');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Click outside detection for dropdown and form collapse
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsModelDropdownOpen(false);
      }
      if (formRef.current && !formRef.current.contains(target)) {
        if (!input.trim() && files.length === 0) {
          setIsExpanded(false);
          setIsModelDropdownOpen(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [input, files.length]);

  const [placeholderText, setPlaceholderText] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    if (isTyping) {
      if (placeholderText.length < DEFAULT_PLACEHOLDERS[placeholderIndex].length) {
        timeout = setTimeout(() => {
          setPlaceholderText(DEFAULT_PLACEHOLDERS[placeholderIndex].slice(0, placeholderText.length + 1));
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
        setPlaceholderIndex((prev) => (prev + 1) % DEFAULT_PLACEHOLDERS.length);
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
    <motion.form 
      ref={formRef}
      layout
      onSubmit={handleSubmit}
      onClick={() => {
        if (!isExpanded) {
          setIsExpanded(true);
          playUiAudio('click');
        }
        textareaRef.current?.focus();
      }}
      initial={false}
      animate={{
        maxWidth: expanded ? 720 : 380,
        minHeight: expanded ? 144 : 58,
      }}
      transition={{
        type: "spring",
        stiffness: 280,
        damping: 26,
        mass: 0.8,
      }}
      className={cn(
        "glass-card relative flex flex-col w-full mx-auto border border-white/[0.09] rounded-3xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.95)] focus-within:border-white/20 focus-within:ring-1 focus-within:ring-white/10 cursor-pointer overflow-hidden transition-colors duration-300",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent z-20" />
      <div className="pointer-events-none absolute inset-0 glass-noise opacity-25 rounded-3xl z-0" />

      {/* Input area */}
      <div className={cn(
        "relative z-10 flex flex-col w-full px-5 transition-all duration-300 flex-1", 
        expanded ? "pt-4 justify-start" : "pt-0 justify-center"
      )}>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-white/5 border border-white/10 px-2 py-1 rounded-md text-xs text-gray-300 font-mono">
                <span className="truncate max-w-[150px]">{file.name}</span>
                <button 
                  type="button" 
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }} 
                  className="text-gray-500 hover:text-white leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (!isExpanded) {
              setIsExpanded(true);
            }
          }}
          placeholder={placeholderText}
          className={cn(
            "w-full bg-transparent text-white placeholder:text-gray-500 text-[15px] resize-none leading-relaxed border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent p-0 m-0 transition-all duration-300",
            expanded ? "min-h-[46px]" : "h-[22px] overflow-hidden"
          )}
          rows={expanded ? 2 : 1}
        />
      </div>

      {/* Animated Bottom Toolbar & Progress */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 8, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full overflow-hidden flex flex-col"
          >
            {/* Bottom tools row */}
            <div className="flex items-center justify-between px-3 pb-3 mt-auto">
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
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="text-gray-400 hover:text-white transition-all p-2 rounded-xl hover:bg-white/10 border border-white/5 flex items-center justify-center active:scale-95 cursor-pointer"
                  title="Add files (Max 5MB)"
                  aria-label="Add files"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Right tools */}
              <div className="flex items-center gap-2">
                {/* Model Selector */}
                <div className="relative group flex items-center" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsModelDropdownOpen(!isModelDropdownOpen);
                    }}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-xl px-3 py-1.5 border border-white/5 whitespace-nowrap text-xs font-mono cursor-pointer"
                  >
                    <AgentIcon model={model} className="w-4 h-4" badgeClassName="w-4 h-4" />
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
                            <AgentIcon agent={agent} className="w-3.5 h-3.5" badgeClassName="w-4 h-4" />
                            <span>{agent.name}</span>
                          </div>
                          {agent.models.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setModel(m.name);
                                setIsModelDropdownOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left rounded-lg transition-colors font-mono cursor-pointer",
                                model === m.name ? "bg-copper-500/20 text-copper-300 font-medium" : "text-gray-300 hover:bg-white/10 hover:text-white"
                              )}
                            >
                              <AgentIcon agent={agent} model={m.id} className="w-3.5 h-3.5" badgeClassName="w-4 h-4" />
                              <span className="truncate">{m.name}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <StatefulButton 
                  type="submit"
                  disabled={!input.trim() && files.length === 0}
                  className={cn(
                    "min-w-[90px] px-4 py-1.5 rounded-xl transition-all text-xs font-semibold uppercase tracking-wider",
                    isLimitReached
                      ? "bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 cursor-pointer"
                      : "bg-[#2C9A8B] hover:bg-[#1F7A6E] text-white shadow-sm shadow-[#2C9A8B]/20 cursor-pointer"
                  )}
                  title={isLimitReached ? `Limit reached. Resets in ${timeUntilSession}` : undefined}
                >
                  {isLimitReached ? 'Limit' : 'Refine'}
                </StatefulButton>
              </div>
            </div>
            
            {/* Token Quota Progress */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-5 pb-3 text-[10px] font-mono text-gray-500 gap-4 sm:gap-6">
              <div 
                className="flex items-center gap-2 flex-1 w-full cursor-pointer hover:text-gray-400 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isLimitReached) setShowQuotaModal(true);
                }}
                title={`Session: ${sessionPrompts}/${sessionLimit} prompts used. Resets every 5 hours (in ${timeUntilSession}).`}
              >
                <span className="whitespace-nowrap">
                  Session: {sessionPercent}% {isFreeTier && `(${sessionPrompts}/${sessionLimit})`}
                </span>
                <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
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
                className="flex items-center gap-2 flex-1 w-full justify-end cursor-pointer hover:text-gray-400 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isLimitReached) setShowQuotaModal(true);
                }}
                title={`Weekly: ${weeklyPrompts}/${weeklyLimit} prompts used. Resets weekly (in ${timeUntilWeekly}).`}
              >
                <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
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
          </motion.div>
        )}
      </AnimatePresence>

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
    </motion.form>
  );
}
