import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { waitUntil } from '@vercel/functions';
import { AiCompletionError, AI_DEFAULT_BUDGET_MS, type AiErrorCode, type TokenUsage } from './ai.js';
import { recordExecutionTrace, isPaidTier } from './security.js';

/**
 * The time by which a route's AI work must be finished, counted from when the request ARRIVED (not from when the AI
 * call starts). Sign-in, rate limits and the quota check run first and, on a cold database, can take several seconds;
 * counting the 50 s budget from the AI call let the whole request run past Vercel's 60 s limit (a non-JSON 504 and a
 * lost quota refund). synthesize already did this; every AI route now shares the rule.
 */
export function aiDeadlineFrom(requestStartedAt: number): number {
  return requestStartedAt + AI_DEFAULT_BUDGET_MS;
}

/**
 * Runs bookkeeping (usage traces) after the answer instead of before it, so the answer never waits on a database
 * write: a slow database can no longer delay, or push past Vercel's 60 s limit, an answer that was already paid for.
 * On Vercel, waitUntil keeps the function alive until the task settles; elsewhere the task simply runs. Never throws.
 */
export function afterResponse(task: Promise<unknown>): void {
  const settled = task.then(
    () => undefined,
    (err: unknown) => {
      console.error('[AI] Background bookkeeping failed:', (err as { message?: string } | null)?.message || err);
    }
  );
  try {
    waitUntil(settled);
  } catch {
    // Not on Vercel's runtime: the task runs anyway
  }
}

/** Maximum input sizes (characters) accepted by the AI endpoints. */
export const INPUT_LIMITS = {
  idea: 4_000,
  answerValue: 1_000,
  answers: 30,
  questionText: 1_000,
  questions: 30,
  currentPrompt: 20_000,
  instruction: 2_000,
  testPrompt: 20_000,
  testSystemPrompt: 10_000,
} as const;

/**
 * Sent next to `truncated: true` in a stream's final event, so a client can tell the user why the end may be missing.
 * A `message` on an event with `done: true` and no `error` / `code` is not read as a failure by the website's clients.
 */
export const TRUNCATED_ANSWER_MESSAGE =
  'The answer reached its length limit, so its end may be missing. Try a shorter request, or ask for less at once.';

/** True for a signed-in, non-guest user on a paid plan (paid users get larger rate limits). One rule for every AI route. */
export function isPaidUser(user: { subscriptionTier?: string | null; isGuest?: boolean } | null | undefined): boolean {
  return Boolean(user && !user.isGuest && isPaidTier(user.subscriptionTier));
}

/** Failures that mean "providers are busy or slow right now", answered with 503 + Retry-After. */
const BUSY_CODES: ReadonlySet<AiErrorCode> = new Set<AiErrorCode>(['AI_ALL_PROVIDERS_FAILED', 'AI_DEADLINE_EXCEEDED']);
/** Matches the circuit-breaker cooldown after a provider 429 (RATE_LIMIT_COOLDOWN_MS in loadBalancer.ts). */
export const AI_BUSY_RETRY_AFTER_SECONDS = 15;

/**
 * Reads one text field from a request body, trying each name in turn (aliases such as "ideaText" / "rawText").
 * Absent, null or '' moves on to the next name; the first real value must be a string. Returns the trimmed text
 * ('' when none was sent) or `{ error }` naming the field. Before, a number or object in these fields reached
 * `.trim()` and crashed the request outside its error handling.
 */
export function readTextField(source: unknown, names: string[]): { value: string } | { error: string } {
  const obj = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
  for (const name of names) {
    const v = obj[name];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v !== 'string') return { error: `${name} must be text` };
    return { value: v.trim() };
  }
  return { value: '' };
}

/** Returns an error message for the first value longer than its limit, or null when all fit. */
export function firstLengthError(checks: Array<[value: unknown, max: number, label: string]>): string | null {
  for (const [value, max, label] of checks) {
    if (typeof value === 'string' && value.length > max) {
      return `${label} must be at most ${max} characters`;
    }
  }
  return null;
}

/** Vercel's own request id when deployed (also shown in Vercel logs), otherwise a fresh UUID. */
export function getRequestId(req: VercelRequest): string {
  const vercelId = req.headers?.['x-vercel-id'];
  const id = Array.isArray(vercelId) ? vercelId[0] : vercelId;
  return id && id.length <= 128 ? id : crypto.randomUUID();
}

/**
 * A signal that fires when the client disconnects before the response was finished (closed tab, cancelled
 * request). Passed to executeAiCompletion so the paid provider call stops instead of running to the end for
 * nobody. `res` 'close' also fires after a normal response, so it only counts when the response never ended.
 */
export function clientAbortSignal(res: VercelResponse): AbortSignal {
  const controller = new AbortController();
  if (typeof res.on === 'function') {
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });
  }
  return controller.signal;
}

/**
 * One JSON log line per AI request, for log search and alerts. Never pass user text or model output here.
 */
export function logAiRequest(entry: {
  route: string;
  requestId: string;
  /** 'aborted' = the client left before the answer was finished (not an error, so error alerts stay quiet) */
  outcome: 'success' | 'error' | 'fallback' | 'aborted';
  latencyMs: number;
  model?: string;
  code?: string;
  stream?: boolean;
  /** The provider stopped at the output limit, so the answer is cut off */
  truncated?: boolean;
  /** Real token counts from the provider (absent when it did not send them) */
  inputTokens?: number;
  outputTokens?: number;
}) {
  const line = JSON.stringify({ type: 'ai_request', ...entry });
  if (entry.outcome === 'success' || entry.outcome === 'aborted') console.log(line);
  else console.error(line);
}

/** The token fields for logAiRequest, only when the provider reported real numbers. */
export function usageFields(usage?: TokenUsage): { inputTokens?: number; outputTokens?: number } {
  return usage ? { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } : {};
}

/** 'error' for a failed call, 'aborted' when the client left. */
export function failureOutcome(err: unknown): 'error' | 'aborted' {
  return (err as { code?: string } | null)?.code === 'AI_CLIENT_ABORTED' ? 'aborted' : 'error';
}

/**
 * Stores a failed AI call as a trace (signed-in users only), so the dashboard's reliability reflects failures
 * and not only successes. The model is the last provider tried. A cancelled request is not a failure.
 */
export async function recordAiFailureTrace(params: {
  userId?: string;
  nodeOrigin: string;
  err: unknown;
  latencyMs: number;
  /** Model to store when the error does not name one (e.g. the call succeeded but its answer was unusable) */
  model?: string;
}): Promise<void> {
  if (!params.userId) return;
  const known = params.err instanceof AiCompletionError ? params.err : null;
  if (known?.code === 'AI_CLIENT_ABORTED') return;
  await recordExecutionTrace({
    userId: params.userId,
    nodeOrigin: params.nodeOrigin,
    modelTarget: known?.model || params.model || 'unavailable',
    tokensUsed: 0,
    latencyMs: params.latencyMs,
    status: 'error',
  });
}

/**
 * Sends a failed AI call to the client without leaking internals.
 * - Before any bytes were sent: JSON `{ error, message, code?, requestId? }`. Status 503 with a
 *   Retry-After header when providers are busy or too slow, otherwise 500.
 * - After an SSE stream has started (headers already sent): an `error` event followed by
 *   `[DONE]`, then the stream is closed, since the status line can no longer change.
 */
export function sendAiFailure(res: VercelResponse, err: unknown, errorTitle: string, requestId?: string) {
  const known = err instanceof AiCompletionError ? err : null;
  const message = known ? known.message : 'Unexpected server error. Please try again.';
  const code = known?.code;

  // The client disconnected: there is nobody to answer. Just close our side.
  if (code === 'AI_CLIENT_ABORTED') {
    try {
      res.end();
    } catch {
      // already closed
    }
    return;
  }
  const busy = Boolean(code && BUSY_CODES.has(code));
  const payload = {
    error: errorTitle,
    message,
    ...(code ? { code } : {}),
    ...(busy ? { retryAfterSeconds: AI_BUSY_RETRY_AFTER_SECONDS } : {}),
    ...(requestId ? { requestId } : {}),
  };

  if (res.headersSent) {
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      res.write('data: [DONE]\n\n');
    } catch {
      // client already disconnected
    }
    res.end();
    return;
  }

  if (busy) {
    res.setHeader('Retry-After', String(AI_BUSY_RETRY_AFTER_SECONDS));
    return res.status(503).json(payload);
  }
  // The input was too big to finish within the output limit: the user can fix it, so not a server error
  if (code === 'AI_OUTPUT_TRUNCATED') return res.status(422).json(payload);
  return res.status(500).json(payload);
}
