import { describe, it, expect, vi, beforeEach } from 'vitest';

// The server owns prompt ids (CHG for OPEN-0015): a local history entry takes the id its save came back with, so the
// next sync does not list the same prompt twice.
const h = vi.hoisted(() => ({
  savePromptToDb: vi.fn(),
  fetchUserPromptsFromDb: vi.fn(async () => [] as unknown[]),
  deletePromptFromDb: vi.fn(),
}));

vi.mock('../telemetry', () => h);
vi.mock('../appSettings', () => ({
  getActivePrivacySettings: () => ({ saveHistory: true, localVaultOnly: false }),
  scrubSecrets: (s: string) => s,
}));

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
});
vi.stubGlobal('window', { dispatchEvent: vi.fn() });
vi.stubGlobal('CustomEvent', class {});

import {
  addPromptToHistory,
  adoptServerPromptId,
  getStoredGeneratorHistory,
  saveGeneratorHistory,
  syncHistoryFromDb,
} from '../generatorHistory';

const item = (id: string, ideaText = id) => ({ id, title: id, ideaText, isPinned: false, createdAt: 1 });
const ids = () => getStoredGeneratorHistory().map((i) => i.id);

beforeEach(() => {
  store.clear();
  h.savePromptToDb.mockReset();
  h.fetchUserPromptsFromDb.mockReset();
  h.fetchUserPromptsFromDb.mockResolvedValue([]);
});

describe('adopting the server id of a prompt', () => {
  it('renames the local entry and keeps its content and place', () => {
    saveGeneratorHistory([item('a'), item('local-1', 'my idea'), item('c')]);
    adoptServerPromptId('local-1', 'server-1');
    expect(ids()).toEqual(['a', 'server-1', 'c']);
    expect(getStoredGeneratorHistory()[1].ideaText).toBe('my idea');
  });

  it('replaces a copy a sync already added, so the prompt is not listed twice', () => {
    saveGeneratorHistory([item('local-1', 'new text'), item('server-1', 'old text')]);
    adoptServerPromptId('local-1', 'server-1');
    expect(ids()).toEqual(['server-1']);
    expect(getStoredGeneratorHistory()[0].ideaText).toBe('new text');
  });

  it('does nothing when the entry was deleted meanwhile, or the id is the same', () => {
    saveGeneratorHistory([item('a')]);
    adoptServerPromptId('gone', 'server-1');
    adoptServerPromptId('a', 'a');
    expect(ids()).toEqual(['a']);
  });

  it('addPromptToHistory adopts the id from the save, and a later sync adds no duplicate', async () => {
    h.savePromptToDb.mockResolvedValue('server-1');
    const created = addPromptToHistory({ id: 'local-1', title: 't', ideaText: 'idea', isPinned: false });
    expect(created.id).toBe('local-1');
    await vi.waitFor(() => expect(ids()).toEqual(['server-1']));

    h.fetchUserPromptsFromDb.mockResolvedValue([item('server-1', 'idea')]);
    await syncHistoryFromDb();
    expect(ids()).toEqual(['server-1']);
  });

  it('keeps the local id when the save did not reach the server', async () => {
    h.savePromptToDb.mockResolvedValue(null);
    addPromptToHistory({ id: 'local-1', title: 't', ideaText: 'idea', isPinned: false });
    await Promise.resolve();
    await Promise.resolve();
    expect(ids()).toEqual(['local-1']);
  });

  it('a failed save does not throw out of addPromptToHistory', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.savePromptToDb.mockRejectedValue(new Error('offline'));
    expect(() => addPromptToHistory({ id: 'local-1', title: 't', ideaText: 'idea', isPinned: false })).not.toThrow();
    await vi.waitFor(() => expect(console.warn).toHaveBeenCalled());
    expect(ids()).toEqual(['local-1']);
  });
});
