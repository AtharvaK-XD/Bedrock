import { Router } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'bedrock_super_secret_jwt_key_2026_dev';

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'Email already exists' });
      return;
    }

    const password_hash = await argon2.hash(password);
    const user = await prisma.user.create({
      data: { email, password_hash, name }
    });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar_url, plan: user.plan } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Since the frontend mock just sent email/name, we might need a fallback for missing password if they are using the old mock auth. 
    // Wait, the frontend mock sent email and name to login(). We'll update the frontend to send a password.
    // Let's assume password is provided.
    if (!password) {
      res.status(400).json({ error: 'Password required' });
      return;
    }

    const isValid = await argon2.verify(user.password_hash, password);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar_url, plan: user.plan } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) {
     res.status(401).json({ error: 'Unauthorized' });
     return;
  }
  
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
       res.status(404).json({ error: 'User not found' });
       return;
    }
    res.json({ user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar_url, plan: user.plan, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
