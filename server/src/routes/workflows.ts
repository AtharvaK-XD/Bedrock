import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db.js';
import { WorkflowSaveSchema } from '../types.js';

const router = Router();

// GET /api/workflows
router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const trees = await prisma.branchingTree.findMany({
      where: { user_id: req.user.id },
      orderBy: { updated_at: 'desc' },
    });

    const parsedTrees = trees.map((tree: any) => {
      let nodes = [];
      let edges = [];
      try {
        nodes = JSON.parse(tree.nodes);
      } catch {
        nodes = [];
      }
      try {
        edges = JSON.parse(tree.edges);
      } catch {
        edges = [];
      }

      return {
        id: tree.id,
        title: tree.title,
        nodes,
        edges,
        created_at: tree.created_at,
        updated_at: tree.updated_at,
      };
    });

    res.json(parsedTrees);
  } catch (err) {
    next(err);
  }
});

// POST /api/workflows
router.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const validated = WorkflowSaveSchema.parse(req.body);
    const nodesJson = JSON.stringify(validated.nodes || []);
    const edgesJson = JSON.stringify(validated.edges || []);

    let workflow;
    if (validated.id) {
      // Check if workflow exists and belongs to user
      const existing = await prisma.branchingTree.findFirst({
        where: { id: validated.id, user_id: req.user.id },
      });

      if (existing) {
        workflow = await prisma.branchingTree.update({
          where: { id: validated.id },
          data: {
            title: validated.title,
            nodes: nodesJson,
            edges: edgesJson,
          },
        });
      } else {
        workflow = await prisma.branchingTree.create({
          data: {
            id: validated.id,
            user_id: req.user.id,
            title: validated.title,
            nodes: nodesJson,
            edges: edgesJson,
          },
        });
      }
    } else {
      workflow = await prisma.branchingTree.create({
        data: {
          user_id: req.user.id,
          title: validated.title,
          nodes: nodesJson,
          edges: edgesJson,
        },
      });
    }

    res.json({
      id: workflow.id,
      title: workflow.title,
      nodes: JSON.parse(workflow.nodes),
      edges: JSON.parse(workflow.edges),
      created_at: workflow.created_at,
      updated_at: workflow.updated_at,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/workflows/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const workflowId = String(req.params.id);
    if (!workflowId) {
      res.status(400).json({ error: 'Workflow ID is required' });
      return;
    }

    await prisma.branchingTree.deleteMany({
      where: { id: workflowId, user_id: req.user.id },
    });

    res.json({ success: true, message: 'Workflow deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
