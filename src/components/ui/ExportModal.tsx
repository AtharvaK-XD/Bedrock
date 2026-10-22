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
  ChevronDown,
  Folder,
  FolderOpen,
  HardDrive,
  CheckCheck,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  EXPORT_TARGETS,
  EXPORT_MODELS,
  extractPromptVariables,
  type ExportCategory,
  type ExportTarget,
} from '../../lib/exportGenerators';
import { AgentIcon } from './ModelLogos';
import { isDesktopApp } from '../../lib/platform';
import {
  saveRuleFileDirectly,
  pickProjectFolder,
  getSavedProjectFolder,
  saveMultipleRuleFiles,
} from '../../lib/fileExport';

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

  // Direct file saving state
  const [projectFolder, setProjectFolder] = useState<string | null>(getSavedProjectFolder);
  const [isSavingDirect, setIsSavingDirect] = useState(false);
  const [directSaveStatus, setDirectSaveStatus] = useState<{
    type: 'success' | 'error';
    text: string;
    filePath?: string;
  } | null>(null);

  const isDesktop = isDesktopApp();

  // Refresh saved folder whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setProjectFolder(getSavedProjectFolder());
      setDirectSaveStatus(null);
    }
  }, [isOpen]);

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

  const handlePickFolder = async () => {
    const folder = await pickProjectFolder();
    if (folder) {
      setProjectFolder(folder);
      setDirectSaveStatus({
        type: 'success',
        text: `Target project directory set: ${folder}`,
      });
      setTimeout(() => setDirectSaveStatus(null), 3000);
    }
  };

  const handleDirectSave = async (targetOverride?: ExportTarget) => {
    const target = targetOverride || currentTarget;
    const code = targetOverride
      ? targetOverride.generate(promptText, title, selectedModel)
      : generatedCode;

    if (!code) return;

    setIsSavingDirect(true);
    setDirectSaveStatus(null);

    const res = await saveRuleFileDirectly(target.filename, code, projectFolder || undefined);
    setIsSavingDirect(false);

    if (res.canceled) return;

    if (res.success) {
      if (res.folderPath) {
        setProjectFolder(res.folderPath);
      }
      setDirectSaveStatus({
        type: 'success',
        text: `Saved ${target.filename} directly to project folder!`,
        filePath: res.filePath,
      });
      setTimeout(() => setDirectSaveStatus(null), 5000);
    } else {
      setDirectSaveStatus({
        type: 'error',
        text: res.error || `Failed to save ${target.filename} to disk.`,
      });
    }
  };

  const handleSaveAllCommonRules = async () => {
    if (!promptText) return;
    setIsSavingDirect(true);
    setDirectSaveStatus(null);

    const cursorTarget = EXPORT_TARGETS.find((t) => t.id === 'cursorrules');
    const claudeTarget = EXPORT_TARGETS.find((t) => t.id === 'claudemd');
    const windsurfTarget = EXPORT_TARGETS.find((t) => t.id === 'windsurf');

    const files = [
      cursorTarget && { fileName: cursorTarget.filename, content: cursorTarget.generate(promptText, title) },
      claudeTarget && { fileName: claudeTarget.filename, content: claudeTarget.generate(promptText, title) },
      windsurfTarget && { fileName: windsurfTarget.filename, content: windsurfTarget.generate(promptText, title) },
    ].filter(Boolean) as { fileName: string; content: string }[];

    const res = await saveMultipleRuleFiles(files, projectFolder || undefined);
    setIsSavingDirect(false);

    if (res.success) {
      setDirectSaveStatus({
        type: 'success',
        text: `Saved ${res.savedCount} rule files (.cursorrules, CLAUDE.md, .windsurfrules) to project!`,
      });
      setTimeout(() => setDirectSaveStatus(null), 5000);
    } else if (res.errors.length) {
      setDirectSaveStatus({
        type: 'error',
        text: res.errors.join('; '),
      });
    }
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
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            data-lenis-prevent="true"
            className="relative w-full max-w-5xl h-[88vh] max-h-[850px] bg-[#0c0d12] border border-white/15 rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden z-10"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#12141a]/90 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-copper-500/15 border border-copper-500/30 flex items-center justify-center text-copper-400 shadow-sm">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                      Export Blueprint & Direct Save
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-mono text-emerald-400 uppercase font-semibold">
                      {isDesktop ? 'Native Desktop Mode' : 'Web Workstation'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 font-sans">
                    Save directly into your local codebase (.cursorrules, CLAUDE.md) or copy formatted code
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category Navigation Bar */}
            <div className="px-6 py-2.5 border-b border-white/10 bg-[#0e1015] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/50 border border-white/5">
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
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                        isActive
                          ? 'bg-copper-500 text-white shadow-md shadow-copper-500/20'
                          : 'text-neutral-400 hover:text-white hover:bg-white/5'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{cat.label}</span>
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                          isActive ? 'bg-black/30 text-white' : 'bg-white/10 text-neutral-400'
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Target Pills inside active category */}
              <div 
                className="flex items-center gap-1.5 overflow-x-auto py-0.5 custom-scrollbar max-w-full sm:max-w-md"
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
                        'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all cursor-pointer font-medium',
                        isSelected
                          ? 'bg-copper-500/15 border border-copper-500/40 text-copper-300 font-semibold shadow-sm'
                          : 'bg-black/40 border border-white/5 text-neutral-400 hover:text-white hover:bg-white/5'
                      )}
                    >
                      <AgentIcon model={target.id} className="w-4 h-4" badgeClassName="w-4 h-4" />
                      <span>{target.name}</span>
                      <span className="text-[10px] font-mono opacity-70">({target.extension})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 1-Click Direct File Saving Toolbar */}
            <div className="px-6 py-2.5 bg-gradient-to-r from-emerald-950/30 via-[#11141c] to-black border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <HardDrive className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-[11px] font-mono text-neutral-400 uppercase font-bold shrink-0">
                    Project Folder:
                  </span>
                  <button
                    type="button"
                    onClick={handlePickFolder}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-neutral-200 hover:text-white transition-all truncate cursor-pointer group"
                    title={projectFolder ? `Target: ${projectFolder} (Click to change)` : 'Click to select project directory'}
                  >
                    <FolderOpen className="w-3 h-3 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                    <span className="truncate max-w-[200px] sm:max-w-[320px]">
                      {projectFolder || 'Select Codebase Folder...'}
                    </span>
                    <span className="text-[10px] font-sans text-neutral-400 group-hover:text-emerald-300 underline ml-1">
                      {projectFolder ? 'Change' : 'Browse'}
                    </span>
                  </button>
                </div>
              </div>

              {/* 1-Click Quick Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleDirectSave(EXPORT_TARGETS.find((t) => t.id === 'cursorrules'))}
                  disabled={isSavingDirect}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/30 text-neutral-300 hover:text-emerald-300 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  title="Write .cursorrules directly into project root"
                >
                  <Zap className="w-3 h-3 text-copper-400" />
                  <span>.cursorrules</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDirectSave(EXPORT_TARGETS.find((t) => t.id === 'claudemd'))}
                  disabled={isSavingDirect}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/30 text-neutral-300 hover:text-emerald-300 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  title="Write CLAUDE.md directly into project root"
                >
                  <Zap className="w-3 h-3 text-copper-400" />
                  <span>CLAUDE.md</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAllCommonRules}
                  disabled={isSavingDirect}
                  className="px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
                  title="Save .cursorrules, CLAUDE.md, and .windsurfrules simultaneously"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Save All Rules (1-Click)</span>
                </button>
              </div>
            </div>

            {/* Direct Save Alert Feedback */}
            <AnimatePresence>
              {directSaveStatus && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn(
                    'px-6 py-2 border-b text-xs font-mono flex items-center justify-between gap-3 shrink-0',
                    directSaveStatus.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    {directSaveStatus.type === 'success' ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 stroke-[2.5]" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="font-semibold">{directSaveStatus.text}</span>
                    {directSaveStatus.filePath && (
                      <span className="text-[11px] text-neutral-300 truncate underline">
                        {directSaveStatus.filePath}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDirectSaveStatus(null)}
                    className="text-neutral-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Target Settings Bar & Variable Indicators */}
            <div className="px-6 py-2.5 bg-[#13161c]/80 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <AgentIcon model={currentTarget.id} className="w-4 h-4" badgeClassName="w-4 h-4" />
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
                    <AgentIcon model={selectedModel} className="w-4 h-4" badgeClassName="w-4 h-4" />
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
                        className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl bg-[#14161c] border border-white/10 shadow-2xl p-1.5 z-50 space-y-0.5"
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
                              'w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors text-left cursor-pointer',
                              selectedModel === m.id
                                ? 'bg-copper-500/20 text-copper-300 font-semibold'
                                : 'text-neutral-300 hover:bg-white/5 hover:text-white'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <AgentIcon model={m.id} className="w-3.5 h-3.5" badgeClassName="w-3.5 h-3.5" />
                              <span>{m.name}</span>
                            </div>
                            <span className="text-[10px] text-neutral-500 font-mono">{m.provider}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Variable Pills */}
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
            <div className="px-6 py-4 border-t border-white/10 bg-[#13161c] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-neutral-400 font-mono hidden sm:flex items-center gap-2">
                <span>{generatedCode.split('\n').length} lines</span>
                <span>·</span>
                <span>{generatedCode.length} chars</span>
                <span>·</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <Folder className="w-3 h-3" />
                  {projectFolder ? (
                    <span className="truncate max-w-[200px]" title={projectFolder}>
                      {projectFolder}
                    </span>
                  ) : (
                    'No folder selected'
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
                {/* 1-Click Direct Save to Project */}
                <button
                  type="button"
                  onClick={() => handleDirectSave()}
                  disabled={isSavingDirect}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-emerald-600/20 active:scale-[0.98] border border-emerald-400/30"
                >
                  <HardDrive className="w-4 h-4 text-emerald-200" />
                  <span>
                    {isSavingDirect ? 'Writing...' : `1-Click Save ${currentTarget.filename}`}
                  </span>
                </button>

                {/* Standard Download */}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-3.5 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
                  title={`Download ${currentTarget.filename} to local downloads`}
                >
                  <Download className="w-4 h-4 text-neutral-300" />
                  <span>Download</span>
                </button>

                {/* Copy to Clipboard */}
                <button
                  type="button"
                  onClick={handleCopy}
                  className={cn(
                    'px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg active:scale-[0.98]',
                    copied
                      ? 'bg-emerald-500 text-black shadow-emerald-500/20'
                      : 'bg-copper-500 hover:bg-copper-600 text-white shadow-copper-500/20'
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 stroke-[2.5]" />
                      <span>Copy</span>
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
