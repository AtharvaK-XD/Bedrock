import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { config } from '../config.js';
import { logSecurityEvent } from '../db.js';

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
  return rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      const ip = getClientIp(req);
      logSecurityEvent({
        eventType: `${endpointName.toUpperCase()}_RATE_LIMIT_EXCEEDED`,
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
