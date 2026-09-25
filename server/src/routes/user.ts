import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { ProfileUpdateSchema } from '../types.js';

const router = Router();

// GET /api/user/profile
router.get('/profile', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      name: user.name,
      email: user.email,
      username: user.username || user.email.split('@')[0],
      role: user.role,
      bio: user.bio || '',
      plan: user.plan,
      location: user.location || '',
      organization: user.organization || '',
      avatarInitials: user.avatar_initials || 'AK',
      avatarUrl: user.avatar_url || '',
      github: user.github || '',
      huggingface: user.huggingface || '',
      website: user.website || '',
      joinedDate: user.joined_date || 'January 2025',
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/user/profile
router.put('/profile', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validated = ProfileUpdateSchema.parse(req.body);

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.username && { username: validated.username }),
        ...(validated.role && { role: validated.role }),
        ...(validated.bio !== undefined && { bio: validated.bio }),
        ...(validated.plan && { plan: validated.plan }),
        ...(validated.location !== undefined && { location: validated.location }),
        ...(validated.organization !== undefined && { organization: validated.organization }),
        ...(validated.avatarInitials && { avatar_initials: validated.avatarInitials }),
        ...(validated.avatar_initials && { avatar_initials: validated.avatar_initials }),
        ...(validated.avatarUrl !== undefined && { avatar_url: validated.avatarUrl }),
        ...(validated.avatar_url !== undefined && { avatar_url: validated.avatar_url }),
        ...(validated.github !== undefined && { github: validated.github }),
        ...(validated.huggingface !== undefined && { huggingface: validated.huggingface }),
        ...(validated.website !== undefined && { website: validated.website }),
      },
    });

    res.json({
      name: updatedUser.name,
      email: updatedUser.email,
      username: updatedUser.username || updatedUser.email.split('@')[0],
      role: updatedUser.role,
      bio: updatedUser.bio || '',
      plan: updatedUser.plan,
      location: updatedUser.location || '',
      organization: updatedUser.organization || '',
      avatarInitials: updatedUser.avatar_initials || 'AK',
      avatarUrl: updatedUser.avatar_url || '',
      github: updatedUser.github || '',
      huggingface: updatedUser.huggingface || '',
      website: updatedUser.website || '',
      joinedDate: updatedUser.joined_date || 'January 2025',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
