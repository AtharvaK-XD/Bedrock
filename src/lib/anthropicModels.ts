/**
 * Anthropic Model Registry & Dynamic Discovery
 *
 * Provides curated frontier Claude models and dynamically fetches models accessible
 * via the user's Anthropic API key (BYOK) from https://api.anthropic.com/v1/models.
 * Cached locally in localStorage for instant access without blocking launches.
 */

export interface AnthropicModel {
  id: string;
  name: string;
  tag: string;
  tagColor: string;
  description?: string;
  isFrontier?: boolean;
}

/**
 * Curated frontier Claude models.
 * Includes latest generation models (Claude 3.7 Sonnet, Opus 5.5, Sonnet 5.5, Haiku 5.5, 3.5 Sonnet, 3.5 Haiku).
 */
export const CURATED_ANTHROPIC_MODELS: AnthropicModel[] = [
  {
    id: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet',
    tag: 'Hybrid Reasoning',
    tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    description: 'Anthropic flagship with hybrid reasoning and frontier coding capability.',
    isFrontier: true,
  },
  {
    id: 'claude-opus-5-5',
    name: 'Claude Opus 5.5',
    tag: 'Frontier Flagship',
    tagColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    description: 'Ultimate depth for complex system architecture and challenging benchmarks.',
    isFrontier: true,
  },
  {
    id: 'claude-sonnet-5-5',
    name: 'Claude Sonnet 5.5',
    tag: 'Deep Reasoning',
    tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    description: 'High efficiency and nuanced reasoning for production prompt engineering.',
    isFrontier: true,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    tag: 'Pro Coding',
    tagColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    description: 'Industry-standard reasoning and software development benchmark.',
    isFrontier: true,
  },
  {
    id: 'claude-haiku-5-5',
    name: 'Claude Haiku 5.5',
    tag: 'Ultra-Fast',
    tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    description: 'Sub-second lightweight execution for rapid iterations and testing.',
    isFrontier: true,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    tag: 'Fast',
    tagColor: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
    description: 'Fast, cost-effective model for high-frequency prompt evaluations.',
    isFrontier: true,
  },
];

export const STORAGE_KEY_ANTHROPIC_MODELS = 'bedrock_cached_anthropic_models';
export const ANTHROPIC_MODELS_EVENT = 'bedrock_anthropic_models_updated';

function formatDynamicModel(id: string, displayName?: string): AnthropicModel {
  const name = displayName || id
    .replace(/^claude-/i, 'Claude ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const lower = id.toLowerCase();
  let tag = 'Claude Model';
  let tagColor = 'text-orange-400 bg-orange-500/10 border-orange-500/20';

  if (lower.includes('opus')) {
    tag = 'Frontier Flagship';
    tagColor = 'text-purple-400 bg-purple-500/10 border-purple-500/20';
  } else if (lower.includes('sonnet')) {
    tag = 'Reasoning & Code';
    tagColor = 'text-orange-400 bg-orange-500/10 border-orange-500/20';
  } else if (lower.includes('haiku')) {
    tag = 'Ultra-Fast';
    tagColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  }

  return {
    id,
    name,
    tag,
    tagColor,
    description: `Dynamic Anthropic model available via your API key (${id})`,
    isFrontier: true,
  };
}

/**
 * Returns currently cached Anthropic models merged with the curated list.
 * Always synchronous and safe to call during component initialization.
 */
export function getCachedAnthropicModels(): AnthropicModel[] {
  try {
    if (typeof window === 'undefined') return CURATED_ANTHROPIC_MODELS;
    const raw = localStorage.getItem(STORAGE_KEY_ANTHROPIC_MODELS);
    if (!raw) return CURATED_ANTHROPIC_MODELS;
    const parsed = JSON.parse(raw);
    const list: AnthropicModel[] = Array.isArray(parsed?.models)
      ? parsed.models
      : Array.isArray(parsed)
      ? parsed
      : [];

    if (list.length === 0) return CURATED_ANTHROPIC_MODELS;

    const map = new Map<string, AnthropicModel>();
    for (const m of CURATED_ANTHROPIC_MODELS) {
      map.set(m.id.toLowerCase(), m);
    }
    for (const m of list) {
      const key = m.id.toLowerCase();
      if (!map.has(key)) {
        map.set(key, m);
      }
    }
    return Array.from(map.values());
  } catch {
    return CURATED_ANTHROPIC_MODELS;
  }
}

/**
 * Dynamically queries the Anthropic models endpoint with the user's API key.
 * Updates local cache and emits ANTHROPIC_MODELS_EVENT.
 */
export async function fetchAnthropicModels(apiKey: string): Promise<AnthropicModel[]> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    return getCachedAnthropicModels();
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': cleanKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    });

    if (!res.ok) {
      console.warn(`[AnthropicModels] Models query returned HTTP ${res.status}`);
      return getCachedAnthropicModels();
    }

    const json = await res.json();
    const fetchedItems: Array<{ id: string; display_name?: string }> = Array.isArray(json?.data)
      ? json.data
      : [];

    const dynamicModels = fetchedItems.map((item) =>
      formatDynamicModel(item.id, item.display_name)
    );

    const map = new Map<string, AnthropicModel>();
    for (const m of CURATED_ANTHROPIC_MODELS) {
      map.set(m.id.toLowerCase(), m);
    }
    for (const m of dynamicModels) {
      const key = m.id.toLowerCase();
      if (!map.has(key)) {
        map.set(key, m);
      }
    }

    const result = Array.from(map.values());

    if (typeof window !== 'undefined') {
      localStorage.setItem(
        STORAGE_KEY_ANTHROPIC_MODELS,
        JSON.stringify({ timestamp: Date.now(), models: result })
      );
      window.dispatchEvent(new CustomEvent(ANTHROPIC_MODELS_EVENT, { detail: { models: result } }));
    }

    return result;
  } catch (err) {
    console.warn('[AnthropicModels] Dynamic model discovery failed:', err);
    return getCachedAnthropicModels();
  }
}

/**
 * Non-blocking background sync helper called at app startup or when settings change.
 */
export function syncAnthropicModelsIfAvailable(): void {
  try {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem('bedrock_api_keys');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const key = parsed?.anthropicKey;
    if (typeof key === 'string' && key.trim().length > 10) {
      fetchAnthropicModels(key.trim()).catch(() => {});
    }
  } catch {
    // ignore
  }
}
