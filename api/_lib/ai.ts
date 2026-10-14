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

function getApiKey(provider: 'groq' | 'gemini' | 'openrouter'): string {
  if (provider === 'groq') {
    return process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || '';
  }
  if (provider === 'gemini') {
    return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
  }
  return process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || '';
}

/**
 * Calls Groq chat completions with optional streaming
 */
async function callGroq(
  prompt: string,
  systemPrompt?: string,
  model = 'llama-3.3-70b-versatile',
  onToken?: (token: string) => void
): Promise<string> {
  const key = getApiKey('groq');
  if (!key) throw new Error('GROQ_API_KEY is not configured on the server.');

  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const isStreaming = typeof onToken === 'function';

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 3500,
      stream: isStreaming,
    }),
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
}

/**
 * Calls Google Gemini REST API with optional SSE streaming
 */
async function callGemini(
  prompt: string,
  systemPrompt?: string,
  model = 'gemini-flash-lite-latest',
  onToken?: (token: string) => void
): Promise<string> {
  const key = getApiKey('gemini');
  if (!key) throw new Error('GEMINI_API_KEY is not configured on the server.');

  const candidates = (model === 'gemini-2.5-flash' || model === 'gemini-1.5-flash')
    ? ['gemini-flash-lite-latest', 'gemini-flash-latest']
    : [model, 'gemini-flash-lite-latest', 'gemini-flash-latest'];

  const isStreaming = typeof onToken === 'function';
  let lastError: Error | null = null;

  for (const m of candidates) {
    try {
      const endpoint = isStreaming ? 'streamGenerateContent?alt=sse&key=' : 'generateContent?key=';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:${endpoint}${key}`;
      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
      };
      if (systemPrompt) {
        body.systemInstruction = { parts: [{ text: systemPrompt }] };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
  onToken?: (token: string) => void
): Promise<string> {
  const key = getApiKey('openrouter');
  if (!key) throw new Error('OPENROUTER_API_KEY is not configured on the server.');

  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const isStreaming = typeof onToken === 'function';

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
      temperature: 0.3,
      max_tokens: 3000,
      stream: isStreaming,
    }),
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
  onToken?: (token: string) => void
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

  // Helper to execute a single provider
  const dispatchToProvider = async (target: ProviderTarget): Promise<string> => {
    if (target.id === 'groq-llama-70b') {
      return await callGroq(prompt, systemPrompt, 'llama-3.3-70b-versatile', onToken);
    }
    if (target.id === 'groq-llama-8b') {
      return await callGroq(prompt, systemPrompt, 'llama-3.1-8b-instant', onToken);
    }
    if (target.id === 'groq-deepseek') {
      return await callGroq(prompt, systemPrompt, 'deepseek-r1-distill-llama-70b', onToken);
    }
    if (target.id === 'gemini-flash') {
      return await callGemini(prompt, systemPrompt, 'gemini-flash-latest', onToken);
    }
    if (target.id === 'openrouter-gpt4o') {
      return await callOpenRouter(prompt, systemPrompt, 'openai/gpt-4o-mini', onToken);
    }
    // Fallback dynamic routing by model identifier
    if (target.model.includes('llama') || target.id.startsWith('groq')) {
      return await callGroq(prompt, systemPrompt, target.model, onToken);
    }
    if (target.model.includes('gemini') || target.id.startsWith('gemini')) {
      return await callGemini(prompt, systemPrompt, target.model, onToken);
    }
    return await callOpenRouter(prompt, systemPrompt, target.model, onToken);
  };

  // 2. Select optimal provider via distributed round-robin / circuit health
  const primaryChoice = (await selectOptimalProvider(candidates)) || candidates[0];

  // Order providers starting with the primary choice, followed by healthy alternates
  const executionOrder = [
    primaryChoice,
    ...candidates.filter((c) => c.id !== primaryChoice.id),
  ];

  let lastError: Error | null = null;

  for (const provider of executionOrder) {
    try {
      const text = await dispatchToProvider(provider);
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
      console.warn(`[LoadBalancer] Provider ${provider.name} failed:`, err?.message || err);
      await recordProviderFailure(provider.id, err?.message || String(err));
      lastError = err;
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
