import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  X,
  Copy,
  Check,
  Download,
  Code2,
  Sparkles,
  Bot,
  Terminal,
  Cpu,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  EXPORT_TARGETS,
  EXPORT_MODELS,
  extractPromptVariables,
  type ExportCategory,
} from '../../lib/exportGenerators';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  promptText: string;
  title?: string;
  initialTargetId?: string;
}

const CATEGORIES: { id: ExportCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'ide', label: 'IDE & Agent Rules', icon: Bot },
  { id: 'sdk', label: 'AI SDKs', icon: Code2 },
  { id: 'api', label: 'API & Payloads', icon: Terminal },
];

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  promptText,
  title = 'Bedrock System Prompt',
  initialTargetId = 'cursorrules',
}) => {
  const [activeCategory, setActiveCategory] = useState<ExportCategory>('ide');
  const [selectedTargetId, setSelectedTargetId] = useState<string>(initialTargetId);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o');
  const [copied, setCopied] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  // Sync initial target
  useEffect(() => {
    if (initialTargetId) {
      const match = EXPORT_TARGETS.find((t) => t.id === initialTargetId);
      if (match) {
        setSelectedTargetId(match.id);
        setActiveCategory(match.category);
      }
    }
  }, [initialTargetId, isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const categoryTargets = useMemo(
    () => EXPORT_TARGETS.filter((t) => t.category === activeCategory),
    [activeCategory]
  );

  const currentTarget = useMemo(() => {
    return EXPORT_TARGETS.find((t) => t.id === selectedTargetId) || categoryTargets[0] || EXPORT_TARGETS[0];
  }, [selectedTargetId, categoryTargets]);

  // If active category changes and selected target is not in category, switch to first target of category
  const handleCategoryChange = (cat: ExportCategory) => {
    setActiveCategory(cat);
    const firstInCat = EXPORT_TARGETS.find((t) => t.category === cat);
    if (firstInCat) {
      setSelectedTargetId(firstInCat.id);
    }
  };

  const detectedVariables = useMemo(() => extractPromptVariables(promptText), [promptText]);

  const generatedCode = useMemo(() => {
    if (!promptText) return '';
    return currentTarget.generate(promptText, title, selectedModel);
  }, [currentTarget, promptText, title, selectedModel]);

  const handleCopy = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!generatedCode) return;
    const blob = new Blob([generatedCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = currentTarget.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const codeContainerRef = useRef<HTMLDivElement>(null);

  const handleCodeWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-hidden"
          data-lenis-prevent="true"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl transition-all"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0f1115] border border-white/10 shadow-2xl overflow-hidden z-10"
            data-lenis-prevent="true"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/10 flex items-start justify-between gap-4 shrink-0 bg-[#13161c]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      Export Prompt Blueprint
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Production Ready
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5 font-sans">
                    Transform your prompt into IDE agent rules, runnable SDK code, or raw API payloads.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category Tabs */}
            <div className="px-6 pt-4 pb-2 border-b border-white/5 bg-[#0f1115] shrink-0">
              <div className="flex items-center gap-2">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = activeCategory === cat.id;
                  const count = EXPORT_TARGETS.filter((t) => t.category === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleCategoryChange(cat.id)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer',
                        isActive
                          ? 'bg-white text-black font-semibold shadow-md'
                          : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/10 border border-white/5'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{cat.label}</span>
                      <span
                        className={cn(
                          'text-[10px] font-mono px-1.5 py-0.2 rounded-full',
                          isActive ? 'bg-black/10 text-black' : 'bg-white/10 text-neutral-400'
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Sub-Target Pills */}
              <div 
                className="flex items-center gap-2 overflow-x-auto py-3 custom-scrollbar"
                data-lenis-prevent="true"
              >
                {categoryTargets.map((target) => {
                  const isSelected = target.id === currentTarget.id;
                  return (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => setSelectedTargetId(target.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer font-medium',
                        isSelected
                          ? 'bg-copper-500/15 border border-copper-500/40 text-copper-300 font-semibold shadow-sm'
                          : 'bg-black/40 border border-white/5 text-neutral-400 hover:text-white hover:bg-white/5'
                      )}
                    >
                      <span>{target.name}</span>
                      <span className="text-[10px] font-mono opacity-70">({target.extension})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Settings Bar & Variable Indicators */}
            <div className="px-6 py-3 bg-[#13161c]/80 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">{currentTarget.filename}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-white/5 border border-white/10 text-neutral-300">
                  {currentTarget.badge}
                </span>
                <span className="text-xs text-neutral-400 font-sans hidden sm:inline">
                  — {currentTarget.description}
                </span>
              </div>

              {/* Model Selector for SDK / API targets */}
              {(currentTarget.category === 'sdk' || currentTarget.category === 'api') && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 hover:border-white/20 text-xs font-medium text-neutral-200 cursor-pointer"
                  >
                    <Cpu className="w-3.5 h-3.5 text-copper-400" />
                    <span>Model: {EXPORT_MODELS.find((m) => m.id === selectedModel)?.name || selectedModel}</span>
                    <ChevronDown className="w-3 h-3 text-neutral-400" />
                  </button>

                  <AnimatePresence>
                    {modelDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        data-lenis-prevent="true"
                        className="absolute right-0 top-full mt-1.5 w-52 rounded-2xl bg-[#14161c] border border-white/10 shadow-2xl p-1.5 z-50 space-y-0.5"
                      >
                        {EXPORT_MODELS.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setSelectedModel(m.id);
                              setModelDropdownOpen(false);
                            }}
                            className={cn(
                              'w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer',
                              selectedModel === m.id
                                ? 'bg-copper-500/15 text-copper-300 font-semibold'
                                : 'text-neutral-300 hover:bg-white/5'
                            )}
                          >
                            <span>{m.name}</span>
                            <span className="text-[10px] font-mono opacity-60">{m.provider}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Variable Pills (if prompt has placeholders) */}
            {detectedVariables.length > 0 && (
              <div 
                className="px-6 py-2 bg-emerald-500/5 border-b border-emerald-500/10 flex items-center gap-2 overflow-x-auto text-xs shrink-0"
                data-lenis-prevent="true"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px] font-mono text-emerald-300 font-semibold uppercase shrink-0">
                  Detected Variables:
                </span>
                <div className="flex items-center gap-1.5">
                  {detectedVariables.map((v) => (
                    <span
                      key={v}
                      className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-[11px]"
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Code Body */}
            <div 
              ref={codeContainerRef}
              onWheel={handleCodeWheel}
              className="flex-1 min-h-0 overflow-y-auto p-6 custom-scrollbar bg-[#0b0c0f] overscroll-contain"
              data-lenis-prevent="true"
            >
              <div className="relative group">
                <pre 
                  className="w-full p-5 bg-[#07080a] border border-white/10 rounded-2xl text-neutral-200 font-mono text-xs leading-relaxed overflow-x-auto selection:bg-copper-500/30"
                  data-lenis-prevent="true"
                >
                  <code data-lenis-prevent="true">{generatedCode}</code>
                </pre>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-white/10 bg-[#13161c] flex items-center justify-between shrink-0">
              <div className="text-xs text-neutral-500 font-mono hidden sm:block">
                <span>{generatedCode.split('\n').length} lines</span>
                <span className="mx-2">·</span>
                <span>{generatedCode.length} characters</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                >
                  <Download className="w-4 h-4 text-neutral-300" />
                  <span>Download {currentTarget.filename}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopy}
                  className={cn(
                    'px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-[0.98]',
                    copied
                      ? 'bg-emerald-500 text-black shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-copper-500 to-amber-400 hover:from-copper-400 hover:to-amber-300 text-black shadow-copper-500/20'
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 stroke-[2.5]" />
                      <span>Copy {currentTarget.name}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
