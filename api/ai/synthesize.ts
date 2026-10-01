import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { sanitizeAndDelimitPrompt, checkPromptInjection, enforceServerQuota, recordExecutionTrace } from '../_lib/security.js';
import { executeAiCompletion } from '../_lib/ai.js';
import { enforceRateLimit } from '../_lib/rateLimiter.js';
import { BEDROCK_CORE_GUARDRAILS } from '../_lib/aiPrompts.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Enforce distributed Upstash Redis rate limiting
  const allowed = await enforceRateLimit(req, res, 'synthesize');
  if (!allowed) return;

  const startTime = Date.now();
  const user = await authenticateRequest(req);
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

  // 1. Enforce Server-Side Quota in Neon DB
  if (user?.id) {
    const quota = await enforceServerQuota(user.id, user.subscriptionTier);
    if (!quota.allowed) {
      return res.status(429).json({
        error: 'Free Tier Limit Reached',
        code: 'FREE_TIER_QUOTA_EXCEEDED',
        message: 'Free tier accounts can generate up to 10 prompts per 5-hour session. Please upgrade to Pro for unlimited prompts.',
        sessionLimit: quota.limit,
        sessionPrompts: quota.count,
        resetMs: quota.resetMs,
      });
    }
  }

  const body = req.body || {};
  const idea = body.idea || {};
  const rawIdea = (idea.rawText || body.rawText || '').trim();
  const targetType = idea.targetType || body.targetType || 'Production Prompt';
  const answers: Array<{ questionId: string; value: string | string[] }> = body.answers || [];
  const questions: Array<{ id: string; questionText: string }> = body.questions || [];

  if (!rawIdea) {
    return res.status(400).json({ error: 'rawIdea is required' });
  }

  // Security: Check for prompt injection
  checkPromptInjection(rawIdea, user?.id, ip);

  // Construct structured clarification summary
  let clarificationContext = '';
  if (answers.length > 0) {
    clarificationContext = '\n\nUser Answers to Clarifications:\n' + answers.map(a => {
      const q = questions.find(item => item.id === a.questionId);
      const valStr = Array.isArray(a.value) ? a.value.join(', ') : a.value;
      return `- ${q ? q.questionText : a.questionId}: ${valStr}`;
    }).join('\n');
  }

  const systemPrompt = `You are Bedrock, the premier AI Prompt Architect for frontier intelligence.
Your task is to synthesize the user's concept into an extraordinary, production-grade, highly structured prompt.

${BEDROCK_CORE_GUARDRAILS}

Structure the prompt with the following clear markdown sections:
# [Prompt Title]

## Role & Persona
[Define the expert mindset, domain depth, and operational standards]

## Objective & Task Definition
[Clear, unambiguous mission statement]

## Context & Core Inputs
[Input variables, state context, and source materials]

## Execution Protocol & Step-by-Step Instructions
[Numbered sequence of execution]

## Output Format & Specification
[Strict output structure, formatting schema, and stylistic tone]

## Negative Constraints & Guardrails
[Critical anti-patterns, boundary limitations, and disallowed behaviors]

Return the final synthesized prompt cleanly. Avoid conversational meta-text like "Sure, here is your prompt:". Start directly with the prompt content.`;

  const userContent = sanitizeAndDelimitPrompt(`Concept: ${rawIdea}\nTarget Type: ${targetType}${clarificationContext}`);

  try {
    const { text, model } = await executeAiCompletion(userContent, systemPrompt);

    if (user?.id) {
      await recordExecutionTrace({
        userId: user.id,
        nodeOrigin: 'Wizard.synthesize',
        modelTarget: model,
        tokensUsed: Math.max(500, Math.round(text.length / 3.5)),
        latencyMs: Date.now() - startTime,
        status: 'success',
      });
    }

    return res.status(200).json({
      promptText: text.trim(),
      modelTarget: model,
      latencyMs: Date.now() - startTime,
    });
  } catch (err: any) {
    console.error('[Synthesize] Error:', err);
    return res.status(500).json({
      error: 'Prompt synthesis failed on server',
      message: err.message,
    });
  }
}
