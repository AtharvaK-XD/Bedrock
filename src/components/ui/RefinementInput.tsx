import React, { useState, useRef, useEffect } from 'react';
import { Plus, AppWindow, Palette, Sparkles, ArrowUp, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface RefinementInputProps {
  onSubmit?: (text: string, model: string) => void;
  className?: string;
}

export function RefinementInput({ onSubmit, className }: RefinementInputProps) {
  const [input, setInput] = useState('');
  const [model, setModel] = useState('3 Flash');
  const [isExpanded, setIsExpanded] = useState(false);

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
        "relative flex flex-col w-full mx-auto bg-white/90 backdrop-blur-md border border-basalt-900/10 rounded-3xl shadow-xl transition-all duration-500 ease-[0.22,1,0.36,1] focus-within:ring-2 focus-within:ring-copper-500/30 overflow-hidden",
        expanded ? "max-w-[700px] min-h-[140px]" : "max-w-[340px] min-h-[60px]",
        className
      )}
    >
      {/* Input area */}
      <div className={cn("flex w-full px-5 transition-all duration-500", expanded ? "pt-4" : "py-[18px]")}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholderText}
          className={cn(
            "w-full bg-transparent text-basalt-900 placeholder:text-basalt-400 text-[15px] focus:outline-none resize-none leading-relaxed transition-all duration-500",
            expanded ? "min-h-[44px]" : "h-[24px]"
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
          <div className="relative group flex items-center bg-basalt-900/5 hover:bg-basalt-900/10 transition-colors rounded-full px-4 py-1.5 cursor-pointer border border-basalt-900/5 whitespace-nowrap">
            <span className="text-basalt-900 text-[13px] font-medium mr-1.5">{model}</span>
            <ChevronDown className="w-3.5 h-3.5 text-basalt-500 group-hover:text-basalt-700 transition-colors" />
            <select 
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value="3 Flash">3 Flash</option>
              <option value="4o">4o</option>
              <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet</option>
            </select>
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
