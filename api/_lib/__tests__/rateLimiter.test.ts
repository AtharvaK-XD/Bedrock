import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Which store the limiter uses, per environment (OPEN-0043). Upstash itself is faked: no network.
const h = vi.hoisted(() => ({
  limit: vi.fn(),
  redisConstructed: [] as Array<{ url?: string; token?: string }>,
  redisThrows: false,
}));

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor(opts: { url?: string; token?: string }) {
      if (h.redisThrows) throw new Error('bad url');
      h.redisConstructed.push(opts);
    }
  },
}));
vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    static slidingWindow = () => ({});
    limit = h.limit;
  }
  return { Ratelimit };
});

const ENV_NAMES = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'VITE_UPSTASH_REDIS_REST_URL',
  'VITE_UPSTASH_REDIS_REST_TOKEN',
];

function mockRes() {
  const res: any = { statusCode: 200, body: undefined, headers: {} as Record<string, string> };
  res.status = vi.fn((c: number) => {
    res.statusCode = c;
    return res;
  });
  res.json = vi.fn((b: unknown) => {
    res.body = b;
    return res;
  });
  res.setHeader = vi.fn((k: string, v: string) => {
    res.headers[k] = v;
  });
  return res;
}

const req = { headers: { 'x-forwarded-for': '203.0.113.7' } } as any;

async function load(env: Record<string, string>) {
  for (const name of ENV_NAMES) vi.stubEnv(name, '');
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  vi.resetModules();
  return import('../rateLimiter.js');
}

beforeEach(() => {
  h.limit.mockReset();
  h.redisConstructed.length = 0;
  h.redisThrows = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const BOTH = { UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 'server-token' };

describe('rate limiter environment', () => {
  it('ignores the browser-named VITE_UPSTASH_* variables completely', async () => {
    const { getRedisClient, enforceRateLimit } = await load({
      VITE_UPSTASH_REDIS_REST_URL: 'https://vite.example',
      VITE_UPSTASH_REDIS_REST_TOKEN: 'vite-token',
    });
    expect(getRedisClient()).toBeNull();
    expect(h.redisConstructed).toEqual([]);
    // Same as Redis left out: local in-memory limits, not a refusal
    const res = mockRes();
    expect(await enforceRateLimit(req, res, 'general')).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('uses only the server-side variables when they are set', async () => {
    h.limit.mockResolvedValue({ success: true, limit: 120, remaining: 119, reset: Date.now() + 1000 });
    const { getRedisClient, enforceRateLimit } = await load({
      ...BOTH,
      VITE_UPSTASH_REDIS_REST_URL: 'https://vite.example',
      VITE_UPSTASH_REDIS_REST_TOKEN: 'vite-token',
    });
    expect(getRedisClient()).not.toBeNull();
    expect(h.redisConstructed).toEqual([{ url: 'https://redis.example', token: 'server-token' }]);
    expect(await enforceRateLimit(req, mockRes(), 'general')).toBe(true);
    expect(h.limit).toHaveBeenCalledWith('203.0.113.7');
  });

  it('both variables omitted: in-memory limits still apply and answer 429 over the limit', async () => {
    const { enforceRateLimit } = await load({});
    for (let i = 0; i < 12; i++) {
      expect(await enforceRateLimit(req, mockRes(), 'synthesize')).toBe(true);
    }
    const res = mockRes();
    expect(await enforceRateLimit(req, res, 'synthesize')).toBe(false);
    expect(res.statusCode).toBe(429);
    expect(res.body.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});

describe('Redis configured but not usable: no silent in-memory fallback', () => {
  const expectRefused = (res: any) => {
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('RATE_LIMITER_UNAVAILABLE');
    expect(res.headers['Retry-After']).toBe('30');
    expect(JSON.stringify(res.body)).not.toMatch(/redis|upstash|token/i);
  };

  it.each([
    ['only the URL is set', { UPSTASH_REDIS_REST_URL: 'https://redis.example' }],
    ['only the token is set', { UPSTASH_REDIS_REST_TOKEN: 'server-token' }],
  ])('refuses when %s', async (_label, env) => {
    const { enforceRateLimit } = await load(env);
    const res = mockRes();
    expect(await enforceRateLimit(req, res, 'synthesize')).toBe(false);
    expectRefused(res);
  });

  it('refuses when the client cannot be created', async () => {
    h.redisThrows = true;
    const { enforceRateLimit } = await load(BOTH);
    const res = mockRes();
    expect(await enforceRateLimit(req, res, 'prompts')).toBe(false);
    expectRefused(res);
  });

  it('refuses when a Redis call fails', async () => {
    h.limit.mockRejectedValue(new Error('connection reset'));
    const { enforceRateLimit } = await load(BOTH);
    const res = mockRes();
    expect(await enforceRateLimit(req, res, 'synthesize')).toBe(false);
    expectRefused(res);
  });

  it('/api/health keeps answering during the outage, so it can report it', async () => {
    h.limit.mockRejectedValue(new Error('connection reset'));
    const { enforceRateLimit } = await load(BOTH);
    const res = mockRes();
    expect(await enforceRateLimit(req, res, 'health')).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });
});
