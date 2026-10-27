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
    return process.env.GROQ_API_KEY || '';
  }
  if (provider === 'gemini') {
    return process.env.GEMINI_API_KEY || '';
  }
  return process.env.OPENROUTER_API_KEY || '';
}

/**
 * Helper for transient network retries with exponential backoff & jitter
 */
async function withTransientRetry<T>(fn: () => Promise<T>, maxRetries = 1): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const msg = (err?.message || '').toLowerCase();
      const isTransient =
        msg.includes('503') ||
        msg.includes('502') ||
        msg.includes('econnreset') ||
        msg.includes('etimedout') ||
        msg.includes('fetch failed') ||
        msg.includes('overloaded');
      if (attempt <= maxRetries && isTransient) {
        const backoff = 150 + Math.random() * 200;
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
  temperature = 0.5
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
  const timeoutId = setTimeout(() => controller.abort(), 45000);

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
      throw new Error(`Groq API returned ${res.status}: ${err}`);
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
    return data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning || '';
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
  temperature = 0.55
): Promise<string> {
  const key = getApiKey('gemini');
  if (!key) throw new Error('GEMINI_API_KEY is not configured on the server.');

  const candidates = (model === 'gemini-2.5-flash' || model === 'gemini-1.5-flash')
    ? ['gemini-flash-lite-latest', 'gemini-flash-latest']
    : [model, 'gemini-flash-lite-latest', 'gemini-flash-latest'];

  const isStreaming = typeof onToken === 'function';
  let lastError: Error | null = null;

  for (const m of candidates) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

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
        lastError = new Error(`Gemini API returned ${res.status}: ${err}`);
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
  temperature = 0.5
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
  const timeoutId = setTimeout(() => controller.abort(), 45000);

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
      throw new Error(`OpenRouter API returned ${res.status}: ${err}`);
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
  temperatureOverride?: number
): Promise<{ text: string; model: string }> {
  const startTime = new Date();

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
    throw new Error(
      'No AI providers configured on the server. Please ensure GROQ_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY is configured in Vercel environment variables.'
    );
  }

  // Helper to execute a single provider with model-specific tuning or use-case temperature override
  const dispatchToProvider = async (
    target: ProviderTarget,
    currentOnToken?: (tok: string) => void
  ): Promise<string> => {
    const tuning = getModelTuning(target.model || target.id);
    const tunedSystem = systemPrompt
      ? `${systemPrompt}\n\n${tuning.extraWording}`
      : tuning.extraWording;
    const temp = temperatureOverride !== undefined ? temperatureOverride : tuning.temperature;

    if (target.id === 'groq-llama-70b') {
      return await callGroq(prompt, tunedSystem, 'llama-3.3-70b-versatile', currentOnToken, temp);
    }
    if (target.id === 'groq-llama-8b') {
      return await callGroq(prompt, tunedSystem, 'llama-3.1-8b-instant', currentOnToken, temp);
    }
    if (target.id === 'groq-deepseek') {
      return await callGroq(prompt, tunedSystem, 'deepseek-r1-distill-llama-70b', currentOnToken, temp);
    }
    if (target.id === 'gemini-flash') {
      return await callGemini(prompt, tunedSystem, 'gemini-flash-latest', currentOnToken, temp);
    }
    if (target.id === 'gemini-flash-lite') {
      return await callGemini(prompt, tunedSystem, 'gemini-flash-lite-latest', currentOnToken, temp);
    }
    if (target.id === 'openrouter-gpt4o') {
      return await callOpenRouter(prompt, tunedSystem, 'openai/gpt-4o-mini', currentOnToken, temp);
    }
    // Fallback dynamic routing by model identifier
    if (target.model.includes('llama') || target.id.startsWith('groq')) {
      return await callGroq(prompt, tunedSystem, target.model, currentOnToken, temp);
    }
    if (target.model.includes('gemini') || target.id.startsWith('gemini')) {
      return await callGemini(prompt, tunedSystem, target.model, currentOnToken, temp);
    }
    return await callOpenRouter(prompt, tunedSystem, target.model, currentOnToken, temp);
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

  for (const provider of executionOrder) {
    // If this provider's entire family hit 429 rate limit, skip sibling models sharing the same key
    if (throttledProviders.has(provider.provider)) {
      continue;
    }

    let tokensEmitted = 0;
    const trackedOnToken = onToken
      ? (tok: string) => {
          tokensEmitted++;
          onToken(tok);
        }
      : undefined;

    try {
      const text = await withTransientRetry(() => dispatchToProvider(provider, trackedOnToken));
      if (text && text.trim().length > 0) {
        await recordProviderSuccess(provider.id);
        const modelName = `${provider.name} (${provider.model})`;

        // Async non-blocking telemetry to Langfuse
        recordLangfuseGeneration({
          traceName: 'bedrock_ai_completion',
          model: modelName,
          input: { systemPrompt, prompt },
          output: text,
          userId,
          startTime,
          endTime: new Date(),
          metadata: { providerId: provider.id, providerModel: provider.model },
        }).catch((e) => console.warn('[Langfuse] Error in recordLangfuseGeneration:', e));

        return {
          text,
          model: modelName,
        };
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
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
        throw err;
      }
    }
  }

  // Record failure trace in Langfuse
  recordLangfuseGeneration({
    traceName: 'bedrock_ai_completion',
    model: 'all_providers_failed',
    input: { systemPrompt, prompt },
    output: null,
    userId,
    startTime,
    endTime: new Date(),
    level: 'ERROR',
    statusMessage: lastError?.message || 'All providers failed',
  }).catch((e) => console.warn('[Langfuse] Error reporting failure:', e));

  throw new Error(
    `All AI providers failed under load. Last error: ${lastError?.message || 'Unknown provider error'}`
  );
}
