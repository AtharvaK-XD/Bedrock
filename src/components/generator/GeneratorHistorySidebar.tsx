import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  SlidersHorizontal, 
  Download, 
  Search, 
  ChevronDown, 
  PanelLeftClose, 
  Plus, 
  Trash2, 
  Pin, 
  PinOff, 
  X,
  User,
  Settings,
  Sparkles,
  Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { 
  type HistoryPromptItem, 
  getStoredGeneratorHistory, 
  togglePinPrompt, 
  deletePromptFromHistory, 
  HISTORY_UPDATE_EVENT 
} from '../../lib/generatorHistory';
import { useUserProfile } from '../../lib/useUserProfile';

interface GeneratorHistorySidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeId: string | null;
  onSelectPrompt: (prompt: HistoryPromptItem) => void;
  onNewPrompt: () => void;
}

export function GeneratorHistorySidebar({
  isCollapsed,
  onToggleCollapse,
  activeId,
  onSelectPrompt,
  onNewPrompt,
}: GeneratorHistorySidebarProps) {
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const [items, setItems] = useState<HistoryPromptItem[]>(getStoredGeneratorHistory);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [sortAlphabetical, setSortAlphabetical] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Sync with localStorage & custom events
  useEffect(() => {
    const handleUpdate = () => {
      setItems(getStoredGeneratorHistory());
    };
    window.addEventListener(HISTORY_UPDATE_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(HISTORY_UPDATE_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Close user dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleTogglePin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = togglePinPrompt(id);
    setItems(updated);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = deletePromptFromHistory(id);
    setItems(updated);
  };

  const handleExport = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `bedrock_prompts_history_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2000);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Filter items by search query
  const filteredItems = useMemo(() => {
    let result = items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        item => item.title.toLowerCase().includes(q) || item.ideaText.toLowerCase().includes(q)
      );
    }
    if (sortAlphabetical) {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    }
    return result;
  }, [items, searchQuery, sortAlphabetical]);

  const pinnedItems = useMemo(() => filteredItems.filter(i => i.isPinned), [filteredItems]);
  const chatItems = useMemo(() => filteredItems.filter(i => !i.isPinned), [filteredItems]);

  // Fallback user display
  const displayName = profile?.name ? profile.name.split(' ')[0] : 'Atharva';
  const displayPlan = profile?.plan?.toLowerCase().includes('pro') ? 'Pro' : 'Free';
  const displayInitial = profile?.avatarInitials ? profile.avatarInitials[0] : (displayName[0] || 'A');

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 bottom-0 z-30 w-64 sm:w-72 bg-[#0c0d10] border-r border-white/[0.08] flex flex-col transition-transform duration-300 ease-in-out select-none shadow-[6px_0_32px_rgba(0,0,0,0.65)]",
        isCollapsed ? "-translate-x-full pointer-events-none" : "translate-x-0 pointer-events-auto"
      )}
    >
      {/* Top Header Controls (starts at pt-20 to cleanly sit below the fixed Topbar brand) */}
      <div className="pt-20 px-3 pb-2.5 flex items-center justify-between border-b border-white/[0.06]">
        <button
          type="button"
          onClick={onNewPrompt}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.09] border border-white/5 transition-all cursor-pointer group"
          title="Start fresh prompt"
        >
          <Plus className="w-3.5 h-3.5 text-copper-400 group-hover:rotate-90 transition-transform duration-200" />
          <span>New Prompt</span>
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer"
          title="Minimize sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Inline Search Bar (toggled by search icon at bottom) */}
      {isSearchOpen && (
        <div className="px-3 pt-2.5 pb-1 border-b border-white/[0.05] animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search previous prompts..."
              className="w-full bg-white/[0.04] border border-white/10 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-copper-500/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-neutral-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Scrollable History List */}
      <div className="flex-1 overflow-y-auto px-2 py-2.5 space-y-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
        
        {/* Pinned Section */}
        {pinnedItems.length > 0 && (
          <div>
            <div className="px-2.5 pb-1.5 text-xs text-neutral-400 font-medium select-none">
              Pinned
            </div>
            <div className="space-y-0.5">
              {pinnedItems.map(item => {
                const isActive = activeId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectPrompt(item)}
                    className={cn(
                      "group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] transition-all cursor-pointer",
                      isActive
                        ? "bg-[#1f2025] text-white font-medium shadow-sm"
                        : "text-neutral-300 hover:text-white hover:bg-white/[0.04]"
                    )}
                  >
                    <div className="flex items-center min-w-0 pr-2">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full border shrink-0 mr-2.5 transition-colors",
                        isActive ? "border-copper-400 bg-copper-400/20" : "border-neutral-500/70 group-hover:border-neutral-300"
                      )} />
                      <span
                        className="truncate text-[13px] leading-tight"
                        style={item.statusColor ? { color: item.statusColor } : undefined}
                      >
                        {item.title}
                      </span>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleTogglePin(e, item.id)}
                        className="p-1 rounded text-neutral-400 hover:text-copper-400 hover:bg-white/10 transition-colors"
                        title="Unpin prompt"
                      >
                        <PinOff className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, item.id)}
                        className="p-1 rounded text-neutral-400 hover:text-rose-400 hover:bg-white/10 transition-colors"
                        title="Delete prompt"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Chats and tasks Section */}
        <div>
          <div className="flex items-center justify-between px-2.5 pb-1.5 text-xs text-neutral-400 font-medium select-none">
            <span>Chats and tasks</span>
            <button
              type="button"
              onClick={() => setSortAlphabetical(prev => !prev)}
              className={cn(
                "p-1 rounded text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer",
                sortAlphabetical ? "text-copper-400 bg-white/5" : ""
              )}
              title={sortAlphabetical ? "Sorting alphabetically (A-Z)" : "Sort order"}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {chatItems.map(item => {
              const isActive = activeId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectPrompt(item)}
                  className={cn(
                    "group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] transition-all cursor-pointer",
                    isActive
                      ? "bg-[#1f2025] text-white font-medium shadow-sm"
                      : "text-neutral-300 hover:text-white hover:bg-white/[0.04]"
                  )}
                >
                  <div className="flex items-center min-w-0 pr-2">
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full border shrink-0 mr-2.5 transition-colors",
                      isActive ? "border-copper-400 bg-copper-400/20" : "border-neutral-500/70 group-hover:border-neutral-300"
                    )} />
                    <span
                      className="truncate text-[13px] leading-tight"
                      style={item.statusColor ? { color: item.statusColor } : undefined}
                    >
                      {item.title}
                    </span>
                  </div>

                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleTogglePin(e, item.id)}
                      className="p-1 rounded text-neutral-400 hover:text-copper-400 hover:bg-white/10 transition-colors"
                      title="Pin prompt"
                    >
                      <Pin className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, item.id)}
                      className="p-1 rounded text-neutral-400 hover:text-rose-400 hover:bg-white/10 transition-colors"
                      title="Delete prompt"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}

            {chatItems.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-neutral-500 font-mono">
                {searchQuery ? "No matching prompts found" : "No previous prompts"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom User & Utility Bar */}
      <div className="relative border-t border-white/[0.08] px-3 py-2.5 flex items-center justify-between bg-[#0c0d10] shrink-0">
        
        {/* User Profile Pill Button */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(prev => !prev)}
            className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer group text-left"
          >
            <div className="w-6 h-6 rounded-full bg-[#24262c] border border-white/10 flex items-center justify-center text-[11px] font-semibold text-neutral-200 shrink-0">
              {displayInitial}
            </div>
            <span className="text-xs text-neutral-300 group-hover:text-white font-medium max-w-[100px] truncate">
              {displayName} · {displayPlan}
            </span>
            <ChevronDown className={cn(
              "w-3 h-3 text-neutral-400 transition-transform duration-200",
              isUserMenuOpen ? "rotate-180" : ""
            )} />
          </button>

          {/* User Popover Menu */}
          {isUserMenuOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#14151a] border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 text-xs space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  navigate('/app/profile');
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-neutral-400" />
                <span>My Profile</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  navigate('/app/settings');
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-neutral-400" />
                <span>Settings</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  navigate('/app/pricing');
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-copper-400 hover:text-copper-300 hover:bg-copper-500/10 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Upgrade Plan</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Action Icons: Download (Export) & Search */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleExport}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
            title={copiedNotification ? "Exported!" : "Export prompts JSON"}
          >
            {copiedNotification ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSearchOpen(prev => !prev);
              if (isSearchOpen) setSearchQuery('');
            }}
            className={cn(
              "p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer",
              isSearchOpen ? "text-copper-400 bg-white/5" : ""
            )}
            title="Search previous prompts"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
