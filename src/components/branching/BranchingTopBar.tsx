import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BookOpen, Download, LayoutPanelLeft, Redo2, Trophy, Undo2, Upload, HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ALL_NODE_TYPES, NODE_CATALOG } from './nodeCatalog';
import { MISSIONS } from './missionList';
import { PlanMeter } from './PlanMeter';
import { IMPORT_ENABLED } from './workflowFile';

interface BranchingTopBarProps {
  nodeCount: number;
  nodeLimit: number;
  planLabel: string;
  onPlanClick: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAutoArrange: () => void;
  onExport: () => void;
  /** Import is behind IMPORT_ENABLED until Security's sanitizeWorkflow is merged. */
  onImport: () => void;
  missionsDone: number;
  onToggleMissions: () => void;
  onShowTour: () => void;
  /** Run controls, shown first (Branching v2) */
  leading?: ReactNode;
  /** Extra tools (doctor, explain, history, share), shown before missions */
  trailing?: ReactNode;
}

const iconButton =
  'p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:cursor-not-allowed cursor-pointer';

/** The row of helpers at the top of the canvas: plan meter, undo/redo, auto-arrange, export, missions and the guide. */
export function BranchingTopBar(props: BranchingTopBarProps) {
  const [guideOpen, setGuideOpen] = useState(false);
  const guideRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!guideOpen) return;
    const onDown = (e: MouseEvent) => {
      if (guideRef.current && !guideRef.current.contains(e.target as Node)) setGuideOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGuideOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [guideOpen]);

  return (
    <div className="absolute top-4 inset-x-0 mx-auto w-fit z-20 pointer-events-none flex justify-center">
      <div
        data-tour="topbar"
        className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 bg-sf-1a1a1a/90 backdrop-blur-2xl border border-white/10 rounded-xl shadow-xl shadow-black/40 text-xs nowheel nopan nodrag"
      >
        {props.leading && (
          <>
            {props.leading}
            <span className="w-px h-4 bg-white/15 mx-1" />
          </>
        )}
        <PlanMeter count={props.nodeCount} limit={props.nodeLimit} planLabel={props.planLabel} onClick={props.onPlanClick} />
        <span className="w-px h-4 bg-white/15 mx-1" />
        <button type="button" onClick={props.onUndo} disabled={!props.canUndo} className={iconButton} title="Undo (Ctrl+Z)" aria-label="Undo">
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={props.onRedo} disabled={!props.canRedo} className={iconButton} title="Redo (Ctrl+Y)" aria-label="Redo">
          <Redo2 className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={props.onAutoArrange} className={iconButton} title="Auto-arrange: tidy the nodes left to right" aria-label="Auto-arrange">
          <LayoutPanelLeft className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={props.onExport} className={iconButton} title="Export this workflow as a file" aria-label="Export workflow as a file">
          <Download className="w-3.5 h-3.5" />
        </button>
        {IMPORT_ENABLED && (
          <button type="button" onClick={props.onImport} className={iconButton} title="Import a workflow from a file" aria-label="Import workflow from a file">
            <Upload className="w-3.5 h-3.5" />
          </button>
        )}
        <span className="w-px h-4 bg-white/15 mx-1" />
        {props.trailing}
        <button
          type="button"
          onClick={props.onToggleMissions}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-amber-200 hover:bg-white/10 transition-colors cursor-pointer"
          title="Missions"
        >
          <Trophy className="w-3.5 h-3.5 text-amber-300" />
          <span className="font-mono">
            {props.missionsDone}/{MISSIONS.length}
          </span>
        </button>

        <div className="relative" ref={guideRef}>
          <button
            type="button"
            onClick={() => setGuideOpen((o) => !o)}
            aria-expanded={guideOpen}
            aria-label="Help and guide"
            className={cn(iconButton, guideOpen && 'bg-white/10 text-white')}
            title="Help and guide"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          {guideOpen && (
            <div className="absolute top-full right-0 mt-2 w-[320px] rounded-2xl border border-white/10 bg-sf-16181d/95 backdrop-blur-2xl shadow-2xl p-3 space-y-3 z-40 text-left">
              <button
                type="button"
                onClick={() => {
                  setGuideOpen(false);
                  props.onShowTour();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-copper-500/10 border border-copper-500/30 text-copper-200 text-xs font-semibold hover:bg-copper-500/15 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Show the tour again
              </button>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-1.5">What each node does</p>
                <ul className="max-h-[240px] overflow-y-auto custom-scrollbar space-y-1.5 pr-1" data-lenis-prevent="true">
                  {ALL_NODE_TYPES.map((type) => NODE_CATALOG[type])
                    .filter((entry) => entry.available)
                    .map((entry) => (
                      <li key={entry.id} className="text-[11px] leading-snug">
                        <span className="text-white font-medium">
                          <span aria-hidden="true">{entry.emoji} </span>
                          {entry.name}
                        </span>
                        <span className="text-gray-400"> — {entry.does}</span>
                      </li>
                    ))}
                </ul>
              </div>
              <div className="text-[11px] text-gray-400 space-y-1 border-t border-white/10 pt-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Shortcuts</p>
                <p><kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px] text-white">Ctrl+Z</kbd> undo · <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px] text-white">Ctrl+Y</kbd> redo</p>
                <p><kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px] text-white">Ctrl+D</kbd> duplicate the selected node</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
