import type { EngineEvent, GraphIssue, NodeResult, RunSummary } from '../../lib/workflowEngine';
import type { NodeRunState } from './runState';

/**
 * How an engine event changes a node's saved data (BRANCHING_PROMPTS.md 0.4 "notes for Frontend"):
 * `output` is always `result.text`, `result` is the full envelope, and the two old fields the page already
 * reads (`conditionResult`, `evalScore`) are kept in step so the original Run buttons still agree.
 */
export function patchForEvent(e: EngineEvent, nodeType: string | undefined, currentOutput?: string): Record<string, unknown> | null {
  switch (e.type) {
    case 'node-start':
      return { status: 'running', output: undefined, result: undefined };
    case 'node-token':
      return { output: (currentOutput ?? '') + e.token };
    case 'node-done':
      return donePatch(e.result, nodeType);
    case 'node-skipped':
      return { status: 'idle', output: e.result.text, result: e.result };
    case 'node-error':
      return { status: 'error', output: e.result.error?.message || e.result.text || 'This step failed.', result: e.result };
    default:
      return null;
  }
}

function donePatch(r: NodeResult, nodeType: string | undefined): Record<string, unknown> {
  const patch: Record<string, unknown> = { status: 'success', output: r.text, result: r };
  if (nodeType === 'condition') patch.conditionResult = r.branch === 'true';
  if (nodeType === 'evaluation') {
    patch.evalScore = r.score;
    const m = r.text.match(/Feedback:\s*([\s\S]+)/i);
    patch.evalCritique = m ? m[1].trim() : undefined;
  }
  return patch;
}

/** The ring a node shows during a run. */
export function visualForEvent(e: EngineEvent): NodeRunState | null {
  switch (e.type) {
    case 'node-start':
      return 'running';
    case 'node-done':
      return 'done';
    case 'node-skipped':
      return 'skipped';
    case 'node-error':
      return 'error';
    default:
      return null;
  }
}

/** One plain sentence about a finished run, for the toast. */
export function describeRun(summary: RunSummary): { text: string; tone: 'success' | 'info' | 'error' } {
  const ran = summary.order.map((id) => summary.results[id]).filter(Boolean);
  const worked = ran.filter((r) => !r.skipped && !r.error).length;
  const failed = ran.filter((r) => r.error && r.error.code !== 'CANCELLED').length;
  const skipped = ran.filter((r) => r.skipped).length;
  const secs = summary.durationMs < 1000 ? '<1s' : `${(summary.durationMs / 1000).toFixed(1)}s`;
  const ai = summary.aiCalls === 1 ? '1 AI call' : `${summary.aiCalls} AI calls`;
  const skippedText = skipped ? `, ${skipped} skipped by a decision` : '';
  if (summary.status === 'cancelled') return { text: `Stopped. ${worked} ${worked === 1 ? 'step' : 'steps'} finished first.`, tone: 'info' };
  if (summary.status === 'success') return { text: `Done: ${worked} ${worked === 1 ? 'step' : 'steps'} in ${secs}, ${ai}${skippedText}.`, tone: 'success' };
  if (summary.status === 'partial') return { text: `${worked} ${worked === 1 ? 'step' : 'steps'} worked, ${failed} ${failed === 1 ? 'needs' : 'need'} a fix (marked red)${skippedText}.`, tone: 'error' };
  return { text: failed ? `The run failed: ${failed} ${failed === 1 ? 'step needs' : 'steps need'} a fix (marked red).` : 'Nothing could run. Check the Pipeline doctor.', tone: 'error' };
}

/** What step-by-step mode says after each step. */
export function explainStep(result: NodeResult | undefined, title: string): string {
  if (!result) return `${title}: nothing happened.`;
  if (result.error) return `${title} failed: ${result.error.message}${result.error.hint ? ` ${result.error.hint}` : ''}`;
  if (result.skipped) return `${title} was skipped: ${result.text === '[Skipped: an earlier step failed]' ? 'an earlier step failed.' : 'the path into it was turned off by a decision.'}`;
  if (result.reason) return `${title}: ${result.reason}`;
  const notes = result.notes?.length ? ` ${result.notes.join(' ')}` : '';
  const what =
    result.kind === 'array'
      ? `gave a list of ${Array.isArray(result.value) ? result.value.length : result.meta.itemCount ?? 0} items`
      : result.kind === 'json'
        ? 'gave JSON data'
        : result.kind === 'number'
          ? `gave the number ${String(result.value)}`
          : result.kind === 'empty'
            ? 'gave an empty result'
            : `wrote ${result.text.length} characters`;
  return `${title} ${what}${result.meta.aiCalls ? ` using ${result.meta.aiCalls} AI ${result.meta.aiCalls === 1 ? 'call' : 'calls'}` : ''}.${notes}`;
}

const SEVERITY_ORDER: Record<GraphIssue['severity'], number> = { error: 0, warning: 1, tip: 2 };

export function sortIssues(issues: GraphIssue[]): GraphIssue[] {
  return [...issues].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}
