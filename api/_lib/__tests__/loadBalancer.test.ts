import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let fakeRedis: any = null;
vi.mock('../rateLimiter.js', () => ({ getRedisClient: () => fakeRedis }));

import {
  AI_PROVIDERS,
  selectOptimalProvider,
  recordProviderFailure,
  recordProviderSuccess,
} from '../loadBalancer.js';

function makeRedis(overrides: Record<string, unknown> = {}) {
  let counter = 0;
  return {
    get: vi.fn(async () => null),
    mget: vi.fn(async (...keys: string[]) => keys.map(() => null)),
    incr: vi.fn(async () => counter++),
    set: vi.fn(async () => 'OK'),
    del: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
    ...overrides,
  };
}

describe('AI_PROVIDERS', () => {
  it('does not route traffic to the DeepSeek reasoning model', () => {
    expect(AI_PROVIDERS.some((p) => /deepseek/i.test(p.id) || /deepseek/i.test(p.model))).toBe(false);
    expect(AI_PROVIDERS).toHaveLength(5);
  });
});

describe('selectOptimalProvider', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    fakeRedis = null;
    for (const p of AI_PROVIDERS) await recordProviderSuccess(p.id);
    vi.restoreAllMocks();
  });

  it('checks every provider circuit with one MGET, not one GET per provider', async () => {
    fakeRedis = makeRedis();
    const picked = await selectOptimalProvider(AI_PROVIDERS);

    expect(picked).not.toBeNull();
    expect(fakeRedis.mget).toHaveBeenCalledTimes(1);
    expect(fakeRedis.mget).toHaveBeenCalledWith(...AI_PROVIDERS.map((p) => `circuit:ai:${p.id}`));
    expect(fakeRedis.get).not.toHaveBeenCalled();
    expect(fakeRedis.incr).toHaveBeenCalledTimes(1);
  });

  it('never selects a provider whose circuit is tripped in Redis', async () => {
    const trippedId = AI_PROVIDERS[0].id;
    fakeRedis = makeRedis({
      mget: vi.fn(async (...keys: string[]) => keys.map((k) => (k === `circuit:ai:${trippedId}` ? 'tripped' : null))),
    });
    const picks = new Set<string>();
    for (let i = 0; i < AI_PROVIDERS.length * 2; i++) {
      picks.add((await selectOptimalProvider(AI_PROVIDERS))!.id);
    }
    expect(picks.has(trippedId)).toBe(false);
    expect(picks.size).toBe(AI_PROVIDERS.length - 1);
  });

  it('keeps round-robin order over healthy providers (selection order unchanged)', async () => {
    fakeRedis = makeRedis();
    const order: string[] = [];
    for (let i = 0; i < AI_PROVIDERS.length; i++) {
      order.push((await selectOptimalProvider(AI_PROVIDERS))!.id);
    }
    expect(order).toEqual(AI_PROVIDERS.map((p) => p.id));
  });

  it('falls back to local circuit state when the batch read fails', async () => {
    fakeRedis = makeRedis({
      mget: vi.fn(async () => {
        throw new Error('redis down');
      }),
      incr: vi.fn(async () => {
        throw new Error('redis down');
      }),
    });
    const picked = await selectOptimalProvider(AI_PROVIDERS);
    expect(picked).not.toBeNull();
  });

  it('skips providers tripped in local memory when Redis is not configured', async () => {
    fakeRedis = null;
    await recordProviderFailure('groq-llama-70b', 'Groq API returned 429: rate limit');
    const picks = new Set<string>();
    for (let i = 0; i < AI_PROVIDERS.length * 2; i++) {
      picks.add((await selectOptimalProvider(AI_PROVIDERS))!.id);
    }
    // a 429 cools down every model sharing the Groq key
    expect([...picks].some((id) => id.startsWith('groq'))).toBe(false);
    expect(picks.size).toBeGreaterThan(0);
  });

  it('probes the first provider when every circuit is tripped', async () => {
    fakeRedis = makeRedis({ mget: vi.fn(async (...keys: string[]) => keys.map(() => 'tripped')) });
    const picked = await selectOptimalProvider(AI_PROVIDERS);
    expect(picked?.id).toBe(AI_PROVIDERS[0].id);
  });
});
