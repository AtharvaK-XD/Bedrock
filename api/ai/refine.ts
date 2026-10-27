import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { sanitizeAndDelimitPrompt, checkPromptInjection, recordExecutionTrace } from '../_lib/security.js';
import { executeAiCompletion } from '../_lib/ai.js';
import { enforceRateLimit } from '../_lib/rateLimiter.js';
import { buildRefineSystemPrompt, extractRefineResult } from '../_lib/aiPrompts.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  const user = await authenticateRequest(req);
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
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

    return res.status(200).json({
      updatedMarkdown: extracted.updatedMarkdown,
      summary: extracted.summary,
      modelTarget: model,
    });
  } catch (err: any) {
    console.error('[Refine] Error:', err);
    return res.status(500).json({
      error: 'Prompt refinement failed',
      message: err.message,
    });
  }
}
