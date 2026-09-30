import { getDb, logSecurityEvent } from './db.js';

// Suspicious patterns commonly used in prompt injection / system prompt extraction attacks
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|directives|prompts)/i,
  /disregard\s+(all\s+)?(previous|above|prior)\s+(instructions|rules)/i,
  /reveal\s+(your\s+)?(system\s+prompt|hidden\s+instructions|initial\s+prompt)/i,
  /print\s+(your\s+)?(system\s+prompt|core\s+instructions|developer\s+mode)/i,
  /you\s+are\s+now\s+in\s+developer\s+mode/i,
  /DAN\s+mode|jailbreak/i,
  /output\s+the\s+above\s+text\s+verbatim/i,
];

/**
 * Strips invisible unicode escapes and delimits user input safely
 */
export function sanitizeAndDelimitPrompt(rawText: string): string {
  const cleaned = rawText
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .replace(/<\/?(UNTRUSTED_USER_INPUT|SYSTEM_INSTRUCTION|PROMPT_OVERRIDE)>/gi, '')
    .trim();

  return `<UNTRUSTED_USER_INPUT>\n${cleaned}\n</UNTRUSTED_USER_INPUT>`;
}

/**
 * Checks for prompt injection and logs security alert if detected
 */
export function checkPromptInjection(text: string, userId?: string, ipAddress?: string): boolean {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      logSecurityEvent({
        userId,
        eventType: 'SUSPICIOUS_PROMPT_INJECTION',
        severity: 'WARN',
        ipAddress,
        message: `Prompt injection pattern detected: ${pattern.toString()}`,
      });
      return true;
    }
  }
  return false;
}

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

export interface QuotaCheckResult {
  allowed: boolean;
  count: number;
  limit: number;
  resetMs: number;
}

/**
 * Enforces server-side quota in Neon PostgreSQL
 */
export async function enforceServerQuota(
  userId: string,
  tier: string
): Promise<QuotaCheckResult> {
  const isPaid = tier === 'advanced' || tier === 'ultimate' || tier === 'pro';
  const limit = isPaid ? 500 : 10;

  try {
    const sql = getDb();
    const fiveHoursAgo = new Date(Date.now() - FIVE_HOURS_MS);

    const rows = (await sql`
      SELECT COUNT(*)::int as count FROM "Trace"
      WHERE user_id = ${userId}
        AND node_origin IN ('Wizard.synthesize', 'RefineModal.refine', 'Tester.test')
        AND created_at >= ${fiveHoursAgo}
    `) as any[];

    const count = rows[0]?.count ?? 0;
    const allowed = count < limit;

    return {
      allowed,
      count,
      limit,
      resetMs: FIVE_HOURS_MS,
    };
  } catch (err) {
    console.error('[Quota] Failed to check quota in database:', err);
    // In case of transient DB error, do not completely brick the user
    return {
      allowed: true,
      count: 0,
      limit,
      resetMs: FIVE_HOURS_MS,
    };
  }
}

/**
 * Records execution trace in Neon PostgreSQL
 */
export async function recordExecutionTrace(params: {
  userId: string;
  nodeOrigin: string;
  modelTarget: string;
  tokensUsed: number;
  latencyMs: number;
  status: 'success' | 'error';
}) {
  try {
    const sql = getDb();
    const traceId = `TRC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    await sql`
      INSERT INTO "Trace" (id, user_id, node_origin, model_target, tokens_used, latency_ms, status, created_at)
      VALUES (${traceId}, ${params.userId}, ${params.nodeOrigin}, ${params.modelTarget}, ${params.tokensUsed}, ${params.latencyMs}, ${params.status}, NOW())
    `;
  } catch (err) {
    console.error('[Trace] Failed to record trace in database:', err);
  }
}
