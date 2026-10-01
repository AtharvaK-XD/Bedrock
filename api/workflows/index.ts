import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';
import { enforceRateLimit } from '../_lib/rateLimiter.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enforce distributed Upstash Redis rate limiting
  const allowed = await enforceRateLimit(req, res, 'workflows');
  if (!allowed) return;

  const user = await authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = getDb();

  // GET /api/workflows: list workflows/branching trees for user
  if (req.method === 'GET') {
    try {
      const rows = (await sql`
        SELECT * FROM "BranchingTree" WHERE user_id = ${user.id} ORDER BY updated_at DESC
      `) as any[];
      const workflows = rows.map((r: any) => ({
        id: r.id,
        name: r.title,
        title: r.title,
        nodes: typeof r.nodes === 'string' ? JSON.parse(r.nodes) : r.nodes,
        edges: typeof r.edges === 'string' ? JSON.parse(r.edges) : r.edges,
        updatedAt: r.updated_at,
        createdAt: r.created_at,
      }));
      return res.status(200).json(workflows);
    } catch (err: any) {
      console.error('[Workflows] GET error:', err);
      return res.status(500).json({ error: 'Failed to fetch workflows', message: err.message });
    }
  }

  // POST /api/workflows: save workflow/tree
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const id = body.id || `wf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const title = body.title || body.name || 'Untitled Workflow';
      const nodes = JSON.stringify(body.nodes || []);
      const edges = JSON.stringify(body.edges || []);

      await sql`
        INSERT INTO "BranchingTree" (id, user_id, title, nodes, edges, created_at, updated_at)
        VALUES (${id}, ${user.id}, ${title}, ${nodes}, ${edges}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = ${title},
          nodes = ${nodes},
          edges = ${edges},
          updated_at = NOW()
      `;

      return res.status(200).json({ id, title, success: true });
    } catch (err: any) {
      console.error('[Workflows] POST error:', err);
      return res.status(500).json({ error: 'Failed to save workflow', message: err.message });
    }
  }

  // DELETE /api/workflows?id=...: delete workflow
  if (req.method === 'DELETE') {
    try {
      const id = (req.query.id as string) || (req.body?.id as string);
      if (!id) {
        return res.status(400).json({ error: 'Workflow id is required' });
      }

      await sql`DELETE FROM "BranchingTree" WHERE id = ${id} AND user_id = ${user.id}`;
      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error('[Workflows] DELETE error:', err);
      return res.status(500).json({ error: 'Failed to delete workflow', message: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
