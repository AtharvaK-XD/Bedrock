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

export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxGeneral,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const ip = getClientIp(req);
    logSecurityEvent({
      eventType: 'RATE_LIMIT_EXCEEDED',
      severity: 'WARN',
      ipAddress: ip,
      endpoint: req.originalUrl,
      message: `General rate limit exceeded: ${req.method} ${req.originalUrl}`,
    });
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please wait a few moments before trying again.',
      retryAfterSeconds: Math.ceil(config.rateLimit.windowMs / 1000),
    });
  },
});

export const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxAuth,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const ip = getClientIp(req);
    logSecurityEvent({
      eventType: 'AUTH_RATE_LIMIT_EXCEEDED',
      severity: 'CRITICAL',
      ipAddress: ip,
      endpoint: req.originalUrl,
      message: `Authentication brute-force limit reached from ${ip}`,
    });
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Too many login attempts. Account temporarily throttled for security.',
    });
  },
});

export const aiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxAi,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const ip = getClientIp(req);
    logSecurityEvent({
      eventType: 'AI_RATE_LIMIT_EXCEEDED',
      severity: 'WARN',
      ipAddress: ip,
      endpoint: req.originalUrl,
      message: `AI generation quota exceeded: ${req.method} ${req.originalUrl}`,
    });
    res.status(429).json({
      error: 'AI Rate Limit Exceeded',
      message: 'You have reached the AI generation request rate limit. Please pause before submitting more requests.',
    });
  },
});
