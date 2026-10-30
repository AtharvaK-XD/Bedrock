import type { VercelResponse } from '@vercel/node';

/** Size and count limits for data saved through the prompts, workflows, traces and profile routes. */
export const DATA_LIMITS = {
  id: 200,
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

/** Postgres error code for a unique constraint violation. */
export const PG_UNIQUE_VIOLATION = '23505';

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
