import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let fakeRedis: any = null;
vi.mock('../rateLimiter.js', () => ({ getRedisClient: () => fakeRedis }));

import {
  AI_PROVIDERS,
  selectOptimalProvider,
  recordProviderFailure,
  recordProviderSuccess,
  orderForFailover,
  isProviderHealthy,
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

  function trippedInRedis(...ids: string[]) {
    return makeRedis({
      mget: vi.fn(async (...keys: string[]) => keys.map((k) => (ids.some((id) => k === `circuit:ai:${id}`) ? 'tripped' : null))),
    });
  }

  async function pick(times: number): Promise<string[]> {
    const order: string[] = [];
    for (let i = 0; i < times; i++) order.push((await selectOptimalProvider(AI_PROVIDERS))!.id);
    return order;
  }

  it('sends normal traffic only to the strongest tier, alternating between its providers', async () => {
    fakeRedis = makeRedis();
    const order = await pick(10);
    expect(new Set(order)).toEqual(new Set(['groq-llama-70b', 'gemini-flash']));
    for (let i = 1; i < order.length; i++) expect(order[i]).not.toBe(order[i - 1]);
  });

  it('never selects a provider whose circuit is tripped in Redis', async () => {
    fakeRedis = trippedInRedis('groq-llama-70b');
    expect(new Set(await pick(10))).toEqual(new Set(['gemini-flash']));
  });

  it('uses the backup tier only while every stronger provider is tripped', async () => {
    fakeRedis = trippedInRedis('groq-llama-70b', 'gemini-flash');
    expect(new Set(await pick(10))).toEqual(new Set(['groq-llama-8b', 'openrouter-gpt4o']));

    fakeRedis = trippedInRedis('groq-llama-70b', 'gemini-flash', 'groq-llama-8b', 'openrouter-gpt4o');
    expect(new Set(await pick(4))).toEqual(new Set(['gemini-flash-lite']));
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

describe('orderForFailover', () => {
  const [groq70, geminiFlash, groq8, openrouter, geminiLite] = AI_PROVIDERS;
  const ids = (list: Array<{ id: string }>) => list.map((p) => p.id);

  beforeEach(() => {
    fakeRedis = null;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    for (const p of AI_PROVIDERS) await recordProviderSuccess(p.id);
    vi.restoreAllMocks();
  });

  it('puts the chosen provider first, then the others strongest tier first', async () => {
    expect(ids(await orderForFailover(AI_PROVIDERS, groq70))).toEqual(ids([groq70, geminiFlash, groq8, openrouter, geminiLite]));
    expect(ids(await orderForFailover(AI_PROVIDERS, geminiLite))).toEqual(ids([geminiLite, groq70, geminiFlash, groq8, openrouter]));
  });

  it('tries providers known to be down last, so a healthy backup is never behind a broken one', async () => {
    // Two failures in a row open the circuit (MAX_FAILURES), without being a rate limit
    for (const p of [geminiFlash, groq8]) {
      await recordProviderFailure(p.id, 'Gemini API returned 500', { rateLimited: false });
      await recordProviderFailure(p.id, 'Gemini API returned 500', { rateLimited: false });
    }
    expect(ids(await orderForFailover(AI_PROVIDERS, groq70))).toEqual(ids([groq70, openrouter, geminiLite, geminiFlash, groq8]));
  });

  it('works with only some providers configured', async () => {
    const onlyGroq = [groq70, groq8];
    expect(ids(await orderForFailover(onlyGroq, groq8))).toEqual(ids([groq8, groq70]));
  });
});

describe('recordProviderFailure: rate limit decided by the caller', () => {
  beforeEach(() => {
    fakeRedis = null;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    for (const p of AI_PROVIDERS) await recordProviderSuccess(p.id);
    vi.restoreAllMocks();
  });

  it('does not treat "429" inside an unrelated message as a rate limit when the caller says it is not', async () => {
    await recordProviderFailure('groq-llama-70b', 'Groq API returned 400: request id 4291 invalid', { rateLimited: false });
    // One ordinary failure does not trip the circuit (needs 2), and the Groq siblings are untouched
    expect(await isProviderHealthy('groq-llama-70b')).toBe(true);
    expect(await isProviderHealthy('groq-llama-8b')).toBe(true);
  });

  it('trips at once, and cools the sibling models, when the caller says it is a rate limit', async () => {
    await recordProviderFailure('groq-llama-70b', 'upstream said slow down', { rateLimited: true });
    expect(await isProviderHealthy('groq-llama-70b')).toBe(false);
    expect(await isProviderHealthy('groq-llama-8b')).toBe(false);
    expect(await isProviderHealthy('gemini-flash')).toBe(true);
  });

  it('still reads the message when no flag is given (older callers)', async () => {
    await recordProviderFailure('groq-llama-70b', 'Groq API returned 429: rate limit');
    expect(await isProviderHealthy('groq-llama-70b')).toBe(false);
  });
});
