import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AiCompletionError, type AiErrorCode } from './ai.js';

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

/** Failures that mean "providers are busy or slow right now", answered with 503 + Retry-After. */
const BUSY_CODES: ReadonlySet<AiErrorCode> = new Set<AiErrorCode>(['AI_ALL_PROVIDERS_FAILED', 'AI_DEADLINE_EXCEEDED']);
/** Matches the circuit-breaker cooldown after a provider 429 (RATE_LIMIT_COOLDOWN_MS in loadBalancer.ts). */
export const AI_BUSY_RETRY_AFTER_SECONDS = 15;

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
 * One JSON log line per AI request, for log search and alerts. Never pass user text or model output here.
 */
export function logAiRequest(entry: {
  route: string;
  requestId: string;
  outcome: 'success' | 'error' | 'fallback';
  latencyMs: number;
  model?: string;
  code?: string;
  stream?: boolean;
}) {
  const line = JSON.stringify({ type: 'ai_request', ...entry });
  if (entry.outcome === 'success') console.log(line);
  else console.error(line);
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
  return res.status(500).json(payload);
}
