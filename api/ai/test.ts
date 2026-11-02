import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { checkPromptInjection, reserveQuota, releaseQuota, sendQuotaDenied, recordExecutionTrace } from '../_lib/security.js';
import { executeAiCompletion, testOutputBudget, tokensForTrace } from '../_lib/ai.js';
import {
  INPUT_LIMITS,
  firstLengthError,
  sendAiFailure,
  getRequestId,
  logAiRequest,
  clientAbortSignal,
  isPaidUser,
  recordAiFailureTrace,
  usageFields,
  failureOutcome,
} from '../_lib/aiHttp.js';
import { enforceRateLimit, getClientIp } from '../_lib/rateLimiter.js';
import { BEDROCK_CORE_GUARDRAILS } from '../_lib/aiPrompts.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  const requestId = getRequestId(req);
  res.setHeader('X-Request-Id', requestId);
  const user = await authenticateRequest(req);
  const ip = getClientIp(req);
  const isPaid = isPaidUser(user);

  // This route runs any prompt the caller sends on Bedrock's provider keys, so it needs a signed-in
  // account (the app itself only exists behind sign-in). Questions and synthesize stay open.
  // The local development guest (localhost only) is allowed through.
  if (!user) {
    return res.status(401).json({
      error: 'Sign in required',
      code: 'AUTH_REQUIRED',
      message: 'Please sign in to run prompts on Bedrock.',
      requestId,
    });
  }

  // Enforce distributed Upstash Redis rate limiting (per-user if authenticated, else IP)
  const allowed = await enforceRateLimit(req, res, 'test', user?.id || ip, isPaid);
  if (!allowed) return;

  const body = req.body || {};
  // The client says how long an answer it needs (up to a ceiling); the server decides the real limit
  const maxOutputTokens = testOutputBudget(body.maxOutputTokens);
  // Stops the paid provider call when the user closes the tab or cancels
  const signal = clientAbortSignal(res);
  const prompt = (body.prompt || body.promptText || '').trim();
  const rawSystemPrompt = (body.systemPrompt || '').trim();
  const systemPrompt = rawSystemPrompt
    ? `${rawSystemPrompt}\n\n${BEDROCK_CORE_GUARDRAILS}`
    : BEDROCK_CORE_GUARDRAILS;

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const limitError = firstLengthError([
    [prompt, INPUT_LIMITS.testPrompt, 'prompt'],
    [rawSystemPrompt, INPUT_LIMITS.testSystemPrompt, 'systemPrompt'],
  ]);
  if (limitError) {
    return res.status(400).json({ error: limitError });
  }

  // Server-side usage quota (per user, or per client IP for anonymous callers); fails closed
  const quota = await reserveQuota({ bucket: 'assist', endpoint: 'ai/test', user, ip });
  if (!quota.allowed) return sendQuotaDenied(res, quota);

  checkPromptInjection(prompt, user?.id, ip);

  const wantsStream = Boolean(body.stream || req.query?.stream === 'true' || req.headers.accept?.includes('text/event-stream'));

  try {
    if (wantsStream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const { text, model, truncated, usage } = await executeAiCompletion(
        prompt,
        systemPrompt,
        user?.id,
        (token) => {
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        },
        undefined,
        { maxOutputTokens, signal }
      );

      const latency = Date.now() - startTime;
      const tokens = tokensForTrace(usage, Math.max(100, Math.round(text.length / 4)));

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

      res.write(`data: ${JSON.stringify({ done: true, text, modelTarget: model, latencyMs: latency, tokensUsed: tokens, status: 'success', ...(truncated ? { truncated: true } : {}) })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      logAiRequest({ route: 'ai/test', requestId, outcome: 'success', latencyMs: latency, model, stream: true, ...(truncated ? { truncated: true } : {}), ...usageFields(usage) });
      return;
    }

    const { text, model, truncated, usage } = await executeAiCompletion(prompt, systemPrompt, user?.id, undefined, undefined, { maxOutputTokens, signal });
    const latency = Date.now() - startTime;
    const tokens = tokensForTrace(usage, Math.max(100, Math.round(text.length / 4)));

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

    logAiRequest({ route: 'ai/test', requestId, outcome: 'success', latencyMs: latency, model, ...(truncated ? { truncated: true } : {}), ...usageFields(usage) });
    return res.status(200).json({
      text,
      latencyMs: latency,
      tokensUsed: tokens,
      modelTarget: model,
      status: 'success',
      // Only present when the answer was cut off at the output limit
      ...(truncated ? { truncated: true } : {}),
    });
  } catch (err: any) {
    const outcome = failureOutcome(err);
    if (outcome === 'error') {
      await releaseQuota(quota);
      await recordAiFailureTrace({ userId: user?.id, nodeOrigin: 'Tester.test', err, latencyMs: Date.now() - startTime });
      console.error('[Tester] Error:', err);
    }
    logAiRequest({ route: 'ai/test', requestId, outcome, latencyMs: Date.now() - startTime, code: err?.code, stream: wantsStream });
    return sendAiFailure(res, err, 'Prompt test execution failed', requestId);
  }
}
