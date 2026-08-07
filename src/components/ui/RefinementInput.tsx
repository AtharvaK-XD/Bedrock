import React, { useState, useRef, useEffect } from 'react';
import { Plus, AppWindow, Palette, Sparkles, ArrowUp, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AI_AGENTS } from './RichInput';

interface RefinementInputProps {
  onSubmit?: (text: string, model: string) => void;
  className?: string;
}

export function RefinementInput({ onSubmit, className }: RefinementInputProps) {
  const [input, setInput] = useState('');
  const [model, setModel] = useState('GPT-4o');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    "What would you like to change or create?",
    "Add a new feature to the prompt...",
    "Make the tone more professional...",
    "Rewrite this for a technical audience..."
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

  const expanded = isExpanded || input.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && onSubmit) {
      onSubmit(input, model);
      setInput('');
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
        "relative flex flex-col w-full mx-auto bg-white/90 backdrop-blur-md border border-basalt-900/10 rounded-3xl shadow-xl transition-all duration-500 ease-[0.22,1,0.36,1] focus-within:ring-2 focus-within:ring-copper-500/30",
        expanded ? "max-w-[700px] min-h-[140px]" : "max-w-[340px] min-h-[60px]",
        className
      )}
    >
      {/* Input area */}
      <div className={cn("flex w-full px-5 transition-all duration-500 flex-1", expanded ? "pt-5 items-start" : "pt-0 items-center")}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholderText}
          className={cn(
            "w-full bg-transparent text-basalt-900 placeholder:text-basalt-400 text-[15px] resize-none leading-relaxed transition-all duration-500 border-none outline-none focus:outline-none focus:ring-0 focus:border-transparent p-0 m-0",
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
        {/* Left tools (+) */}
        <div className="flex items-center">
          <button type="button" className="text-basalt-400 hover:text-basalt-700 transition-colors p-2 rounded-xl hover:bg-basalt-900/5">
            <Plus className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>

        {/* Right tools */}
        <div className="flex items-center gap-2">
          {/* Model Selector */}
          <div className="relative group flex items-center" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center bg-basalt-900/5 hover:bg-basalt-900/10 transition-colors rounded-full px-4 py-1.5 border border-basalt-900/5 whitespace-nowrap"
            >
              <span className="text-basalt-900 text-[13px] font-medium mr-1.5">{model}</span>
              <ChevronDown className="w-3.5 h-3.5 text-basalt-500 transition-colors" />
            </button>

            {isModelDropdownOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-56 max-h-[300px] overflow-y-auto custom-scrollbar bg-white/90 backdrop-blur-xl border border-basalt-900/10 rounded-2xl shadow-xl z-50 py-2">
                {AI_AGENTS.map((agent) => (
                  <div key={agent.id} className="mb-2">
                    <div className="px-3 py-1 text-[10px] font-bold text-basalt-400 uppercase tracking-wider">
                      {agent.name}
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
                          "w-full flex items-center px-4 py-1.5 text-[13px] text-left transition-colors",
                          model === m.name ? "bg-copper-500/10 text-copper-700 font-medium" : "text-basalt-700 hover:bg-basalt-900/5 hover:text-basalt-900"
                        )}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="button" className="text-basalt-400 hover:text-basalt-700 transition-colors p-2 rounded-xl hover:bg-basalt-900/5 whitespace-nowrap">
            <Sparkles className="w-[18px] h-[18px]" strokeWidth={2} />
          </button>

          <button 
            type="submit"
            disabled={!input.trim()}
            className="ml-1 bg-copper-500 text-white p-2 rounded-full hover:bg-copper-600 disabled:opacity-50 disabled:bg-basalt-900/10 disabled:text-basalt-400 transition-all flex items-center justify-center"
          >
            <ArrowUp className="w-[18px] h-[18px]" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </form>
  );
}
