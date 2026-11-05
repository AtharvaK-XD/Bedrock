/**
 * Desktop BYOK: which provider serves a model the user picked from the discovered list (dynamicModelDiscovery.ts).
 *
 * Discovered ids are whatever the provider's /models endpoint returned ("gpt-5.1-mini", "grok-4", "mistral-large-latest",
 * "command-a-03-2025", "meta-llama/llama-4-scout" on OpenRouter ...). Guessing the provider from the name sends many
 * of them to the wrong place, so the id is looked up in the discovery cache instead: the cache records which
 * provider listed it. Website builds never use this (the website shows only the curated models).
 */
import { isDesktopApp } from './platform';
import { getCachedProviderModels } from './dynamicModelDiscovery';

export type DirectProviderId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'groq'
  | 'mistral'
  | 'xai'
  | 'deepseek'
  | 'cohere'
  | 'ollama'
  | 'openrouter';

/**
 * First-party providers before OpenRouter: some ids exist on both (for example "openai/gpt-oss-120b" on Groq and on
 * OpenRouter), and the provider's own endpoint is the direct route for the key the user added.
 */
export const DISCOVERY_LOOKUP_ORDER: readonly DirectProviderId[] = [
  'openai',
  'anthropic',
  'gemini',
  'groq',
  'mistral',
  'xai',
  'deepseek',
  'cohere',
  'ollama',
  'openrouter',
];

/**
 * The provider that listed `modelId` for this user, or null when the id is not a discovered model (curated models,
 * 'auto', the website). `preferredProvider` is tried first when it names one of the providers above.
 */
export function findDiscoveredModelProvider(modelId?: string | null, preferredProvider?: string | null): DirectProviderId | null {
  if (!modelId || modelId === 'auto' || !isDesktopApp()) return null;

  const preferred = DISCOVERY_LOOKUP_ORDER.find((p) => p === preferredProvider);
  const order = preferred ? [preferred, ...DISCOVERY_LOOKUP_ORDER.filter((p) => p !== preferred)] : DISCOVERY_LOOKUP_ORDER;

  for (const provider of order) {
    try {
      // Exact match: the id goes to the provider exactly as the provider listed it
      if (getCachedProviderModels(provider).some((m) => m.id === modelId)) return provider;
    } catch {
      // A damaged cache entry for one provider must not stop the lookup
    }
  }
  return null;
}
