import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { getDb } from '../_lib/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
        status: r.status || 'OK',
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
      console.error('[Traces] GET error:', err);
      return res.status(500).json({ error: 'Failed to fetch telemetry traces', message: err.message });
    }
  }

  // POST /api/traces: Log new execution trace
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const id = body.id || `TRC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      const nodeOrigin = body.node || body.nodeOrigin || 'PROMPT_GEN';
      const modelTarget = body.model || body.modelTarget || 'gemini-2.5-flash';
      const tokensUsed = parseInt(body.tokens || body.tokensUsed || '0', 10);
      const latencyMs = parseInt(body.latency || body.latencyMs || '0', 10);
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
      console.error('[Traces] POST error:', err);
      return res.status(500).json({ error: 'Failed to record execution trace', message: err.message });
    }
  }

  // DELETE /api/traces: Clear traces for user
  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM "Trace" WHERE user_id = ${user.id}`;
      return res.status(200).json({ success: true, message: 'Traces cleared' });
    } catch (err: any) {
      console.error('[Traces] DELETE error:', err);
      return res.status(500).json({ error: 'Failed to clear traces', message: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
