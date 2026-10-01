import {
  BEDROCK_CORE_GUARDRAILS,
  buildRefineSystemPrompt,
  extractRefineResult,
  sanitizeRenderedPrompt,
} from './aiPrompts';

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

  if (targetType === 'no_code') {
    return [
      {
        id: 'nocode_platform',
        questionText: 'What is your primary visual builder platform?',
        questionType: 'single_select',
        options: [
          'Bubble.io (Fullstack Web App)',
          'FlutterFlow (Native iOS & Android)',
          'Webflow + Wized / Xano',
          'Airtable + Softr / Glide',
          'Retool / Appsmith (Internal Tool)',
        ],
      },
      {
        id: 'nocode_database',
        questionText: 'How will user data, collections, and records be stored and queried?',
        questionType: 'single_select',
        options: [
          'Platform Native DB (Bubble / FlutterFlow Firebase)',
          'Airtable Collections & Linked Records',
          'Supabase / PostgreSQL with RLS',
          'Xano Scalable No-Code Backend',
        ],
      },
      {
        id: 'nocode_automations',
        questionText: 'What automated workflows or webhook pipelines are required?',
        questionType: 'multi_select',
        options: [
          'Make.com (Integromat) Multi-step Scenarios',
          'Zapier Instant Webhook Triggers',
          'Payment Webhooks (Stripe / LemonSqueezy)',
          'Automated Email & SMS (SendGrid / Twilio / Resend)',
          'AI / OpenAI API Visual Action Nodes',
        ],
      },
    ];
  }

  // coding_agent (default)
  return [
    {
      id: 'tech_stack',
      questionText: 'What exact runtime & framework constraints must the coding agent follow?',
      questionType: 'single_select',
      options: [
        'React / TypeScript / Vite (Strict Mode)',
        'Next.js 15 App Router + Server Actions',
        'Node.js / Express / TypeScript backend',
        'Python / FastAPI / Pydantic AI Agents',
        'Mobile (React Native Expo + TypeScript)',
      ],
    },
    {
      id: 'schema_contracts',
      questionText: 'What database, ORM, or API validation schema should the agent implement?',
      questionType: 'single_select',
      options: [
        'Prisma ORM + PostgreSQL + Zod',
        'Drizzle ORM + SQLite/Turso + Zod',
        'Supabase JS Client + Database Types',
        'REST API with JSON Schema validation',
      ],
    },
    {
      id: 'negative_rules',
      questionText: 'What strict negative constraints must the AI agent NEVER break?',
      questionType: 'multi_select',
      options: [
        'NEVER use "any" types or loose assertions',
        'NEVER leave "// TODO" placeholder comments',
        'NEVER swallow errors without structured logging',
        'NEVER install unverified third-party libraries',
        'NEVER mutate state or props directly',
      ],
    },
  ];
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const clerk = (window as any).Clerk;
    if (clerk?.session) {
      const token = await clerk.session.getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // ignore
  }
  return headers;
}

export const generateQuestions = async (payload: IdeaPayload): Promise<Question[]> => {
  // 1. Try secure server-side generation first
  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch('/api/ai/generate-questions', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ ideaText: payload.ideaText, targetType: payload.targetType }),
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data as Question[];
      }
    }
  } catch (backendErr) {
    console.warn('[Bedrock] Server generation not available, falling back:', backendErr);
  }

  // 2. Client fallback if client keys configured
  const keys = getActiveApiKeys();
  const hasClientKey = Boolean(
    keys.geminiKey || keys.groqKey || keys.openAiKey || keys.openRouterKey || keys.huggingFaceKey
  );

  if (hasClientKey) {
    const systemPrompt = `You are an elite product manager and technical architect.
Your task is to analyze the user's idea and generate exactly 3 to 4 clarifying questions to scope the project.

${BEDROCK_CORE_GUARDRAILS}

Output MUST be strictly valid JSON array of objects without markdown fences, comments, or backticks.
Each object in the array must strictly have:
- "id": string (e.g. "q1", "q2", "q3")
- "questionText": string
- "questionType": "single_select" | "multi_select" | "free_text"
- "options": string[] (required for "single_select" and "multi_select", omit for "free_text")`;

    const targetGuidanceMap: Record<string, string> = {
      coding_agent: `TARGET FORMAT: CODING AGENT (DEV)
PURPOSE: The user is creating an AI coding prompt for autonomous agents (Cursor, Windsurf, Claude Code, GitHub Copilot).
YOUR QUESTIONS MUST FOCUS ON:
1. Exact runtime and framework constraints (e.g. Next.js 15 App Router vs Vite SPA, strict TypeScript mode).
2. Database, ORM & API contract layer (e.g. Prisma / Drizzle, PostgreSQL, tRPC or REST).
3. Testing harness (Vitest, Playwright) and strict agent negative constraints (what the AI agent must NEVER do, e.g. no 'any', no placeholder comments).`,

      freelancer_brief: `TARGET FORMAT: FREELANCER (BRIEF)
PURPOSE: The user is preparing a professional client Scope of Work (SOW), Upwork proposal, or agency deliverable.
YOUR QUESTIONS MUST FOCUS ON:
1. Primary client deliverables and project milestones (e.g. fullstack production app vs MVP vs Figma implementation).
2. Milestone schedule, delivery phases, and payment release triggers.
3. Design system requirements (Figma tokens, responsive breakpoints) and client handoff/hosting expectations.`,

      hackathon_pitch: `TARGET FORMAT: HACKATHON (PITCH)
PURPOSE: The user is preparing for a 24-48 hour hackathon, demo day, or investor pitch competition.
YOUR QUESTIONS MUST FOCUS ON:
1. Target prize category, judging track, or sponsor API bounty.
2. The 2-minute live demo "wow factor" moment that will make judges lean in and give high scores.
3. High-velocity rapid prototyping shortcuts and P0 must-have core flow vs P1 cut-list features.`,

      no_code: `TARGET FORMAT: NO-CODE (NOCODE)
PURPOSE: The user is building a visual application using visual app builders and automation pipelines (Bubble, FlutterFlow, Webflow, Make, Airtable).
YOUR QUESTIONS MUST FOCUS ON:
1. Primary visual builder platform (Bubble.io, FlutterFlow, Webflow + Wized, Softr, Glide, Retool).
2. Database structure and data persistence (Bubble DB, Airtable linked records, Supabase with RLS, Xano).
3. Automated workflows and webhook pipelines (Make.com multi-step scenarios, Zapier instant triggers, Stripe billing).`,
    };

    const targetGuidance = targetGuidanceMap[payload.targetType] || targetGuidanceMap.coding_agent;

    const userPrompt = `${targetGuidance}

Initial User Project Idea:
${payload.ideaText}

Generate exactly 3 to 4 essential clarifying questions as a JSON array tailored specifically to this mode's purpose.`;

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

  const systemPrompt = `You are an elite principal software architect and prompt engineering director.
Your mission is to generate a world-class, bespoke engineering specification and operational prompt tailored precisely to the user's project idea, target platform, and domain.

${BEDROCK_CORE_GUARDRAILS}

CRITICAL ARCHITECTURAL & FORMATTING DIRECTIVES:
1. BAN ON COOKIE-CUTTER REPETITION:
   - DO NOT use generic, robotic templates (e.g. NEVER default to the rigid "1. Executive Summary & Core Objective" 5-section boilerplate).
   - Tailor the structural anatomy of the document directly to the project domain, complexity, and target audience.

2. DYNAMICALLY SELECT THE OPTIMAL BLUEPRINT FORMAT:
   - For Coding Agents (Cursor / Windsurf / Claude / Copilot):
     Structure as an elite Agent Rulebook (.cursorrules / System Directive):
     * Role Definition & Architectural Philosophy
     * Master System Prompt block (encapsulated in a copy-pasteable markdown codeblock with strict XML tags <directives>, <constraints>, <workflow>)
     * File Tree Blueprint & Component Topology
     * Strict Negative Constraints ("NEVER DO X: e.g., never use any, never swallow errors, never import unverified packages")
     * Concrete Schema Contracts (exact TypeScript interfaces / Zod schemas / Prisma models)
     * Phased Step-by-Step Implementation Sequence with Verification Checklist
   - For Full-Stack Web / Mobile Systems:
     Structure as an End-to-End Production Architecture Blueprint:
     * System Overview & High-Impact Value Proposition
     * Architecture Topology (include a Mermaid diagram \`\`\`mermaid graph TD...\`\`\` for data and auth flows)
     * API Contract Matrix (using Markdown tables: Route | Method | Request Payload | Response)
     * Data Model & Persistence Layer (concrete schema definitions, indexes, relations)
     * Security & Auth Guardrails (CORS, JWT/Sessions, Rate Limiting, Input Sanitization)
     * Execution Milestones with Definition of Done
   - For CLI Tools / Microservices / Automation:
     Structure as a Dense Technical Specification:
     * Command Hierarchy & Flag Specification Tables
     * I/O Contract & Stream Pipelines (stdin, stdout, stderr, POSIX exit codes)
     * Error Recovery Strategies & Graceful Degradation
     * Unit & E2E Testing Protocol
   - For Freelance / Client Specifications:
     Structure as an Executive Scope of Work (SOW):
     * Project Scope & Business Objectives
     * Feature Deliverables Table (Feature | Priority | Acceptance Criteria)
     * UI/UX Design System Tokens & Responsive Breakpoints
     * Deployment & Handover Guide
   - For Hackathon / MVP:
     Structure as a Lean 24-Hour Sprint Plan:
     * Problem / Solution & The 10x Demo Flow
     * P0 Core Features vs P1 Stretch Goals
     * Rapid Prototyping Stack & Third-Party APIs
     * Demo Script & Judging Rubric Optimization

3. RICH MARKDOWN STYLING:
   - Use Markdown Tables for structured comparisons, APIs, or schema fields.
   - Use Mermaid diagrams (\`\`\`mermaid...\`\`\`) where data flow, user journey, or node pipelines benefit from visualization.
   - Use GitHub-flavored callouts (> [!IMPORTANT], > [!TIP], > [!WARNING]) for critical architectural warnings.
   - Provide concrete, syntactically valid code and type definitions rather than vague descriptive prose.

4. ACTIONABILITY:
   - The document must be immediately actionable by an autonomous AI coding agent or senior engineer to build the full system without ambiguities.`;

  const targetLabelMap: Record<string, string> = {
    coding_agent: 'Coding Agent (DEV)',
    freelancer_brief: 'Freelancer (BRIEF)',
    hackathon_pitch: 'Hackathon (PITCH)',
    no_code: 'No-Code (NOCODE)',
  };

  const targetDirectiveMap: Record<string, string> = {
    coding_agent: `MANDATORY BLUEPRINT FORMAT: ELITE CODING AGENT RULEBOOK (.cursorrules / AGENT.md)
The user explicitly selected "Coding Agent (DEV)". You MUST structure the entire document as a production-grade Agent Rulebook:
1. Role Definition & Architectural Philosophy (concise principal engineer persona).
2. Master System Prompt Block: Enclosed in a copy-pasteable markdown code block with strict XML directives (<directives>, <constraints>, <workflow>, <rules>, <verification_protocol>).
3. File Tree Topology & Module Architecture: Detailed file/directory map with exact file paths and specific responsibilities.
4. Strict Negative Constraints: "NEVER use any", "NEVER use placeholder comments like // TODO", "NEVER swallow errors", "NEVER mutate state directly".
5. Concrete Schema Contracts: Syntactically valid TypeScript interfaces, Zod schemas, and Prisma/Drizzle models.
6. Phased Implementation Sequence with Verification Checklist: Step-by-step order of operations with automated terminal verification commands (e.g. npm test, vitest, tsc --noEmit).`,

    freelancer_brief: `MANDATORY BLUEPRINT FORMAT: EXECUTIVE SCOPE OF WORK (SOW) & CLIENT PROJECT CHARTER
The user explicitly selected "Freelancer (BRIEF)". You MUST structure the entire document as a professional Scope of Work and client deliverables contract:
1. Executive Project Charter & Business Value Proposition (clear statement of what is being built and why).
2. Phased Milestone Deliverables Matrix (Markdown table: Milestone # | Deliverable | Est. Timeline | Acceptance Criteria | Payment Trigger).
3. UI/UX Design System Specification: Color palette hex tokens, font pairings, component state matrix, Figma asset mapping, and responsive breakpoints.
4. Client Handoff, Deployment & Staging Playbook: Production hosting setup (Vercel/AWS), credential management, domain DNS configuration, and client training walkthrough.
5. Scope Boundary Guardrails: Explicit "Out-of-Scope" protection clauses, revision limits, and formal change order terms to prevent client scope creep.`,

    hackathon_pitch: `MANDATORY BLUEPRINT FORMAT: LEAN HACKATHON MVP & PITCH BATTLE PLAN
The user explicitly selected "Hackathon (PITCH)". You MUST structure the entire document for winning a 24-48 hour hackathon, demo day, or pitch competition:
1. The 10x Pitch Hook & Problem-Solution Narrative (gripping 30-second opening statement, emotional pain point, and market timing: "why now?").
2. The 2-Minute Live Demo Flow Script (second-by-second click path with exact speaker talking points engineered to hit every judging criterion).
3. Lean 24-Hour Sprint Plan: P0 Core Flow (Hours 0-12: the critical happy path), Integration & UI Polish (Hours 12-18), Buffer & Demo Rehearsal (Hours 18-24).
4. Rapid Prototype Architecture & Shortcuts: Pre-built UI component libraries, managed auth (Clerk/Supabase), and pre-seeded mock APIs to eliminate boilerplate.
5. Hackathon Judging Rubric Optimization Checklist: Specific tactical strategies to score 10/10 on Innovation, Technical Depth, UI Polish, and Practical Impact.`,

    no_code: `MANDATORY BLUEPRINT FORMAT: VISUAL APPLICATION ARCHITECTURE & NO-CODE BLUEPRINT
The user explicitly selected "No-Code (NOCODE)". You MUST structure the entire document for building visual applications and automated workflows using platforms like Bubble, FlutterFlow, Webflow, Make, and Airtable:
1. Visual App Architecture & No-Code Platform Stack Selection (e.g. Webflow frontend + Supabase backend + Make.com automation pipeline).
2. Entity Relationship Diagram & Data Collections Table (Markdown table: Collection / Table | Field Name | Data Type | Relationships & Linked Records | Privacy Rules).
3. Visual Page & Component Topology: Page hierarchy, container layouts (Flexbox/Grid), repeating groups, custom states, and dynamic visibility conditionals.
4. Step-by-Step Automation & Webhook Recipes: Detailed visual workflow logic (Trigger Event -> Filter Condition -> Data Transformation -> Webhook POST -> Notification for Make/Zapier).
5. No-Code Limits, Workarounds & Security Guardrails: Securing sensitive API keys through backend proxies, pagination workarounds, webhook error retry handlers, and client data protection.`,
  };

  const selectedFormatName = targetLabelMap[idea.targetType] || idea.targetType;
  const selectedFormatDirective = targetDirectiveMap[idea.targetType] || targetDirectiveMap.coding_agent;

  const userPrompt = `Selected Target Format: ${selectedFormatName}
Initial Project Concept: ${idea.ideaText}

Clarifying Questions and Answers from User:
${answersText}

SPECIFIC FORMAT INSTRUCTION:
${selectedFormatDirective}

Produce the bespoke, publication-grade prompt document adhering strictly to this target purpose.`;

  // 1. Try secure backend synthesis first
  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch('/api/ai/synthesize', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ idea, answers, questions }),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.promptText || data.content || '';
      if (text) return text;
    }

    if (response.status === 429) {
      const errData = await response.json().catch(() => ({}));
      const quotaErr = new ApiError(
        errData.message || 'Free tier accounts can generate up to 10 prompts per 5-hour session. Please upgrade to Pro for unlimited prompts.',
        false,
        'Bedrock Vault',
        429
      );
      (quotaErr as any).code = 'FREE_TIER_QUOTA_EXCEEDED';
      throw quotaErr;
    }
  } catch (err: any) {
    if (err?.code === 'FREE_TIER_QUOTA_EXCEEDED' || err?.statusCode === 429) {
      throw err;
    }
    console.warn('[Bedrock] Server synthesis not available, falling back:', err);
  }

  // 2. Client fallback if client keys configured
  if (hasClientKey) {
    return await callClientAi(userPrompt, systemPrompt, { temperature: 0.7 });
  }

  throw new ApiError(
    'No API key configured. Please set your Google Gemini or Groq key in Settings or connect to Bedrock Cloud.',
    true,
    'Bedrock Workspace',
    401
  );
};

export const refinePrompt = async (
  currentPrompt: string,
  followUp: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<{ updatedMarkdown: string; summary: string }> => {
  const keys = getActiveApiKeys();
  const hasClientKey = Boolean(
    keys.geminiKey || keys.groqKey || keys.openAiKey || keys.openRouterKey || keys.huggingFaceKey
  );

  if (hasClientKey) {
    const systemPrompt = buildRefineSystemPrompt();

    const recentHistoryText = conversationHistory && conversationHistory.length > 0
      ? `\n\nRecent Refinement History:\n` +
        conversationHistory
          .slice(-6)
          .map(m => `${m.role === 'user' ? 'User' : 'Architect'}: ${m.content}`)
          .join('\n')
      : '';

    const userPrompt = `Current Prompt Document:\n${currentPrompt}${recentHistoryText}\n\nLatest User Feedback / Refinement Request:\n${followUp}`;

    try {
      const raw = await callClientAi(userPrompt, systemPrompt, { temperature: 0.4 });
      const extracted = extractRefineResult(raw, currentPrompt, followUp);
      if (extracted.updatedMarkdown) {
        return {
          updatedMarkdown: sanitizeRenderedPrompt(extracted.updatedMarkdown),
          summary: extracted.summary,
        };
      }
    } catch (err: any) {
      if (err.isApiKeyError) throw err;
      console.warn('[Bedrock] Direct refinement error, attempting retry...', err);
      try {
        const raw = await callClientAi(userPrompt, systemPrompt, { temperature: 0.3 });
        const extracted = extractRefineResult(raw, currentPrompt, followUp);
        return {
          updatedMarkdown: sanitizeRenderedPrompt(extracted.updatedMarkdown),
          summary: extracted.summary,
        };
      } catch (retryErr: any) {
        if (retryErr.isApiKeyError) throw retryErr;
        console.warn('[Bedrock] Client AI refinement failed:', retryErr);
      }
    }
  }

  // 1. Try secure backend refine first
  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch('/api/ai/refine', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ currentPrompt, instruction: followUp, conversationHistory }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.updatedMarkdown) {
        const extracted = extractRefineResult(data.updatedMarkdown, currentPrompt, followUp);
        return {
          updatedMarkdown: sanitizeRenderedPrompt(extracted.updatedMarkdown),
          summary: data.summary || extracted.summary,
        };
      }
    }
  } catch (err) {
    console.warn('[Bedrock] Server refine not available, falling back:', err);
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

  const effectiveSystemPrompt = systemPrompt
    ? `${systemPrompt}\n\n${BEDROCK_CORE_GUARDRAILS}`
    : BEDROCK_CORE_GUARDRAILS;

  // 1. Gemini
  if (lowerModel.includes('gemini') && keys.geminiKey) {
    const targetModel =
      modelId === 'gemini-2.5-flash' || modelId === 'gemini'
        ? 'gemini-3.5-flash-lite'
        : modelId;
    return await callGemini(userPrompt, effectiveSystemPrompt, keys.geminiKey, targetModel);
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
    return await callGroq(userPrompt, effectiveSystemPrompt, keys.groqKey, targetModel);
  }

  // 3. OpenAI
  if ((lowerModel.includes('gpt') || lowerModel.includes('openai')) && keys.openAiKey) {
    return await callOpenAi(userPrompt, effectiveSystemPrompt, keys.openAiKey, modelId);
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
            ...(effectiveSystemPrompt ? [{ role: 'system', content: effectiveSystemPrompt }] : []),
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
    return await callOpenRouter(userPrompt, effectiveSystemPrompt, keys.openRouterKey, modelId);
  }

  // 6. Generic client AI fallback using whichever key IS configured
  const hasAnyKey = Boolean(
    keys.geminiKey || keys.groqKey || keys.openAiKey || keys.openRouterKey || keys.huggingFaceKey
  );
  if (hasAnyKey) {
    return await callClientAi(userPrompt, effectiveSystemPrompt);
  }

  // 7. Backend proxy fallback
  try {
    const authHeaders = await getAuthHeaders();
    const response = await fetch('/api/ai/test', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ targetModel: modelId, systemPrompt: effectiveSystemPrompt, prompt: userPrompt }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.text || data.content || '';
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
    const authHeaders = await getAuthHeaders();
    const response = await fetch('/api/workflows', { headers: authHeaders });
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
    const authHeaders = await getAuthHeaders();
    const response = await fetch('/api/workflows', {
      method: 'POST',
      headers: authHeaders,
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
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`/api/workflows?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
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
