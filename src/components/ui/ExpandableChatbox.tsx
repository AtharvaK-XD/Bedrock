import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ExpandableChatboxProps {
  onSubmit: (text: string) => void;
  className?: string;
}

export function ExpandableChatbox({ onSubmit, className }: ExpandableChatboxProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [value, setValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (!value.trim()) {
          setIsExpanded(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const handleSubmit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (value.trim()) {
      onSubmit(value);
      setValue('');
      setIsExpanded(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea when expanded
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(200, Math.max(60, textareaRef.current.scrollHeight))}px`;
    }
  }, [value, isExpanded]);

  return (
    <motion.div
      ref={containerRef}
      initial={false}
      animate={{
        height: isExpanded ? 'auto' : 56,
        borderRadius: isExpanded ? 24 : 28,
      }}
      className={cn(
        "relative bg-[#1a1a1a]/95 backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-300",
        isExpanded ? "ring-2 ring-copper-500/30" : "hover:border-white/20",
        className
      )}
      onClick={() => {
        if (!isExpanded) {
          setIsExpanded(true);
          setTimeout(() => textareaRef.current?.focus(), 50);
        }
      }}
    >
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <motion.div 
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center h-full px-5 gap-3 cursor-text text-gray-400 w-full"
          >
            <Sparkles className="w-5 h-5 text-copper-500/80" />
            <span className="text-sm font-medium">Ask a question or add a node...</span>
          </motion.div>
        ) : (
          <motion.div 
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col p-4 w-full h-full relative"
          >
             <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What do you want to build or ask?"
                className="w-full resize-none bg-transparent text-white placeholder:text-gray-500 focus:outline-none text-[15px] leading-relaxed min-h-[60px] max-h-[200px] custom-scrollbar overflow-y-auto"
                autoFocus
             />
             <div className="flex justify-between items-center mt-2 border-t border-white/10 pt-3">
               <div className="text-xs text-gray-500 font-medium">
                 Press <kbd className="font-sans px-1 py-0.5 bg-white/10 rounded">Enter</kbd> to send
               </div>
               <button
                 onClick={handleSubmit}
                 disabled={!value.trim()}
                 className="flex items-center gap-2 bg-copper-500 hover:bg-copper-600 disabled:bg-white/5 disabled:text-gray-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm disabled:shadow-none"
               >
                 <Send className="w-4 h-4" />
                 Send
               </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
