import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '../components/layout/PageTransition';
import { cn } from '../lib/utils';
import { isDesktopApp } from '../lib/platform';
import { 
  type HistoryPromptItem, 
  getStoredGeneratorHistory, 
  saveGeneratorHistory,
  togglePinPrompt, 
  deletePromptFromHistory, 
  syncHistoryFromDb,
  HISTORY_UPDATE_EVENT 
} from '../lib/generatorHistory';
import { 
  History as HistoryIcon,
  Search, 
  Pin, 
  Trash2, 
  Copy, 
  Check, 
  Download, 
  Wand2, 
  FlaskConical, 
  Sparkles, 
  ArrowUpRight, 
  Code2, 
  Terminal, 
  Layers, 
  Briefcase, 
  Rocket, 
  Plus,
  X,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon
} from 'lucide-react';
import { ExportModal } from '../components/ui/ExportModal';

const TARGET_TYPE_MAP: Record<string, { label: string; icon: any; color: string; badgeBg: string }> = {
  coding_agent: {
    label: 'Coding Agent',
    icon: Code2,
    color: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
  },
  image_generation: {
    label: 'Image Generation',
    icon: ImageIcon,
    color: 'text-fuchsia-400',
    badgeBg: 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-300'
  },
  video_generation: {
    label: 'Video Generation',
    icon: VideoIcon,
    color: 'text-violet-400',
    badgeBg: 'bg-violet-500/10 border-violet-500/20 text-violet-300'
  },
  freelancer_brief: {
    label: 'Freelancer',
    icon: Briefcase,
    color: 'text-purple-400',
    badgeBg: 'bg-purple-500/10 border-purple-500/20 text-purple-300'
  },
  no_code: {
    label: 'No-Code',
    icon: Layers,
    color: 'text-blue-400',
    badgeBg: 'bg-blue-500/10 border-blue-500/20 text-blue-300'
  },
  full_stack: {
    label: 'Full Stack App',
    icon: Layers,
    color: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300'
  },
  cli_tool: {
    label: 'CLI Tool',
    icon: Terminal,
    color: 'text-amber-400',
    badgeBg: 'bg-amber-500/10 border-amber-500/20 text-amber-300'
  },
  freelance_sow: {
    label: 'Freelance SOW',
    icon: Briefcase,
    color: 'text-purple-400',
    badgeBg: 'bg-purple-500/10 border-purple-500/20 text-purple-300'
  },
  hackathon_mvp: {
    label: 'Hackathon MVP',
    icon: Rocket,
    color: 'text-rose-400',
    badgeBg: 'bg-rose-500/10 border-rose-500/20 text-rose-300'
  }
};

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return 'Recently';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<HistoryPromptItem[]>(getStoredGeneratorHistory);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [exportingHistoryItem, setExportingHistoryItem] = useState<HistoryPromptItem | null>(null);

  // Sync with storage and background db sync
  useEffect(() => {
    const handleUpdate = () => {
      setItems(getStoredGeneratorHistory());
    };
    window.addEventListener(HISTORY_UPDATE_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    syncHistoryFromDb().then(synced => {
      if (synced && synced.length > 0) {
        setItems(synced);
      }
    });

    return () => {
      window.removeEventListener(HISTORY_UPDATE_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Filtered & sorted items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (pinnedOnly && !item.isPinned) return false;
      if (selectedTag !== 'all' && item.targetType !== selectedTag) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inTitle = (item.title || '').toLowerCase().includes(q);
      const inIdea = (item.ideaText || '').toLowerCase().includes(q);
      const inPrompt = (item.promptText || '').toLowerCase().includes(q);
      return inTitle || inIdea || inPrompt;
    }).sort((a, b) => {
      // Pinned items first, then by createdAt desc
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [items, searchQuery, selectedTag, pinnedOnly]);

  // Keep selected item valid
  useEffect(() => {
    if (filteredItems.length > 0) {
      if (!selectedId || !filteredItems.some(i => i.id === selectedId)) {
        setSelectedId(filteredItems[0].id);
      }
    } else {
      setSelectedId(null);
    }
  }, [filteredItems, selectedId]);

  const activeItem = useMemo(() => {
    return items.find(i => i.id === selectedId) || null;
  }, [items, selectedId]);

  const handleTogglePin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = togglePinPrompt(id);
    setItems(updated);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = deletePromptFromHistory(id);
    setItems(updated);
    if (selectedId === id) {
      const remaining = updated.filter(item => item.id !== id);
      setSelectedId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleClearAll = () => {
    saveGeneratorHistory([]);
    setItems([]);
    setSelectedId(null);
    setIsDeletingAll(false);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `bedrock-prompt-history-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenInGenerator = (item: HistoryPromptItem) => {
    navigate('/app/generator', {
      state: {
        idea: item.ideaText || item.title,
        targetType: item.targetType || 'coding_agent',
        id: item.id
      }
    });
  };

  const handleOpenInResult = (item: HistoryPromptItem) => {
    if (item.promptText) {
      navigate('/app/result', {
        state: {
          promptText: item.promptText,
          idea: item.ideaText || item.title,
          historyId: item.id
        }
      });
    } else {
      handleOpenInGenerator(item);
    }
  };

  const handleOpenInTester = (item: HistoryPromptItem) => {
    navigate('/app/tester', {
      state: {
        prompt: item.promptText || item.ideaText || item.title
      }
    });
  };

  const pinnedCount = items.filter(i => i.isPinned).length;
  const isDesktop = isDesktopApp();

  return (
    <PageTransition className={cn(isDesktop ? "h-full" : "")}>
      <div className={cn(
        "w-full flex flex-col p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6",
        isDesktop ? "min-h-full" : "min-h-[calc(100vh-80px)]"
      )}>
        
        {/* Top Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-copper-500/10 border border-copper-500/25 flex items-center justify-center text-copper-400 shadow-sm shadow-copper-500/10">
                <HistoryIcon className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight flex items-center gap-3">
                  Prompt History
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-gray-400 font-mono font-normal">
                    {items.length} {items.length === 1 ? 'Prompt' : 'Prompts'}
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-gray-400">
                  Inspect, resume, export, and refine all prompts generated in your Bedrock sessions.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => navigate('/app/generator')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-copper-500 hover:bg-copper-400 text-white text-xs font-semibold shadow-lg shadow-copper-500/20 hover:shadow-copper-500/30 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Prompt</span>
            </button>

            {items.length > 0 && (
              <>
                <button
                  onClick={handleExportJSON}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-gray-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
                  title="Download complete history as JSON"
                >
                  <Download className="w-3.5 h-3.5 text-copper-400" />
                  <span>Export JSON</span>
                </button>

                <button
                  onClick={() => setIsDeletingAll(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/[0.08] hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-medium transition-all cursor-pointer"
                  title="Clear all prompt history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Clear All Confirmation Modal */}
        <AnimatePresence>
          {isDeletingAll && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
              data-lenis-prevent="true"
              onWheel={(e) => e.stopPropagation()}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-md bg-[#0e1015] border border-white/15 rounded-2xl p-6 shadow-2xl space-y-4"
                data-lenis-prevent="true"
              >
                <div className="flex items-center gap-3 text-rose-400">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Clear Prompt History?</h3>
                    <p className="text-xs text-gray-400">This will remove all {items.length} prompts from local storage.</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  This action cannot be undone. You may export your prompts as JSON before clearing if you want a backup.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsDeletingAll(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-lg shadow-rose-600/30 cursor-pointer"
                  >
                    Yes, Clear History
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="relative md:col-span-5">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search prompts by title, requirements, or code..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 focus:border-copper-500/50 focus:bg-white/[0.06] text-white text-xs placeholder:text-gray-500 transition-all outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="md:col-span-7 flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              onClick={() => { setSelectedTag('all'); setPinnedOnly(false); }}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer border",
                selectedTag === 'all' && !pinnedOnly
                  ? "bg-white/[0.12] text-white border-white/20 shadow-sm"
                  : "bg-white/[0.03] text-gray-400 border-white/5 hover:text-white hover:bg-white/[0.06]"
              )}
            >
              All ({items.length})
            </button>

            <button
              onClick={() => setPinnedOnly(!pinnedOnly)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer border",
                pinnedOnly
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-sm"
                  : "bg-white/[0.03] text-gray-400 border-white/5 hover:text-white hover:bg-white/[0.06]"
              )}
            >
              <Pin className="w-3 h-3 text-amber-400 fill-amber-400/30" />
              <span>Pinned ({pinnedCount})</span>
            </button>

            {Object.entries(TARGET_TYPE_MAP).map(([key, config]) => {
              const count = items.filter(i => i.targetType === key).length;
              if (count === 0) return null;
              const Icon = config.icon;
              return (
                <button
                  key={key}
                  onClick={() => { setSelectedTag(key); setPinnedOnly(false); }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer border",
                    selectedTag === key && !pinnedOnly
                      ? "bg-copper-500/20 text-copper-300 border-copper-500/30 shadow-sm"
                      : "bg-white/[0.03] text-gray-400 border-white/5 hover:text-white hover:bg-white/[0.06]"
                  )}
                >
                  <Icon className="w-3 h-3" />
                  <span>{config.label} ({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content: Master - Detail Split Pane */}
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 border border-white/[0.08] rounded-2xl bg-white/[0.01] text-center space-y-4 my-8">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-gray-500">
              <HistoryIcon className="w-7 h-7 stroke-[1.5]" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-base font-semibold text-white">
                {searchQuery ? 'No matching prompts found' : 'No prompt history yet'}
              </h3>
              <p className="text-xs text-gray-400">
                {searchQuery
                  ? `No prompts matched "${searchQuery}". Try a different keyword or reset filters.`
                  : 'Every prompt idea or architectural specification generated in the Generator workspace will automatically appear here.'}
              </p>
            </div>
            {searchQuery ? (
              <button
                onClick={() => { setSearchQuery(''); setSelectedTag('all'); setPinnedOnly(false); }}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            ) : (
              <button
                onClick={() => navigate('/app/generator')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-copper-500 hover:bg-copper-400 text-white text-xs font-semibold shadow-lg shadow-copper-500/25 transition-all cursor-pointer"
              >
                <Wand2 className="w-4 h-4" />
                <span>Create Your First Prompt</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Prompts List (5 cols on lg) */}
            <div className="lg:col-span-5 space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {filteredItems.map((item) => {
                const isSelected = item.id === selectedId;
                const targetConfig = TARGET_TYPE_MAP[item.targetType || 'coding_agent'] || TARGET_TYPE_MAP.coding_agent;
                const TargetIcon = targetConfig.icon;

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "p-3.5 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden text-left",
                      isSelected
                        ? "bg-white/[0.08] border-copper-500/40 shadow-lg shadow-black/40 ring-1 ring-copper-500/30"
                        : "bg-[#0b0d13]/70 hover:bg-white/[0.04] border-white/[0.06] hover:border-white/15"
                    )}
                  >
                    {/* Header Row: Target Badge + Timestamp + Pin */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono border",
                          targetConfig.badgeBg
                        )}>
                          <TargetIcon className="w-2.5 h-2.5" />
                          <span>{targetConfig.label}</span>
                        </span>
                        <span className="text-[10px] font-mono text-gray-500">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleTogglePin(e, item.id)}
                          className={cn(
                            "p-1 rounded-md transition-colors cursor-pointer",
                            item.isPinned
                              ? "text-amber-400 hover:text-amber-300"
                              : "text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100"
                          )}
                          title={item.isPinned ? "Unpin prompt" : "Pin prompt"}
                        >
                          <Pin className={cn("w-3.5 h-3.5", item.isPinned ? "fill-amber-400" : "")} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, item.id)}
                          className="p-1 rounded-md text-gray-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-colors cursor-pointer"
                          title="Delete prompt"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-semibold text-white tracking-tight line-clamp-1 group-hover:text-copper-300 transition-colors">
                      {item.title}
                    </h3>

                    {/* Idea Snippet */}
                    <p className="text-xs text-gray-400 line-clamp-2 mt-1 leading-relaxed">
                      {item.ideaText || 'No idea text provided.'}
                    </p>

                    {/* Footer indicators */}
                    <div className="mt-3 pt-2.5 border-t border-white/[0.04] flex items-center justify-between text-[11px] text-gray-500">
                      <span className="font-mono text-[10px]">
                        {item.promptText ? `${item.promptText.split(/\s+/).length} words ready` : 'Draft / Questions'}
                      </span>
                      <span className="text-copper-400 group-hover:translate-x-0.5 transition-transform font-medium flex items-center gap-0.5">
                        Inspect <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Prompt Detail Inspector (7 cols on lg) */}
            <div className="lg:col-span-7">
              {activeItem ? (
                <div className="bg-[#0b0d13] border border-white/[0.1] rounded-2xl p-5 sm:p-6 shadow-2xl relative space-y-6">
                  
                  {/* Top Inspector Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const conf = TARGET_TYPE_MAP[activeItem.targetType || 'coding_agent'] || TARGET_TYPE_MAP.coding_agent;
                          const Icon = conf.icon;
                          return (
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border",
                              conf.badgeBg
                            )}>
                              <Icon className="w-3.5 h-3.5" />
                              <span>{conf.label}</span>
                            </span>
                          );
                        })()}
                        <span className="text-xs font-mono text-gray-400">
                          {new Date(activeItem.createdAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-white tracking-tight pt-1">
                        {activeItem.title}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleTogglePin(e, activeItem.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer",
                          activeItem.isPinned
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                            : "bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10"
                        )}
                      >
                        <Pin className={cn("w-3.5 h-3.5", activeItem.isPinned ? "fill-amber-400" : "")} />
                        <span>{activeItem.isPinned ? 'Pinned' : 'Pin'}</span>
                      </button>

                      <button
                        onClick={(e) => handleDelete(e, activeItem.id)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 text-gray-400 hover:text-rose-300 transition-all cursor-pointer"
                        title="Delete Prompt"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Section 1: User's Original Idea Payload */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-gray-400 uppercase tracking-wider font-semibold">
                        Original Prompt Requirements / Idea
                      </span>
                      <button
                        onClick={() => handleCopyText(activeItem.ideaText, `idea-${activeItem.id}`)}
                        className="flex items-center gap-1 text-[11px] font-mono text-copper-400 hover:text-copper-300 transition-colors cursor-pointer"
                      >
                        {copiedId === `idea-${activeItem.id}` ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] text-xs text-gray-300 leading-relaxed font-sans whitespace-pre-wrap select-text">
                      {activeItem.ideaText}
                    </div>
                  </div>

                  {/* Section 2: Generated Output / System Prompt */}
                  {activeItem.promptText ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-400 uppercase tracking-wider font-semibold">
                            Generated Standalone System Prompt
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-400">
                            {activeItem.promptText.split(/\s+/).length} words
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setExportingHistoryItem(activeItem)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-copper-500/20 via-amber-500/15 to-emerald-500/15 border border-copper-500/40 hover:border-copper-500/70 text-copper-300 hover:text-white transition-all text-[11px] font-semibold cursor-pointer active:scale-[0.98]"
                            title="Export to .cursorrules, CLAUDE.md, Vercel AI SDK, Python, or API payload"
                          >
                            <Code2 className="w-3 h-3 text-copper-400" />
                            <span>Export Blueprint</span>
                          </button>

                          <button
                            onClick={() => handleCopyText(activeItem.promptText!, `prompt-${activeItem.id}`)}
                            className="flex items-center gap-1 text-[11px] font-mono text-copper-400 hover:text-copper-300 transition-colors cursor-pointer"
                          >
                            {copiedId === `prompt-${activeItem.id}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Full Prompt</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="max-h-72 overflow-y-auto p-4 rounded-xl bg-black/60 border border-white/[0.08] text-xs font-mono text-gray-300 leading-relaxed whitespace-pre-wrap select-text scrollbar-thin scrollbar-thumb-white/10">
                        {activeItem.promptText}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-amber-500/[0.05] border border-amber-500/20 text-xs text-amber-200/80 flex items-start gap-3">
                      <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-300 mb-0.5">Prompt Draft in Progress</p>
                        <p className="text-[11px] text-amber-200/70">
                          This session contains requirements and clarification questions. Resume in the Generator workspace to synthesize the final production prompt.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action Bar Footer */}
                  <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => handleOpenInGenerator(activeItem)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-copper-500 hover:bg-copper-400 text-white text-xs font-semibold shadow-lg shadow-copper-500/25 transition-all cursor-pointer"
                    >
                      <Wand2 className="w-4 h-4" />
                      <span>Open in Generator</span>
                    </button>

                    {activeItem.promptText && (
                      <button
                        onClick={() => handleOpenInResult(activeItem)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 hover:border-white/20 text-white text-xs font-medium transition-all cursor-pointer"
                      >
                        <FileText className="w-4 h-4 text-copper-400" />
                        <span>Result & Refine</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenInTester(activeItem)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 hover:border-white/20 text-white text-xs font-medium transition-all cursor-pointer"
                    >
                      <FlaskConical className="w-4 h-4 text-copper-400" />
                      <span>Test Prompt</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center border border-dashed border-white/10 rounded-2xl text-gray-500 text-xs">
                  Select a prompt from the list to preview details
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Export Blueprint Modal */}
      <ExportModal
        isOpen={Boolean(exportingHistoryItem)}
        onClose={() => setExportingHistoryItem(null)}
        promptText={exportingHistoryItem?.promptText || ''}
        title={exportingHistoryItem?.title || 'Bedrock Prompt'}
      />
    </PageTransition>
  );
}
