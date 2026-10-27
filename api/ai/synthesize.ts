import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { sanitizeAndDelimitPrompt, checkPromptInjection, enforceServerQuota, recordExecutionTrace } from '../_lib/security.js';
import { executeAiCompletion } from '../_lib/ai.js';
import { enforceRateLimit } from '../_lib/rateLimiter.js';
import { buildSynthesisSystemPrompt } from '../_lib/aiPrompts.js';
import { getUseCaseProfile, validatePromptAgainstForbiddenTerms } from '../_lib/useCaseProfiles.js';
import { validateSynthesisOutput, buildRepairMessage, sanitizePromptOutput } from '../_lib/validation.js';
import { getGroundedFacts } from '../_lib/ragGrounding.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  const user = await authenticateRequest(req);
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const isPaid = user?.subscriptionTier === 'pro' || user?.subscriptionTier === 'ultimate' || user?.subscriptionTier === 'advanced';

  // Enforce distributed Upstash Redis rate limiting (per-user if authenticated, else IP)
  const allowed = await enforceRateLimit(req, res, 'synthesize', user?.id || ip, isPaid);
  if (!allowed) return;

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
  const targetType = idea.targetType || body.targetType || 'coding-agent';
  const answers: Array<{ questionId: string; value: string | string[] }> = body.answers || [];
  const questions: Array<{ id: string; questionText: string }> = body.questions || [];

  if (!rawIdea) {
    return res.status(400).json({ error: 'rawIdea is required' });
  }

  // Security: Check for prompt injection
  checkPromptInjection(rawIdea, user?.id, ip);

  // Retrieve active use case profile
  const profile = getUseCaseProfile(targetType);

  // Construct structured clarification summary
  let clarificationContext = '';
  if (answers.length > 0) {
    clarificationContext = '\n\nUser Answers to Clarifications:\n' + answers.map(a => {
      const q = questions.find(item => item.id === a.questionId);
      const valStr = Array.isArray(a.value) ? a.value.join(', ') : a.value;
      return `- ${q ? q.questionText : a.questionId}: ${valStr}`;
    }).join('\n');
  }

  const ragFacts = getGroundedFacts(rawIdea, targetType);
  const ragSection = ragFacts.groundedFactsBlock ? `\n\n${ragFacts.groundedFactsBlock}` : '';
  const systemPrompt = `${buildSynthesisSystemPrompt(targetType)}\n\n### USE CASE DIRECTIVE: ${profile.name.toUpperCase()}\n${profile.synthesisPrompt}${ragSection}\n\nForbidden terms to avoid:\n${profile.forbiddenTerms.map(t => `- "${t}"`).join('\n')}`;

  const userContent = sanitizeAndDelimitPrompt(`Concept: ${rawIdea}\nTarget Type: ${profile.name} (${profile.id})${clarificationContext}`);

  const wantsStream = Boolean(body.stream || req.query.stream === 'true' || req.headers.accept?.includes('text/event-stream'));

  try {
    if (wantsStream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const { text, model } = await executeAiCompletion(
        userContent,
        systemPrompt,
        user?.id,
        (token) => {
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        },
        profile.temperature
      );

      const validation = validatePromptAgainstForbiddenTerms(text, profile.id);
      if (!validation.valid) {
        console.warn(`[Synthesize] Forbidden terms detected for profile "${profile.id}":`, validation.foundTerms);
      }

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

      res.write(`data: ${JSON.stringify({
        done: true,
        modelTarget: model,
        latencyMs: Date.now() - startTime,
        profileId: profile.id,
        validation: validation.valid ? 'passed' : 'warning',
        flaggedTerms: validation.foundTerms,
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const { text, model } = await executeAiCompletion(
      userContent,
      systemPrompt,
      user?.id,
      undefined,
      profile.temperature
    );

    let finalText = text;
    let effectiveModel = model;
    const sVal = validateSynthesisOutput(finalText, targetType, rawIdea);

    if (!sVal.isValid) {
      console.warn(`[Synthesize] Output failed schema or forbidden-term validation (${sVal.issues.map(i => i.message).join('; ')}). Initiating single repair retry...`);
      const repair = buildRepairMessage({
        previousOutput: finalText,
        validation: sVal,
        targetType,
        userIdea: rawIdea,
        mode: 'synthesis',
      });
      try {
        const retried = await executeAiCompletion(
          repair.repairUserPrompt,
          repair.repairSystemPrompt,
          user?.id,
          undefined,
          Math.min(0.2, profile.temperature)
        );
        const retryVal = validateSynthesisOutput(retried.text, targetType, rawIdea);
        if (retryVal.isValid || retryVal.issues.length < sVal.issues.length) {
          finalText = retried.text;
          effectiveModel = retried.model;
          console.log(`[Synthesize] Serverless synthesis repair retry succeeded for "${targetType}"!`);
        }
      } catch (retryErr: any) {
        console.error(`[Synthesize] Repair retry failed: ${retryErr.message}`);
      }
    }

    finalText = sanitizePromptOutput(finalText);
    const finalValidation = validateSynthesisOutput(finalText, targetType, rawIdea);

    if (user?.id) {
      await recordExecutionTrace({
        userId: user.id,
        nodeOrigin: 'Wizard.synthesize',
        modelTarget: effectiveModel,
        tokensUsed: Math.max(500, Math.round(finalText.length / 3.5)),
        latencyMs: Date.now() - startTime,
        status: 'success',
      });
    }

    return res.status(200).json({
      promptText: finalText.trim(),
      modelTarget: effectiveModel,
      latencyMs: Date.now() - startTime,
      useCaseProfile: {
        id: profile.id,
        name: profile.name,
        temperature: profile.temperature,
        validation: finalValidation.isValid ? 'passed' : 'warning',
        flaggedTerms: finalValidation.forbiddenTermsFound,
        missingSections: finalValidation.missingSections,
      },
    });
  } catch (err: any) {
    console.error('[Synthesize] Error:', err);
    return res.status(500).json({
      error: 'Prompt synthesis failed on server',
      message: err.message,
    });
  }
}
