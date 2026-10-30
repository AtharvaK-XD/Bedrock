import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';
import { enforceRateLimit } from '../_lib/rateLimiter.js';
import { DATA_LIMITS, sendDbFailure, firstFieldError, clampText } from '../_lib/dataHttp.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enforce distributed Upstash Redis rate limiting
  const allowed = await enforceRateLimit(req, res, 'prompts');
  if (!allowed) return;

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
      return sendDbFailure(res, '[Prompts] GET error:', 'Failed to fetch prompts', err);
    }
  }

  // POST /api/prompts: save prompt
  if (req.method === 'POST') {
    const body = req.body || {};
    const rawContent = body.fullContent || body.content;
    const fieldError = firstFieldError([
      [body.id, DATA_LIMITS.id, 'id'],
      [rawContent, DATA_LIMITS.promptContent, 'fullContent'],
    ]);
    if (fieldError) {
      return res.status(400).json({ error: fieldError });
    }

    try {
      const id = body.id || `prm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const title = clampText(body.title, DATA_LIMITS.promptTitle) || 'Untitled Prompt';
      const fullContent: string = rawContent || '';
      const snippet = clampText(body.snippet, DATA_LIMITS.promptSnippet) || fullContent.slice(0, 160);
      const tags = JSON.stringify(
        Array.isArray(body.tags)
          ? body.tags.filter((t: unknown) => typeof t === 'string').slice(0, DATA_LIMITS.promptTags).map((t: string) => t.slice(0, DATA_LIMITS.promptTag))
          : ['Custom']
      );
      const targetType = clampText(body.targetType, DATA_LIMITS.targetType) || 'General';

      // Update only a prompt this user owns; an id belonging to someone else is never touched
      if (body.id) {
        const updated = (await sql`
          UPDATE "Prompt" SET
            title = ${title},
            snippet = ${snippet},
            full_content = ${fullContent},
            tags = ${tags},
            target_type = ${targetType},
            updated_at = NOW()
          WHERE id = ${id} AND user_id = ${user.id}
          RETURNING id
        `) as Array<{ id: string }>;
        if (updated.length > 0) {
          return res.status(200).json({ id, title, success: true });
        }
      }

      const inserted = (await sql`
        INSERT INTO "Prompt" (id, user_id, title, snippet, full_content, tags, target_type, created_at, updated_at)
        SELECT ${id}, ${user.id}, ${title}, ${snippet}, ${fullContent}, ${tags}, ${targetType}, NOW(), NOW()
        WHERE (SELECT COUNT(*) FROM "Prompt" WHERE user_id = ${user.id}) < ${DATA_LIMITS.promptsPerUser}
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `) as Array<{ id: string }>;
      if (inserted.length > 0) {
        return res.status(200).json({ id, title, success: true });
      }

      // Nothing written: either the user is at the limit, or the id is taken by another account
      const [{ count }] = (await sql`
        SELECT COUNT(*)::int AS count FROM "Prompt" WHERE user_id = ${user.id}
      `) as Array<{ count: number }>;
      if (count >= DATA_LIMITS.promptsPerUser) {
        return res.status(409).json({
          error: 'Saved prompt limit reached',
          code: 'PROMPT_LIMIT_REACHED',
          message: `You can keep up to ${DATA_LIMITS.promptsPerUser} saved prompts. Delete some to save new ones.`,
          limit: DATA_LIMITS.promptsPerUser,
        });
      }
      return res.status(409).json({ error: 'This prompt id is already in use', code: 'PROMPT_ID_CONFLICT' });
    } catch (err: any) {
      return sendDbFailure(res, '[Prompts] POST error:', 'Failed to save prompt', err);
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
      return sendDbFailure(res, '[Prompts] DELETE error:', 'Failed to delete prompt', err);
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
