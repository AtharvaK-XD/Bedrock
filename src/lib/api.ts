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
  const response = await fetch('/api/ai/refine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPrompt, followUp }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Backend Proxy API Error:', errText);
    throw new ApiError('Failed to refine prompt via backend', true, 'Backend API', response.status);
  }

  const data = await response.json();
  return data as {updatedMarkdown: string, summary: string};
};

export const testPrompt = async (modelId: string, systemPrompt: string, userPrompt: string): Promise<string> => {
  const response = await fetch('/api/ai/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, systemPrompt, userPrompt }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Backend Proxy API Error:', errText);
    throw new ApiError('Failed to test prompt via backend', true, 'Backend API', response.status);
  }

  const data = await response.json();
  return data.content || '';
};

// Workflows API
export const loadWorkflows = async () => {
  const response = await fetch('/api/workflows');
  if (!response.ok) throw new Error('Failed to load workflows');
  return response.json();
};

export const saveWorkflow = async (workflow: { id?: string, title: string, nodes: any[], edges: any[] }) => {
  const response = await fetch('/api/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow)
  });
  if (!response.ok) throw new Error('Failed to save workflow');
  return response.json();
};

export const deleteWorkflow = async (id: string) => {
  const response = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete workflow');
  return response.json();
};
