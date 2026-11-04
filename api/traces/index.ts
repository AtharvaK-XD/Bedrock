import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';
import { enforceRateLimit } from '../_lib/rateLimiter.js';
import { DATA_LIMITS, sendDbFailure, firstFieldError, clampCount, isDailyTraceLimit } from '../_lib/dataHttp.js';

/**
 * purge_old_logs() deletes at most one batch (5,000 rows) per table per call, so it is called until nothing
 * is left or the time budget runs out. The round cap is only a safety stop: 20 rounds cleared just 100,000
 * rows a day, so a log flood took days to clear (CHG-0015 measured ~73 ms per round).
 */
const MAX_PURGE_ROUNDS = 500;
/** Stay well inside the 60 s function limit (vercel.json maxDuration). */
const PURGE_TIME_BUDGET_MS = 45_000;
const PG_UNDEFINED_FUNCTION = '42883';

type PurgeCounts = { quota_events: number; security_logs: number; traces: number; idempotency_keys: number };

function isPurgeAuthorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[Cron] CRON_SECRET is not configured; refusing purge-logs');
    return false;
  }
  const header = req.headers.authorization;
  if (typeof header !== 'string') return false;
  const given = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

export async function handlePurgeLogs(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isPurgeAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startedAt = Date.now();
  const deleted: PurgeCounts = { quota_events: 0, security_logs: 0, traces: 0, idempotency_keys: 0 };
  let rounds = 0;
  let finished = false;

  try {
    const sql = getDb();
    while (rounds < MAX_PURGE_ROUNDS && Date.now() - startedAt < PURGE_TIME_BUDGET_MS) {
      const [row] = (await sql`SELECT * FROM purge_old_logs()`) as Array<Partial<PurgeCounts>>;
      rounds++;
      let roundTotal = 0;
      for (const key of Object.keys(deleted) as Array<keyof PurgeCounts>) {
        const n = Number(row?.[key]) || 0;
        deleted[key] += n;
        roundTotal += n;
      }
      if (roundTotal === 0) {
        finished = true;
        break;
      }
    }
  } catch (err: any) {
    if (err?.code === PG_UNDEFINED_FUNCTION) {
      console.error('[Cron] purge_old_logs() not found: apply migration 0004 first');
      return res.status(503).json({ error: 'Log cleanup is not available yet', code: 'MIGRATION_NOT_APPLIED' });
    }
    return sendDbFailure(res, '[Cron] purge-logs error:', 'Log cleanup failed', err);
  }

  console.log(JSON.stringify({ type: 'log_purge', rounds, finished, latencyMs: Date.now() - startedAt, ...deleted }));
  return res.status(200).json({ success: true, rounds, finished, deleted });
}

/**
 * Server-side AI routes store 'success' / 'error' (recordExecutionTrace), while POST /api/traces and
 * the dashboard use 'OK' / 'ERR'. Map to the dashboard's values so successful AI runs count as healthy.
 */
function normalizeTraceStatus(status: unknown): string {
  if (status === 'success') return 'OK';
  if (status === 'error') return 'ERR';
  return typeof status === 'string' && status ? status : 'OK';
}

type TraceTotals = {
  totalInferences: number;
  totalTokens: number;
  avgLatency: number;
  p99Latency: number;
  reliability: number;
  activeModels: string[];
};

// After a "not applied" answer, skip trace_totals() for this long before checking again
const TRACE_TOTALS_RECHECK_MS = 5 * 60 * 1000;
let traceTotalsMissingUntil = 0;

function mapTraceTotals(row: any): TraceTotals | null {
  if (!row) return null;
  return {
    // Neon returns bigint / numeric columns as strings
    totalInferences: Number(row.total_inferences) || 0,
    totalTokens: Number(row.total_tokens) || 0,
    avgLatency: Number(row.avg_latency) || 0,
    p99Latency: Number(row.p99_latency) || 0,
    reliability: row.reliability === null || row.reliability === undefined ? 100 : Number(row.reliability),
    activeModels: Array.isArray(row.active_models) ? row.active_models.filter((m: unknown) => typeof m === 'string') : [],
  };
}

/**
 * Totals over ALL of the user's traces, computed in the database: through trace_totals() (migration 0010), or the
 * same aggregate written inline while that migration is not applied. Returns null only when the database fails, so
 * the caller can still show the dashboard with totals over the rows it already loaded.
 */
async function readTraceTotals(sql: ReturnType<typeof getDb>, userId: string): Promise<TraceTotals | null> {
  try {
    if (Date.now() >= traceTotalsMissingUntil) {
      try {
        const [row] = (await sql`SELECT * FROM trace_totals(${userId})`) as any[];
        return mapTraceTotals(row);
      } catch (err: any) {
        if (err?.code !== PG_UNDEFINED_FUNCTION) throw err;
        traceTotalsMissingUntil = Date.now() + TRACE_TOTALS_RECHECK_MS;
        console.warn('[Traces] trace_totals() not found (migration 0010 not applied); using the inline totals query');
      }
    }
    const [row] = (await sql`
      SELECT
        count(*)::int AS total_inferences,
        coalesce(sum(tokens_used), 0)::bigint AS total_tokens,
        coalesce(round(avg(latency_ms)), 0)::int AS avg_latency,
        coalesce(percentile_disc(0.99) WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p99_latency,
        CASE WHEN count(*) = 0 THEN 100::numeric
             ELSE round(100.0 * count(*) FILTER (WHERE status IN ('OK', 'success')) / count(*), 1) END AS reliability,
        coalesce(array_agg(DISTINCT model_target) FILTER (WHERE model_target IS NOT NULL), ARRAY[]::text[]) AS active_models
      FROM "Trace" WHERE user_id = ${userId}
    `) as any[];
    return mapTraceTotals(row);
  } catch (err: any) {
    console.error('[Traces] totals query failed; totals use the listed rows:', err?.code || err?.message || err);
    return null;
  }
}

/** Last resort when the database cannot compute totals: only over the rows passed in (the last 100). */
function totalsFromRows(traces: Array<{ tokens: number; latency: number; status: string; model: string }>): TraceTotals {
  const totalInferences = traces.length;
  let totalTokens = 0;
  let totalLatency = 0;
  let okCount = 0;
  const modelSet = new Set<string>();
  const latencies: number[] = [];

  for (const t of traces) {
    totalTokens += t.tokens;
    totalLatency += t.latency;
    latencies.push(t.latency);
    if (t.status === 'OK') okCount++;
    if (t.model) modelSet.add(t.model);
  }

  latencies.sort((a, b) => a - b);
  const p99Index = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.99));
  return {
    totalInferences,
    totalTokens,
    avgLatency: totalInferences > 0 ? Math.round(totalLatency / totalInferences) : 0,
    p99Latency: latencies.length > 0 ? latencies[p99Index] : 0,
    reliability: totalInferences > 0 ? Number(((okCount / totalInferences) * 100).toFixed(1)) : 100,
    activeModels: Array.from(modelSet),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle log purge action (routed via /api/cron/purge-logs to preserve 12-function Hobby cap)
  if (req.query?.action === 'purge-logs' || req.query?.purge === '1') {
    return handlePurgeLogs(req, res);
  }

  // Enforce distributed Upstash Redis rate limiting
  const allowed = await enforceRateLimit(req, res, 'general');
  if (!allowed) return;

  const user = await authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: valid session token required.' });
  }

  const sql = getDb();

  // GET /api/traces: Fetch traces and compute telemetry summary
  if (req.method === 'GET') {
    try {
      const [rows, sqlTotals] = await Promise.all([
        sql`
          SELECT * FROM "Trace"
          WHERE user_id = ${user.id}
          ORDER BY created_at DESC
          LIMIT 100
        ` as Promise<any[]>,
        readTraceTotals(sql, user.id),
      ]);

      const traces = rows.map((r: any) => ({
        id: r.id,
        time: new Date(r.created_at).toLocaleTimeString('en-US', { hour12: false }),
        fullDate: r.created_at,
        node: r.node_origin || 'PROMPT_GEN',
        model: r.model_target || 'gemini-2.5-flash',
        tokens: Number(r.tokens_used) || 0,
        latency: Number(r.latency_ms) || 0,
        status: normalizeTraceStatus(r.status),
      }));

      // Totals over all of this user's traces, computed in SQL; over the listed rows only if that query failed
      const totals = sqlTotals ?? totalsFromRows(traces);

      return res.status(200).json({
        ...totals,
        activeModelsCount: totals.activeModels.length,
        traces,
      });
    } catch (err: any) {
      return sendDbFailure(res, '[Traces] GET error:', 'Failed to fetch telemetry traces', err);
    }
  }

  // POST /api/traces: Log new execution trace
  if (req.method === 'POST') {
    const body = req.body || {};
    const fieldError = firstFieldError([
      [body.id, DATA_LIMITS.id, 'id'],
      [body.node || body.nodeOrigin, DATA_LIMITS.traceLabel, 'node'],
      [body.model || body.modelTarget, DATA_LIMITS.traceLabel, 'model'],
    ]);
    if (fieldError) {
      return res.status(400).json({ error: fieldError });
    }

    try {
      const id = body.id || `TRC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      const nodeOrigin = body.node || body.nodeOrigin || 'PROMPT_GEN';
      const modelTarget = body.model || body.modelTarget || 'gemini-2.5-flash';
      // Client-reported numbers cannot be verified; keep them within plausible bounds
      const tokensUsed = clampCount(body.tokens || body.tokensUsed, DATA_LIMITS.traceTokensMax);
      const latencyMs = clampCount(body.latency || body.latencyMs, DATA_LIMITS.traceLatencyMsMax);
      const status = body.status === 'ERR' || body.status === 'ERR_TIMEOUT' ? 'ERR' : 'OK';

      await sql`
        INSERT INTO "Trace" (
          id, user_id, node_origin, model_target, tokens_used, latency_ms, status, created_at
        ) VALUES (
          ${id}, ${user.id}, ${nodeOrigin}, ${modelTarget}, ${tokensUsed}, ${latencyMs}, ${status}, NOW()
        )
      `;

      return res.status(200).json({ success: true, id });
    } catch (err: any) {
      // Migration 0015: an account may write 5,000 usage records per 24 hours. Expected only for abuse.
      if (isDailyTraceLimit(err)) {
        res.setHeader('Retry-After', '3600');
        return res.status(429).json({
          error: 'Daily usage-record limit reached',
          code: 'DAILY_TRACE_LIMIT',
          message: 'Too many usage records were saved today. Please try again later.',
        });
      }
      return sendDbFailure(res, '[Traces] POST error:', 'Failed to record execution trace', err);
    }
  }

  // DELETE /api/traces: Clear traces for user
  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM "Trace" WHERE user_id = ${user.id}`;
      return res.status(200).json({ success: true, message: 'Traces cleared' });
    } catch (err: any) {
      return sendDbFailure(res, '[Traces] DELETE error:', 'Failed to clear traces', err);
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
