/**
 * Typed client for the Branching v2 routes (BRANCHING_PROMPTS.md 0.6). Every function returns
 * `{ ok: true, data }` or `{ ok: false, code, message }` and never throws, so the page can simply hide a feature
 * whose answer is `FEATURE_NOT_READY` (database migration not applied yet) or `NOT_AVAILABLE` (offline, desktop).
 */
import { getAuthHeaders } from './api';
import type { GraphIssue } from './workflowEngine/types';

export type WorkflowApiResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string; status?: number };

export interface WorkflowGraphStats {
  nodeCount: number;
  aiNodeCount: number;
  planNodeLimit: number | null;
  overLimit: boolean;
  hasCode: boolean;
  nodeTypes: string[];
}

export interface GeneratedWorkflowResult {
  title: string;
  explanation: string;
  nodes: any[];
  edges: any[];
  /** Plain-English remarks, e.g. "Your plan allows 3 steps, so the design was cut to its first 3." */
  notes: string[];
  planNodeLimit: number | null;
}

export interface WorkflowExplanation {
  summary: string;
  steps: Array<{ nodeId: string; text: string }>;
}

export interface WorkflowVersionInfo {
  version: number;
  title: string;
  nodeCount: number;
  createdAt: string;
}

export interface SharedWorkflow {
  title: string;
  nodes: any[];
  edges: any[];
  hasCode: boolean;
  sharedAt: string;
}

export interface WorkflowRunRecord {
  workflowId?: string;
  status: 'success' | 'partial' | 'error' | 'cancelled';
  nodeCount: number;
  aiCalls: number;
  durationMs: number;
  errorCount: number;
  nodeTypes: string[];
}

export interface WorkflowStats {
  totalRuns: number;
  successRuns: number;
  runsToday: number;
  streakDays: number;
  nodeTypesUsed: string[];
  firstRunAt: string | null;
}

async function call<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown; auth?: boolean } = { method: 'GET' }): Promise<WorkflowApiResult<T>> {
  try {
    const headers: Record<string, string> = init.auth === false ? { 'Content-Type': 'application/json' } : ((await getAuthHeaders()) as Record<string, string>);
    const response = await fetch(path, {
      method: init.method,
      headers,
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (response.ok && payload) return { ok: true, data: payload as T };
    if (response.status === 404 && !payload?.code) {
      return { ok: false, code: 'NOT_AVAILABLE', message: 'This feature is not available here.', status: 404 };
    }
    return {
      ok: false,
      code: String(payload?.code || (response.status === 401 ? 'AUTH_REQUIRED' : response.status === 429 ? 'RATE_LIMITED' : 'REQUEST_FAILED')),
      message: String(payload?.message || payload?.error || 'Something went wrong. Please try again.'),
      status: response.status,
    };
  } catch {
    return { ok: false, code: 'NOT_AVAILABLE', message: 'Could not reach Bedrock. Check your connection.' };
  }
}

const q = encodeURIComponent;

export const workflowApi = {
  /** Server check: unknown steps, loops, plan limit. */
  validate: (nodes: any[], edges: any[]) =>
    call<{ issues: Array<Pick<GraphIssue, 'severity' | 'code' | 'nodeId' | 'message'>>; stats: WorkflowGraphStats }>('/api/workflows?action=validate', { method: 'POST', body: { nodes, edges } }),

  /** "Build it for me": one AI call. Never contains Code steps; respects the plan's step limit. */
  generate: (description: string) => call<GeneratedWorkflowResult>('/api/workflows?action=generate', { method: 'POST', body: { description } }),

  /** "Explain this workflow" in plain English: one AI call. */
  explain: (nodes: any[], edges: any[]) => call<WorkflowExplanation>('/api/workflows?action=explain', { method: 'POST', body: { nodes, edges } }),

  /** The last 20 saved versions, newest first. */
  versions: (workflowId: string) => call<{ id: string; versions: WorkflowVersionInfo[] }>(`/api/workflows?action=versions&id=${q(workflowId)}`),

  /** Puts a saved version back (what is there now is kept as a version first). */
  restore: (workflowId: string, version: number) =>
    call<{ id: string; title: string; nodes: any[]; edges: any[]; restoredVersion: number }>('/api/workflows?action=restore', { method: 'POST', body: { id: workflowId, version } }),

  /** Creates (or returns the existing) read-only link. `url` is a path: prefix it with window.location.origin. */
  share: (workflowId: string) => call<{ id: string; token: string; url: string }>('/api/workflows?action=share', { method: 'POST', body: { id: workflowId } }),

  /** Turns the share link off. */
  unshare: (workflowId: string) => call<{ id: string; revoked: boolean }>('/api/workflows?action=share', { method: 'POST', body: { id: workflowId, revoke: true } }),

  /** Opens a shared link (no sign-in needed). Outputs and sample data are not included. */
  // The share token is the public link itself (not a sign-in secret); built with URLSearchParams so it is encoded
  shared: (token: string) =>
    call<SharedWorkflow>(`/api/workflows?${new URLSearchParams({ action: 'shared', token }).toString()}`, { method: 'GET', auth: false }),

  /** Records a finished Run all (counts only; no prompt text or outputs). */
  saveRun: (run: WorkflowRunRecord) => call<{ id: string }>('/api/workflows?action=runs', { method: 'POST', body: run }),

  /** Totals, today's runs, streak (India time) and step types used, for badges. */
  stats: () => call<WorkflowStats>('/api/workflows?action=stats'),
};

/** True when the answer means "hide this feature for now" rather than "show an error". */
export function isFeatureUnavailable(result: WorkflowApiResult<unknown>): boolean {
  return !result.ok && (result.code === 'FEATURE_NOT_READY' || result.code === 'NOT_AVAILABLE');
}
