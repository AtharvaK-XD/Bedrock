export interface GenerateQuestionsParams {
  ideaText: string;
  targetType: string;
}

export interface QuestionOutput {
  id: string;
  questionText: string;
  questionType: 'single_select' | 'multi_select' | 'free_text';
  options?: string[];
}

export interface SynthesizeParams {
  idea: {
    rawText: string;
    targetType: string;
  };
  answers: Array<{
    questionId: string;
    value: string | string[];
  }>;
  questions: QuestionOutput[];
}

export interface RefineParams {
  currentPrompt: string;
  instruction: string;
}

import { getModelTuning } from './modelTuning.js';

function getApiKey(provider: 'groq' | 'gemini' | 'openrouter'): string {
  if (provider === 'groq') {
    return process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || '';
  }
  if (provider === 'gemini') {
    return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
  }
  return process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || '';
}

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
  | 'AI_STREAM_INTERRUPTED';

/**
 * Error safe to return to clients: the message never contains upstream response bodies,
 * env var names or provider details. Details are logged server-side only.
 */
export class AiCompletionError extends Error {
  code: AiErrorCode;
  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.name = 'AiCompletionError';
    this.code = code;
  }
}

const PUBLIC_AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  AI_NOT_CONFIGURED: 'AI service is not available right now. Please try again later.',
  AI_ALL_PROVIDERS_FAILED: 'All AI providers are busy or unavailable. Please try again shortly.',
  AI_DEADLINE_EXCEEDED: 'The AI request took too long. Please try again.',
  AI_STREAM_INTERRUPTED: 'The AI response was interrupted. Please try again.',
};

function aiError(code: AiErrorCode): AiCompletionError {
  return new AiCompletionError(code, PUBLIC_AI_ERROR_MESSAGES[code]);
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
  timeoutMs = PROVIDER_TIMEOUT_MS
): Promise<string> {
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
        max_tokens: 3500,
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
            if (chunk) {
              accumulated += chunk;
              onToken(chunk);
            }
          } catch {
            // ignore malformed SSE line
          }
        }
      }
      return accumulated;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeoutId);
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
  timeoutMs = PROVIDER_TIMEOUT_MS
): Promise<string> {
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

    try {
      const endpoint = isStreaming ? 'streamGenerateContent?alt=sse&key=' : 'generateContent?key=';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:${endpoint}${key}`;
      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature },
      };
      if (systemPrompt) {
        body.systemInstruction = { parts: [{ text: systemPrompt }] };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
              if (chunk) {
                accumulated += chunk;
                onToken(chunk);
              }
            } catch {
              // ignore malformed line
            }
          }
        }
        if (accumulated) return accumulated;
      }

      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (e: any) {
      lastError = e;
    } finally {
      clearTimeout(timeoutId);
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
  timeoutMs = PROVIDER_TIMEOUT_MS
): Promise<string> {
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

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': 'https://bedrock.app',
        'X-Title': 'Bedrock',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: 3000,
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
            if (chunk) {
              accumulated += chunk;
              onToken(chunk);
            }
          } catch {
            // ignore
          }
        }
      }
      return accumulated;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeoutId);
  }
}

import {
  AI_PROVIDERS,
  ProviderTarget,
  selectOptimalProvider,
  recordProviderSuccess,
  recordProviderFailure,
} from './loadBalancer.js';

import { recordLangfuseGeneration } from './langfuse.js';

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
  }
): Promise<{ text: string; model: string }> {
  const startTime = new Date();
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
  ): Promise<string> => {
    const tuning = getModelTuning(target.model || target.id);
    const tunedSystem = systemPrompt
      ? `${systemPrompt}\n\n${tuning.extraWording}`
      : tuning.extraWording;
    const temp = temperatureOverride !== undefined ? temperatureOverride : tuning.temperature;

    if (target.id === 'groq-llama-70b') {
      return await callGroq(prompt, tunedSystem, 'llama-3.3-70b-versatile', currentOnToken, temp, timeoutMs);
    }
    if (target.id === 'groq-llama-8b') {
      return await callGroq(prompt, tunedSystem, 'llama-3.1-8b-instant', currentOnToken, temp, timeoutMs);
    }
    if (target.id === 'gemini-flash') {
      return await callGemini(prompt, tunedSystem, 'gemini-flash-latest', currentOnToken, temp, timeoutMs);
    }
    if (target.id === 'gemini-flash-lite') {
      return await callGemini(prompt, tunedSystem, 'gemini-flash-lite-latest', currentOnToken, temp, timeoutMs);
    }
    if (target.id === 'openrouter-gpt4o') {
      return await callOpenRouter(prompt, tunedSystem, 'openai/gpt-4o-mini', currentOnToken, temp, timeoutMs);
    }
    // Fallback dynamic routing by model identifier
    if (target.model.includes('llama') || target.id.startsWith('groq')) {
      return await callGroq(prompt, tunedSystem, target.model, currentOnToken, temp, timeoutMs);
    }
    if (target.model.includes('gemini') || target.id.startsWith('gemini')) {
      return await callGemini(prompt, tunedSystem, target.model, currentOnToken, temp, timeoutMs);
    }
    return await callOpenRouter(prompt, tunedSystem, target.model, currentOnToken, temp, timeoutMs);
  };

  // 2. Select optimal provider via distributed round-robin / circuit health
  const primaryChoice = (await selectOptimalProvider(candidates)) || candidates[0];

  // Order providers starting with the primary choice, followed by healthy alternates
  const executionOrder = [
    primaryChoice,
    ...candidates.filter((c) => c.id !== primaryChoice.id),
  ];

  let lastError: Error | null = null;
  const throttledProviders = new Set<string>();
  let deadlineExceeded = false;

  for (const provider of executionOrder) {
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

    let tokensEmitted = 0;
    const trackedOnToken = onToken
      ? (tok: string) => {
          tokensEmitted++;
          onToken(tok);
        }
      : undefined;

    try {
      const rawText = await withTransientRetry(
        () => dispatchToProvider(provider, trackedOnToken, attemptTimeoutMs),
        // Retrying after tokens reached the client would send them twice
        { deadlineAt, canRetry: () => tokensEmitted === 0 }
      );
      const text = stripReasoningText(rawText || '');
      if (text && text.trim().length > 0) {
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
          },
        }).catch((e) => console.warn('[Langfuse] Error in recordLangfuseGeneration:', e));

        return {
          text,
          model: modelName,
        };
      }
    } catch (err: any) {
      const errMsg = clip(err?.message || String(err));
      console.warn(`[LoadBalancer] Provider ${provider.name} failed:`, errMsg);
      await recordProviderFailure(provider.id, errMsg);
      lastError = err;

      // If 429 rate limit or quota exceeded, skip all sibling models from this provider family
      if (
        errMsg.includes('429') ||
        errMsg.toLowerCase().includes('rate limit') ||
        errMsg.toLowerCase().includes('quota')
      ) {
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
  throw aiError(failureCode);
}
