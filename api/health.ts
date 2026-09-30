import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

  return res.status(200).json({
    status: 'ok',
    service: 'Bedrock Production Backend',
    timestamp: new Date().toISOString(),
    database: {
      provider: 'Neon Lakebase PostgreSQL',
      status: dbStatus,
      latencyMs: dbLatency,
    },
    aiProviders: {
      groqConfigured: Boolean(process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY),
      openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY),
    },
    version: '2.0.1-hardened',
  });
}
