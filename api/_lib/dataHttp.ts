import type { VercelResponse } from '@vercel/node';

/** Size and count limits for data saved through the prompts, workflows, traces and profile routes. */
export const DATA_LIMITS = {
  // Matches the database's own id checks (migration 0003: char_length(id) <= 100)
  id: 100,
  // Prompts
  promptTitle: 300,
  promptSnippet: 1_000,
  promptContent: 50_000,
  promptTags: 20,
  promptTag: 60,
  targetType: 100,
  promptsPerUser: 2_000,
  // Workflows (nodes + edges, serialized)
  workflowTitle: 300,
  workflowJsonChars: 500_000,
  workflowsPerUser: 200,
  // Traces
  traceLabel: 200,
  traceTokensMax: 10_000_000,
  traceLatencyMsMax: 600_000,
  // Profile
  profileName: 100,
  profileUsername: 50,
  profileBio: 1_000,
  profileShortText: 100,
  profileLink: 300,
} as const;

/** Paging for the list routes (GET /api/prompts, GET /api/workflows). */
export const LIST_PAGE = { defaultLimit: 50, maxLimit: 100 } as const;

export interface ListCursor {
  /** updated_at of the last row of the previous page, as text from the database (full precision) */
  ts: string;
  id: string;
}

export type ListQuery =
  | { ok: false; error: string }
  | {
      ok: true;
      /** One item by id, with all its content */
      id: string | null;
      /** limit or cursor was sent: answer as { items, nextCursor }. Otherwise the whole list as a plain array (as before). */
      paged: boolean;
      /** Leave out the big fields (prompt text, workflow nodes and edges) */
      summary: boolean;
      limit: number;
      after: ListCursor | null;
    };

// "2026-11-02 05:00:00.123456": what Postgres prints for a timestamp
const CURSOR_TS_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?$/;

/** An opaque token for "continue after this row". */
export function encodeCursor(ts: string, id: string): string {
  return Buffer.from(JSON.stringify([ts, id]), 'utf8').toString('base64url');
}

/** Reads a token made by encodeCursor; null for anything else (never throws). */
export function decodeCursor(value: unknown): ListCursor | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 400) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [ts, id] = parsed;
    if (typeof ts !== 'string' || !CURSOR_TS_RE.test(ts)) return null;
    if (typeof id !== 'string' || id.length === 0 || id.length > DATA_LIMITS.id) return null;
    return { ts, id };
  } catch {
    return null;
  }
}

const firstValue = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);

/**
 * Reads ?id= ?limit= ?cursor= ?summary= of a list route. With none of id / limit / cursor the route answers
 * exactly as it always did (the whole list), so existing clients keep working.
 */
export function parseListQuery(query: Record<string, unknown> | undefined): ListQuery {
  const q = query ?? {};
  const summary = ['1', 'true'].includes(String(firstValue(q.summary) ?? ''));

  const id = firstValue(q.id);
  if (id !== undefined && id !== '') {
    if (typeof id !== 'string' || id.length > DATA_LIMITS.id) return { ok: false, error: 'id is not valid' };
    return { ok: true, id, paged: false, summary, limit: 1, after: null };
  }

  const rawLimit = firstValue(q.limit);
  const rawCursor = firstValue(q.cursor);
  const hasLimit = rawLimit !== undefined && rawLimit !== '';
  const hasCursor = rawCursor !== undefined && rawCursor !== '';
  if (!hasLimit && !hasCursor) return { ok: true, id: null, paged: false, summary, limit: 0, after: null };

  let limit: number = LIST_PAGE.defaultLimit;
  if (hasLimit) {
    if (typeof rawLimit !== 'string' || !/^\d{1,6}$/.test(rawLimit) || Number(rawLimit) < 1) {
      return { ok: false, error: `limit must be a whole number from 1 to ${LIST_PAGE.maxLimit}` };
    }
    limit = Math.min(Number(rawLimit), LIST_PAGE.maxLimit);
  }

  let after: ListCursor | null = null;
  if (hasCursor) {
    after = decodeCursor(rawCursor);
    if (!after) return { ok: false, error: 'cursor is not valid' };
  }
  return { ok: true, id: null, paged: true, summary, limit, after };
}

/** Postgres error code for a unique constraint violation. */
export const PG_UNIQUE_VIOLATION = '23505';

/** Postgres error code for a CHECK constraint, also raised by the per-user row cap trigger (migration 0003). */
export const PG_CHECK_VIOLATION = '23514';

/**
 * Classifies a database refusal from the migration 0003 limits: 'row_limit' for the per-user row cap
 * trigger (ROW_LIMIT_EXCEEDED), 'too_large' for a size CHECK, null for any other error.
 */
export function dbLimitKind(err: unknown): 'row_limit' | 'too_large' | null {
  const e = err as { code?: unknown; message?: unknown } | null;
  if (e?.code !== PG_CHECK_VIOLATION) return null;
  return String(e.message ?? '').includes('ROW_LIMIT_EXCEEDED') ? 'row_limit' : 'too_large';
}

/**
 * True when the database refused a usage record because the account already wrote the daily maximum
 * (migration 0015: error 23514 with the text DAILY_TRACE_LIMIT).
 */
export function isDailyTraceLimit(err: unknown): boolean {
  const e = err as { code?: unknown; message?: unknown } | null;
  return e?.code === PG_CHECK_VIOLATION && String(e.message ?? '').includes('DAILY_TRACE_LIMIT');
}

/**
 * Sends a 500 for a failed database call. The driver's error text (table and column names,
 * constraint details) is logged server-side only and never returned to the client.
 */
export function sendDbFailure(res: VercelResponse, logTag: string, errorTitle: string, err: unknown) {
  console.error(logTag, err);
  return res.status(500).json({ error: errorTitle, message: 'Something went wrong on our side. Please try again.' });
}

/**
 * Validates optional text fields: absent, null or '' is fine; anything else must be a string
 * no longer than its limit. Returns the first error message, or null when all fields are valid.
 */
export function firstFieldError(checks: Array<[value: unknown, max: number, label: string]>): string | null {
  for (const [value, max, label] of checks) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value !== 'string') return `${label} must be a string`;
    if (value.length > max) return `${label} must be at most ${max} characters`;
  }
  return null;
}

/** Cuts a display-only string (title, snippet, label) to `max` characters; non-strings become ''. */
export function clampText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/** Whole number clamped to [0, max]; anything unparsable becomes 0. */
export function clampCount(value: unknown, max: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? '0'), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), max);
}

/**
 * True for links a browser would run or load as code when used as an href
 * (`javascript:`, `data:`, `vbscript:`, `file:`), including obfuscated forms like `java\tscript:`.
 */
export function isUnsafeLink(value: string): boolean {
  // Browsers ignore control characters and spaces inside a scheme, so drop them before comparing
  const normalized = Array.from(value)
    .filter((ch) => ch.charCodeAt(0) > 0x20)
    .join('')
    .toLowerCase();
  return /^(javascript|data|vbscript|file):/.test(normalized);
}
