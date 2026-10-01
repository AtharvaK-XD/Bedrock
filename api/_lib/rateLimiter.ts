import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Initialize Upstash Redis client with environment variables or fallback
let redisClient: Redis | null = null;

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.VITE_UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.VITE_UPSTASH_REDIS_REST_TOKEN;

if (redisUrl && redisToken) {
  try {
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
    });
    console.log('⚡ [Upstash Redis] Successfully connected for Edge Rate Limiting & Load Balancing');
  } catch (err) {
    console.warn('⚠️ [Upstash Redis] Failed to initialize Redis client, using in-memory fallback:', err);
  }
} else {
  console.info('ℹ️ [Upstash Redis] Credentials not found in environment, running in-memory rate limiting fallback.');
}

export function getRedisClient(): Redis | null {
  return redisClient;
}

// In-Memory Fallback Store for serverless instances when Redis is unconfigured or unreachable
interface MemoryEntry {
  count: number;
  resetAt: number;
}
const memoryStore = new Map<string, MemoryEntry>();

function checkMemoryRateLimit(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: now + windowSeconds * 1000,
    };
  }

  if (entry.count < limit) {
    entry.count += 1;
    return {
      success: true,
      limit,
      remaining: limit - entry.count,
      reset: entry.resetAt,
    };
  }

  return {
    success: false,
    limit,
    remaining: 0,
    reset: entry.resetAt,
  };
}

// Extract Client IP address from request headers
export function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') {
    return realIp.trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

export type LimiterPreset =
  | 'synthesize'
  | 'questions'
  | 'refine'
  | 'test'
  | 'prompts'
  | 'workflows'
  | 'general'
  | 'health';

interface PresetConfig {
  requests: number;
  windowSeconds: number;
  prefix: string;
}

const PRESET_CONFIGS: Record<LimiterPreset, PresetConfig> = {
  synthesize: { requests: 12, windowSeconds: 60, prefix: 'ratelimit:ai:synthesize' },
  questions: { requests: 20, windowSeconds: 60, prefix: 'ratelimit:ai:questions' },
  refine: { requests: 20, windowSeconds: 60, prefix: 'ratelimit:ai:refine' },
  test: { requests: 15, windowSeconds: 60, prefix: 'ratelimit:ai:test' },
  prompts: { requests: 60, windowSeconds: 60, prefix: 'ratelimit:prompts' },
  workflows: { requests: 60, windowSeconds: 60, prefix: 'ratelimit:workflows' },
  general: { requests: 100, windowSeconds: 60, prefix: 'ratelimit:general' },
  health: { requests: 200, windowSeconds: 60, prefix: 'ratelimit:health' },
};

// Cache Upstash Ratelimit instances
const ratelimitInstances = new Map<LimiterPreset, Ratelimit>();

function getUpstashLimiter(preset: LimiterPreset): Ratelimit | null {
  if (!redisClient) return null;
  if (ratelimitInstances.has(preset)) {
    return ratelimitInstances.get(preset)!;
  }

  const cfg = PRESET_CONFIGS[preset];
  const instance = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(cfg.requests, `${cfg.windowSeconds} s` as any),
    prefix: cfg.prefix,
    analytics: true,
  });

  ratelimitInstances.set(preset, instance);
  return instance;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfterSeconds?: number;
}

/**
 * Enforces rate limiting on a Vercel serverless request.
 * Sets X-RateLimit headers and automatically sends HTTP 429 if the quota is exceeded.
 *
 * @returns true if allowed to proceed, false if response was terminated with 429.
 */
export async function enforceRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  preset: LimiterPreset,
  identifierOverride?: string
): Promise<boolean> {
  const cfg = PRESET_CONFIGS[preset] || PRESET_CONFIGS.general;
  const ip = getClientIp(req);
  const identifier = identifierOverride || ip;

  let limitResult: { success: boolean; limit: number; remaining: number; reset: number };

  const limiter = getUpstashLimiter(preset);
  if (limiter) {
    try {
      const resData = await limiter.limit(identifier);
      limitResult = {
        success: resData.success,
        limit: resData.limit,
        remaining: resData.remaining,
        reset: resData.reset,
      };
    } catch (redisErr) {
      console.warn(`[RateLimiter] Upstash Redis call failed for ${preset}, using memory fallback:`, redisErr);
      limitResult = checkMemoryRateLimit(`${preset}:${identifier}`, cfg.requests, cfg.windowSeconds);
    }
  } else {
    limitResult = checkMemoryRateLimit(`${preset}:${identifier}`, cfg.requests, cfg.windowSeconds);
  }

  const { success, limit, remaining, reset } = limitResult;
  const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));

  // Set standard rate limit headers
  res.setHeader('X-RateLimit-Limit', limit.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining).toString());
  res.setHeader('X-RateLimit-Reset', reset.toString());

  if (!success) {
    res.setHeader('Retry-After', retryAfterSeconds.toString());
    res.status(429).json({
      error: 'Too Many Requests',
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit of ${limit} requests per ${cfg.windowSeconds}s reached for ${preset}. Please wait ${retryAfterSeconds}s before retrying.`,
      limit,
      remaining: 0,
      retryAfterSeconds,
    });
    return false;
  }

  return true;
}
