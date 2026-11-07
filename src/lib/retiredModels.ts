/**
 * Groq has retired these models, so a request for them fails. Anything that still names one (saved workflows,
 * a stored default model, older settings) is quietly switched to the current replacement just before the request.
 */
export const GROQ_MAIN_MODEL = 'openai/gpt-oss-120b';
export const GROQ_FAST_MODEL = 'openai/gpt-oss-20b';

const RETIRED_GROQ_MODELS: Record<string, string> = {
  'llama-3.3-70b-versatile': GROQ_MAIN_MODEL,
  'llama-3.1-8b-instant': GROQ_FAST_MODEL,
  'deepseek-r1-distill-llama-70b': GROQ_MAIN_MODEL,
};

export function isRetiredModel(modelId: string | undefined | null): boolean {
  return Boolean(modelId && RETIRED_GROQ_MODELS[modelId]);
}

/** The model to actually call: the replacement when `modelId` is retired, otherwise `modelId` unchanged. */
export function replaceRetiredModel<T extends string | undefined | null>(modelId: T): T | string {
  if (modelId && RETIRED_GROQ_MODELS[modelId]) return RETIRED_GROQ_MODELS[modelId];
  return modelId;
}

/**
 * Extra request fields the gpt-oss models need on Groq: low reasoning effort, no reasoning text in the answer,
 * and 1,024 more tokens of room so the hidden reasoning cannot use up the budget meant for the answer.
 */
export function groqModelExtras(model: string, maxTokens: number): { max_tokens: number; reasoning_effort?: 'low'; include_reasoning?: false } {
  if (model.includes('gpt-oss')) {
    return { max_tokens: maxTokens + 1024, reasoning_effort: 'low', include_reasoning: false };
  }
  return { max_tokens: maxTokens };
}
