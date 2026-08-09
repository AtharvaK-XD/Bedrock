import React, { useState, useRef, useEffect } from 'react';
import { Plus, Sparkles, ArrowUp, ChevronDown, X } from 'lucide-react';
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

  const expanded = isExpanded || input.trim().length > 0 || files.length > 0;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((input.trim() || files.length > 0) && onSubmit) {
      // In a real app, you would pass files to onSubmit too
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
        "relative flex flex-col w-full mx-auto bg-[#111] backdrop-blur-md border border-white/10 rounded-3xl shadow-xl transition-all duration-500 ease-[0.22,1,0.36,1] focus-within:ring-2 focus-within:ring-copper-500/30",
        expanded ? "max-w-[700px] min-h-[140px]" : "max-w-[340px] min-h-[60px]",
        className
      )}
    >
      {/* Input area */}
      <div className={cn("flex flex-col w-full px-5 transition-all duration-500 flex-1", expanded ? "pt-5 justify-start" : "pt-0 justify-center")}>
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-1 rounded-md text-xs text-gray-300">
                <span className="truncate max-w-[150px]">{file.name}</span>
                <button type="button" onClick={() => removeFile(idx)} className="text-gray-500 hover:text-white">
                  <X className="w-3 h-3" />
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
        {/* Left tools (+) */}
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
            className="text-gray-500 hover:text-gray-300 transition-colors p-2 rounded-xl hover:bg-white/10"
            title="Attach files (Max 5MB)"
          >
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
              className="flex items-center bg-white/10 hover:bg-white/20 transition-colors rounded-full px-4 py-1.5 border border-white/5 whitespace-nowrap"
            >
              <span className="text-white text-[13px] font-medium mr-1.5">{model}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 transition-colors" />
            </button>

            {isModelDropdownOpen && (
              <div 
                className="absolute bottom-full right-0 mb-2 w-56 max-h-[300px] overflow-y-auto custom-scrollbar bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl z-50 py-2"
                data-lenis-prevent="true"
              >
                {AI_AGENTS.map((agent) => (
                  <div key={agent.id} className="mb-2">
                    <div className="px-3 py-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
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
                          model === m.name ? "bg-copper-500/10 text-copper-700 font-medium" : "text-gray-300 hover:bg-white/10 hover:text-white"
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

          <button type="button" className="text-gray-500 hover:text-gray-300 transition-colors p-2 rounded-xl hover:bg-white/10 whitespace-nowrap">
            <Sparkles className="w-[18px] h-[18px]" strokeWidth={2} />
          </button>

          <button 
            type="submit"
            disabled={!input.trim() && files.length === 0}
            className="ml-1 bg-copper-500 text-white p-2 rounded-full hover:bg-copper-600 disabled:opacity-50 disabled:bg-white/10 disabled:text-gray-500 transition-all flex items-center justify-center"
          >
            <ArrowUp className="w-[18px] h-[18px]" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </form>
  );
}
