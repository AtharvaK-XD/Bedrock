import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { PromptCreateSchema } from '../types.js';

const router = Router();

// GET /api/prompts
router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const prompts = await prisma.prompt.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' },
    });

    const parsedPrompts = prompts.map((p: any) => {
      let tags: string[] = [];
      try {
        tags = JSON.parse(p.tags);
      } catch {
        tags = p.tags ? p.tags.split(',') : [];
      }
      return {
        ...p,
        tags,
      };
    });

    res.json(parsedPrompts);
  } catch (err) {
    next(err);
  }
});

// POST /api/prompts
router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validated = PromptCreateSchema.parse(req.body);
    const tagsString = Array.isArray(validated.tags)
      ? JSON.stringify(validated.tags)
      : JSON.stringify([validated.tags]);

    const prompt = await prisma.prompt.create({
      data: {
        user_id: req.user.id,
        title: validated.title,
        snippet: validated.snippet || validated.full_content.slice(0, 150),
        full_content: validated.full_content,
        tags: tagsString,
        target_type: validated.target_type,
      },
    });

    res.status(201).json({
      ...prompt,
      tags: JSON.parse(prompt.tags),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/prompts/:id
router.get('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const id = String(req.params.id);
    const prompt = await prisma.prompt.findFirst({
      where: { id, user_id: req.user.id },
    });

    if (!prompt) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }

    let tags: string[] = [];
    try {
      tags = JSON.parse(prompt.tags);
    } catch {
      tags = [];
    }

    res.json({ ...prompt, tags });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/prompts/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const id = String(req.params.id);
    await prisma.prompt.deleteMany({
      where: { id, user_id: req.user.id },
    });

    res.json({ success: true, message: 'Prompt deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
