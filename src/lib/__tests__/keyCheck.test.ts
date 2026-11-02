import { describe, it, expect, afterEach, vi } from 'vitest';
import { checkProviderKey } from '../keyCheck';
import { isVersionNewer, parseSemver, CURRENT_APP_VERSION } from '../updater';
import pkg from '../../../package.json';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(status: number) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('checkProviderKey', () => {
  it('asks for a key when the field is empty, without any network call', async () => {
    const fetchMock = stubFetch(200);
    const result = await checkProviderKey('groq', '   ');
    expect(result.status).toBe('invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says valid only when the provider accepts the key', async () => {
    stubFetch(200);
    expect((await checkProviderKey('openai', 'sk-test')).status).toBe('valid');
  });

  it('reports a rejected key as invalid', async () => {
    stubFetch(401);
    const result = await checkProviderKey('groq', 'gsk_bad');
    expect(result.status).toBe('invalid');
    expect(result.message).not.toMatch(/verified/i);
  });

  it('treats rate limiting as a working key', async () => {
    stubFetch(429);
    expect((await checkProviderKey('gemini', 'AIza-test')).status).toBe('valid');
  });

  it('reports provider outages and network failures as unreachable, never as valid', async () => {
    stubFetch(503);
    expect((await checkProviderKey('openrouter', 'sk-or-test')).status).toBe('unreachable');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect((await checkProviderKey('openrouter', 'sk-or-test')).status).toBe('unreachable');
  });

  it('does not pretend to check providers it cannot check', async () => {
    const fetchMock = stubFetch(200);
    const result = await checkProviderKey('deepseek', 'sk-test');
    expect(result.status).toBe('unsupported');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the key only to the provider it belongs to', async () => {
    const fetchMock = stubFetch(200);
    await checkProviderKey('groq', 'gsk_secretvalue');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/api\.groq\.com\//);
    expect(JSON.stringify(init)).toContain('gsk_secretvalue');
  });
});

describe('app version', () => {
  it('comes from package.json, so the updater never offers the version you already have', () => {
    expect(CURRENT_APP_VERSION).toBe(pkg.version);
    expect(isVersionNewer(pkg.version, CURRENT_APP_VERSION)).toBe(false);
  });

  it('compares versions numerically', () => {
    expect(parseSemver('v1.4.1')).toEqual([1, 4, 1]);
    expect(isVersionNewer('1.10.0', '1.9.9')).toBe(true);
    expect(isVersionNewer('1.4.1', '1.4.1')).toBe(false);
    expect(isVersionNewer('1.4.0', '1.4.1')).toBe(false);
  });
});
