import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { sanitizeAndDelimitPrompt, checkPromptInjection, reserveQuota, releaseQuota, sendQuotaDenied, recordExecutionTrace } from '../_lib/security.js';
import { executeAiCompletion, AI_OUTPUT_BUDGET, tokensForTrace, QuestionOutput } from '../_lib/ai.js';
import {
  INPUT_LIMITS,
  firstLengthError,
  getRequestId,
  logAiRequest,
  clientAbortSignal,
  isPaidUser,
  recordAiFailureTrace,
  usageFields,
  failureOutcome,
} from '../_lib/aiHttp.js';
import { enforceRateLimit, getClientIp } from '../_lib/rateLimiter.js';
import { getUseCaseProfile, classifyUseCase, normalizeQuestions } from '../_lib/useCaseProfiles.js';
import { checkQuestionQuality } from '../_lib/validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  const requestId = getRequestId(req);
  res.setHeader('X-Request-Id', requestId);
  const ip = getClientIp(req);
  // Cheap per-visitor brake BEFORE token checking and the user lookup, so a flood of junk tokens cannot reach the database
  if (!(await enforceRateLimit(req, res, 'aiGate', ip))) return;
  const user = await authenticateRequest(req);
  const isPaid = isPaidUser(user);

  // Enforce distributed Upstash Redis rate limiting (per-user if authenticated, else IP)
  const allowed = await enforceRateLimit(req, res, 'questions', user?.id || ip, isPaid);
  if (!allowed) return;

  const body = req.body || {};
  const ideaText = (body.ideaText || body.rawText || '').trim();
  const targetType = body.targetType || 'coding-agent';

  if (!ideaText) {
    return res.status(400).json({ error: 'ideaText is required' });
  }

  const limitError = firstLengthError([[ideaText, INPUT_LIMITS.idea, 'ideaText']]);
  if (limitError) {
    return res.status(400).json({ error: limitError });
  }

  // Server-side usage quota (per user, or per client IP for anonymous callers); fails closed
  const quota = await reserveQuota({ bucket: 'assist', endpoint: 'ai/generate-questions', user, ip });
  if (!quota.allowed) return sendQuotaDenied(res, quota);

  // Security: Check for prompt injection
  checkPromptInjection(ideaText, user?.id, ip);

  const profile = getUseCaseProfile(targetType);
  const classification = classifyUseCase(ideaText, targetType);
  const systemPrompt = profile.questionPrompt;

  const safePrompt = sanitizeAndDelimitPrompt(
    `Selected Profile: ${profile.name} (${profile.tag})\nConfirmed: ${classification.isConfirmed}\n\nProject Idea: ${ideaText}`
  );

  // Known once the model has answered, so a failure after that (unusable answer) is stored with its model
  let answeredBy: string | undefined;
  try {
    const { text, model, usage } = await executeAiCompletion(safePrompt, systemPrompt, user?.id, undefined, undefined, {
      maxOutputTokens: AI_OUTPUT_BUDGET.questions,
      signal: clientAbortSignal(res),
    });
    answeredBy = model;

    // Clean JSON response (strip markdown wrappers if any)
    const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text.trim();
    // Models name the keys their own way ("question", "type"): repair them so no card renders blank
    const questions: QuestionOutput[] = normalizeQuestions(JSON.parse(jsonStr));
    // Not enough questions with real text, coding terms in an image/video profile, or chatty filler:
    // the built-in questions are better than a bad set, so this takes the same path as unparsable output
    const problems = checkQuestionQuality(questions, profile.id, ideaText);
    if (problems.length > 0) {
      console.warn(`[GenerateQuestions] Questions rejected (${problems.length}): ${problems.slice(0, 5).join('; ')}`);
      throw Object.assign(new Error(`Questions failed the quality check (${problems.length} problems)`), { code: 'QUESTIONS_UNUSABLE' });
    }

    if (user?.id) {
      await recordExecutionTrace({
        userId: user.id,
        nodeOrigin: 'Wizard.generateQuestions',
        modelTarget: model,
        tokensUsed: tokensForTrace(usage, 400),
        latencyMs: Date.now() - startTime,
        status: 'success',
      });
    }

    logAiRequest({ route: 'ai/generate-questions', requestId, outcome: 'success', latencyMs: Date.now() - startTime, model, ...usageFields(usage) });
    return res.status(200).json(questions);
  } catch (err: any) {
    // 'fallback' when the built-in questions are sent instead, 'aborted' when the user already left
    const aborted = failureOutcome(err) === 'aborted';
    if (!aborted) {
      await releaseQuota(quota);
      await recordAiFailureTrace({ userId: user?.id, nodeOrigin: 'Wizard.generateQuestions', err, latencyMs: Date.now() - startTime, model: answeredBy });
      console.error('[GenerateQuestions] Error:', err);
    }
    logAiRequest({ route: 'ai/generate-questions', requestId, outcome: aborted ? 'aborted' : 'fallback', latencyMs: Date.now() - startTime, code: err?.code });
    return res.status(200).json(profile.fallbackQuestions);
  }
}
