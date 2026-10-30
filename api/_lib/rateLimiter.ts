import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isIP } from 'node:net';
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

  // Prune expired entries if memory map grows large
  if (memoryStore.size > 1500) {
    for (const [k, v] of memoryStore.entries()) {
      if (now > v.resetAt) {
        memoryStore.delete(k);
      }
    }
  }

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

// If even the in-memory fallback fails, refuse the request (fail closed) instead of allowing it.
function safeMemoryRateLimit(key: string, limit: number, windowSeconds: number) {
  try {
    return checkMemoryRateLimit(key, limit, windowSeconds);
  } catch (err) {
    console.error('[RateLimiter] Memory fallback failed, refusing request:', err);
    return { success: false, limit, remaining: 0, reset: Date.now() + windowSeconds * 1000 };
  }
}

/**
 * Extracts the client IP used for rate limits and anonymous quotas.
 * On Vercel, `x-vercel-forwarded-for` / `x-forwarded-for` are set by the platform, which
 * overwrites client-supplied X-Forwarded-For to prevent spoofing (Vercel request-headers docs).
 * Only syntactically valid IPs are accepted, so a junk header value cannot become a fresh key.
 */
export function getClientIp(req: VercelRequest): string {
  const candidates = [req.headers['x-vercel-forwarded-for'], req.headers['x-forwarded-for'], req.headers['x-real-ip']];
  for (const header of candidates) {
    const raw = Array.isArray(header) ? header[0] : header;
    if (typeof raw !== 'string') continue;
    const first = raw.split(',')[0]?.trim() || '';
    if (first.length <= 64 && isIP(first)) return first;
  }
  const socketIp = req.socket?.remoteAddress || '';
  return isIP(socketIp) ? socketIp : '127.0.0.1';
}

export type LimiterPreset =
  | 'synthesize'
  | 'questions'
  | 'refine'
  | 'test'
  | 'prompts'
  | 'workflows'
  | 'general'
  | 'health'
  | 'email'
  | 'emailRecipient';

interface PresetConfig {
  requests: number;
  windowSeconds: number;
  prefix: string;
}

const PRESET_CONFIGS: Record<LimiterPreset, PresetConfig> = {
  synthesize: { requests: 12, windowSeconds: 60, prefix: 'ratelimit:ai:synthesize' },
  questions: { requests: 24, windowSeconds: 60, prefix: 'ratelimit:ai:questions' },
  refine: { requests: 24, windowSeconds: 60, prefix: 'ratelimit:ai:refine' },
  test: { requests: 20, windowSeconds: 60, prefix: 'ratelimit:ai:test' },
  prompts: { requests: 80, windowSeconds: 60, prefix: 'ratelimit:prompts' },
  workflows: { requests: 80, windowSeconds: 60, prefix: 'ratelimit:workflows' },
  general: { requests: 120, windowSeconds: 60, prefix: 'ratelimit:general' },
  health: { requests: 300, windowSeconds: 60, prefix: 'ratelimit:health' },
  // Transactional email: per sender IP, and per recipient address
  email: { requests: 5, windowSeconds: 3600, prefix: 'ratelimit:email:ip' },
  emailRecipient: { requests: 3, windowSeconds: 86400, prefix: 'ratelimit:email:rcpt' },
};

// Cache Upstash Ratelimit instances (keyed by preset + tier)
const ratelimitInstances = new Map<string, Ratelimit>();

function getUpstashLimiter(preset: LimiterPreset, requests: number, windowSeconds: number, prefix: string): Ratelimit | null {
  if (!redisClient) return null;
  const cacheKey = `${preset}:${requests}`;
  if (ratelimitInstances.has(cacheKey)) {
    return ratelimitInstances.get(cacheKey)!;
  }

  const instance = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(requests, `${windowSeconds} s` as any),
    prefix: `${prefix}:${requests}`,
    analytics: true,
  });

  ratelimitInstances.set(cacheKey, instance);
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
 * @param req Vercel HTTP Request
 * @param res Vercel HTTP Response
 * @param preset Rate limit preset configuration
 * @param identifierOverride Custom identifier (e.g., user.id or IP)
 * @param isPaidTier If true, scales allowable requests by 2.5x for paid subscribers
 * @returns true if allowed to proceed, false if response was terminated with 429.
 */
export async function enforceRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  preset: LimiterPreset,
  identifierOverride?: string,
  isPaidTier = false
): Promise<boolean> {
  const cfg = PRESET_CONFIGS[preset] || PRESET_CONFIGS.general;
  const ip = getClientIp(req);
  const identifier = identifierOverride || ip;

  // Paid tier burst capacity scaling (2.5x request volume)
  const allowedRequests = isPaidTier ? Math.round(cfg.requests * 2.5) : cfg.requests;

  let limitResult: { success: boolean; limit: number; remaining: number; reset: number };

  const limiter = getUpstashLimiter(preset, allowedRequests, cfg.windowSeconds, cfg.prefix);
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
      limitResult = safeMemoryRateLimit(`${preset}:${identifier}`, allowedRequests, cfg.windowSeconds);
    }
  } else {
    limitResult = safeMemoryRateLimit(`${preset}:${identifier}`, allowedRequests, cfg.windowSeconds);
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
