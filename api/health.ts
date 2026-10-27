import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/db.js';
import { getRedisClient, enforceRateLimit } from './_lib/rateLimiter.js';
import { getLoadBalancerMetrics } from './_lib/loadBalancer.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit health checks to prevent denial of service
  await enforceRateLimit(req, res, 'health');

  const startTime = Date.now();
  let dbStatus = 'disconnected';
  let dbLatency = -1;

  try {
    const sql = getDb();
    const result = (await sql`SELECT 1 as alive`) as any[];
    if (Array.isArray(result) && result.length > 0) {
      dbStatus = 'connected';
      dbLatency = Date.now() - startTime;
    }
  } catch (err: any) {
    dbStatus = `error: ${err.message}`;
  }

  // Upstash Redis health check
  let redisStatus = 'disconnected';
  let redisLatency = -1;
  const redis = getRedisClient();

  if (redis) {
    const redisStart = Date.now();
    try {
      const pong = await redis.ping();
      if (pong) {
        redisStatus = 'connected';
        redisLatency = Date.now() - redisStart;
      }
    } catch (rErr: any) {
      redisStatus = `error: ${rErr.message}`;
    }
  } else {
    redisStatus = 'unconfigured (in-memory fallback active)';
  }

  const loadBalancer = await getLoadBalancerMetrics();

  return res.status(200).json({
    status: 'ok',
    service: 'Bedrock Production Backend',
    timestamp: new Date().toISOString(),
    database: {
      provider: 'Neon Lakebase PostgreSQL',
      status: dbStatus,
      latencyMs: dbLatency,
    },
    redis: {
      provider: 'Upstash Distributed Redis',
      status: redisStatus,
      latencyMs: redisLatency,
    },
    rateLimiting: {
      engine: redis ? 'Upstash Edge Sliding-Window' : 'In-Memory Sliding-Window Fallback',
      active: true,
      standardHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
    },
    loadBalancer,
    aiProviders: {
      groqConfigured: Boolean(process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY),
      openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY),
    },
    version: '2.1.0-upstash-k6',
  });
}
