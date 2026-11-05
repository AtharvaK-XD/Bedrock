import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getCachedAnthropicModels,
  fetchAnthropicModels,
  STORAGE_KEY_ANTHROPIC_MODELS,
  ANTHROPIC_MODELS_EVENT,
  CURATED_ANTHROPIC_MODELS,
} from '../anthropicModels';
import { getModelGroups } from '../modelCatalog';

function installBrowserStubs() {
  const store = new Map<string, string>();
  const localStorageStub = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  const listeners: Record<string, Function[]> = {};
  vi.stubGlobal('localStorage', localStorageStub);
  vi.stubGlobal('window', {
    addEventListener: (type: string, fn: Function) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    removeEventListener: (type: string, fn: Function) => {
      if (listeners[type]) {
        listeners[type] = listeners[type].filter((f) => f !== fn);
      }
    },
    dispatchEvent: (e: any) => {
      const type = e.type;
      (listeners[type] || []).forEach((fn) => fn(e));
      return true;
    },
  });
  vi.stubGlobal(
    'CustomEvent',
    class CustomEvent extends Event {
      detail: unknown;
      constructor(type: string, init?: any) {
        super(type);
        this.detail = init?.detail;
      }
    }
  );
}

describe('Anthropic dynamic model discovery & registry', () => {
  beforeEach(() => {
    installBrowserStubs();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns curated frontier models by default when no cache exists', () => {
    const models = getCachedAnthropicModels();
    expect(models.length).toBeGreaterThanOrEqual(6);
    const ids = models.map((m) => m.id);
    expect(ids).toContain('claude-3-7-sonnet-20250219');
    expect(ids).toContain('claude-opus-5-5');
    expect(ids).toContain('claude-sonnet-5-5');
    expect(ids).toContain('claude-3-5-sonnet-20241022');
    expect(ids).toContain('claude-haiku-5-5');
    expect(ids).toContain('claude-3-5-haiku-20241022');
  });

  it('fetches dynamic models from Anthropic API and caches them in localStorage', async () => {
    const mockApiResponse = {
      data: [
        { id: 'claude-3-7-sonnet-20250219', display_name: 'Claude 3.7 Sonnet' },
        { id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5' },
        { id: 'claude-sonnet-5-5', display_name: 'Claude Sonnet 5.5' },
        { id: 'claude-custom-finetune-v1', display_name: 'Claude Custom Finetune v1' },
      ],
      has_more: false,
    };

    let requestedUrl = '';
    let requestHeaders: Record<string, string> = {};

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      requestedUrl = String(url);
      requestHeaders = (init?.headers as Record<string, string>) || {};
      return new Response(JSON.stringify(mockApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    let eventFired = false;
    window.addEventListener(ANTHROPIC_MODELS_EVENT, () => {
      eventFired = true;
    });

    const result = await fetchAnthropicModels('sk-ant-test-key-12345');

    expect(requestedUrl).toBe('https://api.anthropic.com/v1/models');
    expect(requestHeaders['x-api-key']).toBe('sk-ant-test-key-12345');
    expect(requestHeaders['anthropic-version']).toBe('2023-06-01');
    expect(requestHeaders['anthropic-dangerous-direct-browser-access']).toBe('true');

    // Custom model is included
    const custom = result.find((m) => m.id === 'claude-custom-finetune-v1');
    expect(custom).toBeDefined();
    expect(custom?.name).toBe('Claude Custom Finetune v1');

    // Local storage updated
    const rawStored = localStorage.getItem(STORAGE_KEY_ANTHROPIC_MODELS);
    expect(rawStored).toBeTruthy();
    expect(eventFired).toBe(true);

    // Dynamic model catalog reflects it
    const groups = getModelGroups();
    const anthropicGroup = groups.find((g) => g.group === 'Anthropic');
    expect(anthropicGroup).toBeDefined();
    const foundCustomInGroup = anthropicGroup?.models.some((m) => m.id === 'claude-custom-finetune-v1');
    expect(foundCustomInGroup).toBe(true);
  });

  it('safely falls back to curated models on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const result = await fetchAnthropicModels('sk-ant-test-key-12345');
    expect(result.length).toBe(CURATED_ANTHROPIC_MODELS.length);
    expect(result[0].id).toBe('claude-3-7-sonnet-20250219');
  });
});
