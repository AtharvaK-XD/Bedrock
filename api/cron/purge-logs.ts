import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../_lib/db.js';
import { sendDbFailure } from '../_lib/dataHttp.js';

/** purge_old_logs() deletes at most one batch per table per call, so it is called until nothing is left. */
const MAX_ROUNDS = 20;
/** Stay well inside the 60 s function limit (vercel.json maxDuration). */
const TIME_BUDGET_MS = 45_000;

const PG_UNDEFINED_FUNCTION = '42883';

type PurgeCounts = { quota_events: number; security_logs: number; traces: number; idempotency_keys: number };

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET env var is set.
 * Without that env var nobody can run this endpoint.
 */
function isAuthorized(req: VercelRequest): boolean {
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

/**
 * Daily retention job (scheduled in vercel.json "crons"): calls purge_old_logs() from migration 0004
 * until every table reports 0 deleted rows, the round cap, or the time budget is reached.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startedAt = Date.now();
  const deleted: PurgeCounts = { quota_events: 0, security_logs: 0, traces: 0, idempotency_keys: 0 };
  let rounds = 0;
  let finished = false;

  try {
    const sql = getDb();
    while (rounds < MAX_ROUNDS && Date.now() - startedAt < TIME_BUDGET_MS) {
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
