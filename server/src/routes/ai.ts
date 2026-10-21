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
          model_target: 'Groq/Llama-3.3',
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

// Helper: Enforce model tier authorization based on verified user subscription
function getModelRequiredTier(modelId: string): 'free' | 'pro' | 'ultimate' {
  if (!modelId) return 'free';
  const m = modelId.toLowerCase().trim();

  // Ultimate Tier Models (Frontier reasoning and flagship intelligence)
  if (
    m.includes('claude-3-5-sonnet') ||
    m.includes('claude-sonnet') ||
    m.includes('claude-opus') ||
    (m.includes('gpt-4o') && !m.includes('mini')) ||
    m.includes('gpt-4-turbo') ||
    m.includes('o3-mini') ||
    m.includes('o1-mini') ||
    m.includes('o1') ||
    m.includes('sonar-pro') ||
    m.includes('sonar-reasoning-pro') ||
    m.includes('grok-3') ||
    m.includes('command-r-plus') ||
    m.includes('copilot-pro')
  ) {
    return 'ultimate';
  }

  // Pro Tier Models (Fast frontier compact models & large open weights)
  if (
    m.includes('gpt-4o-mini') ||
    m.includes('claude-3-5-haiku') ||
    m.includes('claude-haiku') ||
    m.includes('llama-3.3') ||
    m.includes('llama-3.1-8b') ||
    m.includes('mistral-large') ||
    m.includes('mixtral-8x22b') ||
    m.includes('sonar') ||
    m.includes('grok-2') ||
    m.includes('deepseek-coder-v2')
  ) {
    return 'pro';
  }

  return 'free';
}

function enforceModelTierAccess(req: AuthRequest, res: any, modelId: string): boolean {
  const userTier = (req.user?.subscriptionTier || 'free').toLowerCase();
  const required = getModelRequiredTier(modelId);

  if (required === 'ultimate' && !userTier.includes('ultimate')) {
    res.status(403).json({
      error: 'Model Requires Ultimate Plan',
      code: 'TIER_UPGRADE_REQUIRED',
      requiredTier: 'ultimate',
      message: `${modelId} requires an active Ultimate Plan subscription.`,
    });
    return false;
  }

  if (required === 'pro' && userTier === 'free') {
    res.status(403).json({
      error: 'Model Requires Pro Plan',
      code: 'TIER_UPGRADE_REQUIRED',
      requiredTier: 'pro',
      message: `${modelId} requires a Pro or Ultimate Plan subscription.`,
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
          model_target: 'Groq/Llama-3.3',
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
    const result = await AiService.refinePrompt(
      validated.currentPrompt,
      validated.followUp,
      validated.conversationHistory
    );

    if (req.user?.id) {
      await prisma.trace.create({
        data: {
          id: `TRC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          user_id: req.user.id,
          node_origin: 'RefineModal.refine',
          model_target: 'Groq/Llama-3.3',
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
    if (!enforceModelTierAccess(req, res, validated.modelId)) return;

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
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', provider: 'Groq', available: config.ai.groqKeys.length > 0 },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (Groq)', provider: 'Groq', available: config.ai.groqKeys.length > 0 },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B (Groq)', provider: 'Groq', available: config.ai.groqKeys.length > 0 },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Groq)', provider: 'Groq', available: config.ai.groqKeys.length > 0 },
      { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', provider: 'Google', available: config.ai.geminiKeys.length > 0 },
      { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite', provider: 'Google', available: config.ai.geminiKeys.length > 0 },
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', provider: 'Google', available: config.ai.geminiKeys.length > 0 },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (OpenRouter)', provider: 'OpenRouter', available: config.ai.openRouterKeys.length > 0 },
      { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B (OpenRouter)', provider: 'OpenRouter', available: config.ai.openRouterKeys.length > 0 },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (OpenRouter)', provider: 'OpenRouter', available: config.ai.openRouterKeys.length > 0 },
    ],
  });
});

export default router;
