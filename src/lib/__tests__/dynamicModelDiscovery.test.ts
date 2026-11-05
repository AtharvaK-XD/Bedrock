import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchProviderModels,
  getCachedProviderModels,
  getAllCachedDiscoveredModels,
  syncAllConfiguredModels,
  DYNAMIC_MODELS_UPDATED_EVENT,
  STORAGE_PREFIX_DYNAMIC_MODELS,
} from '../dynamicModelDiscovery';
import { getModelGroups, MODEL_GROUPS } from '../modelCatalog';
import * as platform from '../platform';

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

describe('Universal Dynamic Model Discovery', () => {
  beforeEach(() => {
    installBrowserStubs();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Website isolation invariant (isDesktopApp() === false)', () => {
    beforeEach(() => {
      vi.spyOn(platform, 'isDesktopApp').mockReturnValue(false);
    });

    it('returns empty cached models on website', () => {
      localStorage.setItem(
        `${STORAGE_PREFIX_DYNAMIC_MODELS}openai`,
        JSON.stringify({ models: [{ id: 'gpt-custom', name: 'Custom GPT' }] })
      );
      expect(getCachedProviderModels('openai')).toEqual([]);
      expect(getAllCachedDiscoveredModels()).toEqual({});
    });

    it('no-ops fetchProviderModels and makes zero network calls on website', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const models = await fetchProviderModels('openai', 'sk-test-fake');
      expect(models).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('strictly returns static curated MODEL_GROUPS on website', () => {
      localStorage.setItem(
        `${STORAGE_PREFIX_DYNAMIC_MODELS}openai`,
        JSON.stringify({ models: [{ id: 'gpt-custom', name: 'Custom GPT' }] })
      );
      const groups = getModelGroups();
      expect(groups).toEqual(MODEL_GROUPS);
      const openAiGroup = groups.find((g) => g.group === 'OpenAI');
      expect(openAiGroup?.models.some((m) => m.id === 'gpt-custom')).toBe(false);
    });
  });

  describe('Desktop App dynamic discovery (isDesktopApp() === true)', () => {
    beforeEach(() => {
      vi.spyOn(platform, 'isDesktopApp').mockReturnValue(true);
    });

    it('fetches and filters OpenAI models with correct tags and caching', async () => {
      const mockOpenAiResponse = {
        data: [
          { id: 'gpt-4o' },
          { id: 'o1-preview' },
          { id: 'o3-mini' },
          { id: 'whisper-1' },
          { id: 'text-embedding-3-large' },
          { id: 'dall-e-3' },
          { id: 'ft:gpt-4o:my-org:custom-1' },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        expect(String(url)).toBe('https://api.openai.com/v1/models');
        return new Response(JSON.stringify(mockOpenAiResponse), { status: 200 });
      });

      let eventFired = false;
      window.addEventListener(DYNAMIC_MODELS_UPDATED_EVENT, (e: any) => {
        if (e.detail?.provider === 'openai') {
          eventFired = true;
        }
      });

      const models = await fetchProviderModels('openai', 'sk-test-valid');

      expect(eventFired).toBe(true);
      const ids = models.map((m) => m.id);
      expect(ids).toContain('gpt-4o');
      expect(ids).toContain('o1-preview');
      expect(ids).toContain('o3-mini');
      expect(ids).toContain('ft:gpt-4o:my-org:custom-1');

      // Filtered out non-chat models
      expect(ids).not.toContain('whisper-1');
      expect(ids).not.toContain('text-embedding-3-large');
      expect(ids).not.toContain('dall-e-3');

      // Tags verified
      const o1Model = models.find((m) => m.id === 'o1-preview');
      expect(o1Model?.tag).toBe('Deep Reasoning');

      // Merged into getModelGroups()
      const groups = getModelGroups();
      const openAiGroup = groups.find((g) => g.group === 'OpenAI');
      expect(openAiGroup?.models.some((m) => m.id === 'ft:gpt-4o:my-org:custom-1')).toBe(true);
    });

    it('fetches and normalizes Groq models', async () => {
      const mockGroqResponse = {
        data: [
          { id: 'llama-3.3-70b-versatile', active: true },
          { id: 'qwen-2.5-coder-32b', active: true },
          { id: 'whisper-large-v3', active: true },
          { id: 'inactive-model', active: false },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(JSON.stringify(mockGroqResponse), { status: 200 });
      });

      const models = await fetchProviderModels('groq', 'gsk-test-valid');
      const ids = models.map((m) => m.id);

      expect(ids).toContain('llama-3.3-70b-versatile');
      expect(ids).toContain('qwen-2.5-coder-32b');
      expect(ids).not.toContain('whisper-large-v3');
      expect(ids).not.toContain('inactive-model');

      const coderModel = models.find((m) => m.id === 'qwen-2.5-coder-32b');
      expect(coderModel?.tag).toBe('Code Specialist');
    });

    it('fetches Gemini models and strips models/ prefix', async () => {
      const mockGeminiResponse = {
        models: [
          {
            name: 'models/gemini-2.0-flash',
            displayName: 'Gemini 2.0 Flash',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/text-embedding-004',
            displayName: 'Text Embedding 004',
            supportedGenerationMethods: ['embedContent'],
          },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        expect(String(url)).toContain('generativelanguage.googleapis.com');
        return new Response(JSON.stringify(mockGeminiResponse), { status: 200 });
      });

      const models = await fetchProviderModels('gemini', 'AIzaSyFakeKey');
      expect(models.length).toBe(1);
      expect(models[0].id).toBe('gemini-2.0-flash');
      expect(models[0].name).toBe('Gemini 2.0 Flash');
      expect(models[0].tag).toBe('Ultra Fast');
    });

    it('fetches local Ollama models and normalizes IDs', async () => {
      const mockOllamaResponse = {
        models: [
          { name: 'deepseek-r1:14b', model: 'deepseek-r1:14b' },
          { name: 'llama3.2:latest', model: 'llama3.2:latest' },
        ],
      };

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        expect(String(url)).toBe('http://localhost:11434/api/tags');
        return new Response(JSON.stringify(mockOllamaResponse), { status: 200 });
      });

      const models = await fetchProviderModels('ollama', '', 'http://localhost:11434');
      const ids = models.map((m) => m.id);
      expect(ids).toContain('ollama/deepseek-r1:14b');
      expect(ids).toContain('ollama/llama3.2:latest');

      const groups = getModelGroups();
      const ollamaGroup = groups.find((g) => g.group === 'Ollama (Local Models)');
      expect(ollamaGroup?.models.some((m) => m.id === 'ollama/deepseek-r1:14b')).toBe(true);
    });

    it('syncAllConfiguredModels queries all populated keys in bedrock_api_keys', async () => {
      const keys = {
        openAiKey: 'sk-test-openai',
        groqKey: 'gsk-test-groq',
        geminiKey: 'AIzaSyTestGemini',
      };
      localStorage.setItem('bedrock_api_keys', JSON.stringify(keys));

      const fetchedProviders: string[] = [];
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const u = String(url);
        if (u.includes('api.openai.com')) fetchedProviders.push('openai');
        if (u.includes('api.groq.com')) fetchedProviders.push('groq');
        if (u.includes('generativelanguage.googleapis.com')) fetchedProviders.push('gemini');
        if (u.includes('localhost:11434')) fetchedProviders.push('ollama');
        return new Response(JSON.stringify({ data: [], models: [] }), { status: 200 });
      });

      syncAllConfiguredModels();

      // Allow background microtasks to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(fetchedProviders).toContain('openai');
      expect(fetchedProviders).toContain('groq');
      expect(fetchedProviders).toContain('gemini');
    });

    it('gracefully handles network errors without breaking cached state', async () => {
      localStorage.setItem(
        `${STORAGE_PREFIX_DYNAMIC_MODELS}xai`,
        JSON.stringify({ models: [{ id: 'grok-test', name: 'Grok Test' }] })
      );

      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'));

      const result = await fetchProviderModels('xai', 'xai-fake-key');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('grok-test');
    });
  });
});
