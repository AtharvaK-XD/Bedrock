import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';
import { enforceRateLimit } from '../_lib/rateLimiter.js';
import { DATA_LIMITS, sendDbFailure, firstFieldError, clampText, dbLimitKind, parseListQuery, encodeCursor, newRowId, serverRowId } from '../_lib/dataHttp.js';
import { handleShared, handleWorkflowAction, snapshotVersion } from '../_lib/workflowActions.js';

/** Nodes and edges are stored as JSON text; a damaged value must not break the whole list. */
function readJsonList(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function mapWorkflow(r: any, summary: boolean) {
  return {
    id: r.id,
    name: r.title,
    title: r.title,
    // Summary lists leave the (large) graph out but say how big it is (the screen can show "large workflow");
    // GET ?id= returns the graph
    ...(summary ? { sizeChars: Number(r.size_chars) || 0 } : { nodes: readJsonList(r.nodes), edges: readJsonList(r.edges) }),
    updatedAt: r.updated_at,
    createdAt: r.created_at,
  };
}

function sendWorkflowLimitReached(res: VercelResponse) {
  return res.status(409).json({
    error: 'Saved workflow limit reached',
    code: 'WORKFLOW_LIMIT_REACHED',
    message: `You can keep up to ${DATA_LIMITS.workflowsPerUser} saved workflows. Delete some to save new ones.`,
    limit: DATA_LIMITS.workflowsPerUser,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // When the request arrived: the AI actions' time budget counts from here, sign-in time included
  const requestStartedAt = Date.now();
  // Branching v2: opening a shared link needs no sign-in (its own per-IP limit is inside)
  const action = typeof req.query?.action === 'string' ? req.query.action : '';
  if (action === 'shared') {
    return handleShared(req, res, getDb());
  }

  // Enforce distributed Upstash Redis rate limiting
  const allowed = await enforceRateLimit(req, res, 'workflows');
  if (!allowed) return;

  const user = await authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = getDb();

  // Branching v2 actions (validate, generate, explain, versions, restore, share, runs, stats)
  if (action) {
    return handleWorkflowAction(action, req, res, user, sql, requestStartedAt);
  }

  // GET /api/workflows
  //   (no parameters)          every workflow as a plain array, as before
  //   ?id=<id>                 one workflow with its nodes and edges (404 when it is not yours)
  //   ?limit=&cursor=&summary=1  one page: { items, nextCursor }, newest first; summary leaves nodes and edges out
  if (req.method === 'GET') {
    const list = parseListQuery(req.query);
    if (!list.ok) {
      return res.status(400).json({ error: (list as { ok: false; error: string }).error, code: 'INVALID_LIST_QUERY' });
    }

    try {
      if (list.id) {
        const [row] = (await sql`
          SELECT id, title, nodes, edges, created_at, updated_at
          FROM "BranchingTree" WHERE id IN (${list.id}, ${serverRowId(user.id, list.id)}) AND user_id = ${user.id} LIMIT 1
        `) as any[];
        if (!row) return res.status(404).json({ error: 'Workflow not found', code: 'WORKFLOW_NOT_FOUND' });
        return res.status(200).json(mapWorkflow(row, false));
      }

      if (list.paged) {
        const afterTs = list.after?.ts ?? null;
        const afterId = list.after?.id ?? null;
        // One extra row tells whether another page exists. Keyset paging on (updated_at, id): stays correct
        // while workflows are saved or deleted between pages, and uses the (user_id, updated_at) index.
        const rows = (list.summary
          ? await sql`
              SELECT id, title, created_at, updated_at, char_length(nodes) + char_length(edges) AS size_chars,
                updated_at::text AS cursor_ts
              FROM "BranchingTree"
              WHERE user_id = ${user.id}
                AND (${afterTs}::text IS NULL OR (updated_at, id) < (${afterTs}::timestamp, ${afterId}::text))
              ORDER BY updated_at DESC, id DESC
              LIMIT ${list.limit + 1}::int
            `
          : await sql`
              SELECT id, title, nodes, edges, created_at, updated_at, updated_at::text AS cursor_ts
              FROM "BranchingTree"
              WHERE user_id = ${user.id}
                AND (${afterTs}::text IS NULL OR (updated_at, id) < (${afterTs}::timestamp, ${afterId}::text))
              ORDER BY updated_at DESC, id DESC
              LIMIT ${list.limit + 1}::int
            `) as any[];
        const page = rows.slice(0, list.limit);
        const last = page[page.length - 1];
        return res.status(200).json({
          items: page.map((r: any) => mapWorkflow(r, list.summary)),
          nextCursor: rows.length > list.limit && last ? encodeCursor(String(last.cursor_ts), String(last.id)) : null,
        });
      }

      const rows = (list.summary
        ? await sql`
            SELECT id, title, created_at, updated_at, char_length(nodes) + char_length(edges) AS size_chars
            FROM "BranchingTree" WHERE user_id = ${user.id} ORDER BY updated_at DESC
          `
        : await sql`
            SELECT * FROM "BranchingTree" WHERE user_id = ${user.id} ORDER BY updated_at DESC
          `) as any[];
      return res.status(200).json(rows.map((r: any) => mapWorkflow(r, list.summary)));
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
      // The server owns every new row's id. A client id only says which of this user's rows is meant (see serverRowId).
      const id = body.id ? serverRowId(user.id, body.id) : newRowId();
      const title = clampText(body.title || body.name, DATA_LIMITS.workflowTitle) || 'Untitled Workflow';

      // Update only a workflow this user owns (rows saved before server ids keep their old id). A row of another
      // account is never touched: its id is simply not one of these two for this user's update.
      if (body.id) {
        const updated = (await sql`
          UPDATE "BranchingTree" SET
            title = ${title},
            nodes = ${nodes},
            edges = ${edges},
            updated_at = NOW()
          WHERE id IN (${body.id}, ${id}) AND user_id = ${user.id}
          RETURNING id
        `) as Array<{ id: string }>;
        if (updated.length > 0) {
          await snapshotVersion(sql, user.id, updated[0].id, title, nodes, edges); // version history; never fails the save
          return res.status(200).json({ id: updated[0].id, title, success: true });
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
        await snapshotVersion(sql, user.id, id, title, nodes, edges); // version history; never fails the save
        return res.status(200).json({ id, title, success: true });
      }

      // Nothing written: either the user is at the limit, or a parallel save of the same workflow just created it
      const [{ count }] = (await sql`
        SELECT COUNT(*)::int AS count FROM "BranchingTree" WHERE user_id = ${user.id}
      `) as Array<{ count: number }>;
      if (count >= DATA_LIMITS.workflowsPerUser) {
        return sendWorkflowLimitReached(res);
      }
      return res.status(409).json({ error: 'This workflow id is already in use', code: 'WORKFLOW_ID_CONFLICT' });
    } catch (err: any) {
      // The database's own limits (migration 0003) refused the row
      const limitKind = dbLimitKind(err);
      if (limitKind === 'row_limit') {
        return sendWorkflowLimitReached(res);
      }
      if (limitKind === 'too_large') {
        return res.status(400).json({
          error: 'Workflow is too large to save',
          code: 'WORKFLOW_TOO_LARGE',
          message: 'This workflow is too large to save. Remove some nodes and try again.',
        });
      }
      return sendDbFailure(res, '[Workflows] POST error:', 'Failed to save workflow', err);
    }
  }

  // DELETE /api/workflows?id=...: delete workflow
  if (req.method === 'DELETE') {
    try {
      const id = req.query.id || req.body?.id;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Workflow id is required' });
      }

      await sql`DELETE FROM "BranchingTree" WHERE id IN (${id}, ${serverRowId(user.id, id)}) AND user_id = ${user.id}`;
      return res.status(200).json({ success: true });
    } catch (err: any) {
      return sendDbFailure(res, '[Workflows] DELETE error:', 'Failed to delete workflow', err);
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
