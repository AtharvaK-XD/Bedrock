import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { sanitizeAndDelimitPrompt, checkPromptInjection, recordExecutionTrace } from '../_lib/security.js';
import { executeAiCompletion, QuestionOutput } from '../_lib/ai.js';
import { enforceRateLimit } from '../_lib/rateLimiter.js';
import { getUseCaseProfile, classifyUseCase } from '../_lib/useCaseProfiles.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  const user = await authenticateRequest(req);
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const isPaid = user?.subscriptionTier === 'pro' || user?.subscriptionTier === 'ultimate' || user?.subscriptionTier === 'advanced';

  // Enforce distributed Upstash Redis rate limiting (per-user if authenticated, else IP)
  const allowed = await enforceRateLimit(req, res, 'questions', user?.id || ip, isPaid);
  if (!allowed) return;

  const body = req.body || {};
  const ideaText = (body.ideaText || body.rawText || '').trim();
  const targetType = body.targetType || 'coding-agent';

  if (!ideaText) {
    return res.status(400).json({ error: 'ideaText is required' });
  }

  // Security: Check for prompt injection
  checkPromptInjection(ideaText, user?.id, ip);

  const profile = getUseCaseProfile(targetType);
  const classification = classifyUseCase(ideaText, targetType);
  const systemPrompt = profile.questionPrompt;

  const safePrompt = sanitizeAndDelimitPrompt(
    `Selected Profile: ${profile.name} (${profile.tag})\nConfirmed: ${classification.isConfirmed}\n\nProject Idea: ${ideaText}`
  );

  try {
    const { text, model } = await executeAiCompletion(safePrompt, systemPrompt, user?.id);

    // Clean JSON response (strip markdown wrappers if any)
    const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text.trim();
    const questions: QuestionOutput[] = JSON.parse(jsonStr);

    if (user?.id) {
      await recordExecutionTrace({
        userId: user.id,
        nodeOrigin: 'Wizard.generateQuestions',
        modelTarget: model,
        tokensUsed: 400,
        latencyMs: Date.now() - startTime,
        status: 'success',
      });
    }

    return res.status(200).json(questions);
  } catch (err: any) {
    console.error('[GenerateQuestions] Error:', err);
    return res.status(200).json(profile.fallbackQuestions);
  }
}
