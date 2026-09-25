import { Router } from 'express';
import { AiService } from '../services/aiService.js';
import { QueueService } from '../services/queueService.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import {
  questionsLimiter,
  synthesizeLimiter,
  refineLimiter,
  testPromptLimiter,
} from '../middleware/rateLimiter.js';
import { prisma } from '../db.js';
import { config } from '../config.js';
import {
  GenerateQuestionsSchema,
  SynthesizeSchema,
  RefineSchema,
  TestPromptSchema,
} from '../types.js';

const router = Router();

// Section 11: Queue & Concurrency status
router.get('/queue-status', (req, res) => {
  res.json(QueueService.getStats());
});

// Generate Clarifying Questions (per-endpoint rate limited)
router.post('/generate-questions', questionsLimiter, requireAuth, async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  try {
    const validated = GenerateQuestionsSchema.parse(req.body);
    const questions = await AiService.generateQuestions(validated.ideaText, validated.targetType);

    if (req.user?.id) {
      await prisma.trace.create({
        data: {
          id: `TRC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          user_id: req.user.id,
          node_origin: 'Wizard.generateQuestions',
          model_target: 'Groq/GPT-OSS',
          tokens_used: 350,
          latency_ms: Date.now() - startTime,
          status: 'success',
        },
      }).catch((e: any) => console.error('[Trace] Failed to log question trace:', e));
    }

    res.json(questions);
  } catch (err) {
    next(err);
  }
});

// Helper: Enforce 10 prompt quota limit per 5-hour session for free tier users
async function enforcePromptQuota(req: AuthRequest, res: any): Promise<boolean> {
  if (!req.user || req.user.subscriptionTier !== 'free') {
    return true;
  }

  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
  const promptCount = await prisma.trace.count({
    where: {
      user_id: req.user.id,
      node_origin: { in: ['Wizard.synthesize', 'RefineModal.refine', 'Tester.test'] },
      created_at: { gte: fiveHoursAgo },
    },
  });

  if (promptCount >= 10) {
    res.status(429).json({
      error: 'Free Tier Limit Reached',
      code: 'FREE_TIER_QUOTA_EXCEEDED',
      message: 'Free tier accounts can generate up to 10 prompts per 5-hour session. Please upgrade to Pro for unlimited prompts.',
      sessionLimit: 10,
      sessionPrompts: promptCount,
    });
    return false;
  }

  return true;
}

// Synthesize Master Prompt & Project Brief (per-endpoint rate limited)
router.post('/synthesize', synthesizeLimiter, requireAuth, async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  try {
    if (!(await enforcePromptQuota(req, res))) return;

    const validated = SynthesizeSchema.parse(req.body);
    const content = await AiService.synthesizePrompt(
      validated.idea,
      validated.answers,
      validated.questions as any
    );

    if (req.user?.id) {
      await prisma.trace.create({
        data: {
          id: `TRC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          user_id: req.user.id,
          node_origin: 'Wizard.synthesize',
          model_target: 'Groq/GPT-OSS',
          tokens_used: 1200,
          latency_ms: Date.now() - startTime,
          status: 'success',
        },
      }).catch((e: any) => console.error('[Trace] Failed to log synthesize trace:', e));
    }

    res.json({ content });
  } catch (err) {
    next(err);
  }
});

// Refine Prompt with user feedback (per-endpoint rate limited)
router.post('/refine', refineLimiter, requireAuth, async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  try {
    if (!(await enforcePromptQuota(req, res))) return;

    const validated = RefineSchema.parse(req.body);
    const result = await AiService.refinePrompt(validated.currentPrompt, validated.followUp);

    if (req.user?.id) {
      await prisma.trace.create({
        data: {
          id: `TRC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          user_id: req.user.id,
          node_origin: 'RefineModal.refine',
          model_target: 'Groq/GPT-OSS',
          tokens_used: 800,
          latency_ms: Date.now() - startTime,
          status: 'success',
        },
      }).catch((e: any) => console.error('[Trace] Failed to log refine trace:', e));
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Test Prompt across multiple target models (per-endpoint rate limited)
router.post('/test', testPromptLimiter, requireAuth, async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  try {
    if (!(await enforcePromptQuota(req, res))) return;

    const validated = TestPromptSchema.parse(req.body);
    const content = await AiService.testPrompt(
      validated.modelId,
      validated.systemPrompt,
      validated.userPrompt
    );

    if (req.user?.id) {
      await prisma.trace.create({
        data: {
          id: `TRC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          user_id: req.user.id,
          node_origin: `Playground.test(${validated.modelId})`,
          model_target: validated.modelId,
          tokens_used: 450,
          latency_ms: Date.now() - startTime,
          status: 'success',
        },
      }).catch((e: any) => console.error('[Trace] Failed to log test trace:', e));
    }

    res.json({ content });
  } catch (err) {
    next(err);
  }
});

// Get available models and backend provider statuses
router.get('/models', requireAuth, (req, res) => {
  res.json({
    models: [
      { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B (Groq)', provider: 'Groq', available: config.ai.groqKeys.length > 0 },
      { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B (Groq)', provider: 'Groq', available: config.ai.groqKeys.length > 0 },
      { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B (Groq)', provider: 'Groq', available: config.ai.groqKeys.length > 0 },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (OpenRouter)', provider: 'OpenRouter', available: config.ai.openRouterKeys.length > 0 },
      { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (OpenRouter)', provider: 'OpenRouter', available: config.ai.openRouterKeys.length > 0 },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', provider: 'Google', available: config.ai.geminiKeys.length > 0 },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', provider: 'Google', available: config.ai.geminiKeys.length > 0 },
    ],
  });
});

export default router;
