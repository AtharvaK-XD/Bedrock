import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return;
  try {
    const prompts = await prisma.prompt.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' }
    });
    res.json(prompts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return;
  const { title, snippet, full_content, tags, target_type } = req.body;
  
  try {
    const prompt = await prisma.prompt.create({
      data: {
        user_id: req.user.id,
        title,
        snippet,
        full_content,
        tags: JSON.stringify(tags || []),
        target_type
      }
    });
    res.json(prompt);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save prompt' });
  }
});

export default router;
