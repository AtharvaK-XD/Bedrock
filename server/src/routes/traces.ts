import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { TraceCreateSchema } from '../types.js';

const router = Router();

// GET /api/traces
router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const traces = await prisma.trace.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    res.json(traces);
  } catch (err) {
    next(err);
  }
});

// POST /api/traces
router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validated = TraceCreateSchema.parse(req.body);

    const trace = await prisma.trace.create({
      data: {
        id: validated.id,
        user_id: req.user.id,
        node_origin: validated.node_origin,
        model_target: validated.model_target,
        tokens_used: validated.tokens_used,
        latency_ms: validated.latency_ms,
        status: validated.status,
      },
    });

    res.status(201).json(trace);
  } catch (err) {
    next(err);
  }
});

export default router;
