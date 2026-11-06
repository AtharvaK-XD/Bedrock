import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The website runs on Bedrock's server keys only (CHG-0086). A key a visitor saved in an older version must not be
// sent anywhere from the website, and must not stay in the browser in plain text.
const KEYS = JSON.stringify({ anthropicKey: ['sk-ant-', 'api03-FakeKeyForTests1234567890'].join(''), geminiKey: 'g-fake' });
let store: Map<string, string>;

function browser(desktop: boolean) {
  store = new Map([['bedrock_api_keys', KEYS], ['bedrock_model_settings', '{}']]);
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  };
  vi.stubGlobal('localStorage', localStorage);
  vi.stubGlobal('window', { localStorage, ...(desktop ? { IS_ELECTRON: true } : {}), location: { origin: 'https://bedrockxai.com' } });
  vi.stubGlobal('navigator', { userAgent: desktop ? 'Mozilla/5.0 Electron/43' : 'Mozilla/5.0 Chrome/140' });
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe('website: no use and no storage of the visitor\'s own keys', () => {
  it('never sends a stored Anthropic key from the website', async () => {
    const fetchMock = browser(false);
    const { syncAnthropicModelsIfAvailable } = await import('../anthropicModels');
    syncAnthropicModelsIfAvailable();
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still syncs Anthropic models in the desktop app', async () => {
    const fetchMock = browser(true);
    const { syncAnthropicModelsIfAvailable } = await import('../anthropicModels');
    syncAnthropicModelsIfAvailable();
    await new Promise((r) => setTimeout(r, 0));
    expect(String((fetchMock.mock.calls as any[])[0]?.[0])).toBe('https://api.anthropic.com/v1/models');
  });

  it('deletes keys an older version saved in the website\'s browser storage, and nothing else', async () => {
    browser(false);
    const { initSecureKeyStore } = await import('../secureKeyStore');
    await initSecureKeyStore();
    expect(store.has('bedrock_api_keys')).toBe(false);
    expect(store.has('bedrock_model_settings')).toBe(true);
  });

  it('leaves the desktop app\'s keys alone (they move to OS-encrypted storage there)', async () => {
    browser(true);
    const { initSecureKeyStore } = await import('../secureKeyStore');
    await initSecureKeyStore(); // no electronSecrets bridge in this test: keeps browser storage
    expect(store.get('bedrock_api_keys')).toBe(KEYS);
  });
});
