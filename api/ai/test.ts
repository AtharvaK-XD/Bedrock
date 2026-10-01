import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { checkPromptInjection, recordExecutionTrace } from '../_lib/security.js';
import { executeAiCompletion } from '../_lib/ai.js';
import { enforceRateLimit } from '../_lib/rateLimiter.js';
import { BEDROCK_CORE_GUARDRAILS } from '../_lib/aiPrompts.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Enforce distributed Upstash Redis rate limiting
  const allowed = await enforceRateLimit(req, res, 'test');
  if (!allowed) return;

  const startTime = Date.now();
  const user = await authenticateRequest(req);
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

  const body = req.body || {};
  const prompt = (body.prompt || body.promptText || '').trim();
  const rawSystemPrompt = (body.systemPrompt || '').trim();
  const systemPrompt = rawSystemPrompt
    ? `${rawSystemPrompt}\n\n${BEDROCK_CORE_GUARDRAILS}`
    : BEDROCK_CORE_GUARDRAILS;

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  checkPromptInjection(prompt, user?.id, ip);

  try {
    const { text, model } = await executeAiCompletion(prompt, systemPrompt);
    const latency = Date.now() - startTime;
    const tokens = Math.max(100, Math.round(text.length / 4));

    if (user?.id) {
      await recordExecutionTrace({
        userId: user.id,
        nodeOrigin: 'Tester.test',
        modelTarget: model,
        tokensUsed: tokens,
        latencyMs: latency,
        status: 'success',
      });
    }

    return res.status(200).json({
      text,
      latencyMs: latency,
      tokensUsed: tokens,
      modelTarget: model,
      status: 'success',
    });
  } catch (err: any) {
    console.error('[Tester] Error:', err);
    return res.status(500).json({
      error: 'Prompt test execution failed',
      message: err.message,
    });
  }
}
