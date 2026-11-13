/**
 * Branching v2 actions on /api/workflows (?action=...). Kept here so the original GET/POST/DELETE code in
 * api/workflows/index.ts stays as it was. Routes and answers: agent-sync/BRANCHING_PROMPTS.md section 0.6.
 *
 * Tables (migration 0021, Database session): "WorkflowVersion", "WorkflowRun", "WorkflowShare". Until the migration is
 * applied, every action that needs them answers 503 FEATURE_NOT_READY and the original routes keep working.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AuthenticatedUser } from './auth.js';
import { enforceRateLimit, getClientIp } from './rateLimiter.js';
import { DATA_LIMITS, newRowId, sendDbFailure, serverRowId } from './dataHttp.js';
import { checkGraph, graphStats, KNOWN_NODE_TYPES, newShareToken, readJsonArray, SHARE_TOKEN_RE, stripForShare, tierOf, nodeLimitForJson, PLAN_NODE_LIMIT } from './workflowGraph.js';
import {
  buildGenerateSystemPrompt, buildGeneratedWorkflow, describeGraphForAi, EXPLAIN_SYSTEM_PROMPT, parseAiJsonObject, readExplanation, WORKFLOW_AI_LIMITS,
} from './workflowAi.js';
import { executeAiCompletion } from './ai.js';
import { checkPromptInjection, releaseQuota, reserveQuota, sendQuotaDenied } from './security.js';
import { clientAbortSignal, failureOutcome, getRequestId, isPaidUser, logAiRequest, sendAiFailure } from './aiHttp.js';

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;

export const WORKFLOW_ACTIONS = ['validate', 'generate', 'explain', 'versions', 'restore', 'share', 'shared', 'runs', 'stats'] as const;
export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];

/** Versions kept per workflow; older ones are removed when a new one is saved. */
export const VERSIONS_KEPT = 20;
/** Run history kept per account. */
export const RUN_HISTORY_DAYS = 90;

/** undefined_table, undefined_column, insufficient_privilege: migration 0021 or its grants are not in place yet. */
const FEATURE_MISSING_CODES = new Set(['42P01', '42703', '42501']);
export function isFeatureMissing(err: unknown): boolean {
  return FEATURE_MISSING_CODES.has(String((err as { code?: unknown } | null)?.code ?? ''));
}

function sendFeatureNotReady(res: VercelResponse) {
  return res.status(503).json({
    error: 'Feature not ready',
    code: 'FEATURE_NOT_READY',
    message: 'This feature is being set up. Please try again later.',
  });
}

/**
 * Database refusals from migration 0021 (db/PAGING.md): the workflow belongs to another account (23503
 * WORKFLOW_NOT_OWNED) -> 404; more than 2,000 run records in 24 hours (23514 DAILY_RUN_LIMIT) -> 429; another
 * broken rule (23514) -> 400; table or grants missing -> 503. Returns null for anything else.
 */
function sendMappedDbError(res: VercelResponse, err: unknown): VercelResponse | null {
  const e = err as { code?: unknown; message?: unknown } | null;
  const code = String(e?.code ?? '');
  const message = String(e?.message ?? '');
  if (isFeatureMissing(err)) return sendFeatureNotReady(res);
  if (code === '23503' && message.includes('WORKFLOW_NOT_OWNED')) return sendWorkflowNotFound(res);
  if (code === '23514' && message.includes('DAILY_RUN_LIMIT')) {
    return res.status(429).json({ error: 'Daily run limit reached', code: 'DAILY_RUN_LIMIT', message: 'You have recorded a lot of runs today. Your runs still work; they are just not counted until tomorrow.' });
  }
  if (code === '23514') return res.status(400).json({ error: 'Invalid value', code: 'INVALID_VALUE', message: 'One of the values is out of range.' });
  return null;
}

function sendWorkflowNotFound(res: VercelResponse) {
  return res.status(404).json({ error: 'Workflow not found', code: 'WORKFLOW_NOT_FOUND', message: 'That workflow was not found in your account.' });
}

const asText = (v: unknown) => (typeof v === 'string' ? v : '');

/** The stored id of a workflow this user owns (client ids and server ids both work), or null. */
async function ownedWorkflowId(sql: Sql, userId: string, clientId: unknown): Promise<string | null> {
  if (typeof clientId !== 'string' || !clientId || clientId.length > DATA_LIMITS.id) return null;
  const rows = (await sql`
    SELECT id FROM "BranchingTree" WHERE id IN (${clientId}, ${serverRowId(userId, clientId)}) AND user_id = ${userId} LIMIT 1
  `) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

/** Reads nodes/edges arrays from a body, with the same size limit as saving. */
function readGraphBody(body: Record<string, unknown>): { nodes: any[]; edges: any[] } | { error: string } {
  const nodes = body.nodes ?? [];
  const edges = body.edges ?? [];
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return { error: 'nodes and edges must be arrays' };
  if (JSON.stringify(nodes).length + JSON.stringify(edges).length > DATA_LIMITS.workflowJsonChars) {
    return { error: `Workflow is too large (nodes and edges must be at most ${DATA_LIMITS.workflowJsonChars} characters)` };
  }
  return { nodes, edges };
}

// ---- Version history (also called by the original save) -----------------------------------------------------

/**
 * Saves the workflow's current state as a new version, unless it is the same as the newest version, then keeps
 * only the newest 20. Never throws: version history must never make a save fail.
 */
export async function snapshotVersion(sql: Sql, userId: string, workflowId: string, title: string, nodesJson: string, edgesJson: string): Promise<boolean> {
  try {
    const nodeCount = graphStats(readJsonArray(nodesJson), 'ultimate').nodeCount;
    await sql`
      WITH latest AS (
        SELECT COALESCE(MAX(version), 0) AS v FROM "WorkflowVersion" WHERE workflow_id = ${workflowId}
      )
      INSERT INTO "WorkflowVersion" (id, workflow_id, user_id, version, title, nodes, edges, node_count, created_at)
      SELECT ${newRowId()}, ${workflowId}, ${userId}, latest.v + 1, ${title}, ${nodesJson}, ${edgesJson}, ${nodeCount}, NOW()
      FROM latest
      WHERE NOT EXISTS (
        SELECT 1 FROM "WorkflowVersion" w
        WHERE w.workflow_id = ${workflowId} AND w.version = latest.v AND w.title = ${title} AND w.nodes = ${nodesJson} AND w.edges = ${edgesJson}
      )
      ON CONFLICT DO NOTHING
    `;
    await sql`
      DELETE FROM "WorkflowVersion"
      WHERE workflow_id = ${workflowId} AND user_id = ${userId}
        AND version <= (SELECT MAX(version) - ${VERSIONS_KEPT}::int FROM "WorkflowVersion" WHERE workflow_id = ${workflowId})
    `;
    return true;
  } catch (err) {
    if (!isFeatureMissing(err)) console.error('[Workflows] version snapshot failed:', (err as Error)?.message || err);
    return false;
  }
}

// ---- Public: GET /api/workflows/shared?token= --------------------------------------------------------------

/** Read-only copy of a shared workflow. No sign-in. Unknown, malformed and revoked tokens all answer the same 404. */
export async function handleShared(req: VercelRequest, res: VercelResponse, sql: Sql) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await enforceRateLimit(req, res, 'workflowPublic', getClientIp(req)))) return;
  res.setHeader('Cache-Control', 'no-store');
  const notFound = () => res.status(404).json({ error: 'Shared workflow not found', code: 'SHARE_NOT_FOUND', message: 'This link does not work. It may have been turned off by its owner.' });
  const token = asText(req.query?.token);
  if (!SHARE_TOKEN_RE.test(token)) return notFound();
  try {
    // db/PAGING.md shared_open: counts one view and reads the workflow (owner must match) in one statement
    const rows = (await sql`
      WITH opened AS (
        UPDATE "WorkflowShare" SET view_count = view_count + 1
        WHERE token = ${token} AND revoked_at IS NULL
        RETURNING workflow_id, user_id, created_at
      )
      SELECT b.title, b.nodes, b.edges, opened.created_at AS shared_at
      FROM opened
      JOIN "BranchingTree" b ON b.id = opened.workflow_id AND b.user_id = opened.user_id
    `) as Array<{ title: string; nodes: unknown; edges: unknown; shared_at: unknown }>;
    const row = rows[0];
    if (!row) return notFound();
    const copy = stripForShare(readJsonArray(row.nodes), readJsonArray(row.edges));
    return res.status(200).json({ title: row.title, nodes: copy.nodes, edges: copy.edges, hasCode: copy.hasCode, sharedAt: row.shared_at });
  } catch (err) {
    { const mapped = sendMappedDbError(res, err); if (mapped) return mapped; }
    return sendDbFailure(res, '[Workflows] shared error:', 'Failed to open shared workflow', err);
  }
}

// ---- Signed-in actions ---------------------------------------------------------------------------------------

export async function handleWorkflowAction(action: string, req: VercelRequest, res: VercelResponse, user: AuthenticatedUser, sql: Sql) {
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const tier = tierOf(user);
  const method = req.method;
  const wrongMethod = () => res.status(405).json({ error: 'Method not allowed' });

  switch (action) {
    case 'validate': {
      if (method !== 'POST') return wrongMethod();
      const graph = readGraphBody(body);
      if ('error' in graph) return res.status(400).json({ error: graph.error });
      return res.status(200).json(checkGraph(graph.nodes, graph.edges, tier));
    }

    case 'generate':
      if (method !== 'POST') return wrongMethod();
      return handleGenerate(req, res, user, body, tier);

    case 'explain':
      if (method !== 'POST') return wrongMethod();
      return handleExplain(req, res, user, body);

    case 'versions': {
      if (method !== 'GET') return wrongMethod();
      try {
        const id = await ownedWorkflowId(sql, user.id, req.query?.id);
        if (!id) return sendWorkflowNotFound(res);
        const rows = (await sql`
          SELECT version, title, node_count, created_at FROM "WorkflowVersion"
          WHERE workflow_id = ${id} AND user_id = ${user.id}
          ORDER BY version DESC LIMIT ${VERSIONS_KEPT}::int
        `) as Array<{ version: number; title: string; node_count: number; created_at: unknown }>;
        return res.status(200).json({
          id,
          versions: rows.map((r) => ({ version: Number(r.version), title: r.title, nodeCount: Number(r.node_count) || 0, createdAt: r.created_at })),
        });
      } catch (err) {
        { const mapped = sendMappedDbError(res, err); if (mapped) return mapped; }
        return sendDbFailure(res, '[Workflows] versions error:', 'Failed to list versions', err);
      }
    }

    case 'restore': {
      if (method !== 'POST') return wrongMethod();
      const version = Number(body.version);
      if (!Number.isInteger(version) || version < 1) return res.status(400).json({ error: 'version must be a positive whole number' });
      try {
        const id = await ownedWorkflowId(sql, user.id, body.id);
        if (!id) return sendWorkflowNotFound(res);
        const [target] = (await sql`
          SELECT title, nodes, edges FROM "WorkflowVersion" WHERE workflow_id = ${id} AND user_id = ${user.id} AND version = ${version} LIMIT 1
        `) as Array<{ title: string; nodes: string; edges: string }>;
        if (!target) return res.status(404).json({ error: 'Version not found', code: 'VERSION_NOT_FOUND', message: 'That version is no longer kept.' });
        const [current] = (await sql`SELECT title, nodes, edges FROM "BranchingTree" WHERE id = ${id} AND user_id = ${user.id} LIMIT 1`) as Array<{ title: string; nodes: string; edges: string }>;
        // Keep what is there now, so a restore can itself be undone
        if (current) await snapshotVersion(sql, user.id, id, current.title, current.nodes, current.edges);
        await sql`
          UPDATE "BranchingTree" SET title = ${target.title}, nodes = ${target.nodes}, edges = ${target.edges}, updated_at = NOW()
          WHERE id = ${id} AND user_id = ${user.id}
        `;
        await snapshotVersion(sql, user.id, id, target.title, target.nodes, target.edges);
        return res.status(200).json({ id, title: target.title, nodes: readJsonArray(target.nodes), edges: readJsonArray(target.edges), restoredVersion: version });
      } catch (err) {
        { const mapped = sendMappedDbError(res, err); if (mapped) return mapped; }
        return sendDbFailure(res, '[Workflows] restore error:', 'Failed to restore version', err);
      }
    }

    case 'share': {
      if (method !== 'POST') return wrongMethod();
      if (!(await enforceRateLimit(req, res, 'workflowShare', user.id))) return;
      try {
        const id = await ownedWorkflowId(sql, user.id, body.id);
        if (!id) return sendWorkflowNotFound(res);
        if (body.revoke === true) {
          const rows = (await sql`
            UPDATE "WorkflowShare" SET revoked_at = NOW()
            WHERE workflow_id = ${id} AND user_id = ${user.id} AND revoked_at IS NULL
            RETURNING token
          `) as Array<{ token: string }>;
          return res.status(200).json({ id, revoked: rows.length > 0, success: true });
        }
        // db/PAGING.md share_create: the new link, or the one already active (one per workflow). No row only when
        // two clicks land at the very same instant: run it once more.
        const createOrGet = async () =>
          ((await sql`
            WITH created AS (
              INSERT INTO "WorkflowShare"(token, workflow_id, user_id)
              VALUES (${newShareToken()}, ${id}, ${user.id})
              ON CONFLICT (workflow_id) WHERE revoked_at IS NULL DO NOTHING
              RETURNING token, created_at
            )
            SELECT token, created_at FROM created
            UNION ALL
            SELECT token, created_at FROM "WorkflowShare"
            WHERE workflow_id = ${id} AND user_id = ${user.id} AND revoked_at IS NULL
            LIMIT 1
          `) as Array<{ token: string }>)[0]?.token;
        const token = (await createOrGet()) ?? (await createOrGet());
        if (!token) return res.status(409).json({ error: 'Could not create a share link', code: 'SHARE_CONFLICT', message: 'Please try again.' });
        // The page opens shared links at /app/branching?shared=<token> (CHG-0142); the token is URL-safe base64
        return res.status(200).json({ id, token, url: `/app/branching?shared=${token}` });
      } catch (err) {
        { const mapped = sendMappedDbError(res, err); if (mapped) return mapped; }
        return sendDbFailure(res, '[Workflows] share error:', 'Failed to share workflow', err);
      }
    }

    case 'runs': {
      if (method !== 'POST') return wrongMethod();
      const status = asText(body.status);
      if (!['success', 'partial', 'error', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'status must be success, partial, error or cancelled' });
      }
      const count = (v: unknown, max: number) => {
        const n = Math.floor(Number(v));
        return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
      };
      const known = new Set<string>(KNOWN_NODE_TYPES);
      const nodeTypes = Array.isArray(body.nodeTypes)
        ? [...new Set((body.nodeTypes as unknown[]).filter((t): t is string => typeof t === 'string' && known.has(t)))].slice(0, 30)
        : [];
      try {
        const workflowId = body.workflowId ? await ownedWorkflowId(sql, user.id, body.workflowId) : null;
        const id = newRowId();
        await sql`
          INSERT INTO "WorkflowRun" (id, user_id, workflow_id, status, node_count, ai_calls, duration_ms, error_count, node_types, created_at)
          VALUES (${id}, ${user.id}, ${workflowId}, ${status}, ${count(body.nodeCount, 10_000)}, ${count(body.aiCalls, 10_000)},
                  ${count(body.durationMs, 3_600_000)}, ${count(body.errorCount, 10_000)}, ${nodeTypes}::text[], NOW())
        `;
        // Run history is kept 90 days; trimmed here so the daily cleanup job does not need to change
        await sql`DELETE FROM "WorkflowRun" WHERE user_id = ${user.id} AND created_at < NOW() - make_interval(days => ${RUN_HISTORY_DAYS}::int)`;
        return res.status(200).json({ id, success: true });
      } catch (err) {
        { const mapped = sendMappedDbError(res, err); if (mapped) return mapped; }
        return sendDbFailure(res, '[Workflows] runs error:', 'Failed to save run', err);
      }
    }

    case 'stats': {
      if (method !== 'GET') return wrongMethod();
      try {
        // db/PAGING.md run_stats (tested there): one statement; days and streak in India time; last 90 days
        const [row] = (await sql`
          WITH runs AS (
            SELECT status, created_at, node_types, (created_at AT TIME ZONE 'Asia/Kolkata')::date AS day
            FROM "WorkflowRun"
            WHERE user_id = ${user.id}
          ),
          today AS (
            SELECT (COALESCE(${null}::timestamptz, now()) AT TIME ZONE 'Asia/Kolkata')::date AS d
          ),
          islands AS (
            SELECT day, day - (row_number() OVER (ORDER BY day))::int AS grp
            FROM (SELECT DISTINCT day FROM runs) d
          ),
          last_island AS (
            SELECT max(day) AS last_day, count(*)::int AS len
            FROM islands
            GROUP BY grp
            ORDER BY max(day) DESC
            LIMIT 1
          )
          SELECT
            (SELECT count(*)::int FROM runs) AS total_runs,
            (SELECT count(*)::int FROM runs WHERE status = 'success') AS success_runs,
            (SELECT count(*)::int FROM runs, today WHERE runs.day = today.d) AS runs_today,
            COALESCE((SELECT len FROM last_island, today WHERE last_island.last_day >= today.d - 1), 0) AS streak_days,
            (SELECT COALESCE(array_agg(DISTINCT t ORDER BY t), '{}'::text[]) FROM runs, unnest(node_types) AS t) AS node_types_used,
            (SELECT min(created_at) FROM runs) AS first_run_at
        `) as Array<{ total_runs: number; success_runs: number; runs_today: number; streak_days: number; node_types_used: string[] | null; first_run_at: unknown }>;
        return res.status(200).json({
          totalRuns: Number(row?.total_runs) || 0,
          successRuns: Number(row?.success_runs) || 0,
          runsToday: Number(row?.runs_today) || 0,
          streakDays: Number(row?.streak_days) || 0,
          nodeTypesUsed: Array.isArray(row?.node_types_used) ? row!.node_types_used.filter(Boolean) : [],
          firstRunAt: row?.first_run_at ?? null,
        });
      } catch (err) {
        { const mapped = sendMappedDbError(res, err); if (mapped) return mapped; }
        return sendDbFailure(res, '[Workflows] stats error:', 'Failed to load stats', err);
      }
    }

    default:
      return res.status(400).json({ error: 'Unknown action', code: 'UNKNOWN_ACTION' });
  }
}

// ---- AI actions ----------------------------------------------------------------------------------------------

async function handleGenerate(req: VercelRequest, res: VercelResponse, user: AuthenticatedUser, body: Record<string, unknown>, tier: ReturnType<typeof tierOf>) {
  const startTime = Date.now();
  const requestId = getRequestId(req);
  res.setHeader('X-Request-Id', requestId);
  if (!(await enforceRateLimit(req, res, 'workflowAi', user.id, isPaidUser(user)))) return;
  const description = asText(body.description).trim();
  if (!description) return res.status(400).json({ error: 'description is required', message: 'Describe what you want the workflow to do.' });
  if (description.length > WORKFLOW_AI_LIMITS.description) {
    return res.status(400).json({ error: `description must be at most ${WORKFLOW_AI_LIMITS.description} characters` });
  }
  const ip = getClientIp(req);
  const quota = await reserveQuota({ bucket: 'assist', endpoint: 'workflows/generate', user, ip });
  if (!quota.allowed) return sendQuotaDenied(res, quota);
  checkPromptInjection(description, user.id, ip);

  const limit = PLAN_NODE_LIMIT[tier];
  let answered = false;
  try {
    const { text, model } = await executeAiCompletion(
      `Design a workflow for this request:\n"""${description}"""`,
      buildGenerateSystemPrompt(Number.isFinite(limit) ? limit : null),
      user.id,
      undefined,
      0.4,
      { maxOutputTokens: 3_000, signal: clientAbortSignal(res) }
    );
    answered = true;
    const proposal = parseAiJsonObject(text);
    const workflow = proposal ? buildGeneratedWorkflow(proposal, tier) : null;
    logAiRequest({ route: 'workflows/generate', requestId, outcome: workflow ? 'success' : 'error', latencyMs: Date.now() - startTime, model });
    if (!workflow) {
      return res.status(502).json({
        error: 'Could not build a workflow',
        code: 'GENERATE_UNUSABLE',
        message: "The AI's design could not be used. Try describing it in a different way.",
        requestId,
      });
    }
    return res.status(200).json({ ...workflow, planNodeLimit: nodeLimitForJson(tier), requestId });
  } catch (err) {
    const outcome = failureOutcome(err);
    if (outcome === 'error' && !answered) await releaseQuota(quota);
    logAiRequest({ route: 'workflows/generate', requestId, outcome, latencyMs: Date.now() - startTime, code: (err as { code?: string })?.code });
    return sendAiFailure(res, err, 'Workflow generation failed', requestId);
  }
}

async function handleExplain(req: VercelRequest, res: VercelResponse, user: AuthenticatedUser, body: Record<string, unknown>) {
  const startTime = Date.now();
  const requestId = getRequestId(req);
  res.setHeader('X-Request-Id', requestId);
  if (!(await enforceRateLimit(req, res, 'workflowAi', user.id, isPaidUser(user)))) return;
  const graph = readGraphBody(body);
  if ('error' in graph) return res.status(400).json({ error: graph.error });
  const { text: described, nodeIds } = describeGraphForAi(graph.nodes, graph.edges);
  if (nodeIds.size === 0) return res.status(400).json({ error: 'The workflow is empty', message: 'Add a step first, then ask for an explanation.' });
  const ip = getClientIp(req);
  const quota = await reserveQuota({ bucket: 'assist', endpoint: 'workflows/explain', user, ip });
  if (!quota.allowed) return sendQuotaDenied(res, quota);
  checkPromptInjection(described, user.id, ip);

  let answered = false;
  try {
    const { text, model } = await executeAiCompletion(
      `Explain this workflow:\n${described}`,
      EXPLAIN_SYSTEM_PROMPT,
      user.id,
      undefined,
      0.3,
      { maxOutputTokens: 2_000, signal: clientAbortSignal(res) }
    );
    answered = true;
    const parsed = parseAiJsonObject(text);
    const explanation = parsed ? readExplanation(parsed, nodeIds) : null;
    logAiRequest({ route: 'workflows/explain', requestId, outcome: explanation ? 'success' : 'error', latencyMs: Date.now() - startTime, model });
    if (!explanation) {
      // Still useful: the answer as plain text
      return res.status(200).json({ summary: text.slice(0, 1_200), steps: [], requestId });
    }
    return res.status(200).json({ ...explanation, requestId });
  } catch (err) {
    const outcome = failureOutcome(err);
    if (outcome === 'error' && !answered) await releaseQuota(quota);
    logAiRequest({ route: 'workflows/explain', requestId, outcome, latencyMs: Date.now() - startTime, code: (err as { code?: string })?.code });
    return sendAiFailure(res, err, 'Workflow explanation failed', requestId);
  }
}
