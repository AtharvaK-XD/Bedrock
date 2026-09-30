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

/**
 * Multi-provider execution with automatic fallback
 */
export async function executeAiCompletion(prompt: string, systemPrompt?: string): Promise<{ text: string; model: string }> {
  // 1. Try primary: Groq llama-3.3-70b
  if (getApiKey('groq')) {
    try {
      const text = await callGroq(prompt, systemPrompt, 'llama-3.3-70b-versatile');
      if (text.trim()) return { text, model: 'Groq/llama-3.3-70b' };
    } catch (err: any) {
      console.warn('[AI] Groq 70b failed, trying Groq 8b fallback:', err.message);
      try {
        const text = await callGroq(prompt, systemPrompt, 'llama-3.1-8b-instant');
        if (text.trim()) return { text, model: 'Groq/llama-3.1-8b' };
      } catch (err8b: any) {
        console.warn('[AI] Groq 8b fallback failed:', err8b.message);
      }
    }
  }

  // 2. Try secondary: Gemini 2.5 Flash
  if (getApiKey('gemini')) {
    try {
      const text = await callGemini(prompt, systemPrompt);
      if (text.trim()) return { text, model: 'Google/Gemini-2.5-Flash' };
    } catch (err: any) {
      console.warn('[AI] Gemini failed:', err.message);
    }
  }

  throw new Error('All server AI providers failed or are unconfigured. Please ensure GROQ_API_KEY or GEMINI_API_KEY is configured in Vercel environment variables.');
}
