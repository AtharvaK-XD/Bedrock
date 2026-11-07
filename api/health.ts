import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/db.js';
import { getRedisClient, enforceRateLimit } from './_lib/rateLimiter.js';

/** A result is reused for this long per server instance, so a burst of checks costs one DB + Redis probe. */
const HEALTH_CACHE_MS = 10_000;

interface HealthBody {
  status: 'ok' | 'degraded';
  timestamp: string;
  database: { status: 'connected' | 'error' };
  redis: { status: 'connected' | 'error' | 'unconfigured' };
  /** First 7 characters of the deployed commit (Vercel sets it): tells you which version is live. Absent locally. */
  version?: string;
}

let cached: { at: number; body: HealthBody } | null = null;

/**
 * 503 when degraded: uptime monitors (UptimeRobot, Vercel checks) look at the HTTP status, not the body, so a 200
 * with "degraded" inside never raised an alert when the database was down.
 */
const httpStatusFor = (body: HealthBody) => (body.status === 'ok' ? 200 : 503);

/**
 * Public liveness check. It reports only whether the database and Redis respond: no error text,
 * provider configuration or circuit-breaker state, since anyone can call it.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit health checks to prevent denial of service
  const allowed = await enforceRateLimit(req, res, 'health');
  if (!allowed) return;

  if (cached && Date.now() - cached.at < HEALTH_CACHE_MS) {
    return res.status(httpStatusFor(cached.body)).json(cached.body);
  }

  const commit = (process.env.VERCEL_GIT_COMMIT_SHA || '').replace(/[^0-9a-f]/gi, '').slice(0, 7);

  let dbStatus: HealthBody['database']['status'] = 'error';
  try {
    const sql = getDb();
    const result = (await sql`SELECT 1 as alive`) as any[];
    if (Array.isArray(result) && result.length > 0) {
      dbStatus = 'connected';
    }
  } catch (err: any) {
    console.error('[Health] Database check failed:', err);
  }

  let redisStatus: HealthBody['redis']['status'] = 'unconfigured';
  const redis = getRedisClient();
  if (redis) {
    redisStatus = 'error';
    try {
      const pong = await redis.ping();
      if (pong) {
        redisStatus = 'connected';
      }
    } catch (rErr: any) {
      console.error('[Health] Redis check failed:', rErr);
    }
  }

  const body: HealthBody = {
    // A configured Redis that fails stops every API route (rateLimiter.ts refuses instead of guessing), so it counts
    // as degraded too. Redis left out on purpose (local development) does not.
    status: dbStatus === 'connected' && redisStatus !== 'error' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database: { status: dbStatus },
    redis: { status: redisStatus },
    ...(commit ? { version: commit } : {}),
  };
  cached = { at: Date.now(), body };
  return res.status(httpStatusFor(body)).json(body);
}
