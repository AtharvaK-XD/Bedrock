import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from '../_lib/auth.js';
import { sanitizeAndDelimitPrompt, checkPromptInjection, recordExecutionTrace } from '../_lib/security.js';
import { executeAiCompletion } from '../_lib/ai.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  const user = await authenticateRequest(req);
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

  const body = req.body || {};
  const currentPrompt = (body.currentPrompt || body.prompt || '').trim();
  const instruction = (body.instruction || body.refinement || '').trim();

  if (!currentPrompt || !instruction) {
    return res.status(400).json({ error: 'currentPrompt and instruction are required' });
  }

  checkPromptInjection(instruction, user?.id, ip);

  const systemPrompt = `You are Bedrock's Prompt Refinement Engine.
Your task is to take the existing prompt and apply the user's specific refinement instruction with surgical precision.
Preserve all formatting and existing sections unless instructed to alter them.
Enhance clarity, remove ambiguities, and incorporate new guardrails.
Output the updated prompt directly in full markdown. Do not include introductory conversational text.`;

  const payload = `EXISTING PROMPT:\n${currentPrompt}\n\nREFINEMENT INSTRUCTION:\n${instruction}`;
  const safeContent = sanitizeAndDelimitPrompt(payload);

  try {
    const { text, model } = await executeAiCompletion(safeContent, systemPrompt);

    if (user?.id) {
      await recordExecutionTrace({
        userId: user.id,
        nodeOrigin: 'RefineModal.refine',
        modelTarget: model,
        tokensUsed: Math.max(400, Math.round(text.length / 3.5)),
        latencyMs: Date.now() - startTime,
        status: 'success',
      });
    }

    return res.status(200).json({
      updatedMarkdown: text.trim(),
      summary: `Applied refinement: "${instruction.slice(0, 80)}"`,
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
