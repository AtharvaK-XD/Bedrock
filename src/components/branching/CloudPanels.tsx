import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, BookOpenText, Check, Copy, Flame, History, Link2, Loader2, Medal, RotateCcw, Share2, Wand2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { isFeatureUnavailable, workflowApi, type WorkflowExplanation, type WorkflowStats, type WorkflowVersionInfo } from '../../lib/workflowApi';
import { BUILD_IDEAS, badgesFor, shareLinkFor, toCanvas, type CanvasWorkflow } from './cloudHelpers';
import { sanitizeWorkflow } from '../../lib/workflowEngine/importGuard';
import { TemplateThumb } from './TemplateThumb';

const panel = 'rounded-2xl border border-white/10 bg-sf-16181d/95 backdrop-blur-2xl shadow-2xl nowheel nopan nodrag';

function Shell({ open, onClose, title, icon, children, wide }: { open: boolean; onClose: () => void; title: string; icon: ReactNode; children: ReactNode; wide?: boolean }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key={title}
          className="absolute inset-0 z-[55] flex items-start justify-center bg-black/40 p-4 pt-20 nowheel nopan nodrag"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduce ? false : { y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className={cn(panel, 'w-full p-4 space-y-3 max-h-[78vh] overflow-y-auto custom-scrollbar', wide ? 'max-w-[560px]' : 'max-w-[440px]')}
            data-lenis-prevent="true"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                {icon}
                {title}
              </h3>
              <button type="button" onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10" aria-label={`Close ${title}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p role="alert" className="text-[12px] text-rose-200 bg-rose-500/10 border border-rose-500/25 rounded-xl px-3 py-2 flex items-start gap-1.5">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      {text}
    </p>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Build it for me

export function BuildForMeDialog({ open, onClose, onUse, onUnavailable }: { open: boolean; onClose: () => void; onUse: (wf: CanvasWorkflow) => void; onUnavailable: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<(CanvasWorkflow & { explanation: string; notes: string[] }) | null>(null);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const build = async () => {
    const description = text.trim();
    if (description.length < 8) {
      setError('Say a little more: one sentence about what you want.');
      return;
    }
    setBusy(true);
    setError(null);
    setDraft(null);
    const res = await workflowApi.generate(description);
    setBusy(false);
    if (!res.ok) {
      if (isFeatureUnavailable(res)) {
        onUnavailable();
        onClose();
        return;
      }
      setError(res.message);
      return;
    }
    const clean = sanitizeWorkflow({ nodes: res.data.nodes, edges: res.data.edges }, { source: 'ai' });
    if (!clean.ok || clean.nodes.length === 0) {
      setError('The AI did not come back with a usable workflow. Try saying it another way.');
      return;
    }
    const canvas = toCanvas(clean.nodes, clean.edges);
    setDraft({ title: res.data.title || 'My workflow', ...canvas, explanation: res.data.explanation, notes: [...(res.data.notes ?? []), ...clean.warnings] });
  };

  return (
    <Shell open={open} onClose={onClose} title="Build it for me" icon={<Wand2 className="w-4 h-4 text-copper-300" />} wide>
      <p className="text-[12px] text-gray-400 leading-snug">Describe what you want in a sentence. Bedrock drafts the steps and wires; you can change anything after.</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={600}
        placeholder="e.g. Read my notes, pull out the tasks, and write a friendly summary email"
        className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-copper-500/50 resize-y custom-scrollbar"
        aria-label="Describe your workflow"
      />
      <div className="flex flex-wrap gap-1.5">
        {BUILD_IDEAS.map((idea) => (
          <button key={idea} type="button" onClick={() => setText(idea)} className="px-2 py-1 rounded-lg text-[11px] text-gray-300 border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:text-white text-left">
            {idea}
          </button>
        ))}
      </div>
      {error && <ErrorLine text={error} />}
      {draft && (
        <div className="rounded-xl border border-copper-500/25 bg-copper-500/[0.06] p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white truncate">{draft.title}</span>
            <span className="text-[10px] font-mono text-gray-400 shrink-0">{draft.nodes.length} steps</span>
          </div>
          <TemplateThumb nodes={draft.nodes} edges={draft.edges} className="w-full h-20 rounded-lg bg-black/30 border border-white/5" />
          {draft.explanation && <p className="text-[12px] text-gray-300 leading-snug">{draft.explanation}</p>}
          {draft.notes.length > 0 && (
            <ul className="space-y-0.5">
              {draft.notes.slice(0, 4).map((n, i) => (
                <li key={i} className="text-[11px] text-amber-200/90 leading-snug">
                  {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        {draft ? (
          <>
            <button type="button" onClick={build} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-white/10 disabled:opacity-50">
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                onUse({ title: draft.title, nodes: draft.nodes, edges: draft.edges });
                setDraft(null);
                setText('');
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-copper-500/20 text-copper-100 border border-copper-500/40 hover:bg-copper-500/30"
            >
              Use this
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={build}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-copper-500/20 text-copper-100 border border-copper-500/40 hover:bg-copper-500/30 disabled:opacity-60 flex items-center gap-1.5"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            {busy ? 'Drafting…' : 'Build it'}
          </button>
        )}
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Explain this workflow

export function ExplainDialog({ open, onClose, workflow, onFocus, titleOf, onUnavailable }: {
  open: boolean;
  onClose: () => void;
  workflow: CanvasWorkflow;
  onFocus: (nodeId: string) => void;
  titleOf: (nodeId: string) => string | undefined;
  onUnavailable: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WorkflowExplanation | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setBusy(true);
    setError(null);
    setData(null);
    workflowApi.explain(workflow.nodes, workflow.edges).then((res) => {
      if (!alive) return;
      setBusy(false);
      if (res.ok) setData(res.data);
      else if (isFeatureUnavailable(res)) {
        onUnavailable();
        onClose();
      } else setError(res.message);
    });
    return () => {
      alive = false;
    };
    // Explains the canvas as it was when the window opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Shell open={open} onClose={onClose} title="What this workflow does" icon={<BookOpenText className="w-4 h-4 text-copper-300" />}>
      {busy && (
        <p className="text-[12px] text-gray-400 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading your workflow…
        </p>
      )}
      {error && <ErrorLine text={error} />}
      {data && (
        <>
          <p className="text-[13px] text-gray-100 leading-relaxed">{data.summary}</p>
          {data.steps.length > 0 && (
            <ol className="space-y-1.5">
              {data.steps.map((s, i) => (
                <li key={`${s.nodeId}-${i}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onFocus(s.nodeId);
                      onClose();
                    }}
                    className="w-full text-left flex gap-2.5 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] px-2.5 py-2"
                  >
                    <span className="w-5 h-5 rounded-full bg-copper-500/15 border border-copper-500/30 text-[10px] font-mono text-copper-200 flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="min-w-0">
                      {titleOf(s.nodeId) && <span className="block text-[11px] font-mono text-gray-400 truncate">{titleOf(s.nodeId)}</span>}
                      <span className="block text-[12px] text-gray-200 leading-snug">{s.text}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Version history

export function HistoryDialog({ open, onClose, workflowId, onRestored, onUnavailable }: {
  open: boolean;
  onClose: () => void;
  workflowId?: string;
  onRestored: (wf: CanvasWorkflow) => void;
  onUnavailable: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<WorkflowVersionInfo[] | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !workflowId) return;
    let alive = true;
    setBusy(true);
    setError(null);
    setVersions(null);
    workflowApi.versions(workflowId).then((res) => {
      if (!alive) return;
      setBusy(false);
      if (res.ok) setVersions(res.data.versions);
      else if (isFeatureUnavailable(res)) {
        onUnavailable();
        onClose();
      } else setError(res.message);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workflowId]);

  const restore = async (version: number) => {
    if (!workflowId) return;
    if (!window.confirm(`Put version ${version} back? What you have now is kept as a version first.`)) return;
    setRestoring(version);
    const res = await workflowApi.restore(workflowId, version);
    setRestoring(null);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    const clean = sanitizeWorkflow({ nodes: res.data.nodes, edges: res.data.edges }, { source: 'file' });
    if (!clean.ok) {
      setError('That version could not be opened.');
      return;
    }
    onRestored({ title: res.data.title, ...toCanvas(clean.nodes, clean.edges) });
    onClose();
  };

  return (
    <Shell open={open} onClose={onClose} title="Version history" icon={<History className="w-4 h-4 text-copper-300" />}>
      {!workflowId && <p className="text-[12px] text-gray-400">Save this workflow first. Every save after that keeps a version you can go back to.</p>}
      {busy && (
        <p className="text-[12px] text-gray-400 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading versions…
        </p>
      )}
      {error && <ErrorLine text={error} />}
      {versions && versions.length === 0 && <p className="text-[12px] text-gray-400">No earlier versions yet. Save again after a change and one appears here.</p>}
      {versions && versions.length > 0 && (
        <ul className="space-y-1.5">
          {versions.map((v) => (
            <li key={v.version} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
              <span className="min-w-0">
                <span className="block text-[12px] text-white truncate">
                  v{v.version} · {v.title}
                </span>
                <span className="block text-[10px] font-mono text-gray-500">
                  {v.nodeCount} steps · {new Date(v.createdAt).toLocaleString()}
                </span>
              </span>
              <button
                type="button"
                onClick={() => restore(v.version)}
                disabled={restoring !== null}
                className="px-2 py-1 rounded-lg text-[11px] text-copper-200 border border-copper-500/30 bg-copper-500/10 hover:bg-copper-500/20 disabled:opacity-50 flex items-center gap-1 shrink-0"
              >
                {restoring === v.version ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Share a read-only link

export function ShareDialog({ open, onClose, workflowId, onUnavailable }: { open: boolean; onClose: () => void; workflowId?: string; onUnavailable: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setLink(null);
      setError(null);
      setCopied(false);
    }
  }, [open]);

  const create = async () => {
    if (!workflowId) return;
    setBusy(true);
    setError(null);
    const res = await workflowApi.share(workflowId);
    setBusy(false);
    if (res.ok) setLink(shareLinkFor(res.data.token, window.location.origin));
    else if (isFeatureUnavailable(res)) {
      onUnavailable();
      onClose();
    } else setError(res.message);
  };

  const revoke = async () => {
    if (!workflowId) return;
    setBusy(true);
    const res = await workflowApi.unshare(workflowId);
    setBusy(false);
    if (res.ok) setLink(null);
    else setError(res.message);
  };

  return (
    <Shell open={open} onClose={onClose} title="Share a copy" icon={<Share2 className="w-4 h-4 text-copper-300" />}>
      {!workflowId ? (
        <p className="text-[12px] text-gray-400">Save this workflow first, then you can share a read-only link to it.</p>
      ) : (
        <>
          <p className="text-[12px] text-gray-400 leading-snug">Anyone with the link can see the steps and copy them into their own workspace. Your results and sample data are not shared.</p>
          {error && <ErrorLine text={error} />}
          {link ? (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                <Link2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="flex-1 bg-transparent text-[12px] font-mono text-gray-200 focus:outline-none min-w-0" aria-label="Share link" />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(link).catch(() => undefined);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  }}
                  className="text-gray-300 hover:text-white shrink-0"
                  aria-label="Copy link"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-gray-500">The person needs a Bedrock account to open it.</span>
                <button type="button" onClick={revoke} disabled={busy} className="text-[11px] text-rose-300 hover:text-rose-200 disabled:opacity-50">
                  Turn the link off
                </button>
              </div>
            </>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={create}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-copper-500/20 text-copper-100 border border-copper-500/40 hover:bg-copper-500/30 disabled:opacity-60 flex items-center gap-1.5"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                Create link
              </button>
            </div>
          )}
        </>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Opening a shared link

export function SharedWorkflowDialog({ token, onClose, onCopy }: { token: string | null; onClose: () => void; onCopy: (wf: CanvasWorkflow) => void }) {
  const [state, setState] = useState<{ busy: boolean; error: string | null; wf: (CanvasWorkflow & { hasCode: boolean; warnings: string[] }) | null }>({ busy: false, error: null, wf: null });

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setState({ busy: true, error: null, wf: null });
    workflowApi.shared(token).then((res) => {
      if (!alive) return;
      if (!res.ok) {
        setState({ busy: false, error: res.code === 'NOT_FOUND' || res.status === 404 ? 'This link does not work any more. Ask for a new one.' : res.message, wf: null });
        return;
      }
      const clean = sanitizeWorkflow({ nodes: res.data.nodes, edges: res.data.edges }, { source: 'share' });
      if (!clean.ok) {
        setState({ busy: false, error: 'This shared workflow could not be opened.', wf: null });
        return;
      }
      setState({ busy: false, error: null, wf: { title: res.data.title, ...toCanvas(clean.nodes, clean.edges), hasCode: clean.hasCode, warnings: clean.warnings } });
    });
    return () => {
      alive = false;
    };
  }, [token]);

  return (
    <Shell open={Boolean(token)} onClose={onClose} title="Shared workflow" icon={<Share2 className="w-4 h-4 text-copper-300" />}>
      {state.busy && (
        <p className="text-[12px] text-gray-400 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Opening…
        </p>
      )}
      {state.error && <ErrorLine text={state.error} />}
      {state.wf && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white truncate">{state.wf.title}</span>
            <span className="text-[10px] font-mono text-gray-400 shrink-0">{state.wf.nodes.length} steps</span>
          </div>
          <TemplateThumb nodes={state.wf.nodes} edges={state.wf.edges} className="w-full h-24 rounded-lg bg-black/30 border border-white/5" />
          {state.wf.hasCode && (
            <p className="text-[12px] text-amber-100 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-300" />
              This workflow has a Code step written by someone else. Read it before you run it; Bedrock asks you first.
            </p>
          )}
          {/* The code warning is already shown above */}
          {state.wf.warnings.filter((w) => !(state.wf!.hasCode && /code/i.test(w))).length > 0 && (
            <p className="text-[11px] text-gray-400 leading-snug">{state.wf.warnings.filter((w) => !(state.wf!.hasCode && /code/i.test(w))).slice(0, 3).join(' ')}</p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-white/10">
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onCopy({ title: `${state.wf!.title} (copy)`, nodes: state.wf!.nodes, edges: state.wf!.edges });
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-copper-500/20 text-copper-100 border border-copper-500/40 hover:bg-copper-500/30"
            >
              Copy to my workspace
            </button>
          </div>
        </>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Buttons in the top bar (each one hides itself once the server says the feature is not switched on)

export type CloudFeature = 'build' | 'explain' | 'history' | 'share';

const CLOUD_BUTTONS: { id: CloudFeature; label: string; Icon: typeof Wand2 }[] = [
  { id: 'build', label: 'Build it for me (AI)', Icon: Wand2 },
  { id: 'explain', label: 'Explain this workflow in plain English', Icon: BookOpenText },
  { id: 'history', label: 'Version history', Icon: History },
  { id: 'share', label: 'Share a read-only link', Icon: Share2 },
];

export function CloudButtons({ show, onOpen }: { show: Record<CloudFeature, boolean>; onOpen: (f: CloudFeature) => void }) {
  const visible = CLOUD_BUTTONS.filter((b) => show[b.id]);
  if (visible.length === 0) return null;
  return (
    <>
      {visible.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onOpen(id)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors active:scale-95 cursor-pointer"
          title={label}
          aria-label={label}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
      <span className="w-px h-4 bg-white/15 mx-1" />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Badges and streak (inside the Missions panel)

export function StatsStrip({ stats }: { stats: WorkflowStats }) {
  const badges = badgesFor(stats);
  return (
    <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
      <div className="flex items-center gap-3 text-[11px] text-gray-300">
        <span className="flex items-center gap-1">
          <Flame className={cn('w-3.5 h-3.5', stats.streakDays > 0 ? 'text-orange-400' : 'text-gray-500')} />
          {stats.streakDays}-day streak
        </span>
        <span className="text-gray-500">·</span>
        <span>{stats.totalRuns} runs</span>
        <span className="text-gray-500">·</span>
        <span>{stats.runsToday} today</span>
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Badges">
        {badges.map((b) => (
          <li
            key={b.id}
            title={b.earned ? 'Earned' : b.hint}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono border',
              b.earned ? 'border-amber-400/40 bg-amber-500/10 text-amber-200' : 'border-white/10 bg-white/[0.02] text-gray-500'
            )}
          >
            <Medal className="w-3 h-3" />
            {b.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
