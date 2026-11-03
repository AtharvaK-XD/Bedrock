import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';
import { enforceRateLimit } from '../_lib/rateLimiter.js';
import { DATA_LIMITS, sendDbFailure, firstFieldError, clampText, dbLimitKind, parseListQuery, encodeCursor } from '../_lib/dataHttp.js';

/** Tags are stored as JSON text; a damaged value must not break the whole list. */
function readTags(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function mapPrompt(r: any, summary: boolean) {
  return {
    id: r.id,
    title: r.title,
    snippet: r.snippet,
    // Summary lists leave the (large) text out and say how long it is; GET ?id= returns it
    ...(summary ? { contentLength: Number(r.content_length) || 0 } : { fullContent: r.full_content }),
    tags: readTags(r.tags),
    targetType: r.target_type,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function sendPromptLimitReached(res: VercelResponse) {
  return res.status(409).json({
    error: 'Saved prompt limit reached',
    code: 'PROMPT_LIMIT_REACHED',
    message: `You can keep up to ${DATA_LIMITS.promptsPerUser} saved prompts. Delete some to save new ones.`,
    limit: DATA_LIMITS.promptsPerUser,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enforce distributed Upstash Redis rate limiting
  const allowed = await enforceRateLimit(req, res, 'prompts');
  if (!allowed) return;

  const user = await authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = getDb();

  // GET /api/prompts
  //   (no parameters)          every prompt as a plain array, as before
  //   ?id=<id>                 one prompt with its full text (404 when it is not yours)
  //   ?limit=&cursor=&summary=1  one page: { items, nextCursor }, newest first; summary leaves the text out
  if (req.method === 'GET') {
    const list = parseListQuery(req.query);
    if (!list.ok) {
      return res.status(400).json({ error: (list as { ok: false; error: string }).error, code: 'INVALID_LIST_QUERY' });
    }

    try {
      if (list.id) {
        const [row] = (await sql`
          SELECT id, title, snippet, full_content, tags, target_type, created_at, updated_at
          FROM "Prompt" WHERE id = ${list.id} AND user_id = ${user.id} LIMIT 1
        `) as any[];
        if (!row) return res.status(404).json({ error: 'Prompt not found', code: 'PROMPT_NOT_FOUND' });
        return res.status(200).json(mapPrompt(row, false));
      }

      if (list.paged) {
        const afterTs = list.after?.ts ?? null;
        const afterId = list.after?.id ?? null;
        // One extra row tells whether another page exists. Keyset paging on (updated_at, id): stays correct
        // while prompts are saved or deleted between pages, and uses the (user_id, updated_at) index.
        const rows = (list.summary
          ? await sql`
              SELECT id, title, snippet, char_length(full_content) AS content_length, tags, target_type,
                created_at, updated_at, updated_at::text AS cursor_ts
              FROM "Prompt"
              WHERE user_id = ${user.id}
                AND (${afterTs}::text IS NULL OR (updated_at, id) < (${afterTs}::timestamp, ${afterId}::text))
              ORDER BY updated_at DESC, id DESC
              LIMIT ${list.limit + 1}::int
            `
          : await sql`
              SELECT id, title, snippet, full_content, tags, target_type,
                created_at, updated_at, updated_at::text AS cursor_ts
              FROM "Prompt"
              WHERE user_id = ${user.id}
                AND (${afterTs}::text IS NULL OR (updated_at, id) < (${afterTs}::timestamp, ${afterId}::text))
              ORDER BY updated_at DESC, id DESC
              LIMIT ${list.limit + 1}::int
            `) as any[];
        const page = rows.slice(0, list.limit);
        const last = page[page.length - 1];
        return res.status(200).json({
          items: page.map((r: any) => mapPrompt(r, list.summary)),
          nextCursor: rows.length > list.limit && last ? encodeCursor(String(last.cursor_ts), String(last.id)) : null,
        });
      }

      const rows = (list.summary
        ? await sql`
            SELECT id, title, snippet, char_length(full_content) AS content_length, tags, target_type, created_at, updated_at
            FROM "Prompt" WHERE user_id = ${user.id} ORDER BY updated_at DESC
          `
        : await sql`
            SELECT * FROM "Prompt" WHERE user_id = ${user.id} ORDER BY updated_at DESC
          `) as any[];
      return res.status(200).json(rows.map((r: any) => mapPrompt(r, list.summary)));
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
        return sendPromptLimitReached(res);
      }
      return res.status(409).json({ error: 'This prompt id is already in use', code: 'PROMPT_ID_CONFLICT' });
    } catch (err: any) {
      // The database's own limits (migration 0003) refused the row
      const limitKind = dbLimitKind(err);
      if (limitKind === 'row_limit') {
        return sendPromptLimitReached(res);
      }
      if (limitKind === 'too_large') {
        return res.status(400).json({
          error: 'Prompt is too large to save',
          code: 'PROMPT_TOO_LARGE',
          message: 'This prompt is too large to save. Shorten it and try again.',
        });
      }
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
