import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { sanitizeAndDelimitPrompt, checkPromptInjection, reserveQuota, releaseQuota, sendQuotaDenied, recordExecutionTrace } from '../_lib/security.js';
import { executeAiCompletion } from '../_lib/ai.js';
import { INPUT_LIMITS, firstLengthError, sendAiFailure, getRequestId, logAiRequest } from '../_lib/aiHttp.js';
import { enforceRateLimit, getClientIp } from '../_lib/rateLimiter.js';
import { buildRefineSystemPrompt, extractRefineResult } from '../_lib/aiPrompts.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  const requestId = getRequestId(req);
  res.setHeader('X-Request-Id', requestId);
  const user = await authenticateRequest(req);
  const ip = getClientIp(req);
  const isPaid = user?.subscriptionTier === 'pro' || user?.subscriptionTier === 'ultimate' || user?.subscriptionTier === 'advanced';

  // Enforce distributed Upstash Redis rate limiting (per-user if authenticated, else IP)
  const allowed = await enforceRateLimit(req, res, 'refine', user?.id || ip, isPaid);
  if (!allowed) return;

  const body = req.body || {};
  const currentPrompt = (body.currentPrompt || body.prompt || '').trim();
  const instruction = (body.instruction || body.refinement || '').trim();

  if (!currentPrompt || !instruction) {
    return res.status(400).json({ error: 'currentPrompt and instruction are required' });
  }

  const limitError = firstLengthError([
    [currentPrompt, INPUT_LIMITS.currentPrompt, 'currentPrompt'],
    [instruction, INPUT_LIMITS.instruction, 'instruction'],
  ]);
  if (limitError) {
    return res.status(400).json({ error: limitError });
  }

  // Server-side usage quota (per user, or per client IP for anonymous callers); fails closed
  const quota = await reserveQuota({ bucket: 'assist', endpoint: 'ai/refine', user, ip });
  if (!quota.allowed) return sendQuotaDenied(res, quota);

  checkPromptInjection(instruction, user?.id, ip);

  const systemPrompt = buildRefineSystemPrompt();
  const payload = `EXISTING PROMPT:\n${currentPrompt}\n\nREFINEMENT INSTRUCTION:\n${instruction}`;
  const safeContent = sanitizeAndDelimitPrompt(payload);

  try {
    const { text, model } = await executeAiCompletion(safeContent, systemPrompt, user?.id);
    const extracted = extractRefineResult(text, currentPrompt, instruction);

    if (user?.id) {
      await recordExecutionTrace({
        userId: user.id,
        nodeOrigin: 'RefineModal.refine',
        modelTarget: model,
        tokensUsed: Math.max(400, Math.round(extracted.updatedMarkdown.length / 3.5)),
        latencyMs: Date.now() - startTime,
        status: 'success',
      });
    }

    logAiRequest({ route: 'ai/refine', requestId, outcome: 'success', latencyMs: Date.now() - startTime, model });
    return res.status(200).json({
      updatedMarkdown: extracted.updatedMarkdown,
      summary: extracted.summary,
      modelTarget: model,
    });
  } catch (err: any) {
    await releaseQuota(quota);
    console.error('[Refine] Error:', err);
    logAiRequest({ route: 'ai/refine', requestId, outcome: 'error', latencyMs: Date.now() - startTime, code: err?.code });
    return sendAiFailure(res, err, 'Prompt refinement failed', requestId);
  }
}
