import {
  BEDROCK_CORE_GUARDRAILS,
  buildRefineSystemPrompt,
  extractRefineResult,
  sanitizeRenderedPrompt,
} from './aiPrompts';
import { getMasterRolePrompt } from './masterRolePrompts';
import {
  getUseCaseProfile,
  classifyUseCase,
  validatePromptAgainstForbiddenTerms,
  USE_CASE_PROFILES,
  type UseCaseProfileId,
} from './useCaseProfiles';
import {
  callLLM,
  callLLMWithMeta,
  getModelTuning,
  MODEL_TUNING_TABLE,
  buildTunedPrompt,
  classifyModelTier,
  TIER_DEFAULTS,
  type LLMPurpose,
  type FewShotExample,
} from './callLLM';
import {
  validateSynthesisOutput,
  validateQuestionsOutput,
  buildRepairMessage,
  sanitizePromptOutput,
  detectForbiddenTerms,
  isIdeaRequestingCode,
  normalizeQuestions,
  type ValidationResult,
  type ValidationIssue,
} from './validation';
import {
  getActiveModelSettings,
  checkTokenBudgetGuard,
  recordTokenUsage,
  createStreamingPacer,
  isLocalVaultOnly,
} from './appSettings';
import { isDesktopApp } from './platform';
import { reportSyncProblem, describeSaveLimit } from './syncNotice';
import { parseQuotaResponse } from './quotaErrors';
import { GROQ_MAIN_MODEL, GROQ_FAST_MODEL, replaceRetiredModel, groqModelExtras } from './retiredModels';
export type {

  ModelTuningConfig,
  ModelTier,
  LLMPurpose,
  FewShotExample,
  CallLLMOptions,
  CallLLMResult,
} from './callLLM';
export type { ValidationResult, ValidationIssue };
export { normalizeQuestions };
export {
  callLLM,
  callLLMWithMeta,
  getModelTuning,
  MODEL_TUNING_TABLE,
  buildTunedPrompt,
  classifyModelTier,
  TIER_DEFAULTS,
  getUseCaseProfile,
  classifyUseCase,
  validatePromptAgainstForbiddenTerms,
  USE_CASE_PROFILES,
  validateSynthesisOutput,
  validateQuestionsOutput,
  buildRepairMessage,
  sanitizePromptOutput,
  detectForbiddenTerms,
  isIdeaRequestingCode,
};
export type { UseCaseProfileId };

export type TargetTypeOption =
  | 'coding_agent'
  | 'coding-agent'
  | 'image_generation'
  | 'image-prompt'
  | 'writing'
  | 'freelancer_brief'
  | 'freelance-brief'
  | 'hackathon_pitch'
  | 'pitch'
  | 'no_code'
  | 'no-code'
  | 'video_generation'
  | 'video-generation'
  | string;

export interface IdeaPayload {
  ideaText: string;
  targetType: TargetTypeOption;
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

function getEnvVar(key: string): string {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.[key]) {
      return (import.meta as any).env[key];
    }
  } catch {}
  try {
    const proc = (globalThis as any)?.process;
    if (proc?.env?.[key]) {
      return proc.env[key] as string;
    }
  } catch {}
  return '';
}

export function getActiveApiKeys() {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_API_KEYS) : null;
    const parsed = raw ? JSON.parse(raw) : {};

    // In the desktop app, strictly require user-configured BYOK keys without silent env fallback
    if (isDesktopApp()) {
      return {
        geminiKey: (parsed.geminiKey || '').trim(),
        groqKey: (parsed.groqKey || '').trim(),
        openAiKey: (parsed.openAiKey || '').trim(),
        anthropicKey: (parsed.anthropicKey || '').trim(),
        openRouterKey: (parsed.openRouterKey || '').trim(),
        huggingFaceKey: (parsed.huggingFaceKey || '').trim(),
        perplexityKey: (parsed.perplexityKey || '').trim(),
        mistralKey: (parsed.mistralKey || '').trim(),
        cohereKey: (parsed.cohereKey || '').trim(),
        xaiKey: (parsed.xaiKey || '').trim(),
        deepSeekKey: (parsed.deepSeekKey || '').trim(),
        // Settings saves the Ollama address as ollamaHost (older builds: ollamaEndpoint)
        ollamaEndpoint: (parsed.ollamaHost || parsed.ollamaEndpoint || 'http://localhost:11434').trim(),
      };
    }

    return {
      geminiKey: (parsed.geminiKey || getEnvVar('VITE_GEMINI_API_KEY')).trim(),
      groqKey: (parsed.groqKey || getEnvVar('VITE_GROQ_API_KEY')).trim(),
      openAiKey: (parsed.openAiKey || getEnvVar('VITE_OPENAI_API_KEY')).trim(),
      anthropicKey: (parsed.anthropicKey || getEnvVar('VITE_ANTHROPIC_API_KEY')).trim(),
      openRouterKey: (parsed.openRouterKey || getEnvVar('VITE_OPENROUTER_API_KEY')).trim(),
      huggingFaceKey: (parsed.huggingFaceKey || getEnvVar('VITE_HUGGINGFACE_API_KEY')).trim(),
      perplexityKey: (parsed.perplexityKey || getEnvVar('VITE_PERPLEXITY_API_KEY')).trim(),
      mistralKey: (parsed.mistralKey || getEnvVar('VITE_MISTRAL_API_KEY')).trim(),
      cohereKey: (parsed.cohereKey || getEnvVar('VITE_COHERE_API_KEY')).trim(),
      xaiKey: (parsed.xaiKey || getEnvVar('VITE_XAI_API_KEY')).trim(),
      deepSeekKey: (parsed.deepSeekKey || '').trim(),
      ollamaEndpoint: (parsed.ollamaHost || parsed.ollamaEndpoint || 'http://localhost:11434').trim(),
    };
  } catch {
    if (isDesktopApp()) {
      return {
        geminiKey: '',
        groqKey: '',
        openAiKey: '',
        anthropicKey: '',
        openRouterKey: '',
        huggingFaceKey: '',
        perplexityKey: '',
        mistralKey: '',
        cohereKey: '',
        xaiKey: '',
        deepSeekKey: '',
        ollamaEndpoint: 'http://localhost:11434',
      };
    }
    return {
      geminiKey: getEnvVar('VITE_GEMINI_API_KEY').trim(),
      groqKey: getEnvVar('VITE_GROQ_API_KEY').trim(),
      openAiKey: getEnvVar('VITE_OPENAI_API_KEY').trim(),
      anthropicKey: getEnvVar('VITE_ANTHROPIC_API_KEY').trim(),
      openRouterKey: getEnvVar('VITE_OPENROUTER_API_KEY').trim(),
      huggingFaceKey: getEnvVar('VITE_HUGGINGFACE_API_KEY').trim(),
      perplexityKey: getEnvVar('VITE_PERPLEXITY_API_KEY').trim(),
      mistralKey: getEnvVar('VITE_MISTRAL_API_KEY').trim(),
      cohereKey: getEnvVar('VITE_COHERE_API_KEY').trim(),
      xaiKey: getEnvVar('VITE_XAI_API_KEY').trim(),
      deepSeekKey: '',
      ollamaEndpoint: 'http://localhost:11434',
    };
  }
}

// Resilient Gemini Direct Client with Streaming Support
export async function callGemini(
  prompt: string,
  systemInstruction?: string,
  apiKey?: string,
  targetModel?: string,
  temperature?: number,
  onToken?: (token: string) => void
): Promise<string> {
  const modelSettings = getActiveModelSettings();
  checkTokenBudgetGuard(modelSettings.maxOutputTokens);

  const key = apiKey || getActiveApiKeys().geminiKey;
  if (!key) {
    throw new ApiError('Google Gemini API Key is required.', true, 'Google Gemini', 401);
  }

  const effectiveTemp = temperature !== undefined ? temperature : modelSettings.temperature;
  const maxOutputTokens = modelSettings.maxOutputTokens || 4096;
  const topP = modelSettings.topP ?? 0.95;
  const strictJsonMode = modelSettings.strictJsonMode || false;
  const pacedOnToken = onToken ? createStreamingPacer(modelSettings.streamSpeed, onToken) : undefined;

  const modelsToTry = targetModel
    ? [targetModel, 'gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash']
    : ['gemini-3.5-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.5-flash'];

  const uniqueModels = Array.from(new Set(modelsToTry));
  let lastError: Error | null = null;
  const isStreaming = typeof pacedOnToken === 'function';

  for (const model of uniqueModels) {
    try {
      // The key goes in a header, never in the URL: URLs end up in browser history, proxies and crash-report breadcrumbs
      const endpoint = isStreaming ? 'streamGenerateContent?alt=sse' : 'generateContent';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}`;
      const body: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: effectiveTemp,
          maxOutputTokens,
          topP,
          ...(strictJsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      };
      if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        if (isStreaming && response.body) {
          const reader = response.body.getReader();
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
                  if (pacedOnToken) await pacedOnToken(chunk);
                }
              } catch {
                // ignore malformed line
              }
            }
          }
          if (accumulated) {
            const totalTokens = Math.max(1, Math.round((prompt.length + accumulated.length) / 4));
            recordTokenUsage(totalTokens);
            return accumulated;
          }
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const totalTokens = Math.max(1, Math.round((prompt.length + text.length) / 4));
          recordTokenUsage(totalTokens);
          return text;
        }
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

// Resilient Groq Direct Client with Streaming Support & Official Model Targets
export async function callGroq(
  prompt: string,
  systemPrompt?: string,
  apiKey?: string,
  targetModel?: string,
  temperature?: number,
  onToken?: (token: string) => void
): Promise<string> {
  const modelSettings = getActiveModelSettings();
  checkTokenBudgetGuard(modelSettings.maxOutputTokens);

  const key = apiKey || getActiveApiKeys().groqKey;
  if (!key) {
    throw new ApiError('Groq API Key is required.', true, 'Groq', 401);
  }

  const effectiveTemp = temperature !== undefined ? temperature : modelSettings.temperature;
  const maxOutputTokens = modelSettings.maxOutputTokens || 4096;
  const topP = modelSettings.topP ?? 0.95;
  const strictJsonMode = modelSettings.strictJsonMode || false;
  const pacedOnToken = onToken ? createStreamingPacer(modelSettings.streamSpeed, onToken) : undefined;

  // Current Groq production models. A retired model the caller still names is swapped for its replacement.
  const requested = replaceRetiredModel(targetModel);
  const modelsToTry = requested && requested !== GROQ_MAIN_MODEL && requested !== GROQ_FAST_MODEL
    ? [requested, GROQ_MAIN_MODEL, GROQ_FAST_MODEL]
    : [GROQ_MAIN_MODEL, GROQ_FAST_MODEL];

  const uniqueModels = Array.from(new Set(modelsToTry));
  let lastError: Error | null = null;
  const isStreaming = typeof pacedOnToken === 'function';

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
          temperature: effectiveTemp,
          ...groqModelExtras(model, maxOutputTokens),
          top_p: topP,
          stream: isStreaming,
          ...(strictJsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      });

      if (response.ok) {
        if (isStreaming && response.body) {
          const reader = response.body.getReader();
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
                  if (pacedOnToken) await pacedOnToken(chunk);
                }
              } catch {
                // ignore
              }
            }
          }
          if (accumulated) {
            const totalTokens = Math.max(1, Math.round((prompt.length + accumulated.length) / 4));
            recordTokenUsage(totalTokens);
            return accumulated;
          }
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          const totalTokens = Math.max(1, Math.round((prompt.length + text.length) / 4));
          recordTokenUsage(totalTokens);
          return text;
        }
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

// Resilient OpenAI Direct Client with Streaming Support
export async function callOpenAi(
  prompt: string,
  systemPrompt?: string,
  apiKey?: string,
  targetModel = 'gpt-4o',
  temperature?: number,
  onToken?: (token: string) => void
): Promise<string> {
  const modelSettings = getActiveModelSettings();
  checkTokenBudgetGuard(modelSettings.maxOutputTokens);

  const key = apiKey || getActiveApiKeys().openAiKey;
  if (!key) {
    throw new ApiError('OpenAI API Key is required.', true, 'OpenAI', 401);
  }

  const effectiveTemp = temperature !== undefined ? temperature : modelSettings.temperature;
  const maxOutputTokens = modelSettings.maxOutputTokens || 4096;
  const topP = modelSettings.topP ?? 0.95;
  const strictJsonMode = modelSettings.strictJsonMode || false;
  const pacedOnToken = onToken ? createStreamingPacer(modelSettings.streamSpeed, onToken) : undefined;

  const models = [targetModel, 'gpt-4o-mini', 'gpt-4o'];
  const uniqueModels = Array.from(new Set(models));
  let lastError: Error | null = null;
  const isStreaming = typeof pacedOnToken === 'function';

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
          temperature: effectiveTemp,
          max_tokens: maxOutputTokens,
          top_p: topP,
          stream: isStreaming,
          ...(strictJsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
      });

      if (response.ok) {
        if (isStreaming && response.body) {
          const reader = response.body.getReader();
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
                  if (pacedOnToken) await pacedOnToken(chunk);
                }
              } catch {
                // ignore
              }
            }
          }
          if (accumulated) {
            const totalTokens = Math.max(1, Math.round((prompt.length + accumulated.length) / 4));
            recordTokenUsage(totalTokens);
            return accumulated;
          }
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          const totalTokens = Math.max(1, Math.round((prompt.length + text.length) / 4));
          recordTokenUsage(totalTokens);
          return text;
        }
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
export async function callOpenRouter(
  prompt: string,
  systemPrompt?: string,
  apiKey?: string,
  targetModel = 'openai/gpt-4o-mini',
  temperature?: number
): Promise<string> {
  const modelSettings = getActiveModelSettings();
  checkTokenBudgetGuard(modelSettings.maxOutputTokens);

  const key = apiKey || getActiveApiKeys().openRouterKey;
  if (!key) {
    throw new ApiError('OpenRouter API Key is required.', true, 'OpenRouter', 401);
  }

  const effectiveTemp = temperature !== undefined ? temperature : modelSettings.temperature;
  const maxOutputTokens = modelSettings.maxOutputTokens || 4096;
  const topP = modelSettings.topP ?? 0.95;
  const strictJsonMode = modelSettings.strictJsonMode || false;

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
      temperature: effectiveTemp,
      max_tokens: maxOutputTokens,
      top_p: topP,
      ...(strictJsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw parseApiErrorResponse('OpenRouter', response.status, errText);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  if (text) {
    const totalTokens = Math.max(1, Math.round((prompt.length + text.length) / 4));
    recordTokenUsage(totalTokens);
  }
  return text;
}


// Universal Client AI Dispatcher with Per-Model Tuning & Streaming Support
export async function callClientAi(
  userPrompt: string,
  systemPrompt?: string,
  options?: {
    preferredProvider?: 'gemini' | 'groq' | 'openai' | 'openrouter' | 'huggingface';
    preferredModel?: string;
    temperature?: number;
    onToken?: (token: string) => void;
    purpose?: LLMPurpose;
    fewShotExamples?: FewShotExample[];
    extraWordingOverride?: string;
    targetType?: string;
    userIdea?: string;
    validateAndRetry?: boolean;
  }
): Promise<string> {
  const model = options?.preferredModel || 'auto';
  return await callLLM(userPrompt, model, options?.purpose || 'general', {
    systemPrompt,
    temperature: options?.temperature,
    onToken: options?.onToken,
    preferredProvider: options?.preferredProvider,
    fewShotExamples: options?.fewShotExamples,
    extraWordingOverride: options?.extraWordingOverride,
    targetType: options?.targetType,
    userIdea: options?.userIdea,
    validateAndRetry: options?.validateAndRetry,
  });
}

function getFallbackQuestions(targetType: IdeaPayload['targetType']): Question[] {
  const profile = getUseCaseProfile(targetType);
  return (profile.fallbackQuestions as Question[]) || [];
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const clerk = (window as any).Clerk;
    if (clerk?.session) {
      const token = await clerk.session.getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    if (!headers['Authorization'] && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('bedrock_token') || localStorage.getItem('bedrock_auth_token');
      if (stored) headers['Authorization'] = `Bearer ${stored}`;
    }
  } catch {
    // ignore
  }
  return headers;
}

/** The error for a 429 from the Bedrock server, using the server's own (accurate) message and code. */
async function quotaApiError(response: Response): Promise<ApiError> {
  const info = await parseQuotaResponse(response);
  const err = new ApiError(info.message, false, 'Bedrock Cloud', 429);
  (err as any).code = info.code;
  (err as any).showUpgrade = info.showUpgrade;
  return err;
}

/** Seconds to wait when the Bedrock server answered 503 "AI providers busy" (see api/_lib/aiHttp.ts), else null. */
export async function readServerBusySeconds(response: Response): Promise<number | null> {
  if (response.status !== 503) return null;
  const body = await response.clone().json().catch(() => ({}));
  const fromBody = Number(body?.retryAfterSeconds);
  const fromHeader = Number(response.headers.get('Retry-After'));
  const seconds = fromBody > 0 ? fromBody : fromHeader > 0 ? fromHeader : 15;
  return Math.min(Math.round(seconds), 300);
}

/** Shown instead of the "no API key" message when the only reason we failed is a busy server. */
export function serverBusyError(seconds: number): ApiError {
  const err = new ApiError(
    `Bedrock is busy right now. Please try again in ${seconds} seconds.`,
    false,
    'Bedrock Cloud',
    503
  );
  (err as any).code = 'AI_BUSY';
  (err as any).retryAfterSeconds = seconds;
  return err;
}

/** Used when the server could not be reached or answered with an error that has no usable message. Not a usage limit. */
export function serverUnavailableError(): ApiError {
  const err = new ApiError(
    "Bedrock couldn't complete that request right now. Please try again in a moment.",
    false,
    'Bedrock Cloud',
    503
  );
  (err as any).code = 'SERVER_UNAVAILABLE';
  return err;
}

/** Converts a JSON server failure payload (HTTP error or SSE error event) into an ApiError preserving message/code. */
export function buildServerErrorFromPayload(
  body: Record<string, any> | null | undefined,
  status = 500,
  retryAfterHeader?: number
): ApiError {
  const code = typeof body?.code === 'string' && body.code ? body.code : undefined;
  const retryRaw = Number(body?.retryAfterSeconds) || Number(retryAfterHeader) || 0;
  const retrySeconds = retryRaw > 0 ? Math.min(Math.round(retryRaw), 300) : undefined;

  if (status === 503 || code === 'RATE_LIMITER_UNAVAILABLE' || code === 'AI_ALL_PROVIDERS_FAILED' || code === 'AI_DEADLINE_EXCEEDED') {
    const seconds = retrySeconds ?? 15;
    if (code === 'RATE_LIMITER_UNAVAILABLE') {
      const err = new ApiError(
        `Bedrock is briefly unavailable. Please try again in ${seconds} seconds.`,
        false,
        'Bedrock Cloud',
        503
      );
      (err as any).code = 'RATE_LIMITER_UNAVAILABLE';
      (err as any).retryAfterSeconds = seconds;
      return err;
    }
    return serverBusyError(seconds);
  }

  const rawMessage =
    typeof body?.message === 'string' && body.message.trim()
      ? body.message.trim()
      : typeof body?.error === 'string' && body.error.trim()
        ? body.error.trim()
        : '';

  const fallbackMessage =
    status === 401
      ? 'Please sign in to run prompts on Bedrock.'
      : "Bedrock couldn't complete that request right now. Please try again in a moment.";

  const err = new ApiError(rawMessage || fallbackMessage, false, 'Bedrock Cloud', status);
  (err as any).code = code || (status >= 500 ? 'SERVER_ERROR' : 'REQUEST_FAILED');
  if (retrySeconds !== undefined) (err as any).retryAfterSeconds = retrySeconds;
  return err;
}

/** Parses an HTTP error response from a Bedrock `/api/*` endpoint without consuming the original body stream. */
export async function readStructuredServerError(response: Response): Promise<ApiError> {
  if (response.status === 429) {
    return await quotaApiError(response);
  }
  const readable = typeof (response as any)?.clone === 'function' ? response.clone() : response;
  const body = await readable.json().catch(() => null);
  const headerRetry = Number(response.headers?.get?.('Retry-After')) || undefined;
  return buildServerErrorFromPayload(body, response.status, headerRetry);
}

export const generateQuestions = async (payload: IdeaPayload): Promise<Question[]> => {
  let serverBusyErrorResult: ApiError | null = null;

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
      const normalized = normalizeQuestions(data);
      if (normalized.length > 0) {
        return normalized;
      }
    } else if (response.status === 429) {
      throw await quotaApiError(response);
    } else if (response.status === 503) {
      serverBusyErrorResult = await readStructuredServerError(response);
    }
  } catch (backendErr: any) {
    if (backendErr?.code === 'FREE_TIER_QUOTA_EXCEEDED' || backendErr?.statusCode === 429) {
      throw backendErr;
    }
    console.warn('[Bedrock] Server generation not available, falling back:', backendErr);
  }

  // 2. Client fallback if client keys configured (Strictly Desktop App only)
  if (isDesktopApp()) {
    const keys = getActiveApiKeys();
    const hasClientKey = Boolean(
      keys.geminiKey || keys.groqKey || keys.openAiKey || keys.openRouterKey || keys.huggingFaceKey
    );

    if (hasClientKey) {
      const profile = getUseCaseProfile(payload.targetType);
      const systemPrompt = profile.questionPrompt;

      const fewShotSection = profile.fewShotExamples.length > 0
        ? `\n\nFEW-SHOT EXAMPLES:\n` + profile.fewShotExamples.map((ex, idx) => `Example ${idx + 1}: ${ex.title}\nUser Input: ${ex.inputIdea}\nClarifying Questions:\n${JSON.stringify((ex.clarifyingQuestions || []).map((q: { id: string; questionText: string; questionType: string; options?: string[] }) => ({ id: q.id, questionText: q.questionText, questionType: q.questionType, options: q.options })), null, 2)}`).join('\n\n')
        : '';

      const userPrompt = `TARGET USE CASE: ${profile.name} (${profile.tag})
DESCRIPTION: ${profile.description}
${fewShotSection}

Initial User Project Idea:
${payload.ideaText}

Generate exactly 3 to 4 essential clarifying questions as a JSON array tailored specifically to this mode's purpose.`;

      try {
        const raw = await callClientAi(userPrompt, systemPrompt, {
          temperature: profile.temperature,
          purpose: 'questions',
          targetType: payload.targetType,
          userIdea: payload.ideaText,
          validateAndRetry: true,
        });

        const qVal = validateQuestionsOutput(raw, payload.targetType, payload.ideaText);
        if (qVal.isValid && qVal.data && qVal.data.length > 0) {
          return normalizeQuestions(qVal.data);
        }

        const cleaned = raw
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();

        const parsed = JSON.parse(cleaned);
        const normalized = normalizeQuestions(parsed);
        if (normalized.length > 0) {
          return normalized;
        }
      } catch (err: any) {
        if (err.isApiKeyError) {
          throw err;
        }
        console.warn('[Bedrock] Direct question generation parse error, falling back to curated questions:', err);
        return getFallbackQuestions(payload.targetType);
      }
    }

    if (serverBusyErrorResult) throw serverBusyErrorResult;
    throw new ApiError(
      'Please enter your Google Gemini or Groq API key in the app to start generating prompts.',
      true,
      'Bedrock Workspace',
      401
    );
  }

  // On the website, fallback to curated questions if backend had a temporary parse error
  if (serverBusyErrorResult) throw serverBusyErrorResult;
  return getFallbackQuestions(payload.targetType);
};

export const synthesizePrompt = async (
  idea: IdeaPayload,
  answers: Answer[],
  questions: Question[],
  onToken?: (token: string) => void
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

  const profile = getUseCaseProfile(idea.targetType);

  const targetLabelMap: Record<string, string> = {
    coding_agent: 'Coding Agent (DEV)',
    'coding-agent': 'Coding Agent (DEV)',
    image_generation: 'Image Generation (IMG)',
    'image-prompt': 'Image Generation (IMG)',
    writing: 'Writing & Editorial (TEXT)',
    video_generation: 'Video Generation (VIDEO)',
    'video-generation': 'Video Generation (VIDEO)',
    freelancer_brief: 'Freelancer (BRIEF)',
    'freelance-brief': 'Freelancer (BRIEF)',
    hackathon_pitch: 'Hackathon (PITCH)',
    pitch: 'Hackathon (PITCH)',
    no_code: 'No-Code (NOCODE)',
    'no-code': 'No-Code (NOCODE)',
  };

  const selectedFormatName = targetLabelMap[idea.targetType] || profile.name;
  const selectedFormatDirective = getMasterRolePrompt(idea.targetType || profile.id);

  const userPrompt = `Selected Target Format: ${selectedFormatName}
Initial Project Concept: ${idea.ideaText}

Clarifying Questions and Answers from User:
${answersText}

SPECIFIC FORMAT INSTRUCTION:
${selectedFormatDirective}

Produce the bespoke, publication-grade prompt document adhering strictly to this target purpose.`;

  let serverError: ApiError | null = null;

  // 1. Try secure backend synthesis first
  try {
    const authHeaders = await getAuthHeaders();
    const isStreaming = typeof onToken === 'function';
    const rawTextValue = (idea as { rawText?: string }).rawText || idea.ideaText;
    const response = await fetch('/api/ai/synthesize', {
      method: 'POST',
      headers: {
        ...authHeaders,
        ...(isStreaming ? { Accept: 'text/event-stream' } : {}),
      },
      body: JSON.stringify({
        idea: { ...idea, rawText: rawTextValue },
        answers,
        questions,
        stream: isStreaming,
      }),
    });

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (isStreaming && contentType.includes('text/event-stream') && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';
        let finalPromptText = '';
        let streamFailure: ApiError | null = null;
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
            let json: any;
            try {
              json = JSON.parse(dataStr);
            } catch {
              continue; // ignore parse errors on incomplete chunks
            }
            if (json.token) {
              accumulated += json.token;
              onToken(json.token);
            }
            if (json.done && typeof json.promptText === 'string' && json.promptText.trim()) {
              finalPromptText = json.promptText;
              if (json.truncated) {
                console.warn('[Bedrock Validation] Server indicated streamed response was truncated');
              }
              if (json.validation) {
                console.warn('[Bedrock Validation] Server validation summary:', json.validation);
              }
            }
            if (json.error || (json.code && !json.done)) {
              streamFailure = buildServerErrorFromPayload(json, json.retryAfterSeconds ? 503 : 500);
            }
          }
        }
        const resultText = finalPromptText || accumulated;
        if (resultText && !streamFailure) {
          const sVal = validateSynthesisOutput(resultText, idea.targetType, idea.ideaText);
          if (!sVal.isValid) {
            console.warn(`[Bedrock Validation] Server streaming output validation issues:`, sVal.issues.map((i: ValidationIssue) => i.message));
          }
          return sanitizePromptOutput(resultText);
        }
        if (streamFailure) {
          serverError = streamFailure;
        }
      } else {
        const data = await response.json();
        const text = data.promptText || data.content || '';
        if (text) {
          const sVal = validateSynthesisOutput(text, idea.targetType, idea.ideaText);
          if (!sVal.isValid) {
            console.warn(`[Bedrock Validation] Server response validation issues:`, sVal.issues.map((i: ValidationIssue) => i.message));
          }
          return sanitizePromptOutput(text);
        }
      }
    } else if (response.status === 429) {
      throw await quotaApiError(response);
    } else {
      serverError = await readStructuredServerError(response);
    }
  } catch (err: any) {
    if (err?.code === 'FREE_TIER_QUOTA_EXCEEDED' || err?.statusCode === 429) {
      throw err;
    }
    console.warn('[Bedrock] Server synthesis not available, falling back:', err);
    if (!serverError) {
      serverError = err instanceof ApiError ? err : new ApiError(err?.message || "Bedrock couldn't complete that request right now. Please try again in a moment.", false, 'Bedrock Cloud', 503);
    }
  }

  // 2. Client fallback if client keys configured (Strictly Desktop App only)
  if (isDesktopApp()) {
    if (hasClientKey) {
      const raw = await callClientAi(userPrompt, systemPrompt, {
        temperature: profile.temperature,
        onToken,
        purpose: 'synthesize',
        targetType: idea.targetType,
        userIdea: idea.ideaText,
        validateAndRetry: true,
      });
      const sVal = validateSynthesisOutput(raw, idea.targetType, idea.ideaText);
      if (!sVal.isValid) {
        console.warn(`[Bedrock Validation] Client output post-retry validation warnings for ${idea.targetType}:`, sVal.issues.map((i: ValidationIssue) => i.message));
      }
      return sanitizePromptOutput(raw);
    }

    if (serverError) throw serverError;
    throw new ApiError(
      'No API key configured. Please set your Google Gemini or Groq key in Settings or connect to Bedrock Cloud.',
      true,
      'Bedrock Workspace',
      401
    );
  }

  if (serverError) throw serverError;
  throw serverUnavailableError();
};

export const refinePrompt = async (
  currentPrompt: string,
  followUp: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<{ updatedMarkdown: string; summary: string }> => {
  const isDesktop = isDesktopApp();
  const keys = getActiveApiKeys();
  const hasClientKey = Boolean(
    keys.geminiKey || keys.groqKey || keys.openAiKey || keys.openRouterKey || keys.huggingFaceKey
  );

  // Client BYOK refinement: Strictly Desktop App only
  if (isDesktop && hasClientKey) {
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
      const raw = await callClientAi(userPrompt, systemPrompt, { temperature: 0.4, purpose: 'refine' });
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
        const raw = await callClientAi(userPrompt, systemPrompt, { temperature: 0.3, purpose: 'refine' });
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

  let serverError: ApiError | null = null;

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
    } else if (response.status === 429) {
      throw await quotaApiError(response);
    } else {
      serverError = await readStructuredServerError(response);
    }
  } catch (err: any) {
    if (err?.code === 'FREE_TIER_QUOTA_EXCEEDED' || err?.statusCode === 429) {
      throw err;
    }
    console.warn('[Bedrock] Server refine not available, falling back:', err);
  }

  if (serverError) throw serverError;

  if (isDesktop) {
    throw new ApiError(
      'No API key configured. Please set your Google Gemini or Groq key to refine prompt.',
      true,
      'Bedrock Workspace',
      401
    );
  }

  throw serverUnavailableError();
};

export interface ArenaBenchmarkMetrics {
  latencyMs: number;
  ttftMs: number;
  tokenCount: number;
  tokensPerSec: number;
}

/**
 * Tests prompts against frontier and open-source models using callLLM with per-model tuning merged inside.
 */
export const testPrompt = async (
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  onToken?: (token: string) => void
): Promise<string> => {
  return await callLLM(userPrompt, modelId, 'test', {
    systemPrompt,
    onToken,
  });
};

/**
 * Tests prompts and captures high-resolution Arena metrics (TTFT, total latency, token throughput).
 */
export const testPromptWithMetrics = async (
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  onToken?: (token: string) => void
): Promise<{ text: string; metrics: ArenaBenchmarkMetrics }> => {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let firstTokenTime: number | null = null;

  const text = await callLLM(userPrompt, modelId, 'test', {
    systemPrompt,
    onToken: (token: string) => {
      if (firstTokenTime === null) {
        firstTokenTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
      }
      if (onToken) onToken(token);
    },
  });

  const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const latencyMs = Math.max(1, Math.round(endTime - startTime));
  const ttftMs = firstTokenTime ? Math.max(1, Math.round(firstTokenTime - startTime)) : latencyMs;

  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const tokenCount = Math.max(1, Math.round(words * 1.35));
  const latencySec = Math.max(0.05, latencyMs / 1000);
  const tokensPerSec = Math.round((tokenCount / latencySec) * 10) / 10;

  return {
    text,
    metrics: {
      latencyMs,
      ttftMs,
      tokenCount,
      tokensPerSec,
    },
  };
};

// Workflows API with localStorage fallback for offline / desktop support
const WORKFLOWS_STORAGE_KEY = 'bedrock_saved_workflows';

export const loadWorkflows = async () => {
  if (!isLocalVaultOnly()) {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/workflows', { headers: authHeaders });
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Offline / desktop fallback
    }
  }

  try {
    const raw = localStorage.getItem(WORKFLOWS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveWorkflow = async (workflow: { id?: string; title: string; nodes: any[]; edges: any[] }) => {
  if (!isLocalVaultOnly()) {
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
      const limitMessage = await describeSaveLimit(response);
      if (limitMessage) reportSyncProblem(limitMessage);
    } catch {
      // Offline / desktop fallback
    }
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
  if (!isLocalVaultOnly()) {
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
