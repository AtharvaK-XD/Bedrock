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

const MAX_REPORT_BYTES = 16 * 1024;
const MAX_REPORTS_PER_REQUEST = 5;

/** A URL reduced to origin + path: query strings and fragments can hold sign-in tokens (Clerk handshake), never logged. */
function safeUrl(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw.slice(0, 40); // "inline", "eval", "self", "data", ...
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? `${u.origin}${u.pathname}`.slice(0, 200) : `${u.protocol}`;
  } catch {
    return 'unparsable';
  }
}

function readReportBody(req: VercelRequest): unknown {
  let body: unknown;
  try {
    body = req.body; // @vercel/node parses lazily and throws on invalid JSON
  } catch {
    return null;
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (body.length > MAX_REPORT_BYTES) return null;
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body && typeof body === 'object' && JSON.stringify(body).length <= MAX_REPORT_BYTES ? body : null;
}

/**
 * Content-Security-Policy violation reports from visitors' browsers (legacy "report-uri" and Reporting API "report-to").
 * Written to the server log only (Vercel > Logs, search "[CSP]"): no database write, so a flood of fake reports costs
 * nothing but log lines, and it is rate limited like the health check. Only the directive, the blocked origin/path and
 * the page path are kept.
 */
async function handleCspReport(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await enforceRateLimit(req, res, 'health'))) return;

  const parsed = readReportBody(req);
  const items: any[] = Array.isArray(parsed)
    ? parsed.filter((r) => r && typeof r === 'object' && r.type === 'csp-violation').map((r) => r.body || {})
    : parsed && typeof parsed === 'object' && (parsed as any)['csp-report']
      ? [(parsed as any)['csp-report']]
      : [];

  for (const r of items.slice(0, MAX_REPORTS_PER_REQUEST)) {
    if (!r || typeof r !== 'object') continue;
    const directive = String(r.effectiveDirective || r['effective-directive'] || r['violated-directive'] || '').split(' ')[0].slice(0, 40);
    console.warn(
      '[CSP] ' +
        JSON.stringify({
          directive,
          blocked: safeUrl(r.blockedURL ?? r['blocked-uri']),
          page: safeUrl(r.documentURL ?? r['document-uri']).replace(/^https?:\/\/[^/]+/, ''),
          source: safeUrl(r.sourceFile ?? r['source-file']),
          line: Number(r.lineNumber ?? r['line-number']) || undefined,
          mode: String(r.disposition || '').slice(0, 10) || undefined,
        })
    );
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(204).end();
}

/**
 * Public liveness check. It reports only whether the database and Redis respond: no error text,
 * provider configuration or circuit-breaker state, since anyone can call it.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // POST /api/csp-report (rewritten here in vercel.json: no extra function, Hobby plan cap of 12)
  if (req.query?.action === 'csp-report') {
    return handleCspReport(req, res);
  }
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
