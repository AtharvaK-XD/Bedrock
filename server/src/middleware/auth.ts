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
        iat?: number;
      };

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          email_verified: true,
          mfa_enabled: true,
          subscription_tier: true,
        },
      });

      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.email_verified,
          mfaEnabled: user.mfa_enabled,
          subscriptionTier: user.subscription_tier,
          tokenIssuedAt: decoded.iat,
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
    }
  }

  // Local desktop fallback
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
    req.user = {
      id: DEFAULT_USER_ID,
      email: 'local-user@bedrock.app',
      name: 'Atharva K.',
      role: 'Lead Prompt Architect',
      emailVerified: true,
      mfaEnabled: true,
      subscriptionTier: 'free',
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
 * Strict authentication: No local guest fallback
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
      role?: string;
      iat?: number;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        email_verified: true,
        mfa_enabled: true,
        subscription_tier: true,
      },
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
      emailVerified: user.email_verified,
      mfaEnabled: user.mfa_enabled,
      subscriptionTier: user.subscription_tier,
      tokenIssuedAt: decoded.iat,
      isGuest: false,
    };
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

/**
 * Section 1: Requires verified email before granting access to paid-tier operations or elevated quotas
 */
export function requireVerifiedEmail(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Local desktop or verified users pass
  if (req.user.isGuest || req.user.emailVerified) {
    return next();
  }

  logSecurityEvent({
    userId: req.user.id,
    eventType: 'UNVERIFIED_EMAIL_BLOCKED',
    severity: 'WARN',
    ipAddress: req.ip,
    endpoint: req.originalUrl,
    message: `Attempt to access elevated tier without verified email: ${req.user.email}`,
  });

  res.status(403).json({
    error: 'Email Verification Required',
    message: 'Please verify your email address to upgrade your plan or access elevated usage quotas.',
    requiresEmailVerification: true,
  });
}

/**
 * Section 1: Requires recent authentication (< 15 min) for sensitive actions (billing change, email change, key rotation)
 */
export function requireRecentAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Local guest allowed in desktop mode
  if (req.user.isGuest) {
    return next();
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const issuedAt = req.user.tokenIssuedAt || 0;
  const maxSessionAgeSeconds = 15 * 60; // 15 minutes

  if (nowSeconds - issuedAt > maxSessionAgeSeconds) {
    res.status(403).json({
      error: 'Re-authentication Required',
      message: 'For your security, please re-authenticate to confirm this sensitive action.',
      requiresReauth: true,
    });
    return;
  }

  next();
}

/**
 * Section 1: Requires MFA for internal / admin accounts
 */
export function requireAdminMfa(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const isAdminRole = req.user.role === 'admin' || req.user.role === 'Lead Prompt Architect';
  if (isAdminRole && !req.user.isGuest && !req.user.mfaEnabled) {
    logSecurityEvent({
      userId: req.user.id,
      eventType: 'ADMIN_MFA_REQUIRED',
      severity: 'WARN',
      ipAddress: req.ip,
      endpoint: req.originalUrl,
      message: `Admin access blocked: MFA not enabled for ${req.user.email}`,
    });

    res.status(403).json({
      error: 'MFA Required',
      message: 'Multi-Factor Authentication (MFA) is strictly required for administrative accounts.',
      requiresMfa: true,
    });
    return;
  }

  next();
}
