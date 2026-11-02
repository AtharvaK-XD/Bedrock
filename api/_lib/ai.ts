export interface QuestionOutput {
  id: string;
  questionText: string;
  questionType: 'single_select' | 'multi_select' | 'free_text';
  options?: string[];
}

import { getModelTuning } from './modelTuning.js';

// Server keys only. VITE_* variables are for the browser bundle and must never hold a provider secret.
function getApiKey(provider: 'groq' | 'gemini' | 'openrouter'): string {
  if (provider === 'groq') return process.env.GROQ_API_KEY || '';
  if (provider === 'gemini') return process.env.GEMINI_API_KEY || '';
  return process.env.OPENROUTER_API_KEY || '';
}

/** Tokens a call really used, as reported by the provider (not a guess from the text length). */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/** What one provider call returns: the text, whether it stopped at the output limit, and the real token counts when sent. */
interface ProviderResult {
  text: string;
  truncated: boolean;
  usage?: TokenUsage;
}

const asCount = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);

/** OpenAI-style usage (Groq, OpenRouter): { prompt_tokens, completion_tokens, total_tokens }. */
function openAiUsage(raw: any): TokenUsage | undefined {
  const u = raw?.usage ?? raw?.x_groq?.usage;
  if (!u || typeof u !== 'object') return undefined;
  const inputTokens = asCount(u.prompt_tokens);
  const outputTokens = asCount(u.completion_tokens);
  const totalTokens = asCount(u.total_tokens) || inputTokens + outputTokens;
  return totalTokens > 0 ? { inputTokens, outputTokens, totalTokens } : undefined;
}

/** Gemini usageMetadata. Hidden "thinking" tokens are billed as output, so they are counted as output. */
function geminiUsage(raw: any): TokenUsage | undefined {
  const u = raw?.usageMetadata;
  if (!u || typeof u !== 'object') return undefined;
  const inputTokens = asCount(u.promptTokenCount);
  const outputTokens = asCount(u.candidatesTokenCount) + asCount(u.thoughtsTokenCount);
  const totalTokens = asCount(u.totalTokenCount) || inputTokens + outputTokens;
  return totalTokens > 0 ? { inputTokens, outputTokens, totalTokens } : undefined;
}

/** Adds up the usage of several calls (e.g. a synthesis and its repair); undefined only when none reported any. */
export function sumUsage(...parts: Array<TokenUsage | undefined>): TokenUsage | undefined {
  const known = parts.filter((p): p is TokenUsage => Boolean(p));
  if (known.length === 0) return undefined;
  return known.reduce((a, b) => ({
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  }));
}

/** Tokens to store for a trace: the real count when the provider sent one, the caller's estimate otherwise. */
export function tokensForTrace(usage: TokenUsage | undefined, estimate: number): number {
  return usage ? usage.totalTokens : estimate;
}

/** Cancels `controller` when `external` (the caller's client disconnecting) aborts. Returns the cleanup function. */
function linkSignal(controller: AbortController, external?: AbortSignal): () => void {
  if (!external) return () => {};
  if (external.aborted) {
    controller.abort();
    return () => {};
  }
  const onAbort = () => controller.abort();
  external.addEventListener('abort', onAbort, { once: true });
  return () => external.removeEventListener('abort', onAbort);
}

/** Output limits (tokens) per kind of call. Callers pass one of these as `maxOutputTokens`. */
export const AI_OUTPUT_BUDGET = {
  /** 3 to 4 clarifying questions as JSON */
  questions: 1_200,
  /** Full prompt document */
  synthesize: 4_000,
  /** Free-form calls (the app's general backend proxy): default and ceiling */
  testDefault: 3_500,
  testMax: 6_000,
  /** Refine rewrites a whole prompt, so it scales with the prompt (see refineOutputBudget) */
  refineMin: 2_500,
  refineMax: 8_000,
} as const;
const DEFAULT_MAX_OUTPUT_TOKENS: number = AI_OUTPUT_BUDGET.testDefault;
/**
 * Gemini's maxOutputTokens also counts its hidden "thinking" tokens. Extra room is added so thinking
 * does not eat the answer; the total is still bounded.
 */
const GEMINI_THINKING_HEADROOM_TOKENS = 4_096;

/** Status codes that mean "this request was bad", not "this provider is unhealthy". */
const CLIENT_CAUSED_STATUSES: ReadonlySet<number> = new Set([400, 413, 422]);
/** Status codes that mean the API key (not one model) is refused or out of quota. */
const KEY_LEVEL_STATUSES: ReadonlySet<number> = new Set([401, 402, 403, 429]);

/** Overall wall-clock budget for one request (Vercel maxDuration is 60 s; leave headroom to respond). */
export const AI_DEFAULT_BUDGET_MS = 50_000;
/** Longest a single provider attempt may run. */
const PROVIDER_TIMEOUT_MS = 20_000;
/** A new provider attempt is not started with less than this left in the budget. */
const MIN_ATTEMPT_MS = 3_000;
/** Upstream error bodies are cut to this length before being kept or logged. */
const MAX_ERROR_BODY_CHARS = 500;

/** Upstream HTTP failure; carries the status so retry and failover logic need not parse message text. */
export class ProviderHttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ProviderHttpError';
    this.status = status;
  }
}

export type AiErrorCode =
  | 'AI_NOT_CONFIGURED'
  | 'AI_ALL_PROVIDERS_FAILED'
  | 'AI_DEADLINE_EXCEEDED'
  | 'AI_STREAM_INTERRUPTED'
  | 'AI_OUTPUT_TRUNCATED'
  | 'AI_CLIENT_ABORTED';

/**
 * Error safe to return to clients: the message never contains upstream response bodies,
 * env var names or provider details. Details are logged server-side only.
 */
export class AiCompletionError extends Error {
  code: AiErrorCode;
  /** Name of the last provider tried (set when every provider failed), for failed-call traces. */
  model?: string;
  constructor(code: AiErrorCode, message: string, model?: string) {
    super(message);
    this.name = 'AiCompletionError';
    this.code = code;
    this.model = model;
  }
}

const PUBLIC_AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  AI_NOT_CONFIGURED: 'AI service is not available right now. Please try again later.',
  AI_ALL_PROVIDERS_FAILED: 'All AI providers are busy or unavailable. Please try again shortly.',
  AI_DEADLINE_EXCEEDED: 'The AI request took too long. Please try again.',
  AI_STREAM_INTERRUPTED: 'The AI response was interrupted. Please try again.',
  AI_OUTPUT_TRUNCATED: 'The result was too long to finish. Try a shorter prompt or a smaller change.',
  AI_CLIENT_ABORTED: 'The request was cancelled.',
};

function aiError(code: AiErrorCode): AiCompletionError {
  return new AiCompletionError(code, PUBLIC_AI_ERROR_MESSAGES[code]);
}

/** For callers that must not return a cut-off answer (e.g. refine would replace the user's prompt with half of one). */
export function truncatedOutputError(): AiCompletionError {
  return aiError('AI_OUTPUT_TRUNCATED');
}

/** Output budget for refine: it rewrites the whole prompt, so it grows with the prompt (about 3 characters per token). */
export function refineOutputBudget(currentPromptChars: number): number {
  return Math.min(
    AI_OUTPUT_BUDGET.refineMax,
    Math.max(AI_OUTPUT_BUDGET.refineMin, Math.ceil(currentPromptChars / 3) + 1_500)
  );
}

/** Output budget for the free-form test route: the client's own `maxOutputTokens` within a safe range. */
export function testOutputBudget(requested: unknown): number {
  const n = typeof requested === 'number' && Number.isFinite(requested) ? Math.floor(requested) : AI_OUTPUT_BUDGET.testDefault;
  return Math.min(AI_OUTPUT_BUDGET.testMax, Math.max(256, n));
}

function clip(text: string): string {
  return text.length > MAX_ERROR_BODY_CHARS ? `${text.slice(0, MAX_ERROR_BODY_CHARS)}…` : text;
}

/**
 * Removes reasoning-model "thinking" blocks (`<think>…</think>`) so they never end up in the
 * user's prompt. An unclosed `<think>` means the rest of the text is reasoning and is dropped too.
 * Text without a `<think>` tag is returned unchanged.
 */
export function stripReasoningText(text: string): string {
  if (!/<think>/i.test(text)) return text;
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/i, '')
    .trimStart();
}

const THINK_OPEN = '<think>';
const THINK_CLOSE = '</think>';

/** Length of the longest end of `text` that could be the start of `tag` (a tag split across stream chunks). */
function partialTagLength(text: string, tag: string): number {
  for (let n = Math.min(tag.length - 1, text.length); n > 0; n--) {
    if (text.slice(-n).toLowerCase() === tag.slice(0, n)) return n;
  }
  return 0;
}

/**
 * Streaming version of stripReasoningText: tokens go to `emit` with `<think>…</think>` removed, also when a
 * tag arrives split over several chunks. Joined, the emitted text equals stripReasoningText(all chunks)
 * apart from leading whitespace (the final event's promptText is the exact, cleaned answer).
 * Call flush() once the provider finished: it releases a held-back "<thi"-style ending that was not a tag.
 */
export function createReasoningStreamFilter(emit: (text: string) => void) {
  let buffer = '';
  let inThink = false;
  let sawThink = false;
  let emittedAny = false;

  const out = (text: string) => {
    // stripReasoningText trims the start of the answer once a think block was removed
    const clean = sawThink && !emittedAny ? text.trimStart() : text;
    if (!clean) return;
    emittedAny = true;
    emit(clean);
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      for (;;) {
        if (inThink) {
          const close = /<\/think>/i.exec(buffer);
          if (!close) {
            buffer = buffer.slice(buffer.length - partialTagLength(buffer, THINK_CLOSE));
            return;
          }
          buffer = buffer.slice(close.index + THINK_CLOSE.length);
          inThink = false;
          continue;
        }
        const open = /<think>/i.exec(buffer);
        if (!open) {
          const keep = partialTagLength(buffer, THINK_OPEN);
          out(buffer.slice(0, buffer.length - keep));
          buffer = buffer.slice(buffer.length - keep);
          return;
        }
        out(buffer.slice(0, open.index));
        buffer = buffer.slice(open.index + THINK_OPEN.length);
        inThink = true;
        sawThink = true;
      }
    },
    flush() {
      // An unclosed think block is reasoning cut off mid-way: dropped, as stripReasoningText does
      if (!inThink) out(buffer);
      buffer = '';
    },
  };
}

/**
 * Transient = worth one more try on the same provider: gateway-level HTTP errors and
 * connection resets. Timeouts (AbortError) are not retried: they already spent their budget.
 */
function isTransientError(err: any): boolean {
  if (err instanceof ProviderHttpError) {
    return err.status === 502 || err.status === 503 || err.status === 504;
  }
  if (err?.name === 'AbortError') return false;
  const code = String(err?.code || err?.cause?.code || '').toUpperCase();
  if (code === 'ECONNRESET' || code === 'ETIMEDOUT') return true;
  return err instanceof TypeError && String(err.message).toLowerCase().includes('fetch failed');
}

/**
 * Bounded retry for transient failures: at most `maxRetries` extra attempts, only while
 * `canRetry()` allows it (e.g. nothing streamed to the client yet) and the deadline leaves room.
 */
async function withTransientRetry<T>(
  fn: () => Promise<T>,
  opts: { deadlineAt: number; canRetry?: () => boolean; maxRetries?: number }
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 1;
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const backoff = 150 + Math.random() * 200;
      const hasTime = opts.deadlineAt - Date.now() > backoff + MIN_ATTEMPT_MS;
      if (attempt <= maxRetries && isTransientError(err) && hasTime && (opts.canRetry?.() ?? true)) {
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Calls Groq chat completions with optional streaming
 */
async function callGroq(
  prompt: string,
  systemPrompt?: string,
  model = 'llama-3.3-70b-versatile',
  onToken?: (token: string) => void,
  temperature = 0.5,
  timeoutMs = PROVIDER_TIMEOUT_MS,
  maxTokens = DEFAULT_MAX_OUTPUT_TOKENS,
  signal?: AbortSignal
): Promise<ProviderResult> {
  const key = getApiKey('groq');
  if (!key) throw new Error('GROQ_API_KEY is not configured on the server.');

  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const isStreaming = typeof onToken === 'function';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const unlink = linkSignal(controller, signal);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: isStreaming,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new ProviderHttpError(`Groq API returned ${res.status}: ${clip(err)}`, res.status);
    }

    if (isStreaming && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';
      let truncated = false;
      let usage: TokenUsage | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;
          try {
            const json = JSON.parse(dataStr);
            const chunk = json.choices?.[0]?.delta?.content || '';
            if (json.choices?.[0]?.finish_reason === 'length') truncated = true;
            usage = openAiUsage(json) ?? usage;
            if (chunk) {
              accumulated += chunk;
              onToken(chunk);
            }
          } catch {
            // ignore malformed SSE line
          }
        }
      }
      return { text: accumulated, truncated, usage };
    }

    const data = await res.json();
    return {
      text: data.choices?.[0]?.message?.content || '',
      truncated: data.choices?.[0]?.finish_reason === 'length',
      usage: openAiUsage(data),
    };
  } finally {
    clearTimeout(timeoutId);
    unlink();
  }
}

/**
 * Calls Google Gemini REST API with optional SSE streaming
 */
async function callGemini(
  prompt: string,
  systemPrompt?: string,
  model = 'gemini-flash-lite-latest',
  onToken?: (token: string) => void,
  temperature = 0.55,
  timeoutMs = PROVIDER_TIMEOUT_MS,
  maxTokens = DEFAULT_MAX_OUTPUT_TOKENS,
  signal?: AbortSignal
): Promise<ProviderResult> {
  const key = getApiKey('gemini');
  if (!key) throw new Error('GEMINI_API_KEY is not configured on the server.');

  const candidates = (model === 'gemini-2.5-flash' || model === 'gemini-1.5-flash')
    ? ['gemini-flash-lite-latest', 'gemini-flash-latest']
    : [model, 'gemini-flash-lite-latest', 'gemini-flash-latest'];

  const isStreaming = typeof onToken === 'function';
  let lastError: Error | null = null;
  // The model fallbacks share one time budget so three candidates cannot take 3x the timeout
  const providerDeadline = Date.now() + timeoutMs;

  for (const m of candidates) {
    const attemptMs = providerDeadline - Date.now();
    if (attemptMs < 1_000) break;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), attemptMs);
    const unlink = linkSignal(controller, signal);

    try {
      // The key travels in a header (documented by Google), not in the URL where proxies and logs keep it
      const endpoint = isStreaming ? 'streamGenerateContent?alt=sse' : 'generateContent';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:${endpoint}`;
      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
        // Without a limit the answer (and the billed thinking tokens) is unbounded
        generationConfig: { temperature, maxOutputTokens: maxTokens + GEMINI_THINKING_HEADROOM_TOKENS },
      };
      if (systemPrompt) {
        body.systemInstruction = { parts: [{ text: systemPrompt }] };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        lastError = new ProviderHttpError(`Gemini API returned ${res.status}: ${clip(err)}`, res.status);
        if (res.status === 503 || res.status === 404) continue;
        throw lastError;
      }

      if (isStreaming && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let buffer = '';
        let truncated = false;
        let usage: TokenUsage | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;
            try {
              const json = JSON.parse(dataStr);
              const chunk = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (json.candidates?.[0]?.finishReason === 'MAX_TOKENS') truncated = true;
              usage = geminiUsage(json) ?? usage;
              if (chunk) {
                accumulated += chunk;
                onToken(chunk);
              }
            } catch {
              // ignore malformed line
            }
          }
        }
        if (accumulated) return { text: accumulated, truncated, usage };
      }

      const data = await res.json();
      return {
        text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
        truncated: data.candidates?.[0]?.finishReason === 'MAX_TOKENS',
        usage: geminiUsage(data),
      };
    } catch (e: any) {
      lastError = e;
    } finally {
      clearTimeout(timeoutId);
      unlink();
    }
  }

  throw lastError || new Error('All Gemini fallback models failed.');
}

/**
 * Calls OpenRouter REST API with optional streaming
 */
async function callOpenRouter(
  prompt: string,
  systemPrompt?: string,
  model = 'openai/gpt-4o-mini',
  onToken?: (token: string) => void,
  temperature = 0.5,
  timeoutMs = PROVIDER_TIMEOUT_MS,
  maxTokens = DEFAULT_MAX_OUTPUT_TOKENS,
  signal?: AbortSignal
): Promise<ProviderResult> {
  const key = getApiKey('openrouter');
  if (!key) throw new Error('OPENROUTER_API_KEY is not configured on the server.');

  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const isStreaming = typeof onToken === 'function';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const unlink = linkSignal(controller, signal);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': 'https://bedrock-steel.vercel.app',
        'X-Title': 'Bedrock',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: isStreaming,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new ProviderHttpError(`OpenRouter API returned ${res.status}: ${clip(err)}`, res.status);
    }

    if (isStreaming && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';
      let truncated = false;
      let usage: TokenUsage | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;
          try {
            const json = JSON.parse(dataStr);
            const chunk = json.choices?.[0]?.delta?.content || '';
            if (json.choices?.[0]?.finish_reason === 'length') truncated = true;
            usage = openAiUsage(json) ?? usage;
            if (chunk) {
              accumulated += chunk;
              onToken(chunk);
            }
          } catch {
            // ignore
          }
        }
      }
      return { text: accumulated, truncated, usage };
    }

    const data = await res.json();
    return {
      text: data.choices?.[0]?.message?.content || '',
      truncated: data.choices?.[0]?.finish_reason === 'length',
      usage: openAiUsage(data),
    };
  } finally {
    clearTimeout(timeoutId);
    unlink();
  }
}

import {
  AI_PROVIDERS,
  ProviderTarget,
  selectOptimalProvider,
  recordProviderSuccess,
  recordProviderFailure,
  orderForFailover,
} from './loadBalancer.js';

import { recordLangfuseGeneration } from './langfuse.js';

/**
 * A failure that counts against the provider's circuit breaker. A request the provider refused because
 * of its own content (400 / 413 / 422) says nothing about the provider's health, and counting it let one
 * user's oversized input take a provider out for everybody for 30 seconds.
 */
function countsAgainstProvider(err: unknown): boolean {
  return !(err instanceof ProviderHttpError && CLIENT_CAUSED_STATUSES.has(err.status));
}

/** Rate limited: decided from the HTTP status when there is one, from the message text only otherwise. */
function isRateLimitError(err: unknown, message: string): boolean {
  if (err instanceof ProviderHttpError) return err.status === 429;
  const lower = message.toLowerCase();
  return message.includes('429') || lower.includes('rate limit') || lower.includes('quota');
}

/**
 * Multi-provider execution with Upstash Redis distributed load balancing, circuit breaking, and automatic fallback
 */
export async function executeAiCompletion(
  prompt: string,
  systemPrompt?: string,
  userId?: string,
  onToken?: (token: string) => void,
  temperatureOverride?: number,
  options?: {
    /** Absolute epoch ms by which this call must finish. Callers making several calls for one request share one value. */
    deadlineAt?: number;
    /** Most tokens the answer may use (see AI_OUTPUT_BUDGET). Defaults to AI_OUTPUT_BUDGET.testDefault. */
    maxOutputTokens?: number;
    /** Aborts the provider call when the caller's client disconnects (see clientAbortSignal in aiHttp.ts). */
    signal?: AbortSignal;
  }
): Promise<{ text: string; model: string; truncated?: boolean; usage?: TokenUsage }> {
  const startTime = new Date();
  const maxTokens = Math.max(100, Math.floor(options?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS));
  const deadlineAt = options?.deadlineAt ?? Date.now() + AI_DEFAULT_BUDGET_MS;

  // 1. Gather all candidates that have valid API keys
  const groqAvailable = Boolean(getApiKey('groq'));
  const geminiAvailable = Boolean(getApiKey('gemini'));
  const openRouterAvailable = Boolean(getApiKey('openrouter'));

  const candidates: ProviderTarget[] = AI_PROVIDERS.filter((p) => {
    if (p.id.startsWith('groq') && !groqAvailable) return false;
    if (p.id.startsWith('gemini') && !geminiAvailable) return false;
    if (p.id.startsWith('openrouter') && !openRouterAvailable) return false;
    return true;
  });

  if (candidates.length === 0) {
    console.error(
      '[AI] No AI providers configured. Set GROQ_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY in the server environment.'
    );
    throw aiError('AI_NOT_CONFIGURED');
  }

  // Helper to execute a single provider with model-specific tuning or use-case temperature override
  const dispatchToProvider = async (
    target: ProviderTarget,
    currentOnToken: ((tok: string) => void) | undefined,
    timeoutMs: number
  ): Promise<ProviderResult> => {
    const tuning = getModelTuning(target.model || target.id);
    const tunedSystem = systemPrompt
      ? `${systemPrompt}\n\n${tuning.extraWording}`
      : tuning.extraWording;
    const temp = temperatureOverride !== undefined ? temperatureOverride : tuning.temperature;

    if (target.id === 'groq-llama-70b') {
      return await callGroq(prompt, tunedSystem, 'llama-3.3-70b-versatile', currentOnToken, temp, timeoutMs, maxTokens, options?.signal);
    }
    if (target.id === 'groq-llama-8b') {
      return await callGroq(prompt, tunedSystem, 'llama-3.1-8b-instant', currentOnToken, temp, timeoutMs, maxTokens, options?.signal);
    }
    if (target.id === 'gemini-flash') {
      return await callGemini(prompt, tunedSystem, 'gemini-flash-latest', currentOnToken, temp, timeoutMs, maxTokens, options?.signal);
    }
    if (target.id === 'gemini-flash-lite') {
      return await callGemini(prompt, tunedSystem, 'gemini-flash-lite-latest', currentOnToken, temp, timeoutMs, maxTokens, options?.signal);
    }
    if (target.id === 'openrouter-gpt4o') {
      return await callOpenRouter(prompt, tunedSystem, 'openai/gpt-4o-mini', currentOnToken, temp, timeoutMs, maxTokens, options?.signal);
    }
    // Fallback dynamic routing by model identifier
    if (target.model.includes('llama') || target.id.startsWith('groq')) {
      return await callGroq(prompt, tunedSystem, target.model, currentOnToken, temp, timeoutMs, maxTokens, options?.signal);
    }
    if (target.model.includes('gemini') || target.id.startsWith('gemini')) {
      return await callGemini(prompt, tunedSystem, target.model, currentOnToken, temp, timeoutMs, maxTokens, options?.signal);
    }
    return await callOpenRouter(prompt, tunedSystem, target.model, currentOnToken, temp, timeoutMs, maxTokens, options?.signal);
  };

  // 2. Select optimal provider via distributed round-robin / circuit health
  const primaryChoice = (await selectOptimalProvider(candidates)) || candidates[0];

  // The chosen provider first, then healthy ones by quality, and providers known to be down last
  const executionOrder = await orderForFailover(candidates, primaryChoice);

  let lastError: Error | null = null;
  let lastAttempted: ProviderTarget | null = null;
  const throttledProviders = new Set<string>();
  let deadlineExceeded = false;

  for (const provider of executionOrder) {
    // The client left: stop before starting another paid call
    if (options?.signal?.aborted) throw aiError('AI_CLIENT_ABORTED');

    // If this provider's entire family hit 429 rate limit, skip sibling models sharing the same key
    if (throttledProviders.has(provider.provider)) {
      continue;
    }

    const remainingMs = deadlineAt - Date.now();
    if (remainingMs < MIN_ATTEMPT_MS) {
      deadlineExceeded = true;
      break;
    }
    const attemptTimeoutMs = Math.min(PROVIDER_TIMEOUT_MS, remainingMs);

    // Counts only text that actually reached the client: hidden <think> text does not block a retry or failover
    lastAttempted = provider;
    let tokensEmitted = 0;
    const emitToClient = onToken
      ? (tok: string) => {
          tokensEmitted++;
          onToken(tok);
        }
      : undefined;
    const stream: { filter: ReturnType<typeof createReasoningStreamFilter> | null } = { filter: null };

    try {
      const result = await withTransientRetry(
        () => {
          // A fresh filter per attempt (a retry only happens while nothing has reached the client)
          const filter = emitToClient ? createReasoningStreamFilter(emitToClient) : null;
          stream.filter = filter;
          return dispatchToProvider(provider, filter ? (tok) => filter.push(tok) : undefined, attemptTimeoutMs);
        },
        // Retrying after tokens reached the client would send them twice
        { deadlineAt, canRetry: () => tokensEmitted === 0 }
      );
      const text = stripReasoningText(result.text || '');
      if (text && text.trim().length > 0) {
        if (result.truncated) {
          console.warn(`[AI] ${provider.name} stopped at the output limit (${maxTokens} tokens); the answer is cut off.`);
        }
        stream.filter?.flush();
        await recordProviderSuccess(provider.id);
        const modelName = `${provider.name} (${provider.model})`;

        // Async non-blocking telemetry to Langfuse (sizes and timing only, never user text or output)
        recordLangfuseGeneration({
          traceName: 'bedrock_ai_completion',
          model: modelName,
          userId,
          startTime,
          endTime: new Date(),
          metadata: {
            providerId: provider.id,
            providerModel: provider.model,
            inputChars: prompt.length + (systemPrompt?.length ?? 0),
            outputChars: text.length,
            truncated: result.truncated,
            ...(result.usage
              ? { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens }
              : {}),
          },
        }).catch((e) => console.warn('[Langfuse] Error in recordLangfuseGeneration:', e));

        return {
          text,
          model: modelName,
          // Only present when true / known, so normal answers keep exactly the same shape
          ...(result.truncated ? { truncated: true } : {}),
          ...(result.usage ? { usage: result.usage } : {}),
        };
      }
    } catch (err: any) {
      // The client left and cancelled the call: that says nothing about the provider, and nothing more should be tried
      if (options?.signal?.aborted) throw aiError('AI_CLIENT_ABORTED');

      const errMsg = clip(err?.message || String(err));
      const rateLimited = isRateLimitError(err, errMsg);
      console.warn(`[LoadBalancer] Provider ${provider.name} failed:`, errMsg);
      // A request the provider refused because of its own content is not a sign the provider is unhealthy
      if (countsAgainstProvider(err)) {
        await recordProviderFailure(provider.id, errMsg, { rateLimited });
      }
      lastError = err;

      // Rate limited, or the key itself is refused (401 / 402 / 403): the sibling models share that key, so skip them
      if (rateLimited || (err instanceof ProviderHttpError && KEY_LEVEL_STATUSES.has(err.status))) {
        throttledProviders.add(provider.provider);
      }

      // If tokens have already been streamed to the client, we cannot fail over transparently
      if (tokensEmitted > 0) {
        throw aiError('AI_STREAM_INTERRUPTED');
      }
    }
  }

  const failureCode: AiErrorCode = deadlineExceeded ? 'AI_DEADLINE_EXCEEDED' : 'AI_ALL_PROVIDERS_FAILED';

  // Record failure trace in Langfuse (error code only: upstream messages can echo request content)
  recordLangfuseGeneration({
    traceName: 'bedrock_ai_completion',
    model: 'all_providers_failed',
    userId,
    startTime,
    endTime: new Date(),
    level: 'ERROR',
    statusMessage: failureCode,
    metadata: { inputChars: prompt.length + (systemPrompt?.length ?? 0) },
  }).catch((e) => console.warn('[Langfuse] Error reporting failure:', e));

  console.error(
    `[AI] ${deadlineExceeded ? 'Deadline reached before a provider succeeded' : 'All providers failed'}. Last error: ${clip(lastError?.message || 'Unknown provider error')}`
  );
  const failure = aiError(failureCode);
  failure.model = (lastAttempted ?? primaryChoice).name;
  throw failure;
}
