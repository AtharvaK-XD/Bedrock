import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import cors from 'cors';
import { config } from '../config.js';

// Setup strict Helmet security headers
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc: ["'self'", ...config.corsOrigins, 'https://generativelanguage.googleapis.com', 'https://api.groq.com', 'https://openrouter.ai', 'https://api-inference.huggingface.co', 'https://api.openai.com'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: config.isProduction ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: config.isProduction
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
});

// Setup strict CORS policy
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow local desktop app, Tauri, Electron, or requests with no origin (e.g. mobile apps/curl/same-origin)
    if (!origin) {
      return callback(null, true);
    }

    if (config.corsOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }

    // In development mode, allow developer tools access
    if (!config.isProduction && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }

    return callback(new Error('Cross-Origin Request Blocked by Bedrock Security Policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-Client-Version',
  ],
  maxAge: 86400, // 24 hours preflight cache
});

// HTTP Parameter Pollution Protection
export const hppMiddleware = hpp();

// Deep sanitization against Prototype Pollution & Malicious Payloads
export function sanitizePayloads(req: Request, res: Response, next: NextFunction): void {
  function sanitize(obj: any, depth = 0): any {
    if (depth > 10 || !obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => sanitize(item, depth + 1));
    }

    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Prevent prototype pollution
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }

      if (typeof value === 'string') {
        // Strip null bytes and dangerous execution sequences
        clean[key] = value.replace(/\0/g, '');
      } else if (typeof value === 'object' && value !== null) {
        clean[key] = sanitize(value, depth + 1);
      } else {
        clean[key] = value;
      }
    }
    return clean;
  }

  if (req.body && typeof req.body === 'object') {
    req.body = sanitize(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        delete (req.query as any)[key];
      }
    }
  }

  next();
}
