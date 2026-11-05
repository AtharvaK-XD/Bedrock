import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// OPEN-0075: on the desktop app, a model picked from the discovered list runs exactly as listed, on the provider that
// listed it, with the user's own key. fetch is faked: no network, no real keys.
const store = new Map<string, string>();
const win: Record<string, unknown> = { IS_ELECTRON: true, dispatchEvent: () => true };
vi.stubGlobal('localStorage', {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});
vi.stubGlobal('window', win);
vi.stubGlobal('CustomEvent', class {});

import { callLLMWithMeta } from '../callLLM';
import { findDiscoveredModelProvider } from '../discoveredModelRouting';
import { getRequiredProviderForModel } from '../apiKeysHelper';
import { isModelAllowedForTier } from '../subscriptionTiers';

type Call = { url: string; body: any; headers: Record<string, string> };
let calls: Call[] = [];
let failWith: number | null = null;

function okBody(url: string) {
  if (url.includes('cohere.com')) return { message: { content: [{ type: 'text', text: 'ok' }] } };
  if (url.includes('anthropic.com')) return { content: [{ type: 'text', text: 'ok' }] };
  if (url.includes('generativelanguage')) return { candidates: [{ content: { parts: [{ text: 'ok' }] } }] };
  return { choices: [{ message: { content: 'ok' } }] };
}

const fetchMock = vi.fn(async (url: string, init: any) => {
  calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
  if (failWith) {
    return new Response(JSON.stringify({ error: { message: 'model_not_found' } }), { status: failWith });
  }
  return new Response(JSON.stringify(okBody(url)), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
vi.stubGlobal('fetch', fetchMock);

function setKeys(keys: Record<string, string>) {
  store.set('bedrock_api_keys', JSON.stringify(keys));
}
function discover(provider: string, ids: string[]) {
  store.set(`bedrock_cached_models_${provider}`, JSON.stringify(ids.map((id) => ({ id, name: id, provider }))));
}

beforeEach(() => {
  store.clear();
  calls = [];
  failWith = null;
  fetchMock.mockClear();
  win.IS_ELECTRON = true;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('discovered models run exactly as listed (desktop)', () => {
  it('Groq: a llama model is NOT swapped for qwen, and goes to Groq', async () => {
    setKeys({ groqKey: 'gsk_test', openRouterKey: 'sk-or-test' });
    discover('groq', ['meta-llama/llama-4-scout-17b-16e-instruct']);
    const r = await callLLMWithMeta('hi', 'meta-llama/llama-4-scout-17b-16e-instruct');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(calls[0].body.model).toBe('meta-llama/llama-4-scout-17b-16e-instruct');
    expect(r.provider).toBe('Groq');
    expect(r.text).toBe('ok');
  });

  it.each([
    ['mistral', 'mistralKey', 'mistral-large-latest', 'https://api.mistral.ai/v1/chat/completions', 'Mistral AI'],
    ['xai', 'xaiKey', 'grok-4', 'https://api.x.ai/v1/chat/completions', 'xAI (Grok)'],
    ['deepseek', 'deepSeekKey', 'deepseek-reasoner', 'https://api.deepseek.com/chat/completions', 'DeepSeek'],
    ['openai', 'openAiKey', 'gpt-4.1-nano', 'https://api.openai.com/v1/chat/completions', 'OpenAI'],
    ['openrouter', 'openRouterKey', 'qwen/qwen3-coder', 'https://openrouter.ai/api/v1/chat/completions', 'OpenRouter'],
  ])('%s: exact model id, own endpoint, Bearer key', async (provider, keyField, model, url, label) => {
    setKeys({ [keyField]: 'k_test' });
    discover(provider, [model]);
    const r = await callLLMWithMeta('hi', model);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(url);
    expect(calls[0].body.model).toBe(model);
    expect(calls[0].headers.Authorization).toBe('Bearer k_test');
    expect(r.provider).toBe(label);
    expect(r.text).toBe('ok');
  });

  it('Cohere: v2 chat format, "p" within 0.99, text read from message.content', async () => {
    setKeys({ cohereKey: 'co_test' });
    discover('cohere', ['command-a-03-2025']);
    const r = await callLLMWithMeta('hi', 'command-a-03-2025');
    expect(calls[0].url).toBe('https://api.cohere.com/v2/chat');
    expect(calls[0].body).toMatchObject({ model: 'command-a-03-2025', stream: false });
    expect(calls[0].body.p).toBeLessThanOrEqual(0.99);
    expect(calls[0].body.messages.at(-1)).toEqual({ role: 'user', content: expect.any(String) });
    expect(r.text).toBe('ok');
  });

  it('Gemini: a discovered id is not renamed to gemini-3.5-flash-lite', async () => {
    setKeys({ geminiKey: 'AIza_test' });
    discover('gemini', ['gemini-2.5-pro']);
    await callLLMWithMeta('hi', 'gemini-2.5-pro');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent');
  });

  it('OpenAI reasoning models: no temperature / top_p, max_completion_tokens instead of max_tokens', async () => {
    setKeys({ openAiKey: 'sk_test' });
    discover('openai', ['o3-mini', 'gpt-5-mini']);
    for (const model of ['o3-mini', 'gpt-5-mini']) {
      calls = [];
      await callLLMWithMeta('hi', model);
      expect(calls[0].body, model).not.toHaveProperty('temperature');
      expect(calls[0].body, model).not.toHaveProperty('top_p');
      expect(calls[0].body, model).not.toHaveProperty('max_tokens');
      expect(calls[0].body.max_completion_tokens, model).toBeGreaterThan(0);
    }
  });

  it('Anthropic: exact model, temperature only (current Claude models refuse temperature + top_p together)', async () => {
    setKeys({ anthropicKey: 'sk-ant-test' });
    store.set('bedrock_cached_anthropic_models', JSON.stringify([{ id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5' }]));
    await callLLMWithMeta('hi', 'claude-sonnet-5-5');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages');
    expect(calls[0].body.model).toBe('claude-sonnet-5-5');
    expect(calls[0].body).toHaveProperty('temperature');
    expect(calls[0].body).not.toHaveProperty('top_p');
  });

  it('Ollama: uses the host saved in Settings (ollamaHost) and the model name without the ollama/ prefix', async () => {
    setKeys({ ollamaHost: 'http://127.0.0.1:11500' });
    discover('ollama', ['ollama/llama3.2']);
    await callLLMWithMeta('hi', 'ollama/llama3.2');
    expect(calls[0].url).toBe('http://127.0.0.1:11500/v1/chat/completions');
    expect(calls[0].body.model).toBe('llama3.2');
  });
});

describe('no silent substitutes for a model the user picked', () => {
  it('a failing model surfaces its error: one call only, no fallback model or provider', async () => {
    setKeys({ groqKey: 'gsk_test', geminiKey: 'AIza_test', openAiKey: 'sk_test' });
    discover('groq', ['some-new-groq-model']);
    failWith = 404;
    await expect(callLLMWithMeta('hi', 'some-new-groq-model')).rejects.toBeTruthy();
    expect(calls).toHaveLength(1);
    expect(calls[0].body.model).toBe('some-new-groq-model');
  });
});

describe('provider lookup and keys', () => {
  it('an id listed by both Groq and OpenRouter goes to Groq (first-party route)', () => {
    discover('groq', ['openai/gpt-oss-120b']);
    discover('openrouter', ['openai/gpt-oss-120b']);
    expect(findDiscoveredModelProvider('openai/gpt-oss-120b')).toBe('groq');
    expect(findDiscoveredModelProvider('openai/gpt-oss-120b', 'openrouter')).toBe('openrouter');
  });

  it('an OpenRouter llama model needs the OpenRouter key, not a Groq key', async () => {
    setKeys({ openRouterKey: 'sk-or-test' });
    discover('openrouter', ['meta-llama/llama-3.3-70b-instruct']);
    expect(getRequiredProviderForModel('meta-llama/llama-3.3-70b-instruct').providerId).toBe('openrouter');
    await callLLMWithMeta('hi', 'meta-llama/llama-3.3-70b-instruct');
    expect(calls[0].url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(calls[0].body.model).toBe('meta-llama/llama-3.3-70b-instruct');
  });

  it('DeepSeek has its own key requirement (was: asked for a Gemini key)', async () => {
    expect(getRequiredProviderForModel('deepseek-chat').providerId).toBe('deepseek');
    setKeys({ geminiKey: 'AIza_test' });
    discover('deepseek', ['deepseek-chat']);
    await expect(callLLMWithMeta('hi', 'deepseek-chat')).rejects.toMatchObject({ message: expect.stringMatching(/DeepSeek API key/) });
    expect(calls).toHaveLength(0);
  });

  it('a curated Claude model with only an OpenRouter key still goes through OpenRouter', async () => {
    setKeys({ openRouterKey: 'sk-or-test' });
    await callLLMWithMeta('hi', 'claude-sonnet-5-5');
    expect(calls[0].url).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('the plan check allows any model id on desktop', () => {
    for (const id of ['grok-4', 'some/brand-new-model', 'claude-opus-5-5', 'command-a-03-2025']) {
      expect(isModelAllowedForTier(id, 'free'), id).toBe(true);
    }
  });
});

describe('website builds are unchanged', () => {
  it('never routes by the discovered list', () => {
    discover('groq', ['meta-llama/llama-4-scout-17b-16e-instruct']);
    win.IS_ELECTRON = false;
    expect(findDiscoveredModelProvider('meta-llama/llama-4-scout-17b-16e-instruct')).toBeNull();
  });
});
