import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { prisma, DEFAULT_USER_ID, logSecurityEvent } from '../db.js';
import { AuthRequest, AuthenticatedUser } from '../types.js';

export type { AuthRequest } from '../types.js';

/**
 * Standard authentication middleware:
 * Validates JWT from HttpOnly cookie or Authorization Bearer header.
 * If running in local desktop mode without explicit token, falls back gracefully to the local default user.
 */
export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token =
    req.cookies?.[config.cookieName] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as {
        id: string;
        email: string;
        name?: string;
        role?: string;
      };

      // Verify user actually exists in the database
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, name: true, role: true },
      });

      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isGuest: false,
        };
        return next();
      }
    } catch (err: any) {
      logSecurityEvent({
        eventType: 'INVALID_TOKEN_ATTEMPT',
        severity: 'WARN',
        ipAddress: req.ip,
        endpoint: req.originalUrl,
        message: `Token verification failed: ${err.message}`,
      });
      // Fall through to desktop fallback or 401
    }
  }

  // Check if request is originating from local desktop / Vite dev server
  const origin = req.headers.origin || req.headers.host || '';
  const isLocalRequest =
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.includes('tauri') ||
    origin.includes('electron') ||
    req.ip === '127.0.0.1' ||
    req.ip === '::1' ||
    req.ip === '::ffff:127.0.0.1';

  if (isLocalRequest) {
    // Provide isolated default desktop session
    req.user = {
      id: DEFAULT_USER_ID,
      email: 'local-user@bedrock.app',
      name: 'Atharva K.',
      role: 'Lead Prompt Architect',
      isGuest: true,
    };
    return next();
  }

  res.status(401).json({
    error: 'Unauthorized',
    message: 'Access denied. Valid authentication token required.',
  });
}

/**
 * Strict authentication middleware:
 * Requires an active, cryptographically verified user token with no local fallback.
 */
export async function requireStrictAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token =
    req.cookies?.[config.cookieName] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token required for this action.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      id: string;
      email: string;
      name?: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      res.status(401).json({ error: 'User account not found' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isGuest: false,
    };
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired session token' });
  }
}
