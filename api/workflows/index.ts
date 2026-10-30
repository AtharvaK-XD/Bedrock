import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';
import { enforceRateLimit } from '../_lib/rateLimiter.js';
import { DATA_LIMITS, sendDbFailure, firstFieldError, clampText } from '../_lib/dataHttp.js';

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
      return sendDbFailure(res, '[Workflows] GET error:', 'Failed to fetch workflows', err);
    }
  }

  // POST /api/workflows: save workflow/tree
  if (req.method === 'POST') {
    const body = req.body || {};
    const idError = firstFieldError([[body.id, DATA_LIMITS.id, 'id']]);
    if (idError) {
      return res.status(400).json({ error: idError });
    }
    if ((body.nodes != null && !Array.isArray(body.nodes)) || (body.edges != null && !Array.isArray(body.edges))) {
      return res.status(400).json({ error: 'nodes and edges must be arrays' });
    }
    const nodes = JSON.stringify(body.nodes || []);
    const edges = JSON.stringify(body.edges || []);
    if (nodes.length + edges.length > DATA_LIMITS.workflowJsonChars) {
      return res.status(400).json({ error: `Workflow is too large (nodes and edges must be at most ${DATA_LIMITS.workflowJsonChars} characters)` });
    }

    try {
      const id = body.id || `wf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const title = clampText(body.title || body.name, DATA_LIMITS.workflowTitle) || 'Untitled Workflow';

      // Update only a workflow this user owns; an id belonging to someone else is never touched
      if (body.id) {
        const updated = (await sql`
          UPDATE "BranchingTree" SET
            title = ${title},
            nodes = ${nodes},
            edges = ${edges},
            updated_at = NOW()
          WHERE id = ${id} AND user_id = ${user.id}
          RETURNING id
        `) as Array<{ id: string }>;
        if (updated.length > 0) {
          return res.status(200).json({ id, title, success: true });
        }
      }

      const inserted = (await sql`
        INSERT INTO "BranchingTree" (id, user_id, title, nodes, edges, created_at, updated_at)
        SELECT ${id}, ${user.id}, ${title}, ${nodes}, ${edges}, NOW(), NOW()
        WHERE (SELECT COUNT(*) FROM "BranchingTree" WHERE user_id = ${user.id}) < ${DATA_LIMITS.workflowsPerUser}
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `) as Array<{ id: string }>;
      if (inserted.length > 0) {
        return res.status(200).json({ id, title, success: true });
      }

      // Nothing written: either the user is at the limit, or the id is taken by another account
      const [{ count }] = (await sql`
        SELECT COUNT(*)::int AS count FROM "BranchingTree" WHERE user_id = ${user.id}
      `) as Array<{ count: number }>;
      if (count >= DATA_LIMITS.workflowsPerUser) {
        return res.status(409).json({
          error: 'Saved workflow limit reached',
          code: 'WORKFLOW_LIMIT_REACHED',
          message: `You can keep up to ${DATA_LIMITS.workflowsPerUser} saved workflows. Delete some to save new ones.`,
          limit: DATA_LIMITS.workflowsPerUser,
        });
      }
      return res.status(409).json({ error: 'This workflow id is already in use', code: 'WORKFLOW_ID_CONFLICT' });
    } catch (err: any) {
      return sendDbFailure(res, '[Workflows] POST error:', 'Failed to save workflow', err);
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
      return sendDbFailure(res, '[Workflows] DELETE error:', 'Failed to delete workflow', err);
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
