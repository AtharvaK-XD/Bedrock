import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isIP } from 'node:net';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Server-side variables only. A VITE_ name is meant for the browser and must never carry this token (OPEN-0043).
let redisClient: Redis | null = null;

/** Longest a single Redis call may take before it counts as failed (see the client options below). */
export const REDIS_CALL_TIMEOUT_MS = 1_500;

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * True when either variable is set. In-memory limits are only for a setup with Redis left out completely (local
 * development). Memory counters are per serverless instance, so in production they would quietly multiply every
 * limit: once Redis is configured, a broken or half-finished setup refuses requests instead (see enforceRateLimit).
 */
const redisConfigured = Boolean(redisUrl || redisToken);

if (redisUrl && redisToken) {
  try {
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
      // The client's default is 5 retries with growing waits (about 4.3 s in total) per call, and an AI request makes
      // two limiter calls: an Upstash outage held every request for about 9 s before it was refused. One quick retry
      // and a 1.5 s limit per call keep an outage (or a very slow Redis) to a fast 503 instead. Upstash normally
      // answers in a few milliseconds from the same region.
      retry: { retries: 1, backoff: () => 100 },
      signal: () => AbortSignal.timeout(REDIS_CALL_TIMEOUT_MS),
    });
    console.log('⚡ [Upstash Redis] Successfully connected for Edge Rate Limiting & Load Balancing');
  } catch (err) {
    console.error('[Upstash Redis] Failed to initialize the Redis client; requests will be refused:', err);
  }
} else if (redisConfigured) {
  console.error('[Upstash Redis] Only one of UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN is set; requests will be refused until both are set.');
} else {
  console.info('ℹ️ [Upstash Redis] Credentials not found in environment, running in-memory rate limiting fallback.');
}

export function getRedisClient(): Redis | null {
  return redisClient;
}

// In-memory store, used only when Redis is left out completely (and for /api/health, see enforceRateLimit)
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
 * The key one visitor is counted under. IPv4: the address itself. IPv6: the /64 network, because a
 * single home or phone line gets a whole /64 (about 18 quintillion addresses) and can switch
 * between them freely, which would otherwise give every request a fresh, unused limit.
 * IPv4-mapped IPv6 (::ffff:1.2.3.4) counts as the IPv4 address.
 */
export function normalizeIpForLimits(ip: string): string {
  const clean = ip.split('%')[0].toLowerCase();
  if (isIP(clean) !== 6) return ip;

  const mapped = clean.match(/^(?:0*:){2,5}ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped && isIP(mapped[1]) === 4) return mapped[1];

  // Expand "::" and an embedded IPv4 tail to eight 16-bit groups
  let text = clean;
  const v4Tail = text.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4Tail) {
    const [a, b, c, d] = v4Tail[1].split('.').map(Number);
    text = text.slice(0, -v4Tail[1].length) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16);
  }
  const [head, tail] = text.split('::');
  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail !== undefined && tail ? tail.split(':') : [];
  const missing = tail === undefined ? 0 : 8 - headGroups.length - tailGroups.length;
  const groups = [...headGroups, ...Array(Math.max(0, missing)).fill('0'), ...tailGroups];
  if (groups.length !== 8) return ip;
  return `${groups.slice(0, 4).map((g) => parseInt(g || '0', 16).toString(16)).join(':')}::/64`;
}

/**
 * Extracts the client IP used for rate limits and anonymous quotas (IPv6 as its /64 network).
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
    if (first.length <= 64 && isIP(first)) return normalizeIpForLimits(first);
  }
  const socketIp = req.socket?.remoteAddress || '';
  return isIP(socketIp) ? normalizeIpForLimits(socketIp) : '127.0.0.1';
}

export type LimiterPreset =
  | 'aiGate'
  | 'synthesize'
  | 'questions'
  | 'refine'
  | 'test'
  | 'prompts'
  | 'workflows'
  | 'general'
  | 'health'
  | 'email'
  | 'emailRecipient'
  | 'billing'
  | 'desktopTicket';

interface PresetConfig {
  requests: number;
  windowSeconds: number;
  prefix: string;
}

const PRESET_CONFIGS: Record<LimiterPreset, PresetConfig> = {
  // Runs BEFORE token checking and the user lookup on the AI routes, so a flood costs one counter, not a database query.
  // Generous on purpose (5 per second per visitor): the real usage limits come after sign-in, and people share networks.
  aiGate: { requests: 300, windowSeconds: 60, prefix: 'ratelimit:ai:gate' },
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
  // Checkout: a person opens checkout a few times at most; each order is a call to Razorpay and a database row
  billing: { requests: 10, windowSeconds: 60, prefix: 'ratelimit:billing' },
  // Desktop sign-in tickets are login credentials: per account, shared between all server copies
  desktopTicket: { requests: 10, windowSeconds: 60, prefix: 'ratelimit:desktop-ticket' },
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
    analytics: false, // analytics would cost extra Redis commands on every call (OPEN-0043)
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

const LIMITER_RETRY_AFTER_SECONDS = 30;

/** Redis is configured but not usable: refuse (fail closed) rather than run without a shared limit. */
function sendLimiterUnavailable(res: VercelResponse): false {
  res.setHeader('Retry-After', LIMITER_RETRY_AFTER_SECONDS.toString());
  res.status(503).json({
    error: 'Service temporarily unavailable',
    code: 'RATE_LIMITER_UNAVAILABLE',
    message: `Bedrock is briefly unavailable. Please try again in ${LIMITER_RETRY_AFTER_SECONDS} seconds.`,
    retryAfterSeconds: LIMITER_RETRY_AFTER_SECONDS,
  });
  return false;
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
 * @returns true if allowed to proceed, false if the response was terminated (429, or 503 when the limiter is down).
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

  const checkMemoryLimit = () => safeMemoryRateLimit(`${preset}:${identifier}`, allowedRequests, cfg.windowSeconds);
  // /api/health keeps answering during an outage: reporting that Redis is down is its whole job
  const memoryAllowed = !redisConfigured || preset === 'health';

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
      console.error(`[RateLimiter] Upstash Redis call failed for ${preset}:`, redisErr);
      if (!memoryAllowed) return sendLimiterUnavailable(res);
      limitResult = checkMemoryLimit();
    }
  } else {
    if (!memoryAllowed) return sendLimiterUnavailable(res);
    limitResult = checkMemoryLimit();
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
