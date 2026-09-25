import { Router } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma, logSecurityEvent } from '../db.js';
import { config } from '../config.js';
import { requireAuth, requireStrictAuth, AuthRequest } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { RegisterSchema, LoginSchema } from '../types.js';

const router = Router();

// Register new user
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const validated = RegisterSchema.parse(req.body);
    const email = validated.email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      logSecurityEvent({
        eventType: 'REGISTER_DUPLICATE_EMAIL',
        severity: 'WARN',
        ipAddress: req.ip,
        endpoint: '/api/auth/register',
        message: `Registration attempt with existing email: ${email}`,
      });
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const password_hash = await argon2.hash(validated.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
    });

    const user = await prisma.user.create({
      data: {
        email,
        password_hash,
        name: validated.name.trim(),
        avatar_initials: validated.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.cookie(config.cookieName, token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    logSecurityEvent({
      userId: user.id,
      eventType: 'USER_REGISTERED',
      severity: 'INFO',
      ipAddress: req.ip,
      endpoint: '/api/auth/register',
      message: `User registered: ${user.email}`,
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
        avatar_initials: user.avatar_initials,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
});

// Login user
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const validated = LoginSchema.parse(req.body);
    const email = validated.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      logSecurityEvent({
        eventType: 'LOGIN_FAILED_NO_USER',
        severity: 'WARN',
        ipAddress: req.ip,
        endpoint: '/api/auth/login',
        message: `Login failed for non-existent email: ${email}`,
      });
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isValid = await argon2.verify(user.password_hash, validated.password);
    if (!isValid) {
      logSecurityEvent({
        userId: user.id,
        eventType: 'LOGIN_FAILED_BAD_PASSWORD',
        severity: 'CRITICAL',
        ipAddress: req.ip,
        endpoint: '/api/auth/login',
        message: `Failed login attempt for user ${user.email}`,
      });
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.cookie(config.cookieName, token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    logSecurityEvent({
      userId: user.id,
      eventType: 'USER_LOGGED_IN',
      severity: 'INFO',
      ipAddress: req.ip,
      endpoint: '/api/auth/login',
      message: `User logged in: ${user.email}`,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        plan: user.plan,
        avatar_initials: user.avatar_initials,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
});

// Logout user
router.post('/logout', (req, res) => {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
  });
  res.json({ success: true, message: 'Logged out successfully' });
});

// Current user profile
router.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        role: true,
        bio: true,
        plan: true,
        location: true,
        organization: true,
        avatar_url: true,
        avatar_initials: true,
        github: true,
        huggingface: true,
        website: true,
        created_at: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
