import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';

const router = Router();

// Get all workflows for the current user
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return;
  try {
    const trees = await prisma.branchingTree.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' }
    });
    res.json(trees);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

// Save or update a workflow
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return;
  const { id, title, nodes, edges } = req.body;
  
  try {
    if (id) {
      // Update existing
      const tree = await prisma.branchingTree.update({
        where: { id },
        data: {
          title,
          nodes: JSON.stringify(nodes),
          edges: JSON.stringify(edges)
        }
      });
      res.json(tree);
    } else {
      // Create new
      const tree = await prisma.branchingTree.create({
        data: {
          user_id: req.user.id,
          title: title || 'Untitled Workflow',
          nodes: JSON.stringify(nodes),
          edges: JSON.stringify(edges)
        }
      });
      res.json(tree);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save workflow' });
  }
});

// Delete a workflow
router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return;
  try {
    await prisma.branchingTree.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

export default router;
