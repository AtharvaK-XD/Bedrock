import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = getDb();

  // GET /api/prompts: fetch prompts
  if (req.method === 'GET') {
    try {
      const rows = (await sql`
        SELECT * FROM "Prompt" WHERE user_id = ${user.id} ORDER BY updated_at DESC
      `) as any[];
      const prompts = rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        snippet: r.snippet,
        fullContent: r.full_content,
        tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags,
        targetType: r.target_type,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
      return res.status(200).json(prompts);
    } catch (err: any) {
      console.error('[Prompts] GET error:', err);
      return res.status(500).json({ error: 'Failed to fetch prompts', message: err.message });
    }
  }

  // POST /api/prompts: save prompt
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const id = body.id || `prm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const title = body.title || 'Untitled Prompt';
      const fullContent = body.fullContent || body.content || '';
      const snippet = body.snippet || fullContent.slice(0, 160);
      const tags = JSON.stringify(body.tags || ['Custom']);
      const targetType = body.targetType || 'General';

      await sql`
        INSERT INTO "Prompt" (id, user_id, title, snippet, full_content, tags, target_type, created_at, updated_at)
        VALUES (${id}, ${user.id}, ${title}, ${snippet}, ${fullContent}, ${tags}, ${targetType}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = ${title},
          snippet = ${snippet},
          full_content = ${fullContent},
          tags = ${tags},
          target_type = ${targetType},
          updated_at = NOW()
      `;

      return res.status(200).json({ id, title, success: true });
    } catch (err: any) {
      console.error('[Prompts] POST error:', err);
      return res.status(500).json({ error: 'Failed to save prompt', message: err.message });
    }
  }

  // DELETE /api/prompts?id=...: delete prompt
  if (req.method === 'DELETE') {
    try {
      const id = (req.query.id as string) || (req.body?.id as string);
      if (!id) {
        return res.status(400).json({ error: 'Prompt id is required' });
      }

      await sql`DELETE FROM "Prompt" WHERE id = ${id} AND user_id = ${user.id}`;
      return res.status(200).json({ success: true });
    } catch (err: any) {
      console.error('[Prompts] DELETE error:', err);
      return res.status(500).json({ error: 'Failed to delete prompt', message: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
