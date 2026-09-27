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

  const systemPrompt = `You are an elite principal software architect and prompt engineering director.
Your mission is to generate a world-class, bespoke engineering specification and operational prompt tailored precisely to the user's project idea, target platform, and domain.

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

  const userPrompt = `Target Audience / Platform Output: ${idea.targetType}
Initial Project Concept: ${idea.ideaText}

Clarifying Questions and Answers from User:
${answersText}

Produce the bespoke, domain-tailored Project Blueprint & Master System Prompt.`;

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
  followUp: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<{ updatedMarkdown: string; summary: string }> => {
  const keys = getActiveApiKeys();
  const hasClientKey = Boolean(
    keys.geminiKey || keys.groqKey || keys.openAiKey || keys.openRouterKey || keys.huggingFaceKey
  );

  if (hasClientKey) {
    const systemPrompt = `You are an elite principal prompt architect and software design partner.
The user is actively refining and iterating on their project prompt document through a collaborative conversation.
Your goal is not merely to perform mechanical text replacements, but to INTELLIGENTLY IMPROVISE, EVOLVE, AND DEEPEN the document with every follow-up.

REFINEMENT & IMPROVISATION DIRECTIVES:
1. INTELLIGENT ARCHITECTURAL IMPROVISATION:
   - When the user asks for a feature, stack adjustment, or constraint, proactively deduce and inject the downstream architectural consequences.
   - Example: If the user says "add Stripe payments", don't just add a bullet point. Improvise the database schema (customer table, subscription IDs, webhook event logs), add the webhook signature verification flow, inject negative security constraints (prevent replay attacks, idempotent handling), and update the master prompt directives.
   - Example: If the user says "make it faster / more minimal", restructure the document into a dense, high-signal prompt format, prune unnecessary verbose text, and elevate the core code contracts.
   - Example: If the user asks a question or explores options (e.g. "should I use Supabase or Neon?"), explain the trade-offs concisely in the summary, select the best fit, and seamlessly integrate the concrete implementation details into the document.

2. DYNAMIC RE-STRUCTURING:
   - Feel empowered to introduce new sections where valuable (e.g., adding an Architecture Decision Record (ADR), a dedicated Testing & Verification Playbook, a State Machine diagram, or an Environment Variables matrix).
   - If the user requests a specific format (e.g., "give me a .cursorrules format" or "write a freelancer SOW"), dynamically pivot the formatting of the document to match.
   - Maintain rich markdown aesthetics: code blocks with concrete schemas/types, Markdown tables, and Mermaid flow diagrams when relevant.

3. CONVERSATION CONTEXT AWARENESS:
   - Build cumulatively upon the previous conversation turns and refinements. Do not lose previously agreed-upon architectural decisions unless the user explicitly requested replacing them.

4. RESPONSE FORMAT:
   Respond ONLY with a valid JSON object matching this schema:
   {
     "updatedMarkdown": "the complete, revised, publication-grade prompt document in GitHub-flavored Markdown",
     "summary": "a sharp 2-3 sentence explanation of the architectural changes and improvisations introduced"
   }`;

    const recentHistoryText = conversationHistory && conversationHistory.length > 0
      ? `\n\nRecent Refinement History:\n` +
        conversationHistory
          .slice(-6)
          .map(m => `${m.role === 'user' ? 'User' : 'Architect'}: ${m.content}`)
          .join('\n')
      : '';

    const userPrompt = `Current Prompt Document:\n${currentPrompt}${recentHistoryText}\n\nLatest User Request / Follow-up:\n${followUp}`;

    try {
      const raw = await callClientAi(userPrompt, systemPrompt, { temperature: 0.6 });
      const cleaned = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed.updatedMarkdown === 'string') {
        return {
          updatedMarkdown: parsed.updatedMarkdown,
          summary: parsed.summary || `Updated and deepened prompt architecture for: "${followUp.slice(0, 100)}"`,
        };
      }
    } catch {
      // Fallback: direct retry if JSON parsing failed
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
            summary: parsed.summary || `Updated prompt incorporating: "${followUp.slice(0, 100)}"`,
          };
        }
      } catch {
        const raw = await callClientAi(userPrompt, systemPrompt, { temperature: 0.5 });
        return {
          updatedMarkdown: raw.startsWith('{') ? currentPrompt : raw,
          summary: `Updated prompt incorporating user feedback: "${followUp.slice(0, 100)}"`,
        };
      }
    }
  }

  // Fallback to backend
  try {
    const response = await fetch('/api/ai/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPrompt, followUp, conversationHistory }),
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
