import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return;
  try {
    const traces = await prisma.trace.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' },
      take: 50
    });
    res.json(traces);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch traces' });
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return;
  const { id, node_origin, model_target, tokens_used, latency_ms, status } = req.body;
  
  try {
    const trace = await prisma.trace.create({
      data: {
        id,
        user_id: req.user.id,
        node_origin,
        model_target,
        tokens_used,
        latency_ms,
        status
      }
    });
    res.json(trace);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save trace' });
  }
});

export default router;
