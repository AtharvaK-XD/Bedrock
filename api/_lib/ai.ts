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
 * Calls Groq chat completions
 */
async function callGroq(prompt: string, systemPrompt?: string, model = 'llama-3.3-70b-versatile'): Promise<string> {
  const key = getApiKey('groq');
  if (!key) throw new Error('GROQ_API_KEY is not configured on the server.');

  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 3000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API returned ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Calls Google Gemini REST API
 */
async function callGemini(prompt: string, systemPrompt?: string): Promise<string> {
  const key = getApiKey('gemini');
  if (!key) throw new Error('GEMINI_API_KEY is not configured on the server.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
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
    throw new Error(`Gemini API returned ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
  userId?: string
): Promise<{ text: string; model: string }> {
  const startTime = new Date();

  // 1. Gather all candidates that have valid API keys
  const groqAvailable = Boolean(getApiKey('groq'));
  const geminiAvailable = Boolean(getApiKey('gemini'));

  const candidates: ProviderTarget[] = AI_PROVIDERS.filter((p) => {
    if (p.id.startsWith('groq') && !groqAvailable) return false;
    if (p.id.startsWith('gemini') && !geminiAvailable) return false;
    return true;
  });

  if (candidates.length === 0) {
    throw new Error(
      'No AI providers configured on the server. Please ensure GROQ_API_KEY or GEMINI_API_KEY is configured in Vercel environment variables.'
    );
  }

  // Helper to execute a single provider
  const dispatchToProvider = async (target: ProviderTarget): Promise<string> => {
    if (target.id === 'groq-70b') {
      return await callGroq(prompt, systemPrompt, 'llama-3.3-70b-versatile');
    }
    if (target.id === 'groq-8b') {
      return await callGroq(prompt, systemPrompt, 'llama-3.1-8b-instant');
    }
    if (target.id === 'gemini-flash') {
      return await callGemini(prompt, systemPrompt);
    }
    throw new Error(`Unsupported provider: ${target.id}`);
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
