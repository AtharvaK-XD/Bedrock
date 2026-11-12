import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getPaletteGroups, searchCatalog, type NodeCatalogEntry } from './nodeCatalog';

/** The look of one node type in the palette. Passed in by the page, which owns the node styles. */
export interface PaletteStyle {
  title: string;
  desc: string;
  tag: string;
  color: string;
  bg: string;
  border: string;
  hoverBorder: string;
  icon: ComponentType<{ className?: string }>;
  paletteShape: string;
}

interface NodePaletteProps {
  styles: Record<string, PaletteStyle>;
  onAdd: (type: string) => void;
}

const LONG_PRESS_MS = 450;

function ShapeBadge({ type, style }: { type: string; style: PaletteStyle }) {
  const Icon = style.icon;
  return (
    <div
      className={cn(
        'w-8 h-8 shrink-0 bg-black/60 border flex items-center justify-center font-mono text-[9px] font-bold transition-transform group-hover:scale-105',
        style.border,
        style.color,
        style.paletteShape
      )}
    >
      <div className={type === 'condition' ? '-rotate-45' : ''}>
        <Icon className="w-3.5 h-3.5" />
      </div>
    </div>
  );
}

/**
 * The node palette on the right of the canvas. Icons stay compact; hovering (or long-pressing on a touch screen)
 * shows the node's name and one plain sentence. "Find" opens a search box with fuller descriptions.
 */
export function NodePalette({ styles, onAdd }: NodePaletteProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pinned, setPinned] = useState<string | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => getPaletteGroups().map((g) => ({ ...g, entries: g.entries.filter((e) => styles[e.id]) })), [styles]);
  const results = useMemo(() => searchCatalog(query).filter((e) => styles[e.id]), [query, styles]);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }, []);

  const startPress = (e: React.PointerEvent, type: string) => {
    if (e.pointerType === 'mouse') return;
    suppressClick.current = false;
    pressTimer.current = setTimeout(() => {
      suppressClick.current = true;
      setPinned(type);
    }, LONG_PRESS_MS);
  };
  const endPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const add = (type: string) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setPinned(null);
    onAdd(type);
  };

  const addFromSearch = (entry: NodeCatalogEntry) => {
    onAdd(entry.id);
    setSearchOpen(false);
    setQuery('');
  };

  return (
    <div
      data-tour="palette"
      onWheel={(e) => e.stopPropagation()}
      className="absolute top-6 right-6 flex flex-col items-end gap-2 z-20 nowheel nopan nodrag"
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => setSearchOpen((o) => !o)}
          aria-label="Find a node"
          aria-expanded={searchOpen}
          title="Find a node (type: if, list, ask...)"
          className={cn(
            'w-[52px] h-[36px] flex items-center justify-center rounded-xl border bg-sf-1a1a1a/90 backdrop-blur-xl shadow-xl transition-colors',
            searchOpen ? 'border-copper-500/60 text-copper-300' : 'border-white/10 text-gray-400 hover:text-white hover:border-white/25'
          )}
        >
          {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
        </button>

        {searchOpen && (
          <div className="absolute right-[60px] top-0 w-[300px] rounded-2xl border border-white/10 bg-sf-16181d/95 backdrop-blur-2xl shadow-2xl p-3 space-y-2 z-30">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchOpen(false);
                if (e.key === 'Enter' && results[0]) addFromSearch(results[0]);
              }}
              placeholder="Type: if, list, ask..."
              aria-label="Search nodes"
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-copper-500/50"
            />
            <div className="max-h-[52vh] overflow-y-auto custom-scrollbar space-y-1.5 pr-0.5">
              {results.length === 0 && <p className="text-[11px] text-gray-500 px-1 py-2">No node matches. Try "if", "list" or "result".</p>}
              {results.map((entry) => {
                const style = styles[entry.id];
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => addFromSearch(entry)}
                    className={cn('w-full text-left p-2.5 rounded-xl border transition-colors hover:bg-white/5', style.bg, style.border)}
                  >
                    <div className={cn('text-xs font-semibold flex items-center gap-1.5', style.color)}>
                      <span aria-hidden="true">{entry.emoji}</span>
                      <span>{entry.name}</span>
                    </div>
                    <p className="text-[11px] text-gray-300 mt-1 leading-snug">{entry.does}</p>
                    <p className="text-[10px] text-gray-500 mt-1.5 leading-snug">
                      <span className="text-gray-400">In:</span> {entry.goesIn}
                    </p>
                    <p className="text-[10px] text-gray-500 leading-snug">
                      <span className="text-gray-400">Out:</span> {entry.comesOut}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* The list scrolls on its own, so the search panel above is never clipped by it */}
      <div className="flex flex-col items-end gap-2 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar p-2 -mr-2">
      {groups.map(({ group, entries }) => (
        <div key={group.id} className="flex flex-col items-end gap-2.5">
          <span className="text-[8px] font-mono uppercase tracking-widest text-gray-500 pr-1" title={group.hint}>
            {group.label}
          </span>
          {entries.map((entry) => {
            const style = styles[entry.id];
            const showDetails = pinned === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => add(entry.id)}
                onPointerDown={(e) => startPress(e, entry.id)}
                onPointerUp={endPress}
                onPointerLeave={endPress}
                onPointerCancel={endPress}
                onBlur={() => setPinned(null)}
                aria-label={`Add ${entry.name}: ${entry.does}`}
                className={cn(
                  'group flex items-center p-2 rounded-xl border bg-sf-1a1a1a/90 backdrop-blur-xl shadow-xl transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden shrink-0',
                  showDetails ? 'w-[260px]' : 'w-[52px] hover:w-[260px] focus-visible:w-[260px]',
                  style.bg,
                  style.border,
                  style.hoverBorder
                )}
                title={`${entry.name}: ${entry.does}`}
              >
                <ShapeBadge type={entry.id} style={style} />
                <div
                  className={cn(
                    'ml-3 text-left transition-opacity duration-300 delay-100 min-w-0',
                    showDetails ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
                  )}
                >
                  <div className={cn('text-xs font-semibold tracking-wide flex items-center gap-1.5', style.color)}>
                    <span aria-hidden="true">{entry.emoji}</span>
                    <span className="uppercase">{entry.name}</span>
                    <span className="text-[9px] font-mono px-1 rounded bg-black/50 border border-white/10 opacity-70">{style.tag}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5 leading-snug whitespace-normal line-clamp-2 max-w-[180px]">{entry.does}</div>
                </div>
              </button>
            );
          })}
        </div>
      ))}
      </div>
    </div>
  );
}
