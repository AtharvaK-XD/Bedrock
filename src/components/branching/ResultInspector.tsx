import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, ChevronRight, Copy, Download, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { showToast } from '../../lib/notify';
import { buildDownload, describeKind, parseOutput, prettyJson, toTable } from './resultFormat';

type Tab = 'text' | 'json' | 'table';
const MAX_TREE_CHILDREN = 200;

function JsonTree({ value, name, depth = 0 }: { value: unknown; name?: string; depth?: number }) {
  const label = name !== undefined ? <span className="text-sky-300">{name}: </span> : null;
  if (value === null || typeof value !== 'object') {
    const display = typeof value === 'string' ? `"${value}"` : String(value);
    const color = typeof value === 'string' ? 'text-emerald-300' : typeof value === 'number' ? 'text-amber-300' : 'text-purple-300';
    return (
      <div className="pl-4 break-words">
        {label}
        <span className={color}>{display}</span>
      </div>
    );
  }
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value as Record<string, unknown>);
  const open = depth < 2;
  return (
    <details open={open} className="pl-2 group/details">
      <summary className="cursor-pointer list-none flex items-center gap-1 text-gray-300 hover:text-white select-none">
        <ChevronRight className="w-3 h-3 group-open/details:hidden" />
        <ChevronDown className="w-3 h-3 hidden group-open/details:block" />
        {label}
        <span className="text-gray-500">{Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`}</span>
      </summary>
      <div className="border-l border-white/10 ml-1.5">
        {entries.slice(0, MAX_TREE_CHILDREN).map(([k, v]) => (
          <JsonTree key={k} name={k} value={v} depth={depth + 1} />
        ))}
        {entries.length > MAX_TREE_CHILDREN && <div className="pl-4 text-gray-500">... {entries.length - MAX_TREE_CHILDREN} more</div>}
      </div>
    </details>
  );
}

interface ResultInspectorProps {
  open: boolean;
  title: string;
  /** What the node produced. Today this is `data.output`; the engine's `data.result.text` is the same string. */
  text: string;
  onClose: () => void;
}

/** A drawer for reading, copying and downloading what a node produced. */
export function ResultInspector({ open, title, text, onClose }: ResultInspectorProps) {
  const parsed = useMemo(() => parseOutput(text), [text]);
  const table = useMemo(() => (parsed.kind === 'array' ? toTable(parsed.value) : null), [parsed]);
  const hasJson = parsed.kind === 'json' || parsed.kind === 'array';
  const [tab, setTab] = useState<Tab>('text');
  const [copied, setCopied] = useState(false);

  // Open on the most useful tab for this output
  useEffect(() => {
    if (!open) return;
    setTab(table ? 'table' : hasJson ? 'json' : 'text');
  }, [open, table, hasJson]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tab === 'json' && hasJson ? prettyJson(parsed.value) : text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast("Couldn't copy. Select the text and copy it by hand.", 'warning');
    }
  };

  const download = (as: 'txt' | 'json') => {
    const file = buildDownload(text, as, title);
    const url = URL.createObjectURL(new Blob([file.content], { type: file.mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { id: Tab; label: string; enabled: boolean }[] = [
    { id: 'text', label: 'Text', enabled: true },
    { id: 'json', label: 'JSON', enabled: hasJson },
    { id: 'table', label: 'Table', enabled: Boolean(table) },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="dialog"
          aria-label={`Result of ${title}`}
          initial={{ x: 460, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 460, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 32 }}
          onWheel={(e) => e.stopPropagation()}
          className="absolute top-4 right-4 bottom-4 w-[440px] max-w-[calc(100vw-32px)] z-40 flex flex-col rounded-2xl border border-white/10 bg-sf-16181d/95 backdrop-blur-3xl shadow-2xl overflow-hidden nowheel nopan nodrag"
        >
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5 shrink-0">
            <div className="min-w-0">
              <h3 className="font-display text-sm text-white truncate">{title || 'Result'}</h3>
              <p className="text-[10px] font-mono text-gray-400 mt-0.5">
                {describeKind(parsed)} · {text.length.toLocaleString()} characters
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close result viewer" className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 px-4 pt-3 shrink-0">
            <div className="flex items-center bg-black/40 border border-white/10 rounded-lg p-0.5" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  disabled={!t.enabled}
                  onClick={() => setTab(t.id)}
                  title={t.enabled ? undefined : t.id === 'json' ? 'This output is not JSON' : 'This output is not a list of objects'}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs transition-colors',
                    tab === t.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-200',
                    !t.enabled && 'opacity-30 cursor-not-allowed hover:text-gray-400'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={copy} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-white/10 text-gray-200 hover:bg-white/10 cursor-pointer">
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button type="button" onClick={() => download('txt')} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-white/10 text-gray-200 hover:bg-white/10 cursor-pointer" title="Download as a text file">
                <Download className="w-3 h-3" /> .txt
              </button>
              <button type="button" onClick={() => download('json')} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-white/10 text-gray-200 hover:bg-white/10 cursor-pointer" title="Download as a JSON file">
                <Download className="w-3 h-3" /> .json
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar p-4">
            {parsed.kind === 'empty' && <p className="text-xs text-gray-500">This node has not produced anything yet. Run it first.</p>}
            {parsed.kind !== 'empty' && tab === 'text' && <pre className="whitespace-pre-wrap break-words text-[12px] leading-relaxed font-mono text-gray-200 select-text">{text}</pre>}
            {tab === 'json' && hasJson && (
              <div className="text-[12px] font-mono leading-relaxed select-text">
                <JsonTree value={parsed.value} />
              </div>
            )}
            {tab === 'table' && table && (
              <table className="w-full text-[11px] font-mono border-collapse select-text">
                <thead>
                  <tr>
                    {table.columns.map((c) => (
                      <th key={c} className="text-left px-2 py-1.5 border-b border-white/15 text-gray-300 font-semibold sticky top-0 bg-sf-16181d">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, i) => (
                    <tr key={i} className="odd:bg-white/[0.03]">
                      {row.map((cell, j) => (
                        <td key={j} className="px-2 py-1.5 border-b border-white/5 text-gray-200 align-top break-words max-w-[180px]">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
