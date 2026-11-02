import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// A tiny in-memory localStorage so the settings code can run without a browser
function installBrowserStubs() {
  const store = new Map<string, string>();
  const localStorageStub = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  const events: string[] = [];
  vi.stubGlobal('localStorage', localStorageStub);
  vi.stubGlobal('window', {
    dispatchEvent: (e: Event) => {
      events.push(e.type);
      return true;
    },
  });
  vi.stubGlobal('CustomEvent', class CustomEvent extends Event {
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      super(type);
      this.detail = init?.detail;
    }
  });
  return { store, events };
}

describe('app settings: defaults', () => {
  beforeEach(() => {
    installBrowserStubs();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('keeps cloud sync on and diagnostics on by default, and the starfield and sounds off', async () => {
    const s = await import('../appSettings');
    expect(s.getActivePrivacySettings().localVaultOnly).toBe(false);
    expect(s.getActivePrivacySettings().telemetry).toBe(true);
    expect(s.getActiveAppearanceSettings().particleEffects).toBe(false);
    expect(s.getActiveAppearanceSettings().soundFeedback).toBe(false);
    expect(s.isLocalVaultOnly()).toBe(false);
  });

  it('reads saved choices on top of the defaults', async () => {
    const { store } = installBrowserStubs();
    store.set('bedrock_privacy_settings', JSON.stringify({ localVaultOnly: true }));
    const s = await import('../appSettings');
    expect(s.isLocalVaultOnly()).toBe(true);
    expect(s.getActivePrivacySettings().secretScrubbing).toBe(true);
  });

  it('falls back to defaults when stored settings are corrupt', async () => {
    const { store } = installBrowserStubs();
    store.set('bedrock_token_settings', '{not json');
    const s = await import('../appSettings');
    expect(s.getActiveTokenSettings().sessionLimit).toBe(50);
  });
});

describe('token budget', () => {
  beforeEach(() => {
    installBrowserStubs();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.useRealTimers();
  });

  it('counts tokens used in the current session', async () => {
    const s = await import('../appSettings');
    s.recordTokenUsage(1200);
    s.recordTokenUsage(300);
    expect(s.getSessionTokensCount()).toBe(1500);
    expect(s.getWeeklyTokensCount()).toBe(1500);
  });

  it('does not block a new run just because the requested answer length is larger than the budget', async () => {
    const { store } = installBrowserStubs();
    store.set('bedrock_token_settings', JSON.stringify({ sessionLimit: 10, hardStopOnLimit: true }));
    const s = await import('../appSettings');
    expect(() => s.checkTokenBudgetGuard(32768)).not.toThrow();
  });

  it('blocks runs once the session budget is used up, when the hard stop is on', async () => {
    const { store } = installBrowserStubs();
    store.set('bedrock_token_settings', JSON.stringify({ sessionLimit: 10, hardStopOnLimit: true }));
    const s = await import('../appSettings');
    s.recordTokenUsage(10_000);
    expect(() => s.checkTokenBudgetGuard()).toThrow(/Session budget reached/);
  });

  it('only warns when the hard stop is off', async () => {
    const { store } = installBrowserStubs();
    store.set('bedrock_token_settings', JSON.stringify({ sessionLimit: 10, hardStopOnLimit: false }));
    const s = await import('../appSettings');
    s.recordTokenUsage(20_000);
    expect(() => s.checkTokenBudgetGuard()).not.toThrow();
  });

  it('warns once at the threshold, not on every call', async () => {
    const { store, events } = installBrowserStubs();
    store.set('bedrock_token_settings', JSON.stringify({ sessionLimit: 10, hardStopOnLimit: false, warningThreshold: 80 }));
    const s = await import('../appSettings');
    s.recordTokenUsage(8_500);
    s.checkTokenBudgetGuard();
    s.checkTokenBudgetGuard();
    expect(events.filter((e) => e === s.BEDROCK_BUDGET_WARNING_EVENT)).toHaveLength(1);
  });

  it('starts a fresh session after 5 hours, so users are never locked out for good', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T08:00:00Z'));
    const s = await import('../appSettings');
    s.recordTokenUsage(40_000);
    expect(s.getSessionTokensCount()).toBe(40_000);

    vi.setSystemTime(new Date('2026-11-02T12:59:00Z'));
    expect(s.getSessionTokensCount()).toBe(40_000);

    vi.setSystemTime(new Date('2026-11-02T13:01:00Z'));
    expect(s.getSessionTokensCount()).toBe(0);
    // the weekly counter keeps going
    expect(s.getWeeklyTokensCount()).toBe(40_000);
  });

  it('resets both counters on request', async () => {
    const s = await import('../appSettings');
    s.recordTokenUsage(5_000);
    s.resetTokenCounters();
    expect(s.getSessionTokensCount()).toBe(0);
    expect(s.getWeeklyTokensCount()).toBe(0);
  });
});

describe('secret scrubbing', () => {
  beforeEach(() => {
    installBrowserStubs();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('hides keys and bearer tokens unless scrubbing is switched off', async () => {
    const { store } = installBrowserStubs();
    const s = await import('../appSettings');
    const text = 'use gsk_abcdefghijklmnopqrstuvwx and Bearer abcdefghijklmnopqrstuvwxyz';
    expect(s.scrubSecrets(text)).not.toContain('gsk_abcdefghijklmnopqrstuvwx');
    expect(s.scrubSecrets(text)).toContain('[REDACTED_API_KEY]');
    store.set('bedrock_privacy_settings', JSON.stringify({ secretScrubbing: false }));
    expect(s.scrubSecrets(text)).toBe(text);
  });
});
