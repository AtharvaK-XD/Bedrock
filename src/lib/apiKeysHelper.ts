import { isDesktopApp } from './platform';
import { STORAGE_KEY_API_KEYS } from './appSettings';
import type { ApiKeysState } from './appSettings';

export interface ProviderKeyRequirement {
  providerId: string;
  providerName: string;
  keyField: keyof ApiKeysState;
  keyLabel: string;
  placeholder: string;
  helpUrl: string;
  description: string;
}

export const PROVIDER_REQUIREMENTS: Record<string, ProviderKeyRequirement> = {
  gemini: {
    providerId: 'gemini',
    providerName: 'Google Gemini',
    keyField: 'geminiKey',
    keyLabel: 'Gemini API Key',
    placeholder: 'AIzaSy...',
    helpUrl: 'https://aistudio.google.com/app/apikey',
    description: 'High-throughput multimodal API key from Google AI Studio.',
  },
  groq: {
    providerId: 'groq',
    providerName: 'Groq Cloud (LPU)',
    keyField: 'groqKey',
    keyLabel: 'Groq API Key',
    placeholder: 'gsk_...',
    helpUrl: 'https://console.groq.com/keys',
    description: 'Ultra-low latency inference for Llama 3.3, Qwen, and DeepSeek.',
  },
  openai: {
    providerId: 'openai',
    providerName: 'OpenAI',
    keyField: 'openAiKey',
    keyLabel: 'OpenAI API Key',
    placeholder: 'sk-proj-...',
    helpUrl: 'https://platform.openai.com/api-keys',
    description: 'Official API key for GPT-4o, o1, and o3-mini models.',
  },
  anthropic: {
    providerId: 'anthropic',
    providerName: 'Anthropic',
    keyField: 'anthropicKey',
    keyLabel: 'Anthropic API Key',
    placeholder: 'sk-ant-...',
    helpUrl: 'https://console.anthropic.com/settings/keys',
    description: 'API key for Claude 3.7 Sonnet, Claude 3.5 Sonnet, and Haiku.',
  },
  openrouter: {
    providerId: 'openrouter',
    providerName: 'OpenRouter',
    keyField: 'openRouterKey',
    keyLabel: 'OpenRouter API Key',
    placeholder: 'sk-or-v1-...',
    helpUrl: 'https://openrouter.ai/keys',
    description: 'Universal unified router for Claude, GPT, Llama, and frontier open models.',
  },
  huggingface: {
    providerId: 'huggingface',
    providerName: 'Hugging Face',
    keyField: 'huggingFaceKey',
    keyLabel: 'Hugging Face Access Token',
    placeholder: 'hf_...',
    helpUrl: 'https://huggingface.co/settings/tokens',
    description: 'User access token for open-weight foundation models and inference endpoints.',
  },
  perplexity: {
    providerId: 'perplexity',
    providerName: 'Perplexity AI',
    keyField: 'perplexityKey',
    keyLabel: 'Perplexity API Key',
    placeholder: 'pplx-...',
    helpUrl: 'https://www.perplexity.ai/settings/api',
    description: 'API key for real-time web-grounded search models (Sonar Pro & Sonar Reasoning).',
  },
  mistral: {
    providerId: 'mistral',
    providerName: 'Mistral AI',
    keyField: 'mistralKey',
    keyLabel: 'Mistral API Key',
    placeholder: '...',
    helpUrl: 'https://console.mistral.ai/api-keys',
    description: 'API key for Mistral Large and Codestral models.',
  },
  cohere: {
    providerId: 'cohere',
    providerName: 'Cohere',
    keyField: 'cohereKey',
    keyLabel: 'Cohere API Key',
    placeholder: '...',
    helpUrl: 'https://dashboard.cohere.com/api-keys',
    description: 'API key for Command R+ reasoning and retrieval models.',
  },
  xai: {
    providerId: 'xai',
    providerName: 'xAI (Grok)',
    keyField: 'xaiKey',
    keyLabel: 'xAI API Key',
    placeholder: 'xai-...',
    helpUrl: 'https://console.x.ai/',
    description: 'API key for Grok 3 and Grok 2 reasoning models.',
  },
  nvidia: {
    providerId: 'nvidia',
    providerName: 'Nvidia NIM',
    keyField: 'nvidiaKey',
    keyLabel: 'Nvidia API Key',
    placeholder: 'nvapi-...',
    helpUrl: 'https://build.nvidia.com/',
    description: 'API key for Nvidia Nemotron reasoning models.',
  },
  ollama: {
    providerId: 'ollama',
    providerName: 'Ollama Local Runtime',
    keyField: 'ollamaHost',
    keyLabel: 'Ollama Host URL',
    placeholder: 'http://localhost:11434',
    helpUrl: 'https://ollama.com',
    description: 'Local host URL for offline air-gapped private inference.',
  },
};

/**
 * Resolves which provider API key is required for a given model ID or agent ID.
 */
export function getRequiredProviderForModel(modelId?: string, agentId?: string): ProviderKeyRequirement {
  const m = (modelId || '').toLowerCase().trim();
  const a = (agentId || '').toLowerCase().trim();

  if (a === 'gemini' || m.includes('gemini') || m.includes('gemma')) {
    return PROVIDER_REQUIREMENTS.gemini;
  }
  if (
    a === 'groq' ||
    a === 'llama' ||
    m.includes('llama') ||
    m.includes('qwen') ||
    m.includes('gpt-oss') ||
    m.includes('deepseek-r1-distill') ||
    m.includes('mixtral-8x7b')
  ) {
    return PROVIDER_REQUIREMENTS.groq;
  }
  if (a === 'openai' || m.startsWith('gpt-') || m.startsWith('o1') || m.startsWith('o3')) {
    return PROVIDER_REQUIREMENTS.openai;
  }
  if (a === 'anthropic' || m.includes('claude')) {
    return PROVIDER_REQUIREMENTS.anthropic;
  }
  if (a === 'perplexity' || m.includes('sonar') || m.includes('perplexity')) {
    return PROVIDER_REQUIREMENTS.perplexity;
  }
  if (a === 'huggingface' || m.startsWith('hf/')) {
    return PROVIDER_REQUIREMENTS.huggingface;
  }
  if (a === 'mistral' || m.includes('mistral') || m.includes('codestral') || m.includes('mixtral-8x22b')) {
    return PROVIDER_REQUIREMENTS.mistral;
  }
  if (a === 'xai' || a === 'grok' || m.includes('grok')) {
    return PROVIDER_REQUIREMENTS.xai;
  }
  if (a === 'nvidia' || m.includes('nemotron')) {
    return PROVIDER_REQUIREMENTS.nvidia;
  }
  if (a === 'cohere' || m.includes('command-r')) {
    return PROVIDER_REQUIREMENTS.cohere;
  }
  if (a === 'ollama' || m.startsWith('ollama/')) {
    return PROVIDER_REQUIREMENTS.ollama;
  }
  if (a === 'openrouter' || m.startsWith('openrouter/') || m.startsWith('poolside/')) {
    return PROVIDER_REQUIREMENTS.openrouter;
  }

  // Universal or auto defaults to Gemini / Groq free tiers
  return PROVIDER_REQUIREMENTS.gemini;
}

/**
 * Checks whether the required API key for a model is already configured by the user.
 * On website, returns true (handled by web environment).
 * In desktop app, checks localStorage for user-added BYOK credentials.
 */
export function isModelKeyConfigured(modelId?: string, agentId?: string): boolean {
  if (!isDesktopApp()) {
    return true;
  }

  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_API_KEYS) : null;
    const parsed: Partial<ApiKeysState> = raw ? JSON.parse(raw) : {};

    const req = getRequiredProviderForModel(modelId, agentId);

    // If universal or auto, check if ANY key is configured
    if ((!agentId || agentId === 'universal') && (!modelId || modelId === 'auto')) {
      return Boolean(
        parsed.geminiKey?.trim() ||
        parsed.groqKey?.trim() ||
        parsed.openAiKey?.trim() ||
        parsed.openRouterKey?.trim() ||
        parsed.anthropicKey?.trim() ||
        parsed.perplexityKey?.trim()
      );
    }

    // Specific provider key check
    const val = parsed[req.keyField];
    if (typeof val === 'string' && val.trim().length > 0) {
      return true;
    }

    // OpenRouter can serve Anthropic, OpenAI, Nvidia, Mistral as fallback
    if (
      (req.providerId === 'anthropic' || req.providerId === 'nvidia' || req.providerId === 'mistral') &&
      parsed.openRouterKey?.trim()
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Persists an API key directly into local storage and dispatches sync events.
 */
export function saveModelApiKey(keyField: keyof ApiKeysState, value: string): void {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_API_KEYS) : null;
    const parsed: Partial<ApiKeysState> = raw ? JSON.parse(raw) : {};
    const updated = {
      ...parsed,
      [keyField]: value.trim(),
    };
    localStorage.setItem(STORAGE_KEY_API_KEYS, JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Failed to save API key:', err);
  }
}
