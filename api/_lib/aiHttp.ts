import type { VercelResponse } from '@vercel/node';
import { AiCompletionError } from './ai.js';

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

/** Returns an error message for the first value longer than its limit, or null when all fit. */
export function firstLengthError(checks: Array<[value: unknown, max: number, label: string]>): string | null {
  for (const [value, max, label] of checks) {
    if (typeof value === 'string' && value.length > max) {
      return `${label} must be at most ${max} characters`;
    }
  }
  return null;
}

/**
 * Sends a failed AI call to the client without leaking internals.
 * - Before any bytes were sent: JSON `{ error, message, code? }` with status 500.
 * - After an SSE stream has started (headers already sent): an `error` event followed by
 *   `[DONE]`, then the stream is closed, since the status line can no longer change.
 */
export function sendAiFailure(res: VercelResponse, err: unknown, errorTitle: string) {
  const known = err instanceof AiCompletionError ? err : null;
  const message = known ? known.message : 'Unexpected server error. Please try again.';
  const code = known?.code;

  if (res.headersSent) {
    try {
      res.write(`data: ${JSON.stringify({ error: errorTitle, message, ...(code ? { code } : {}) })}\n\n`);
      res.write('data: [DONE]\n\n');
    } catch {
      // client already disconnected
    }
    res.end();
    return;
  }

  return res.status(500).json({ error: errorTitle, message, ...(code ? { code } : {}) });
}
