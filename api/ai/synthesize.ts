import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { sanitizeAndDelimitPrompt, checkPromptInjection, reserveQuota, releaseQuota, sendQuotaDenied, recordExecutionTrace } from '../_lib/security.js';
import { executeAiCompletion, AI_DEFAULT_BUDGET_MS } from '../_lib/ai.js';
import { INPUT_LIMITS, firstLengthError, sendAiFailure, getRequestId, logAiRequest } from '../_lib/aiHttp.js';
import { enforceRateLimit, getClientIp } from '../_lib/rateLimiter.js';
import { buildSynthesisSystemPrompt } from '../_lib/aiPrompts.js';
import { getUseCaseProfile, validatePromptAgainstForbiddenTerms } from '../_lib/useCaseProfiles.js';
import { validateSynthesisOutput, buildRepairMessage, sanitizePromptOutput } from '../_lib/validation.js';
import { getGroundedFacts } from '../_lib/ragGrounding.js';

/** A repair retry is only worth starting if this much of the request budget is left. */
const REPAIR_MIN_REMAINING_MS = 15_000;

/** Returns a message for the first over-long input, or null (checked before any quota is reserved). */
function findInputLimitError(
  rawIdea: string,
  answers: Array<{ questionId: string; value: string | string[] }>,
  questions: Array<{ id: string; questionText: string }>
): string | null {
  const ideaError = firstLengthError([[rawIdea, INPUT_LIMITS.idea, 'rawIdea']]);
  if (ideaError) return ideaError;

  if (Array.isArray(answers)) {
    if (answers.length > INPUT_LIMITS.answers) return `answers must contain at most ${INPUT_LIMITS.answers} items`;
    for (const a of answers) {
      const value = Array.isArray(a?.value) ? a.value.join(', ') : a?.value;
      const error = firstLengthError([[value, INPUT_LIMITS.answerValue, 'Each answer value']]);
      if (error) return error;
    }
  }
  if (Array.isArray(questions)) {
    if (questions.length > INPUT_LIMITS.questions) return `questions must contain at most ${INPUT_LIMITS.questions} items`;
    for (const q of questions) {
      const error = firstLengthError([[q?.questionText, INPUT_LIMITS.questionText, 'Each questionText']]);
      if (error) return error;
    }
  }
  return null;
}

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
  const allowed = await enforceRateLimit(req, res, 'synthesize', user?.id || ip, isPaid);
  if (!allowed) return;

  const body = req.body || {};
  const idea = body.idea || {};
  const rawIdea = (idea.rawText || body.rawText || '').trim();
  const targetType = idea.targetType || body.targetType || 'coding-agent';
  const answers: Array<{ questionId: string; value: string | string[] }> = body.answers || [];
  const questions: Array<{ id: string; questionText: string }> = body.questions || [];

  if (!rawIdea) {
    return res.status(400).json({ error: 'rawIdea is required' });
  }

  const limitError = findInputLimitError(rawIdea, answers, questions);
  if (limitError) {
    return res.status(400).json({ error: limitError });
  }

  // Server-side usage quota (per user, or per client IP for anonymous callers); fails closed
  const quota = await reserveQuota({ bucket: 'generation', endpoint: 'ai/synthesize', user, ip });
  if (!quota.allowed) return sendQuotaDenied(res, quota);

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

  // One budget for the whole request (initial call + any repair), under Vercel's 60 s function limit
  const deadlineAt = startTime + AI_DEFAULT_BUDGET_MS;

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
        profile.temperature,
        { deadlineAt }
      );

      // The tokens are already with the client, so a stream cannot be repaired here;
      // run the same checks as the JSON path and report them in the final event.
      const validation = validatePromptAgainstForbiddenTerms(text, profile.id);
      if (!validation.valid) {
        console.warn(`[Synthesize] Forbidden terms detected for profile "${profile.id}":`, validation.foundTerms);
      }
      const streamedText = sanitizePromptOutput(text);
      const streamValidation = validateSynthesisOutput(streamedText, targetType, rawIdea);
      if (!streamValidation.isValid) {
        console.warn(`[Synthesize] Streamed output failed schema or forbidden-term validation (${streamValidation.issues.map(i => i.message).join('; ')}).`);
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
        validation: validation.valid && streamValidation.isValid ? 'passed' : 'warning',
        flaggedTerms: Array.from(new Set([...validation.foundTerms, ...streamValidation.forbiddenTermsFound])),
        missingSections: streamValidation.missingSections,
        promptText: streamedText.trim(),
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      logAiRequest({ route: 'ai/synthesize', requestId, outcome: 'success', latencyMs: Date.now() - startTime, model, stream: true });
      return;
    }

    const { text, model } = await executeAiCompletion(
      userContent,
      systemPrompt,
      user?.id,
      undefined,
      profile.temperature,
      { deadlineAt }
    );

    let finalText = text;
    let effectiveModel = model;
    const sVal = validateSynthesisOutput(finalText, targetType, rawIdea);

    const canRepair = deadlineAt - Date.now() >= REPAIR_MIN_REMAINING_MS;
    if (!sVal.isValid && !canRepair) {
      console.warn('[Synthesize] Skipping repair retry: not enough request time left.');
    }

    if (!sVal.isValid && canRepair) {
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
          Math.min(0.2, profile.temperature),
          { deadlineAt }
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

    logAiRequest({ route: 'ai/synthesize', requestId, outcome: 'success', latencyMs: Date.now() - startTime, model: effectiveModel });
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
    await releaseQuota(quota);
    console.error('[Synthesize] Error:', err);
    logAiRequest({ route: 'ai/synthesize', requestId, outcome: 'error', latencyMs: Date.now() - startTime, code: err?.code, stream: wantsStream });
    return sendAiFailure(res, err, 'Prompt synthesis failed on server', requestId);
  }
}
