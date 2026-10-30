import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';
import { enforceRateLimit } from '../_lib/rateLimiter.js';
import { DATA_LIMITS, sendDbFailure, firstFieldError, clampCount } from '../_lib/dataHttp.js';

/** purge_old_logs() deletes at most one batch per table per call, so it is called until nothing is left. */
const MAX_PURGE_ROUNDS = 20;
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
      const rows = (await sql`
        SELECT * FROM "Trace" 
        WHERE user_id = ${user.id} 
        ORDER BY created_at DESC 
        LIMIT 100
      `) as any[];

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

      // Compute aggregated metrics for this specific user
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
      const avgLatency = totalInferences > 0 ? Math.round(totalLatency / totalInferences) : 0;
      const p99Index = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.99));
      const p99Latency = latencies.length > 0 ? latencies[p99Index] : 0;
      const reliability = totalInferences > 0 ? Number(((okCount / totalInferences) * 100).toFixed(1)) : 100;

      return res.status(200).json({
        totalInferences,
        totalTokens,
        avgLatency,
        p99Latency,
        reliability,
        activeModelsCount: modelSet.size,
        activeModels: Array.from(modelSet),
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
