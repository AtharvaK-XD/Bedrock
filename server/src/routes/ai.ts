import { Router } from 'express';
import { AiService } from '../services/aiService.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimiter.js';
import { prisma, logSecurityEvent } from '../db.js';
import { config } from '../config.js';
import {
  GenerateQuestionsSchema,
  SynthesizeSchema,
  RefineSchema,
  TestPromptSchema,
} from '../types.js';

const router = Router();

// Apply AI rate limiter to all AI routes
router.use(aiLimiter);

// Generate Clarifying Questions
router.post('/generate-questions', requireAuth, async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  try {
    const validated = GenerateQuestionsSchema.parse(req.body);
    const questions = await AiService.generateQuestions(validated.ideaText, validated.targetType);

    // Record performance trace
    if (req.user?.id) {
      await prisma.trace.create({
        data: {
          id: `TRC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          user_id: req.user.id,
          node_origin: 'Wizard.generateQuestions',
          model_target: 'Groq/Llama-3.3-70b',
          tokens_used: 350,
          latency_ms: Date.now() - startTime,
          status: 'success',
        },
      }).catch((e) => console.error('[Trace] Failed to log question trace:', e));
    }

    res.json(questions);
  } catch (err) {
    next(err);
  }
});

// Synthesize Master Prompt & Project Brief
router.post('/synthesize', requireAuth, async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  try {
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
          model_target: 'Groq/Llama-3.3-70b',
          tokens_used: 1200,
          latency_ms: Date.now() - startTime,
          status: 'success',
        },
      }).catch((e) => console.error('[Trace] Failed to log synthesize trace:', e));
    }

    res.json({ content });
  } catch (err) {
    next(err);
  }
});

// Refine Prompt with user feedback
router.post('/refine', requireAuth, async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  try {
    const validated = RefineSchema.parse(req.body);
    const result = await AiService.refinePrompt(validated.currentPrompt, validated.followUp);

    if (req.user?.id) {
      await prisma.trace.create({
        data: {
          id: `TRC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          user_id: req.user.id,
          node_origin: 'RefineModal.refine',
          model_target: 'Groq/Llama-3.3-70b',
          tokens_used: 800,
          latency_ms: Date.now() - startTime,
          status: 'success',
        },
      }).catch((e) => console.error('[Trace] Failed to log refine trace:', e));
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Test Prompt across multiple target models
router.post('/test', requireAuth, async (req: AuthRequest, res, next) => {
  const startTime = Date.now();
  try {
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
      }).catch((e) => console.error('[Trace] Failed to log test trace:', e));
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
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', provider: 'Groq', available: Boolean(config.ai.groqKey) },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', provider: 'Groq', available: Boolean(config.ai.groqKey) },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', available: Boolean(config.ai.geminiKey) },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', available: Boolean(config.ai.geminiKey) },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (OpenRouter)', provider: 'OpenRouter', available: Boolean(config.ai.openRouterKey) },
      { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (OpenRouter)', provider: 'OpenRouter', available: Boolean(config.ai.openRouterKey) },
      { id: 'hf/meta-llama/Llama-3.2-3B-Instruct', name: 'Llama 3.2 3B Instruct', provider: 'HuggingFace', available: Boolean(config.ai.huggingFaceKey) },
    ],
  });
});

export default router;
