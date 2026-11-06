/**
 * Universal Dynamic Model Discovery for Bedrock Desktop
 *
 * Dynamically queries provider endpoints (OpenAI, Groq, Google Gemini, OpenRouter,
 * Mistral, xAI, DeepSeek, Ollama, Anthropic, Cohere) using the user's BYOK credentials.
 * Discovered models are normalized, tagged, cached in localStorage, and exposed
 * to the workstation selectors.
 *
 * INVARIANT: Strictly active ONLY on the Desktop App (isDesktopApp() === true).
 * The website (isDesktopApp() === false) strictly uses curated static models.
 */

import { isDesktopApp } from './platform';
import { fetchAnthropicModels, getCachedAnthropicModels } from './anthropicModels';

export interface DiscoveredModel {
  id: string;
  name: string;
  tag: string;
  tagColor: string;
  provider: string;
  description?: string;
}

export const DYNAMIC_MODELS_UPDATED_EVENT = 'bedrock_models_updated';
export const STORAGE_PREFIX_DYNAMIC_MODELS = 'bedrock_cached_models_';

export type SupportedDiscoveryProvider =
  | 'openai'
  | 'groq'
  | 'gemini'
  | 'anthropic'
  | 'openrouter'
  | 'mistral'
  | 'xai'
  | 'deepseek'
  | 'ollama'
  | 'cohere';

function formatModelName(id: string, defaultName?: string): string {
  if (defaultName && defaultName.trim().length > 0) {
    return defaultName.trim();
  }

  // Prettify common model IDs
  return id
    .replace(/^models\//i, '')
    .replace(/^ollama\//i, '')
    .replace(/^openai\//i, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bGpt\b/gi, 'GPT')
    .replace(/\bO1\b/gi, 'o1')
    .replace(/\bO3\b/gi, 'o3')
    .replace(/\bOss\b/gi, 'OSS')
    .replace(/\bMoe\b/gi, 'MoE');
}

function assignModelTags(id: string, provider: string): { tag: string; tagColor: string } {
  const lower = id.toLowerCase();

  if (lower.includes('o1') || lower.includes('o3') || lower.includes('r1') || lower.includes('reasoning') || lower.includes('thinking')) {
    return {
      tag: 'Deep Reasoning',
      tagColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    };
  }

  if (lower.includes('coder') || lower.includes('coding') || lower.includes('codestral')) {
    return {
      tag: 'Code Specialist',
      tagColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    };
  }

  if (lower.includes('flash') || lower.includes('mini') || lower.includes('instant') || lower.includes('haiku') || lower.includes('lite')) {
    return {
      tag: 'Ultra Fast',
      tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    };
  }

  if (lower.includes('4o') || lower.includes('opus') || lower.includes('sonnet') || lower.includes('large') || lower.includes('70b') || lower.includes('120b') || lower.includes('340b') || lower.includes('grok-3')) {
    return {
      tag: 'Frontier Flagship',
      tagColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    };
  }

  const capitalizedProvider = provider.charAt(0).toUpperCase() + provider.slice(1);
  return {
    tag: `${capitalizedProvider} Model`,
    tagColor: 'text-copper-400 bg-copper-500/10 border-copper-500/20',
  };
}

/**
 * Reads cached models for a provider synchronously from localStorage.
 * Guarded strictly to return [] on the website.
 */
export function getCachedProviderModels(provider: string): DiscoveredModel[] {
  if (!isDesktopApp() || typeof window === 'undefined') {
    return [];
  }

  if (provider === 'anthropic') {
    const anthropicModels = getCachedAnthropicModels();
    return anthropicModels.map((m) => ({
      id: m.id,
      name: m.name,
      tag: m.tag,
      tagColor: m.tagColor,
      provider: 'anthropic',
      description: m.description,
    }));
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX_DYNAMIC_MODELS}${provider}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list: DiscoveredModel[] = Array.isArray(parsed?.models)
      ? parsed.models
      : Array.isArray(parsed)
      ? parsed
      : [];
    return list;
  } catch {
    return [];
  }
}

/**
 * Returns all cached models grouped by provider.
 * Strictly returns an empty map on the website.
 */
export function getAllCachedDiscoveredModels(): Record<string, DiscoveredModel[]> {
  if (!isDesktopApp() || typeof window === 'undefined') {
    return {};
  }

  const providers: SupportedDiscoveryProvider[] = [
    'openai',
    'groq',
    'gemini',
    'anthropic',
    'openrouter',
    'mistral',
    'xai',
    'deepseek',
    'ollama',
    'cohere',
  ];

  const map: Record<string, DiscoveredModel[]> = {};
  for (const p of providers) {
    const cached = getCachedProviderModels(p);
    if (cached.length > 0) {
      map[p] = cached;
    }
  }
  return map;
}

/**
 * Dynamically queries a specific provider API for available models using the given credentials.
 * Guarded strictly: will NO-OP and return [] on the website.
 */
export async function fetchProviderModels(
  provider: SupportedDiscoveryProvider | string,
  apiKey: string,
  host?: string
): Promise<DiscoveredModel[]> {
  if (!isDesktopApp() || typeof window === 'undefined') {
    return [];
  }

  const cleanKey = (apiKey || '').trim();

  // Anthropic has dedicated discovery handler
  if (provider === 'anthropic') {
    const anthropicList = await fetchAnthropicModels(cleanKey);
    const discovered = anthropicList.map((m) => ({
      id: m.id,
      name: m.name,
      tag: m.tag,
      tagColor: m.tagColor,
      provider: 'anthropic',
      description: m.description,
    }));
    return discovered;
  }

  // Ollama doesn't require an API key, only host reachability
  if (provider !== 'ollama' && !cleanKey) {
    return getCachedProviderModels(provider);
  }

  try {
    let models: DiscoveredModel[] = [];

    switch (provider) {
      case 'openai': {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${cleanKey}` },
        });
        if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
        const data = await res.json();
        const rawList = Array.isArray(data?.data) ? data.data : [];
        models = rawList
          .map((m: any) => m?.id || '')
          .filter((id: string) => {
            const lower = id.toLowerCase();
            if (!lower) return false;
            if (
              lower.includes('whisper') ||
              lower.includes('dall-e') ||
              lower.includes('tts') ||
              lower.includes('embedding') ||
              lower.includes('davinci') ||
              lower.includes('babbage') ||
              lower.includes('moderation') ||
              lower.includes('realtime')
            ) {
              return false;
            }
            return (
              lower.startsWith('gpt-') ||
              lower.startsWith('o1') ||
              lower.startsWith('o3') ||
              lower.startsWith('chatgpt-') ||
              lower.startsWith('ft:gpt-')
            );
          })
          .map((id: string) => {
            const { tag, tagColor } = assignModelTags(id, 'openai');
            return {
              id,
              name: formatModelName(id),
              tag,
              tagColor,
              provider: 'openai',
              description: `OpenAI account model (${id})`,
            };
          });
        break;
      }

      case 'groq': {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${cleanKey}` },
        });
        if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
        const data = await res.json();
        const rawList = Array.isArray(data?.data) ? data.data : [];
        models = rawList
          .filter((m: any) => m?.active !== false)
          .map((m: any) => m?.id || '')
          .filter((id: string) => id && !id.toLowerCase().includes('whisper'))
          .map((id: string) => {
            const { tag, tagColor } = assignModelTags(id, 'groq');
            return {
              id,
              name: formatModelName(id),
              tag,
              tagColor,
              provider: 'groq',
              description: `Groq LPU hardware accelerated model (${id})`,
            };
          });
        break;
      }

      case 'gemini': {
        // Key in a header, never in the URL (URLs reach browser history, proxies and crash reports)
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
          headers: { 'x-goog-api-key': cleanKey },
        });
        if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
        const data = await res.json();
        const rawList = Array.isArray(data?.models) ? data.models : [];
        models = rawList
          .filter((m: any) => {
            if (!m?.name) return false;
            const methods = m?.supportedGenerationMethods || [];
            if (methods.length > 0 && !methods.includes('generateContent')) return false;
            const lower = m.name.toLowerCase();
            return !lower.includes('embedding') && !lower.includes('aqa');
          })
          .map((m: any) => {
            const cleanId = m.name.replace(/^models\//i, '');
            const { tag, tagColor } = assignModelTags(cleanId, 'gemini');
            return {
              id: cleanId,
              name: m.displayName || formatModelName(cleanId),
              tag,
              tagColor,
              provider: 'gemini',
              description: m.description || `Google Gemini model (${cleanId})`,
            };
          });
        break;
      }

      case 'openrouter': {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${cleanKey}` },
        });
        if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
        const data = await res.json();
        const rawList = Array.isArray(data?.data) ? data.data : [];
        models = rawList
          .map((m: any) => ({
            id: m?.id || '',
            name: m?.name || formatModelName(m?.id || ''),
            description: m?.description,
          }))
          .filter((m: any) => m.id)
          .map((m: any) => {
            const { tag, tagColor } = assignModelTags(m.id, 'openrouter');
            return {
              id: m.id,
              name: m.name,
              tag,
              tagColor,
              provider: 'openrouter',
              description: m.description || `OpenRouter model (${m.id})`,
            };
          });
        break;
      }

      case 'mistral': {
        const res = await fetch('https://api.mistral.ai/v1/models', {
          headers: { Authorization: `Bearer ${cleanKey}` },
        });
        if (!res.ok) throw new Error(`Mistral HTTP ${res.status}`);
        const data = await res.json();
        const rawList = Array.isArray(data?.data) ? data.data : [];
        models = rawList
          .map((m: any) => m?.id || '')
          .filter((id: string) => id && !id.toLowerCase().includes('embed'))
          .map((id: string) => {
            const { tag, tagColor } = assignModelTags(id, 'mistral');
            return {
              id,
              name: formatModelName(id),
              tag,
              tagColor,
              provider: 'mistral',
              description: `Mistral AI model (${id})`,
            };
          });
        break;
      }

      case 'xai': {
        const res = await fetch('https://api.x.ai/v1/models', {
          headers: { Authorization: `Bearer ${cleanKey}` },
        });
        if (!res.ok) throw new Error(`xAI HTTP ${res.status}`);
        const data = await res.json();
        const rawList = Array.isArray(data?.data) ? data.data : [];
        models = rawList
          .map((m: any) => m?.id || '')
          .filter((id: string) => id)
          .map((id: string) => {
            const { tag, tagColor } = assignModelTags(id, 'xai');
            return {
              id,
              name: formatModelName(id),
              tag,
              tagColor,
              provider: 'xai',
              description: `xAI Grok model (${id})`,
            };
          });
        break;
      }

      case 'deepseek': {
        const res = await fetch('https://api.deepseek.com/models', {
          headers: { Authorization: `Bearer ${cleanKey}` },
        });
        if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`);
        const data = await res.json();
        const rawList = Array.isArray(data?.data) ? data.data : [];
        models = rawList
          .map((m: any) => m?.id || '')
          .filter((id: string) => id)
          .map((id: string) => {
            const { tag, tagColor } = assignModelTags(id, 'deepseek');
            return {
              id,
              name: formatModelName(id),
              tag,
              tagColor,
              provider: 'deepseek',
              description: `DeepSeek model (${id})`,
            };
          });
        break;
      }

      case 'ollama': {
        const baseUrl = (host || 'http://localhost:11434').replace(/\/+$/, '');
        const res = await fetch(`${baseUrl}/api/tags`);
        if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
        const data = await res.json();
        const rawList = Array.isArray(data?.models) ? data.models : [];
        models = rawList
          .map((m: any) => m?.name || m?.model || '')
          .filter((name: string) => name)
          .map((name: string) => {
            const cleanId = name.startsWith('ollama/') ? name : `ollama/${name}`;
            const { tag, tagColor } = assignModelTags(cleanId, 'ollama');
            return {
              id: cleanId,
              name: `${formatModelName(name)} (Local)`,
              tag: tag || 'Local Offline',
              tagColor: tagColor || 'text-teal-400 bg-teal-500/10 border-teal-500/20',
              provider: 'ollama',
              description: `Locally served Ollama model (${name})`,
            };
          });
        break;
      }

      case 'cohere': {
        const res = await fetch('https://api.cohere.com/v1/models', {
          headers: { Authorization: `Bearer ${cleanKey}` },
        });
        if (!res.ok) throw new Error(`Cohere HTTP ${res.status}`);
        const data = await res.json();
        const rawList = Array.isArray(data?.models) ? data.models : [];
        models = rawList
          .map((m: any) => m?.name || '')
          .filter((id: string) => id && !id.toLowerCase().includes('embed'))
          .map((id: string) => {
            const { tag, tagColor } = assignModelTags(id, 'cohere');
            return {
              id,
              name: formatModelName(id),
              tag,
              tagColor,
              provider: 'cohere',
              description: `Cohere enterprise model (${id})`,
            };
          });
        break;
      }

      default:
        return getCachedProviderModels(provider);
    }

    if (models.length > 0) {
      localStorage.setItem(
        `${STORAGE_PREFIX_DYNAMIC_MODELS}${provider}`,
        JSON.stringify({ timestamp: Date.now(), models })
      );
      window.dispatchEvent(
        new CustomEvent(DYNAMIC_MODELS_UPDATED_EVENT, { detail: { provider, models } })
      );
    }

    return models;
  } catch (err) {
    console.warn(`[DynamicModelDiscovery] Discovery failed for provider '${provider}':`, err);
    return getCachedProviderModels(provider);
  }
}

/**
 * Scans saved keys in localStorage['bedrock_api_keys'] and executes non-blocking
 * discovery for all configured platforms.
 * Strictly NO-OP when !isDesktopApp().
 */
export function syncAllConfiguredModels(): void {
  if (!isDesktopApp() || typeof window === 'undefined') {
    return;
  }

  try {
    const raw = localStorage.getItem('bedrock_api_keys');
    if (!raw) return;
    const parsed = JSON.parse(raw);

    const keyMap: Record<SupportedDiscoveryProvider, string | undefined> = {
      openai: parsed?.openAiKey,
      groq: parsed?.groqKey,
      gemini: parsed?.geminiKey,
      anthropic: parsed?.anthropicKey,
      openrouter: parsed?.openRouterKey,
      mistral: parsed?.mistralKey,
      xai: parsed?.xaiKey,
      deepseek: parsed?.deepSeekKey,
      ollama: parsed?.ollamaHost,
      cohere: parsed?.cohereKey,
    };

    (Object.entries(keyMap) as [SupportedDiscoveryProvider, string | undefined][]).forEach(
      ([provider, key]) => {
        if (provider === 'ollama') {
          // Sync Ollama if host is specified or localhost
          fetchProviderModels('ollama', '', key || 'http://localhost:11434').catch(() => {});
        } else if (typeof key === 'string' && key.trim().length > 5) {
          fetchProviderModels(provider, key.trim()).catch(() => {});
        }
      }
    );
  } catch {
    // Ignore storage parse issues
  }
}
