import type { NodeResult } from '../../lib/workflowEngine';
import { formatDuration } from './runMapping';

const KIND_LABEL: Record<NodeResult['kind'], string> = {
  text: 'TEXT',
  json: 'JSON',
  array: 'LIST',
  number: 'NUMBER',
  boolean: 'YES/NO',
  empty: 'EMPTY',
};

/** Tiny facts about a node's last engine result: what kind of thing came out, how many items, how long, AI calls. */
export function ResultBadges({ result }: { result?: NodeResult }) {
  if (!result || result.skipped || result.error || !result.meta) return null;
  const items = result.kind === 'array' && Array.isArray(result.value) ? result.value.length : result.meta.itemCount;
  return (
    <div className="flex flex-wrap items-center gap-1 text-[9px] font-mono" aria-label="About this result">
      <span className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-gray-300">
        {KIND_LABEL[result.kind]}
        {items !== undefined ? ` · ${items}` : ''}
      </span>
      <span className="px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-gray-400">{formatDuration(result.meta.durationMs)}</span>
      {result.meta.aiCalls > 0 && (
        <span className="px-1.5 py-0.5 rounded border border-copper-500/25 bg-copper-500/10 text-copper-300">
          {result.meta.aiCalls} AI
        </span>
      )}
    </div>
  );
}

/** Short remarks from the engine, e.g. "Only the first 5 items were used". */
export function ResultNotes({ result }: { result?: NodeResult }) {
  if (!result?.notes?.length || result.error) return null;
  return (
    <ul className="space-y-0.5">
      {result.notes.slice(0, 2).map((n, i) => (
        <li key={i} className="text-[10px] text-amber-200/90 leading-snug">
          {n}
        </li>
      ))}
    </ul>
  );
}
