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
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_API_KEYS) : null;
    const parsed = raw ? JSON.parse(raw) : {};

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
      geminiKey: (import.meta.env.VITE_GEMINI_API_KEY || '').trim(),
      groqKey: (import.meta.env.VITE_GROQ_API_KEY || '').trim(),
      openAiKey: (import.meta.env.VITE_OPENAI_API_KEY || '').trim(),
      anthropicKey: (import.meta.env.VITE_ANTHROPIC_API_KEY || '').trim(),
      openRouterKey: (import.meta.env.VITE_OPENROUTER_API_KEY || '').trim(),
      huggingFaceKey: (import.meta.env.VITE_HUGGINGFACE_API_KEY || '').trim(),
      ollamaEndpoint: 'http://localhost:11434',
    };
  }
}

// Resilient Gemini Direct Client
async function callGemini(
  prompt: string,
  systemInstruction?: string,
  apiKey?: string,
  targetModel?: string,
  temperature = 0.7
): Promise<string> {
  const key = apiKey || getActiveApiKeys().geminiKey;
  if (!key) {
    throw new ApiError('Google Gemini API Key is required.', true, 'Google Gemini', 401);
  }

  const modelsToTry = targetModel
    ? [targetModel, 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash']
    : ['gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.5-flash'];

  const uniqueModels = Array.from(new Set(modelsToTry));
  let lastError: Error | null = null;

  for (const model of uniqueModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature },
      };
      if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }

      const errText = await response.text();
      const parsedErr = parseApiErrorResponse('Google Gemini', response.status, errText);
      if (parsedErr.isApiKeyError) {
        throw parsedErr;
      }
      lastError = parsedErr;
      console.warn(`[Gemini] Model ${model} failed (${response.status}), trying next fallback...`);
    } catch (err: any) {
      if (err.isApiKeyError) throw err;
      lastError = err;
    }
  }

  throw lastError || new ApiError('Failed to generate response from Google Gemini', false, 'Google Gemini');
}

// Resilient Groq Direct Client
async function callGroq(
  prompt: string,
  systemPrompt?: string,
  apiKey?: string,
  targetModel?: string,
  temperature = 0.7
): Promise<string> {
  const key = apiKey || getActiveApiKeys().groqKey;
  if (!key) {
    throw new ApiError('Groq API Key is required.', true, 'Groq', 401);
  }

  const modelsToTry = targetModel
    ? [targetModel, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'llama-3.1-8b-instant']
    : ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

  const uniqueModels = Array.from(new Set(modelsToTry));
  let lastError: Error | null = null;

  for (const model of uniqueModels) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
          temperature,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) return text;
      }

      const errText = await response.text();
      const parsedErr = parseApiErrorResponse('Groq', response.status, errText);
      if (parsedErr.isApiKeyError) {
        throw parsedErr;
      }
      lastError = parsedErr;
      console.warn(`[Groq] Model ${model} failed (${response.status}), trying next fallback...`);
    } catch (err: any) {
      if (err.isApiKeyError) throw err;
      lastError = err;
    }
  }

  throw lastError || new ApiError('Failed to generate response from Groq', false, 'Groq');
}

// Resilient OpenAI Direct Client
async function callOpenAi(
  prompt: string,
  systemPrompt?: string,
  apiKey?: string,
  targetModel = 'gpt-4o',
  temperature = 0.7
): Promise<string> {
  const key = apiKey || getActiveApiKeys().openAiKey;
  if (!key) {
    throw new ApiError('OpenAI API Key is required.', true, 'OpenAI', 401);
  }

  const models = [targetModel, 'gpt-4o-mini', 'gpt-4o'];
  const uniqueModels = Array.from(new Set(models));
  let lastError: Error | null = null;

  for (const model of uniqueModels) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
          temperature,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
      }

      const errText = await response.text();
      const parsedErr = parseApiErrorResponse('OpenAI', response.status, errText);
      if (parsedErr.isApiKeyError) throw parsedErr;
      lastError = parsedErr;
    } catch (err: any) {
      if (err.isApiKeyError) throw err;
      lastError = err;
    }
  }

  throw lastError || new ApiError('Failed to generate response from OpenAI', false, 'OpenAI');
}

// Resilient OpenRouter Direct Client
async function callOpenRouter(
  prompt: string,
  systemPrompt?: string,
  apiKey?: string,
  targetModel = 'openai/gpt-4o-mini',
  temperature = 0.7
): Promise<string> {
  const key = apiKey || getActiveApiKeys().openRouterKey;
  if (!key) {
    throw new ApiError('OpenRouter API Key is required.', true, 'OpenRouter', 401);
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://bedrock.app',
      'X-Title': 'Bedrock Studio',
    },
    body: JSON.stringify({
      model: targetModel,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
      temperature,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw parseApiErrorResponse('OpenRouter', response.status, errText);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Universal Client AI Dispatcher
export async function callClientAi(
  userPrompt: string,
  systemPrompt?: string,
  options?: {
    preferredProvider?: 'gemini' | 'groq' | 'openai' | 'openrouter' | 'huggingface';
    preferredModel?: string;
    temperature?: number;
  }
): Promise<string> {
  const keys = getActiveApiKeys();

  // Try preferred provider first
  if (options?.preferredProvider === 'gemini' && keys.geminiKey) {
    return await callGemini(userPrompt, systemPrompt, keys.geminiKey, options.preferredModel, options.temperature);
  }
  if (options?.preferredProvider === 'groq' && keys.groqKey) {
    return await callGroq(userPrompt, systemPrompt, keys.groqKey, options.preferredModel, options.temperature);
  }
  if (options?.preferredProvider === 'openai' && keys.openAiKey) {
    return await callOpenAi(userPrompt, systemPrompt, keys.openAiKey, options.preferredModel, options.temperature);
  }
  if (options?.preferredProvider === 'openrouter' && keys.openRouterKey) {
    return await callOpenRouter(userPrompt, systemPrompt, keys.openRouterKey, options.preferredModel, options.temperature);
  }

  // Fallback in order of availability: Gemini -> Groq -> OpenAI -> OpenRouter
  if (keys.geminiKey) {
    return await callGemini(userPrompt, systemPrompt, keys.geminiKey, options?.preferredModel, options?.temperature);
  }
  if (keys.groqKey) {
    return await callGroq(userPrompt, systemPrompt, keys.groqKey, options?.preferredModel, options?.temperature);
  }
  if (keys.openAiKey) {
    return await callOpenAi(userPrompt, systemPrompt, keys.openAiKey, options?.preferredModel, options?.temperature);
  }
  if (keys.openRouterKey) {
    return await callOpenRouter(userPrompt, systemPrompt, keys.openRouterKey, options?.preferredModel, options?.temperature);
  }

  throw new ApiError(
    'Please enter your Google Gemini or Groq API key in the app to start generating prompts.',
    true,
    'Bedrock Workspace',
    401
  );
}

function getFallbackQuestions(targetType: IdeaPayload['targetType']): Question[] {
  if (targetType === 'hackathon_pitch') {
    return [
      {
        id: 'hackathon_track',
        questionText: 'Which prize track or evaluation criteria is this hackathon pitch prioritizing?',
        questionType: 'single_select',
        options: ['Grand Prize / Overall Innovation', 'Best AI / LLM Implementation', 'Best UI / UX Experience', 'Enterprise / B2B Utility', 'Open Source Impact'],
      },
      {
        id: 'demo_focus',
        questionText: 'What is the "wow factor" moment in the live 2-minute demo?',
        questionType: 'free_text',
      },
      {
        id: 'tech_stack',
        questionText: 'What stack will allow your team to ship the MVP fastest?',
        questionType: 'single_select',
        options: ['React + Vite + FastAPI', 'Next.js + Supabase', 'Mobile (React Native / Expo)', 'Browser Extension + Cloud Functions'],
      },
    ];
  }

  if (targetType === 'freelancer_brief') {
    return [
      {
        id: 'deliverables',
        questionText: 'What is the primary deliverable for this freelance contract?',
        questionType: 'single_select',
        options: ['Production-ready Fullstack App', 'Frontend UI / Figma Implementation', 'API / Backend Architecture', 'Prototype / MVP for Investors'],
      },
      {
        id: 'timeline_budget',
        questionText: 'What is the target delivery timeline and milestone structure?',
        questionType: 'free_text',
      },
      {
        id: 'tech_stack',
        questionText: 'Are there mandatory client technologies or hosting providers?',
        questionType: 'multi_select',
        options: ['AWS / Cloudflare', 'Vercel / Next.js', 'PostgreSQL / Supabase', 'Docker / Kubernetes', 'Stripe / Payment Gateways'],
      },
    ];
  }

  return [
    {
      id: 'tech_stack',
      questionText: 'What is the primary target tech stack or ecosystem for this project?',
      questionType: 'single_select',
      options: [
        'React / TypeScript / Vite',
        'Next.js Fullstack (App Router)',
        'Node.js / Express backend',
        'Python / FastAPI / AI Agents',
        'Mobile (React Native / Flutter)',
      ],
    },
    {
      id: 'key_features',
      questionText: 'What core feature must be prioritized in the initial release (MVP)?',
      questionType: 'free_text',
    },
    {
      id: 'integrations',
      questionText: 'Which external integrations or third-party services are required?',
      questionType: 'multi_select',
      options: [
        'AI / LLM APIs (Gemini, Groq, OpenAI)',
        'Database & ORM (PostgreSQL / SQLite / Prisma)',
        'User Authentication (OAuth / JWT / Clerk)',
        'Payments & Billing (Stripe / Razorpay)',
        'Real-time WebSocket / Events',
      ],
    },
  ];
}

export const generateQuestions = async (payload: IdeaPayload): Promise<Question[]> => {
  const keys = getActiveApiKeys();
  const hasClientKey = Boolean(
    keys.geminiKey || keys.groqKey || keys.openAiKey || keys.openRouterKey || keys.huggingFaceKey
  );

  if (hasClientKey) {
    const systemPrompt = `You are an elite product manager and technical architect.
Your task is to analyze the user's idea and generate exactly 3 to 4 clarifying questions to scope the project.
Output MUST be strictly valid JSON array of objects without markdown fences, comments, or backticks.
Each object in the array must strictly have:
- "id": string (e.g. "q1", "q2", "q3")
- "questionText": string
- "questionType": "single_select" | "multi_select" | "free_text"
- "options": string[] (required for "single_select" and "multi_select", omit for "free_text")`;

    const userPrompt = `Project Target Audience/Output Type: ${payload.targetType}
Idea: ${payload.ideaText}

Generate 3 to 4 essential clarifying questions as a JSON array.`;

    try {
      const raw = await callClientAi(userPrompt, systemPrompt, { temperature: 0.5 });
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validatedQuestions: Question[] = parsed.map((item, index) => ({
          id: String(item.id || `q${index + 1}`),
          questionText: String(item.questionText || `Clarifying Question ${index + 1}`),
          questionType: ['single_select', 'multi_select', 'free_text'].includes(item.questionType)
            ? item.questionType
            : (Array.isArray(item.options) && item.options.length > 0 ? 'single_select' : 'free_text'),
          options: Array.isArray(item.options) && item.options.length > 0
            ? item.options.map((opt: any) => String(opt))
            : undefined,
        }));
        return validatedQuestions;
      }
    } catch (err: any) {
      if (err.isApiKeyError) {
        throw err;
      }
      console.warn('[Bedrock] Direct question generation parse error, falling back to curated questions:', err);
      return getFallbackQuestions(payload.targetType);
    }
  }

  // Fallback to backend if available
  try {
    const response = await fetch('/api/ai/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return (await response.json()) as Question[];
    }
  } catch (backendErr) {
    console.warn('[Bedrock] Backend not available:', backendErr);
  }

  // If no client keys were configured
  if (!hasClientKey) {
    throw new ApiError(
      'Please enter your Google Gemini or Groq API key in the app to start generating prompts.',
      true,
      'Bedrock Workspace',
      401
    );
  }

  return getFallbackQuestions(payload.targetType);
};

export const synthesizePrompt = async (
  idea: IdeaPayload,
  answers: Answer[],
  questions: Question[]
): Promise<string> => {
  const keys = getActiveApiKeys();
  const hasClientKey = Boolean(
    keys.geminiKey || keys.groqKey || keys.openAiKey || keys.openRouterKey || keys.huggingFaceKey
  );

  const answersText = answers
    .map((a) => {
      const q = questions.find((item) => item.id === a.questionId);
      return `Q: ${q?.questionText || a.questionId}\nA: ${Array.isArray(a.value) ? a.value.join(', ') : a.value}`;
    })
    .join('\n\n');

  const systemPrompt = `You are an expert software architect and prompt engineering director.
A user wants to build a project.
Based on the project requirements and answers, write a comprehensive, highly-detailed Project Brief and Implementation Plan.
Include sections for:
- Executive Summary & Core Objective
- Master System Prompt (contained in a clean markdown codeblock ready for Claude / Cursor / Windsurf / Gemini)
- Functional Requirements & Architecture
- Edge Cases, Security Hardening & Quality Rubric.
Format this entirely in clean GitHub-flavored Markdown.`;

  const userPrompt = `Target Audience / Output Type: ${idea.targetType}
Initial Idea: ${idea.ideaText}

Clarifying Questions and Answers:
${answersText}

Produce the complete Project Brief & Master Prompt.`;

  if (hasClientKey) {
    return await callClientAi(userPrompt, systemPrompt, { temperature: 0.7 });
  }

  // Fallback to backend if available
  try {
    const response = await fetch('/api/ai/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea, answers, questions }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.content || '';
    }
  } catch (err) {
    console.warn('[Bedrock] Backend synthesis not available:', err);
  }

  throw new ApiError(
    'No API key configured. Please set your Google Gemini or Groq key to synthesize prompt.',
    true,
    'Bedrock Workspace',
    401
  );
};

export const refinePrompt = async (
  currentPrompt: string,
  followUp: string
): Promise<{ updatedMarkdown: string; summary: string }> => {
  const keys = getActiveApiKeys();
  const hasClientKey = Boolean(
    keys.geminiKey || keys.groqKey || keys.openAiKey || keys.openRouterKey || keys.huggingFaceKey
  );

  if (hasClientKey) {
    const systemPrompt = `You are a precision prompt architect.
The user has provided an existing prompt and feedback. Rewrite the prompt completely incorporating the feedback.
Respond ONLY with a valid JSON object matching this schema:
{
  "updatedMarkdown": "the complete rewritten prompt document string",
  "summary": "a 2-3 sentence explanation of the revisions made"
}`;

    const userPrompt = `Current Prompt Document:\n${currentPrompt}\n\nRequested Revisions:\n${followUp}`;

    try {
      const raw = await callClientAi(userPrompt, systemPrompt, { temperature: 0.5 });
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed.updatedMarkdown === 'string') {
        return {
          updatedMarkdown: parsed.updatedMarkdown,
          summary: parsed.summary || `Updated prompt incorporating user feedback: "${followUp.slice(0, 100)}"`,
        };
      }
    } catch {
      // If model returned plain text markdown directly without JSON envelope
      const raw = await callClientAi(userPrompt, systemPrompt, { temperature: 0.5 });
      return {
        updatedMarkdown: raw.startsWith('{') ? currentPrompt : raw,
        summary: `Updated prompt incorporating user feedback: "${followUp.slice(0, 100)}"`,
      };
    }
  }

  // Fallback to backend
  try {
    const response = await fetch('/api/ai/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPrompt, followUp }),
    });

    if (response.ok) {
      return (await response.json()) as { updatedMarkdown: string; summary: string };
    }
  } catch (err) {
    console.warn('[Bedrock] Backend refine not available:', err);
  }

  throw new ApiError(
    'No API key configured. Please set your Google Gemini or Groq key to refine prompt.',
    true,
    'Bedrock Workspace',
    401
  );
};

export const testPrompt = async (
  modelId: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> => {
  const keys = getActiveApiKeys();
  const lowerModel = modelId.toLowerCase();

  // 1. Gemini
  if (lowerModel.includes('gemini') && keys.geminiKey) {
    const targetModel =
      modelId === 'gemini-2.5-flash' || modelId === 'gemini'
        ? 'gemini-3.5-flash-lite'
        : modelId;
    return await callGemini(userPrompt, systemPrompt, keys.geminiKey, targetModel);
  }

  // 2. Groq
  if (
    (lowerModel.includes('llama') ||
      lowerModel.includes('oss') ||
      lowerModel.includes('qwen') ||
      lowerModel.includes('groq')) &&
    keys.groqKey
  ) {
    const targetModel =
      modelId === 'llama-3.3-70b-versatile' || modelId === 'llama' || modelId === 'groq'
        ? 'openai/gpt-oss-120b'
        : modelId;
    return await callGroq(userPrompt, systemPrompt, keys.groqKey, targetModel);
  }

  // 3. OpenAI
  if ((lowerModel.includes('gpt') || lowerModel.includes('openai')) && keys.openAiKey) {
    return await callOpenAi(userPrompt, systemPrompt, keys.openAiKey, modelId);
  }

  // 4. Hugging Face
  if (modelId.startsWith('hf/') && keys.huggingFaceKey) {
    const realModel = modelId.replace('hf/', '');
    const res = await fetch(
      `https://api-inference.huggingface.co/models/${realModel}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${keys.huggingFaceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: realModel,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 1024,
        }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }
  }

  // 5. OpenRouter
  if (modelId.includes('/') && keys.openRouterKey) {
    return await callOpenRouter(userPrompt, systemPrompt, keys.openRouterKey, modelId);
  }

  // 6. Generic client AI fallback using whichever key IS configured
  const hasAnyKey = Boolean(
    keys.geminiKey || keys.groqKey || keys.openAiKey || keys.openRouterKey || keys.huggingFaceKey
  );
  if (hasAnyKey) {
    return await callClientAi(userPrompt, systemPrompt);
  }

  // 7. Backend proxy fallback
  try {
    const response = await fetch('/api/ai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId, systemPrompt, userPrompt }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.content || '';
    }
  } catch (err) {
    console.warn('[Bedrock] Backend test not available:', err);
  }

  throw new ApiError(
    'Please set your API key (Gemini, Groq, OpenAI) to test prompts in the arena.',
    true,
    'Bedrock Workspace',
    401
  );
};

// Workflows API with localStorage fallback for offline / desktop support
const WORKFLOWS_STORAGE_KEY = 'bedrock_saved_workflows';

export const loadWorkflows = async () => {
  try {
    const response = await fetch('/api/workflows');
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Offline / desktop fallback
  }

  try {
    const raw = localStorage.getItem(WORKFLOWS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveWorkflow = async (workflow: { id?: string; title: string; nodes: any[]; edges: any[] }) => {
  try {
    const response = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflow),
    });
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Offline / desktop fallback
  }

  try {
    const existing = await loadWorkflows();
    const id = workflow.id || `wf_${Date.now()}`;
    const newWf = { ...workflow, id, updatedAt: new Date().toISOString() };
    const filtered = Array.isArray(existing) ? existing.filter((w: any) => w.id !== id) : [];
    filtered.unshift(newWf);
    localStorage.setItem(WORKFLOWS_STORAGE_KEY, JSON.stringify(filtered));
    return newWf;
  } catch {
    return workflow;
  }
};

export const deleteWorkflow = async (id: string) => {
  try {
    const response = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Offline / desktop fallback
  }

  try {
    const existing = await loadWorkflows();
    const filtered = Array.isArray(existing) ? existing.filter((w: any) => w.id !== id) : [];
    localStorage.setItem(WORKFLOWS_STORAGE_KEY, JSON.stringify(filtered));
    return { success: true };
  } catch {
    return { success: true };
  }
};
