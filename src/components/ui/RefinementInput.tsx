import React, { useState } from 'react';
import { Plus, AppWindow, Palette, Sparkles, ArrowUp, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface RefinementInputProps {
  onSubmit?: (text: string, model: string) => void;
  className?: string;
}

export function RefinementInput({ onSubmit, className }: RefinementInputProps) {
  const [input, setInput] = useState('');
  const [model, setModel] = useState('3 Flash');

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
      className={cn(
        "relative flex w-full max-w-4xl mx-auto items-center bg-[#18181A] border border-white/5 rounded-full px-2 py-2 shadow-2xl transition-all focus-within:ring-1 focus-within:ring-white/20",
        className
      )}
    >
      {/* Left side hint/icons */}
      <div className="flex items-center gap-4 pl-4 pr-3 text-white/40 select-none">
        <button type="button" className="hover:text-white transition-colors">
          <Plus className="w-5 h-5" strokeWidth={2.5} />
        </button>
        <span className="text-xl font-light">/</span>
      </div>

      {/* Input */}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="What would you like to change or create?"
        className="flex-1 bg-transparent text-white/90 placeholder:text-white/30 h-12 text-[15px] focus:outline-none min-w-0"
      />

      {/* Right side actions */}
      <div className="flex items-center gap-2 pr-1 ml-2">
        <button type="button" className="text-white/40 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/5">
          <AppWindow className="w-[18px] h-[18px]" strokeWidth={2} />
        </button>
        <button type="button" className="text-white/40 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/5">
          <Palette className="w-[18px] h-[18px]" strokeWidth={2} />
        </button>

        {/* Model Selector */}
        <div className="relative group flex items-center bg-[#27272A] hover:bg-[#3F3F46] transition-colors rounded-full px-4 py-1.5 cursor-pointer border border-white/5 ml-1">
          <span className="text-white/90 text-[13px] font-medium mr-1.5">{model}</span>
          <ChevronDown className="w-3.5 h-3.5 text-white/50 group-hover:text-white/80 transition-colors" />
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

        <button type="button" className="text-white/40 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/5">
          <Sparkles className="w-[18px] h-[18px]" strokeWidth={2} />
        </button>

        <button 
          type="submit"
          disabled={!input.trim()}
          className="ml-1 bg-white/10 text-white p-2 rounded-full hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/5 transition-all flex items-center justify-center"
        >
          <ArrowUp className="w-[18px] h-[18px]" strokeWidth={2.5} />
        </button>
      </div>
    </form>
  );
}
