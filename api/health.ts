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
}

let cached: { at: number; body: HealthBody } | null = null;

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
    return res.status(200).json(cached.body);
  }

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
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database: { status: dbStatus },
    redis: { status: redisStatus },
  };
  cached = { at: Date.now(), body };
  return res.status(200).json(body);
}
