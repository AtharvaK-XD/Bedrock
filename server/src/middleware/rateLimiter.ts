import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { config } from '../config.js';
import { logSecurityEvent } from '../db.js';

let upstashRedis: Redis | null = null;
if (config.redis.url && config.redis.token) {
  try {
    upstashRedis = new Redis({
      url: config.redis.url,
      token: config.redis.token,
    });
    console.log('🛡️ [RateLimiter] Upstash Distributed Sliding-Window Rate Limiter initialized');
  } catch (err) {
    console.warn('[RateLimiter] Failed to initialize Upstash Redis, using memory store:', err);
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || '127.0.0.1';
  }
  return req.ip || '127.0.0.1';
}

function createLimiter(
  endpointName: string,
  maxRequests: number,
  windowMs = config.rateLimit.windowMs,
  severity: 'INFO' | 'WARN' | 'CRITICAL' = 'WARN'
) {
  // 1. In-memory fallback
  const memoryLimiter = rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      const ip = getClientIp(req);
      logSecurityEvent({
        eventType: `${endpointName.toUpperCase().replace(/\s+/g, '_')}_RATE_LIMIT_EXCEEDED`,
        severity,
        ipAddress: ip,
        endpoint: req.originalUrl,
        message: `Rate limit of ${maxRequests} requests reached for ${endpointName} by ${ip}`,
      });
      res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: `Too many requests to ${endpointName}. Limit: ${maxRequests} requests per ${Math.round(windowMs / 60000)} minutes. Please wait before retrying.`,
        retryAfterSeconds: Math.ceil(windowMs / 1000),
      });
    },
  });

  // 2. Upstash Distributed Sliding Window Limiter (if configured)
  let upstashLimiter: Ratelimit | null = null;
  if (upstashRedis) {
    const windowSeconds = Math.max(1, Math.round(windowMs / 1000));
    upstashLimiter = new Ratelimit({
      redis: upstashRedis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s` as any),
      prefix: `ratelimit:${endpointName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    });
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    if (upstashLimiter) {
      try {
        const ip = getClientIp(req);
        const { success, limit, remaining, reset } = await upstashLimiter.limit(ip);

        res.setHeader('X-RateLimit-Limit', limit.toString());
        res.setHeader('X-RateLimit-Remaining', remaining.toString());
        res.setHeader('X-RateLimit-Reset', reset.toString());

        if (!success) {
          logSecurityEvent({
            eventType: `${endpointName.toUpperCase().replace(/\s+/g, '_')}_RATE_LIMIT_EXCEEDED`,
            severity,
            ipAddress: ip,
            endpoint: req.originalUrl,
            message: `Distributed rate limit of ${maxRequests} requests reached for ${endpointName} by ${ip}`,
          });
          return res.status(429).json({
            error: 'Rate Limit Exceeded',
            message: `Too many requests to ${endpointName}. Limit: ${maxRequests} requests per ${Math.round(windowMs / 60000)} minutes. Please wait before retrying.`,
            retryAfterSeconds: Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
          });
        }
        return next();
      } catch (err) {
        console.warn(`[RateLimiter] Upstash check failed for ${endpointName}, using in-memory limiter:`, err);
      }
    }

    return memoryLimiter(req, res, next);
  };
}

// Global baseline limiter
export const generalLimiter = createLimiter('General API', 300, 15 * 60 * 1000, 'INFO');

// Authentication brute force protection
export const authLimiter = createLimiter('Auth API', 15, 15 * 60 * 1000, 'CRITICAL');

// Billing & checkout limiter (prevents fraudulent card testing)
export const billingLimiter = createLimiter('Billing API', 20, 15 * 60 * 1000, 'CRITICAL');

// Per-endpoint LLM rate limiters
export const synthesizeLimiter = createLimiter('Synthesize Prompt', 15, 15 * 60 * 1000, 'WARN');
export const refineLimiter = createLimiter('Refine Prompt', 30, 15 * 60 * 1000, 'WARN');
export const questionsLimiter = createLimiter('Generate Questions', 30, 15 * 60 * 1000, 'WARN');
export const testPromptLimiter = createLimiter('Test Prompt Playground', 25, 15 * 60 * 1000, 'WARN');

// Workflows & Library limiters
export const workflowsLimiter = createLimiter('Workflows API', 60, 15 * 60 * 1000, 'INFO');
export const promptsLimiter = createLimiter('Prompts API', 60, 15 * 60 * 1000, 'INFO');
