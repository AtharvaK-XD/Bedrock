import { describe, it, expect, vi, beforeEach } from 'vitest';

// Since CHG-0086 every website AI run goes through Bedrock's server, which stores the trace itself. The app used to
// post a second, client-side trace (with guessed numbers), so every website run counted twice on the dashboard.
const h = vi.hoisted(() => ({ desktop: false }));
vi.mock('../platform', () => ({ isDesktopApp: () => h.desktop }));
vi.mock('../appSettings', () => ({
  getActivePrivacySettings: () => ({ telemetry: true, saveHistory: true, localVaultOnly: false }),
  scrubSecrets: (s: string) => s,
  getSessionTokensCount: () => 0,
  isLocalVaultOnly: () => false,
}));
vi.mock('../notify', () => ({ announceRunFinished: vi.fn() }));
vi.mock('../syncNotice', () => ({ reportSyncProblem: vi.fn(), describeSaveLimit: vi.fn(async () => null) }));

const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
vi.stubGlobal('fetch', fetchMock);
vi.stubGlobal('window', { Clerk: undefined, dispatchEvent: vi.fn() });
vi.stubGlobal('CustomEvent', class {});
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });

import { recordExecutionTrace } from '../telemetry';
import { announceRunFinished } from '../notify';

const tracePosts = () => fetchMock.mock.calls.filter((c: any[]) => String(c[0]) === '/api/traces');

beforeEach(() => {
  fetchMock.mockClear();
  vi.mocked(announceRunFinished).mockClear();
});

describe('client-side traces', () => {
  it('website: posts nothing (the server already recorded the run), but the finish notification still fires', async () => {
    h.desktop = false;
    await recordExecutionTrace({ node: 'Wizard', model: 'm', tokens: 10, latency: 5, status: 'OK' });
    expect(tracePosts()).toHaveLength(0);
    expect(announceRunFinished).toHaveBeenCalledTimes(1);
  });

  it('desktop app: posts the trace (its own-key calls never pass through the server)', async () => {
    h.desktop = true;
    await recordExecutionTrace({ node: 'Wizard', model: 'm', tokens: 10, latency: 5, status: 'OK' });
    expect(tracePosts()).toHaveLength(1);
  });
});
