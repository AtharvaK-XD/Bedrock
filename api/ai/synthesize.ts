import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { sanitizeAndDelimitPrompt, checkPromptInjection, reserveQuota, releaseQuota, sendQuotaDenied, recordExecutionTrace } from '../_lib/security.js';
import { executeAiCompletion, AI_DEFAULT_BUDGET_MS, AI_OUTPUT_BUDGET, sumUsage, tokensForTrace } from '../_lib/ai.js';
import {
  INPUT_LIMITS,
  readTextField,
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
import { buildSynthesisSystemPrompt, FINAL_INTEGRITY_CHECK } from '../_lib/aiPrompts.js';
import { getUseCaseProfile, validatePromptAgainstForbiddenTerms } from '../_lib/useCaseProfiles.js';
import { validateSynthesisOutput, buildRepairMessage, sanitizePromptOutput } from '../_lib/validation.js';
import { getGroundedFacts } from '../_lib/ragGrounding.js';

/** A repair retry is only worth starting if this much of the request budget is left. */
const REPAIR_MIN_REMAINING_MS = 15_000;

type SynthesisAnswer = { questionId: string; value: string | string[] };
type SynthesisQuestion = { id: string; questionText: string };

const asText = (v: unknown): string | null =>
  typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : null;

/**
 * Reads and checks the request body. Before, a non-string idea reached `.trim()`, and a `null` entry or a non-list
 * in `answers` reached `answers.map(a => a.questionId)`: both crashed the request outside its error handling.
 * Numbers and booleans in answers and ids are accepted as text (a free-text answer like 42 is a fair answer).
 */
function readSynthesisInput(body: Record<string, unknown>):
  | { error: string }
  | { rawIdea: string; targetType: string; answers: SynthesisAnswer[]; questions: SynthesisQuestion[] } {
  const idea = body.idea && typeof body.idea === 'object' && !Array.isArray(body.idea) ? body.idea : {};
  let ideaField = readTextField(idea, ['rawText']);
  if ('error' in ideaField) return ideaField;
  if (!ideaField.value) ideaField = readTextField(body, ['rawText']);
  if ('error' in ideaField) return ideaField;
  let typeField = readTextField(idea, ['targetType']);
  if ('error' in typeField) return typeField;
  if (!typeField.value) typeField = readTextField(body, ['targetType']);
  if ('error' in typeField) return typeField;

  const rawAnswers = body.answers ?? [];
  const rawQuestions = body.questions ?? [];
  if (!Array.isArray(rawAnswers)) return { error: 'answers must be a list' };
  if (!Array.isArray(rawQuestions)) return { error: 'questions must be a list' };

  const answers: SynthesisAnswer[] = [];
  for (const a of rawAnswers) {
    if (!a || typeof a !== 'object') return { error: 'Each answer must be an object with questionId and value' };
    const questionId = asText((a as any).questionId) ?? '';
    const rawValue = (a as any).value;
    let value: string | string[];
    if (Array.isArray(rawValue)) {
      const parts = rawValue.map(asText);
      if (parts.some((p) => p === null)) return { error: 'Each answer value must be text or a list of texts' };
      value = parts as string[];
    } else if (rawValue === undefined || rawValue === null) {
      value = '';
    } else {
      const text = asText(rawValue);
      if (text === null) return { error: 'Each answer value must be text or a list of texts' };
      value = text;
    }
    answers.push({ questionId, value });
  }

  const questions: SynthesisQuestion[] = [];
  for (const q of rawQuestions) {
    if (!q || typeof q !== 'object') return { error: 'Each question must be an object with id and questionText' };
    const questionText = (q as any).questionText;
    if (questionText !== undefined && questionText !== null && typeof questionText !== 'string') {
      return { error: 'Each questionText must be text' };
    }
    questions.push({ id: asText((q as any).id) ?? '', questionText: questionText ?? '' });
  }

  return { rawIdea: ideaField.value, targetType: typeField.value || 'coding-agent', answers, questions };
}

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
  const ip = getClientIp(req);
  // Cheap per-visitor brake BEFORE token checking and the user lookup, so a flood of junk tokens cannot reach the database
  if (!(await enforceRateLimit(req, res, 'aiGate', ip))) return;
  const user = await authenticateRequest(req);
  const isPaid = isPaidUser(user);

  // Enforce distributed Upstash Redis rate limiting (per-user if authenticated, else IP)
  const allowed = await enforceRateLimit(req, res, 'synthesize', user?.id || ip, isPaid);
  if (!allowed) return;

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const input = readSynthesisInput(body);
  if ('error' in input) {
    return res.status(400).json({ error: input.error });
  }
  const { rawIdea, targetType, answers, questions } = input;

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
  const systemPrompt = `${buildSynthesisSystemPrompt(targetType)}\n\n### USE CASE DIRECTIVE: ${profile.name.toUpperCase()}\n${profile.synthesisPrompt}${ragSection}\n\nForbidden terms and anti-patterns (never use or recommend them in the document; a code term such as "any" means the TypeScript type, not the ordinary word):\n${profile.forbiddenTerms.map(t => `- "${t}"`).join('\n')}\n\n${FINAL_INTEGRITY_CHECK}`;

  const userContent = sanitizeAndDelimitPrompt(`Concept: ${rawIdea}\nTarget Type: ${profile.name} (${profile.id})${clarificationContext}`);

  const wantsStream = Boolean(body.stream || req.query.stream === 'true' || req.headers.accept?.includes('text/event-stream'));

  // One budget for the whole request (initial call + any repair), under Vercel's 60 s function limit
  const deadlineAt = startTime + AI_DEFAULT_BUDGET_MS;
  // Stops the paid provider call when the user closes the tab or cancels
  const signal = clientAbortSignal(res);

  let answered = false;
  try {
    if (wantsStream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const { text, model, truncated, usage } = await executeAiCompletion(
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
        { deadlineAt, maxOutputTokens: AI_OUTPUT_BUDGET.synthesize, signal }
      );
      answered = true;

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
          tokensUsed: tokensForTrace(usage, Math.max(500, Math.round(text.length / 3.5))),
          latencyMs: Date.now() - startTime,
          status: 'success',
        });
      }

      res.write(`data: ${JSON.stringify({
        done: true,
        modelTarget: model,
        latencyMs: Date.now() - startTime,
        profileId: profile.id,
        validation: validation.valid && streamValidation.isValid && !truncated ? 'passed' : 'warning',
        flaggedTerms: Array.from(new Set([...validation.foundTerms, ...streamValidation.forbiddenTermsFound])),
        missingSections: streamValidation.missingSections,
        promptText: streamedText.trim(),
        // Only present when the answer was cut off at the output limit
        ...(truncated ? { truncated: true } : {}),
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      logAiRequest({ route: 'ai/synthesize', requestId, outcome: 'success', latencyMs: Date.now() - startTime, model, stream: true, ...(truncated ? { truncated: true } : {}), ...usageFields(usage) });
      return;
    }

    const { text, model, truncated, usage } = await executeAiCompletion(
      userContent,
      systemPrompt,
      user?.id,
      undefined,
      profile.temperature,
      { deadlineAt, maxOutputTokens: AI_OUTPUT_BUDGET.synthesize, signal }
    );
    answered = true;

    // A repair call is paid too, so the trace counts both calls
    let totalUsage = usage;
    let finalText = text;
    let effectiveModel = model;
    let finalTruncated = Boolean(truncated);
    const sVal = validateSynthesisOutput(finalText, targetType, rawIdea);

    const canRepair = deadlineAt - Date.now() >= REPAIR_MIN_REMAINING_MS;
    if (!sVal.isValid && !canRepair) {
      console.warn('[Synthesize] Skipping repair retry: not enough request time left.');
    }
    if (!sVal.isValid && truncated) {
      // Rewriting from scratch with the same output limit would be cut off at the same place
      console.warn('[Synthesize] Skipping repair retry: the answer was cut off at the output limit.');
    }

    if (!sVal.isValid && canRepair && !truncated) {
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
          { deadlineAt, maxOutputTokens: AI_OUTPUT_BUDGET.synthesize, signal }
        );
        totalUsage = sumUsage(totalUsage, retried.usage);
        const retryVal = validateSynthesisOutput(retried.text, targetType, rawIdea);
        if (retryVal.isValid || retryVal.issues.length < sVal.issues.length) {
          finalText = retried.text;
          effectiveModel = retried.model;
          finalTruncated = Boolean(retried.truncated);
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
        tokensUsed: tokensForTrace(totalUsage, Math.max(500, Math.round(finalText.length / 3.5))),
        latencyMs: Date.now() - startTime,
        status: 'success',
      });
    }

    logAiRequest({ route: 'ai/synthesize', requestId, outcome: 'success', latencyMs: Date.now() - startTime, model: effectiveModel, ...(finalTruncated ? { truncated: true } : {}), ...usageFields(totalUsage) });
    return res.status(200).json({
      promptText: finalText.trim(),
      modelTarget: effectiveModel,
      latencyMs: Date.now() - startTime,
      // Only present when the answer was cut off at the output limit
      ...(finalTruncated ? { truncated: true } : {}),
      useCaseProfile: {
        id: profile.id,
        name: profile.name,
        temperature: profile.temperature,
        validation: finalValidation.isValid && !finalTruncated ? 'passed' : 'warning',
        flaggedTerms: finalValidation.forbiddenTermsFound,
        missingSections: finalValidation.missingSections,
      },
    });
  } catch (err: any) {
    const outcome = failureOutcome(err);
    // A user who left keeps their quota decision as is (refunding it would make "start and cancel" free)
    if (outcome === 'error') {
      // Refund only when no provider answered. An answer that was paid for but unusable (cut off, rejected) keeps
      // its unit: otherwise repeating such a request would run paid model calls for free.
      if (!answered) await releaseQuota(quota);
      await recordAiFailureTrace({ userId: user?.id, nodeOrigin: 'Wizard.synthesize', err, latencyMs: Date.now() - startTime });
      console.error('[Synthesize] Error:', err);
    }
    logAiRequest({ route: 'ai/synthesize', requestId, outcome, latencyMs: Date.now() - startTime, code: err?.code, stream: wantsStream });
    return sendAiFailure(res, err, 'Prompt synthesis failed on server', requestId);
  }
}
