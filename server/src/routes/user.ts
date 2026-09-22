import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';

const router = Router();

router.put('/profile', requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return;
  const { name, avatar_url, role } = req.body;
  
  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name }),
        ...(avatar_url && { avatar_url }),
        ...(role && { role }),
      }
    });
    
    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      avatar: updatedUser.avatar_url,
      plan: updatedUser.plan,
      role: updatedUser.role
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
