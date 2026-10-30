import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { savePendingDesktopAuth, loadPendingDesktopAuth, clearPendingDesktopAuth } from '../desktopAuthHandoff';

const KEY = 'bedrock_desktop_auth_pending';
const NONCE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal('window', { location: { port: '62222' } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('desktop sign-in hand-off', () => {
  it('keeps a pending sign-in for this loopback port and clears it', () => {
    savePendingDesktopAuth({ nonce: NONCE, port: '62222', strategy: 'oauth_google' });
    expect(loadPendingDesktopAuth()).toEqual({ nonce: NONCE, port: '62222', strategy: 'oauth_google' });
    clearPendingDesktopAuth();
    expect(loadPendingDesktopAuth()).toBeNull();
  });

  it('never stores a token, only nonce, port and provider', () => {
    savePendingDesktopAuth({ nonce: NONCE, port: '62222', strategy: 'oauth_github', token: 'secret' } as any);
    expect(Object.keys(JSON.parse(store.get(KEY)!)).sort()).toEqual(['createdAt', 'nonce', 'port', 'strategy']);
  });

  it('rejects bad nonces, providers and a different port', () => {
    savePendingDesktopAuth({ nonce: 'short', port: '62222', strategy: 'oauth_google' });
    savePendingDesktopAuth({ nonce: NONCE, port: '62222', strategy: 'javascript:alert(1)' });
    savePendingDesktopAuth({ nonce: NONCE, port: '3000', strategy: 'oauth_google' });
    expect(store.size).toBe(0);

    store.set(KEY, JSON.stringify({ nonce: NONCE, port: '3000', strategy: 'oauth_google', createdAt: Date.now() }));
    expect(loadPendingDesktopAuth()).toBeNull();
    expect(store.size).toBe(0);
  });

  it('expires after 10 minutes, like the nonce in the desktop app', () => {
    vi.useFakeTimers();
    savePendingDesktopAuth({ nonce: NONCE, port: '62222', strategy: 'oauth_google' });
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(loadPendingDesktopAuth()).toBeNull();
  });

  it('ignores unreadable stored data', () => {
    store.set(KEY, '{not json');
    expect(loadPendingDesktopAuth()).toBeNull();
  });
});
