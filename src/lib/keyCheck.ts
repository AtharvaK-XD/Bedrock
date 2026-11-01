/**
 * Checks an API key against the provider it belongs to, straight from the user's device.
 * The key is only ever sent to that provider (never to Bedrock servers) and is never logged.
 */

export type KeyCheckStatus = 'valid' | 'invalid' | 'unreachable' | 'unsupported';

export interface KeyCheckResult {
  status: KeyCheckStatus;
  message: string;
}

interface CheckPlan {
  url: string;
  init: RequestInit;
}

/** Providers the app calls directly from the device, with the cheapest request that proves a key works. */
function buildPlan(providerId: string, key: string): CheckPlan | null {
  switch (providerId) {
    case 'gemini':
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(key)}`,
        init: { method: 'GET' },
      };
    case 'groq':
      return { url: 'https://api.groq.com/openai/v1/models', init: { method: 'GET', headers: { Authorization: `Bearer ${key}` } } };
    case 'openai':
      return { url: 'https://api.openai.com/v1/models', init: { method: 'GET', headers: { Authorization: `Bearer ${key}` } } };
    case 'openrouter':
      return { url: 'https://openrouter.ai/api/v1/auth/key', init: { method: 'GET', headers: { Authorization: `Bearer ${key}` } } };
    case 'perplexity':
      // Perplexity has no key-check endpoint, so this sends a one-token request
      return {
        url: 'https://api.perplexity.ai/chat/completions',
        init: {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'sonar', messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }),
        },
      };
    default:
      return null;
  }
}

const TIMEOUT_MS = 8000;

export async function checkProviderKey(providerId: string, rawKey: string): Promise<KeyCheckResult> {
  const key = rawKey.trim();
  if (!key) return { status: 'invalid', message: 'Enter a key first.' };

  const plan = buildPlan(providerId, key);
  if (!plan) {
    return { status: 'unsupported', message: "Saved on this device. A live check isn't available for this provider yet." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(plan.url, { ...plan.init, signal: controller.signal });
    if (res.ok) return { status: 'valid', message: 'The provider accepted this key.' };
    if (res.status === 401 || res.status === 403 || res.status === 400) {
      return { status: 'invalid', message: 'The provider rejected this key. Check that you copied all of it.' };
    }
    if (res.status === 429) {
      return { status: 'valid', message: 'The key works, but the provider is rate-limiting you right now.' };
    }
    return { status: 'unreachable', message: `The provider answered with an error (${res.status}). Try again later.` };
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'AbortError';
    return {
      status: 'unreachable',
      message: timedOut ? 'The provider took too long to answer.' : "Couldn't reach the provider. Check your internet connection.",
    };
  } finally {
    clearTimeout(timer);
  }
}
