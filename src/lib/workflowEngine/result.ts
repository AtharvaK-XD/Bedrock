import type { NodeResult, ResultKind, WorkflowNode } from './types';
import { parseJsonSafe } from './jsonPath';

/** Decides what kind of output a piece of text is (see BRANCHING_PROMPTS.md 0.4). */
export function detectKind(text: string): { kind: ResultKind; value?: unknown } {
  if (!text || !text.trim()) return { kind: 'empty' };
  const parsed = parseJsonSafe(text);
  if (parsed.ok) {
    const v = parsed.value;
    if (Array.isArray(v)) return { kind: 'array', value: v };
    if (v !== null && typeof v === 'object') return { kind: 'json', value: v };
    if (typeof v === 'number' && Number.isFinite(v)) return { kind: 'number', value: v };
    if (typeof v === 'boolean') return { kind: 'boolean', value: v };
  }
  return { kind: 'text' };
}

export interface ResultTiming {
  startedAt: string;
  startMs: number;
  aiCalls: number;
  model?: string;
}

export function startTiming(): ResultTiming {
  return { startedAt: new Date().toISOString(), startMs: Date.now(), aiCalls: 0 };
}

export function makeResult(
  node: WorkflowNode,
  text: string,
  timing: ResultTiming,
  extra: Partial<Omit<NodeResult, 'meta' | 'text'>> & { meta?: Partial<NodeResult['meta']> } = {}
): NodeResult {
  const { meta: extraMeta, ...rest } = extra;
  const detected = detectKind(text);
  return {
    kind: detected.kind,
    ...(detected.value !== undefined ? { value: detected.value } : {}),
    text,
    ...rest,
    meta: {
      nodeId: node.id,
      nodeType: node.data?.nodeType ?? 'prompt',
      startedAt: timing.startedAt,
      durationMs: Math.max(0, Date.now() - timing.startMs),
      aiCalls: timing.aiCalls,
      ...(timing.model ? { model: timing.model } : {}),
      ...(extraMeta ?? {}),
    },
  };
}

/** Error codes with a plain-English message and a "how to fix" hint. */
export const ERROR_TEXT: Record<string, { message: string; hint: string }> = {
  NO_INPUT: { message: 'This step has nothing to work on.', hint: 'Connect a node to its left side, or type some text in it.' },
  AI_LIMIT_REACHED: { message: 'This run reached its limit of AI calls.', hint: 'Use fewer AI steps or fewer list items, or upgrade for a higher limit.' },
  QUOTA_EXCEEDED: { message: "You've used all your AI runs for now.", hint: 'Wait for your allowance to reset, or upgrade your plan.' },
  REGEX_UNSAFE: { message: 'This pattern could freeze the page, so it was not used.', hint: 'Try a simpler pattern, or use "contains" instead.' },
  REGEX_INVALID: { message: 'This pattern is not a valid regular expression.', hint: 'Check the brackets and special characters, or use "contains" instead.' },
  NOT_A_LIST: { message: 'The input is not a list.', hint: 'Send a JSON array, or text with one item per line.' },
  NOT_JSON: { message: 'The input is not JSON.', hint: 'Ask the AI step to "answer with JSON only", or set its answer format to JSON.' },
  PATH_NOT_FOUND: { message: 'That field was not found in the input.', hint: 'Check the spelling of the path, e.g. items[0].title, or set a fallback value.' },
  BAD_PATH: { message: 'The field path is not valid.', hint: 'Use dots and [numbers], e.g. user.name or items[0].title.' },
  BAD_VARIABLE_NAME: { message: 'The variable needs a name made of letters, numbers or _.', hint: 'For example: topic, user_name, score2.' },
  NO_CASES: { message: 'This switch has no cases yet.', hint: 'Add at least one case in the settings panel.' },
  CANCELLED: { message: 'The run was stopped.', hint: 'Press Run again when you are ready.' },
  CYCLE: { message: 'These steps are connected in a loop, so there is no place to start.', hint: 'Remove one of the wires in the loop.' },
  CODE_FAILED: { message: 'The script failed.', hint: 'Check the script; it must return a value, e.g. return input.toUpperCase();' },
  AI_FAILED: { message: 'The AI step failed.', hint: 'Try again in a moment. If it keeps failing, shorten the prompt.' },
  UNKNOWN_NODE: { message: 'This kind of step is not known to this version of Bedrock.', hint: 'Delete it, or update the app.' },
};

export function makeError(node: WorkflowNode, code: string, timing: ResultTiming, detail?: string): NodeResult {
  const known = ERROR_TEXT[code] ?? ERROR_TEXT.AI_FAILED;
  const message = detail ? `${known.message} (${detail})` : known.message;
  return {
    kind: 'text',
    text: message,
    error: { code, message, hint: known.hint },
    meta: {
      nodeId: node.id,
      nodeType: node.data?.nodeType ?? 'prompt',
      startedAt: timing.startedAt,
      durationMs: Math.max(0, Date.now() - timing.startMs),
      aiCalls: timing.aiCalls,
      ...(timing.model ? { model: timing.model } : {}),
    },
  };
}

/** An error thrown inside the engine with one of the codes above. */
export class EngineError extends Error {
  code: string;
  detail?: string;
  constructor(code: string, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.code = code;
    this.detail = detail;
  }
}

/** Maps any thrown value to an EngineError (quota and abort errors from the app's API layer included). */
export function toEngineError(err: unknown, fallbackCode: string): EngineError {
  if (err instanceof EngineError) return err;
  const e = err as { name?: string; code?: string; statusCode?: number; status?: number; message?: string };
  const message = typeof e?.message === 'string' ? e.message : String(err ?? '');
  if (e?.name === 'AbortError') return new EngineError('CANCELLED');
  if (e?.code === 'FREE_TIER_QUOTA_EXCEEDED' || e?.code === 'QUOTA_EXCEEDED' || e?.statusCode === 429 || e?.status === 429) {
    return new EngineError('QUOTA_EXCEEDED');
  }
  return new EngineError(fallbackCode, message.slice(0, 300) || undefined);
}
