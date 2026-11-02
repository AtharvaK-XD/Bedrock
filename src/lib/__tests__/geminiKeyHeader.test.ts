// The user's Gemini key must travel in the x-goog-api-key header, never in the request URL
// (URLs reach browser history, proxies and crash-report breadcrumbs).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkProviderKey } from '../keyCheck';
import { callGemini } from '../api';
import apiSource from '../api.ts?raw';
import callLLMSource from '../callLLM.ts?raw';
import keyCheckSource from '../keyCheck.ts?raw';

const KEY = 'AIzaSyTEST_not_a_real_key_123';

afterEach(() => vi.unstubAllGlobals());

function captureFetch(body: unknown = { candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), headers: { ...((init?.headers as Record<string, string>) || {}) } });
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  return calls;
}

describe('Gemini key placement', () => {
  it('key check: header, not URL', async () => {
    const calls = captureFetch({ models: [] });
    expect((await checkProviderKey('gemini', KEY)).status).toBe('valid');
    expect(calls[0].url).not.toContain(KEY);
    expect(calls[0].url).not.toMatch(/[?&]key=/);
    expect(calls[0].headers['x-goog-api-key']).toBe(KEY);
  });

  it('generation from the browser: header, not URL', async () => {
    const calls = captureFetch();
    await callGemini('hello', undefined, KEY, 'gemini-flash-latest').catch(() => undefined);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.url).not.toContain(KEY);
      expect(c.headers['x-goog-api-key']).toBe(KEY);
    }
  });

  it('no source file builds a Gemini URL with ?key= or &key=', () => {
    for (const [name, src] of Object.entries({ 'api.ts': apiSource, 'callLLM.ts': callLLMSource, 'keyCheck.ts': keyCheckSource })) {
      expect(src, name).not.toMatch(/generateContent\?key=|alt=sse&key=|[?&]key=\$\{/);
    }
  });
});
