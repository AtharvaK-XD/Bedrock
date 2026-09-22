import { isDesktopApp } from './platform';

export interface IdeaPayload {
  ideaText: string;
  targetType: 'coding_agent' | 'freelancer_brief' | 'hackathon_pitch' | 'no_code';
}

export interface Question {
  id: string;
  questionText: string;
  questionType: 'single_select' | 'multi_select' | 'free_text';
  options?: string[];
}

export interface Answer {
  questionId: string;
  value: string | string[];
}

export class ApiError extends Error {
  isApiKeyError: boolean;
  provider: string;
  statusCode?: number;

  constructor(message: string, isApiKeyError = false, provider = 'AI Provider', statusCode?: number) {
    super(message);
    this.name = 'ApiError';
    this.isApiKeyError = isApiKeyError;
    this.provider = provider;
    this.statusCode = statusCode;
  }
}

export function parseApiErrorResponse(provider: string, status: number, rawText: string): ApiError {
  let message = rawText;
  let isKeyError = status === 401 || status === 403;

  try {
    const json = JSON.parse(rawText);
    if (json?.error?.message) {
      message = json.error.message;
    } else if (json?.message) {
      message = json.message;
    }

    const reason = json?.error?.details?.[0]?.reason || json?.error?.code || json?.error?.status || '';
    const fullJsonStr = JSON.stringify(json).toLowerCase();

    if (
      reason === 'API_KEY_INVALID' ||
      fullJsonStr.includes('api_key_invalid') ||
      fullJsonStr.includes('api key not valid') ||
      fullJsonStr.includes('invalid api key') ||
      fullJsonStr.includes('incorrect api key') ||
      fullJsonStr.includes('invalid_api_key') ||
      fullJsonStr.includes('unauthorized') ||
      fullJsonStr.includes('authentication') ||
      fullJsonStr.includes('permission denied')
    ) {
      isKeyError = true;
    }
  } catch {
    const lower = rawText.toLowerCase();
    if (
      lower.includes('api_key_invalid') ||
      lower.includes('api key not valid') ||
      lower.includes('invalid api key') ||
      lower.includes('incorrect api key') ||
      lower.includes('invalid_api_key')
    ) {
      isKeyError = true;
    }
  }

  if (isKeyError) {
    return new ApiError(
      `Your ${provider} API key is invalid or not active. Please update your API key to continue.`,
      true,
      provider,
      status
    );
  }

  return new ApiError(`${provider} Error (${status}): ${message}`, false, provider, status);
}

const STORAGE_KEY_API_KEYS = 'bedrock_api_keys';

export function getActiveApiKeys() {
  const isDesktop = isDesktopApp();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_API_KEYS);
    const parsed = raw ? JSON.parse(raw) : {};

    // In Desktop App, ONLY use keys explicitly configured by the user in the app.
    // Avoid falling back to baked-in dummy or stale environment variables.
    if (isDesktop) {
      return {
        geminiKey: (parsed.geminiKey || '').trim(),
        groqKey: (parsed.groqKey || '').trim(),
        openAiKey: (parsed.openAiKey || '').trim(),
        anthropicKey: (parsed.anthropicKey || '').trim(),
        openRouterKey: (parsed.openRouterKey || '').trim(),
        huggingFaceKey: (parsed.huggingFaceKey || '').trim(),
        ollamaEndpoint: (parsed.ollamaEndpoint || 'http://localhost:11434').trim(),
      };
    }

    return {
      geminiKey: (parsed.geminiKey || import.meta.env.VITE_GEMINI_API_KEY || '').trim(),
      groqKey: (parsed.groqKey || import.meta.env.VITE_GROQ_API_KEY || '').trim(),
      openAiKey: (parsed.openAiKey || import.meta.env.VITE_OPENAI_API_KEY || '').trim(),
      anthropicKey: (parsed.anthropicKey || import.meta.env.VITE_ANTHROPIC_API_KEY || '').trim(),
      openRouterKey: (parsed.openRouterKey || import.meta.env.VITE_OPENROUTER_API_KEY || '').trim(),
      huggingFaceKey: (parsed.huggingFaceKey || import.meta.env.VITE_HUGGINGFACE_API_KEY || '').trim(),
      ollamaEndpoint: (parsed.ollamaEndpoint || 'http://localhost:11434').trim(),
    };
  } catch {
    return {
      geminiKey: '',
      groqKey: '',
      openAiKey: '',
      anthropicKey: '',
      openRouterKey: '',
      huggingFaceKey: '',
      ollamaEndpoint: 'http://localhost:11434',
    };
  }
}

export const generateQuestions = async (payload: IdeaPayload): Promise<Question[]> => {
  const response = await fetch('/api/ai/generate-questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Backend Proxy API Error:', errText);
    throw new ApiError('Failed to generate questions via backend', true, 'Backend API', response.status);
  }

  const data = await response.json();
  return data as Question[];
};

export const synthesizePrompt = async (
  idea: IdeaPayload,
  answers: Answer[],
  questions: Question[]
): Promise<string> => {
  const keys = getActiveApiKeys();

  const answersText = answers.map(a => {
    const q = questions.find(q => q.id === a.questionId);
    return `Q: ${q?.questionText}\nA: ${Array.isArray(a.value) ? a.value.join(', ') : a.value}`;
  }).join('\n\n');

  const prompt = `You are an expert software architect and prompt engineering director. 
A user wants to build a project.

Target Audience / Output Type: ${idea.targetType}
Initial Idea: ${idea.ideaText}

Here are the clarifying questions and their answers:
${answersText}

Based on all of this, write a comprehensive, highly-detailed Project Brief and Implementation Plan. 
Include sections for:
- Executive Summary
- Core System Prompt (ready to copy into Claude / Cursor / Windsurf / Gemini)
- Functional Requirements & Architecture
- Edge Cases & Quality Rubric.
Format this entirely in clean GitHub-flavored Markdown.`;

  if (keys.geminiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${keys.geminiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API Error:', errText);
      throw parseApiErrorResponse('Google Gemini', response.status, errText);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else if (keys.groqKey) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keys.groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq API Error:', errText);
      throw parseApiErrorResponse('Groq', response.status, errText);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } else if (keys.openAiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keys.openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI API Error:', errText);
      throw parseApiErrorResponse('OpenAI', response.status, errText);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } else {
    throw new ApiError(
      'No API key configured. Please set your Google Gemini or Groq key to synthesize prompt.',
      true,
      'System'
    );
  }
};

export const refinePrompt = async (currentPrompt: string, followUp: string): Promise<{updatedMarkdown: string, summary: string}> => {
  const keys = getActiveApiKeys();

  const prompt = `You are an expert prompt engineer. You have drafted this markdown document:
${currentPrompt}

The user has provided this follow-up feedback:
"${followUp}"

Please completely rewrite the markdown document incorporating this feedback. 
Respond ONLY with a valid JSON object. Do not include any conversational filler or markdown formatting around the JSON (e.g. no \`\`\`json).
The JSON object must have exactly two keys:
- "updatedMarkdown": The complete updated markdown document as a string.
- "summary": A detailed summary (2-3 sentences) explaining exactly what you added, changed, or removed based on the user's feedback.`;

  let content = '';

  if (keys.geminiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${keys.geminiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API Error:', errText);
      throw parseApiErrorResponse('Google Gemini', response.status, errText);
    }

    const data = await response.json();
    content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  } else if (keys.groqKey) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keys.groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq API Error:', errText);
      throw parseApiErrorResponse('Groq', response.status, errText);
    }

    const data = await response.json();
    content = data.choices?.[0]?.message?.content || '{}';
  } else if (keys.openAiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keys.openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI API Error:', errText);
      throw parseApiErrorResponse('OpenAI', response.status, errText);
    }

    const data = await response.json();
    content = data.choices?.[0]?.message?.content || '{}';
  } else {
    throw new ApiError(
      'No API key configured for prompt refinement. Please enter a valid API key.',
      true,
      'System'
    );
  }

  try {
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr) as {updatedMarkdown: string, summary: string};
  } catch {
    console.error('Failed to parse JSON', content);
    throw new Error('Invalid JSON received from AI engine.');
  }
};

export const testPrompt = async (modelId: string, systemPrompt: string, userPrompt: string): Promise<string> => {
  const keys = getActiveApiKeys();

  // Hugging Face serverless models
  if (modelId.startsWith('hf/')) {
    if (!keys.huggingFaceKey) {
      throw new ApiError('Please configure your Hugging Face API key in Settings to test this model.', true, 'Hugging Face');
    }
    const realModelId = modelId.replace('hf/', '');
    const response = await fetch(`https://api-inference.huggingface.co/models/${realModelId}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keys.huggingFaceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: realModelId,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1024
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw parseApiErrorResponse('Hugging Face', response.status, errText);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // OpenRouter models
  if (modelId.includes('/')) {
    if (!keys.openRouterKey) {
      throw new ApiError('Please configure your OpenRouter API key in Settings to test community models.', true, 'OpenRouter');
    }
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keys.openRouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: userPrompt }
        ]
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw parseApiErrorResponse('OpenRouter', response.status, errText);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // Google Gemini models
  const isGemini = modelId.toLowerCase().includes('gemini');
  if (isGemini) {
    if (!keys.geminiKey) {
      throw new ApiError('Please configure your Google Gemini API key in Settings or the API Keys panel.', true, 'Google Gemini');
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${keys.geminiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.7 }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw parseApiErrorResponse('Google Gemini', response.status, errText);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // Groq LLaMA models
  if (!keys.groqKey) {
    throw new ApiError('Please configure your Groq API key in Settings or the API Keys panel.', true, 'Groq');
  }

  const groqModel = modelId === 'llama-3-70b' ? 'llama-3.3-70b-versatile' 
    : modelId === 'llama-3-8b' ? 'llama-3.1-8b-instant'
    : 'llama-3.3-70b-versatile';

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${keys.groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: groqModel,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw parseApiErrorResponse('Groq', response.status, errText);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
};
