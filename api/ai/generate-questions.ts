import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { sanitizeAndDelimitPrompt, checkPromptInjection, recordExecutionTrace } from '../_lib/security.js';
import { executeAiCompletion, QuestionOutput } from '../_lib/ai.js';
import { enforceRateLimit } from '../_lib/rateLimiter.js';
import { buildQuestionsSystemPrompt } from '../_lib/aiPrompts.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Enforce distributed Upstash Redis rate limiting
  const allowed = await enforceRateLimit(req, res, 'questions');
  if (!allowed) return;

  const startTime = Date.now();
  const user = await authenticateRequest(req);
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

  const body = req.body || {};
  const ideaText = (body.ideaText || body.rawText || '').trim();
  const targetType = body.targetType || 'General Prompt';

  if (!ideaText) {
    return res.status(400).json({ error: 'ideaText is required' });
  }

  // Security: Check for prompt injection
  checkPromptInjection(ideaText, user?.id, ip);

  const systemPrompt = buildQuestionsSystemPrompt(targetType);

  const safePrompt = sanitizeAndDelimitPrompt(ideaText);

  try {
    const { text, model } = await executeAiCompletion(safePrompt, systemPrompt);

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

    // Safe fallback questions if parsing fails
    const fallbackQuestions: QuestionOutput[] = [
      {
        id: 'fallback_1',
        questionText: 'What is the primary target audience or recipient for this prompt?',
        questionType: 'single_select',
        options: ['Technical / Developers', 'Business / Leadership', 'General Public', 'Academic / Research'],
      },
      {
        id: 'fallback_2',
        questionText: 'What tone of voice should the generated output adopt?',
        questionType: 'single_select',
        options: ['Authoritative & Technical', 'Concise & Actionable', 'Inspirational & Creative', 'Analytical & Formal'],
      },
      {
        id: 'fallback_3',
        questionText: 'Are there any strict constraints or formats required?',
        questionType: 'free_text',
      },
    ];

    return res.status(200).json(fallbackQuestions);
  }
}
