import { Request } from 'express';
import { z } from 'zod';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  emailVerified?: boolean;
  mfaEnabled?: boolean;
  subscriptionTier?: string;
  tokenIssuedAt?: number;
  isGuest?: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

// =================== Zod Validation Schemas ===================

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address').max(255).trim(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name: z.string().min(1, 'Name is required').max(100).trim(),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address').trim(),
  password: z.string().min(1, 'Password is required'),
});

export const ProfileUpdateSchema = z.object({
  name: z.string().max(100).trim().optional(),
  username: z.string().max(50).trim().optional(),
  role: z.string().max(100).trim().optional(),
  bio: z.string().max(1000).trim().optional(),
  plan: z.string().max(50).optional(),
  location: z.string().max(100).trim().optional(),
  organization: z.string().max(100).trim().optional(),
  avatarInitials: z.string().max(5).trim().optional(),
  avatar_initials: z.string().max(5).trim().optional(),
  avatarUrl: z.string().url().max(1000).optional().or(z.literal('')),
  avatar_url: z.string().url().max(1000).optional().or(z.literal('')),
  github: z.string().max(100).trim().optional(),
  huggingface: z.string().max(100).trim().optional(),
  website: z.string().max(200).trim().optional(),
  mfa_enabled: z.boolean().optional(),
});

export const GenerateQuestionsSchema = z.object({
  ideaText: z
    .string()
    .min(3, 'Idea text must be at least 3 characters')
    .max(5000, 'Idea text cannot exceed 5,000 characters')
    .trim(),
  targetType: z.enum(['coding_agent', 'freelancer_brief', 'hackathon_pitch', 'no_code']).default('coding_agent'),
});

export const SynthesizeSchema = z.object({
  idea: z.object({
    ideaText: z.string().min(1).max(5000).trim(),
    targetType: z.string().max(100),
  }),
  answers: z
    .array(
      z.object({
        questionId: z.string().max(50),
        value: z.union([z.string().max(2000), z.array(z.string().max(500))]),
      })
    )
    .max(15, 'Maximum 15 answers allowed'),
  questions: z.array(
    z.object({
      id: z.string().max(50),
      questionText: z.string().max(500),
      questionType: z.string().max(50),
      options: z.array(z.string().max(200)).optional(),
    })
  ).max(15),
});

export const RefineSchema = z.object({
  currentPrompt: z
    .string()
    .min(1, 'Current prompt is required')
    .max(30000, 'Prompt cannot exceed 30,000 characters'),
  followUp: z
    .string()
    .min(1, 'Follow-up instruction is required')
    .max(5000, 'Follow-up cannot exceed 5,000 characters')
    .trim(),
});

export const TestPromptSchema = z.object({
  modelId: z.string().min(1, 'Model ID is required').max(100).trim(),
  systemPrompt: z.string().max(10000, 'System prompt cannot exceed 10,000 characters').optional().default(''),
  userPrompt: z
    .string()
    .min(1, 'User prompt is required')
    .max(10000, 'User prompt cannot exceed 10,000 characters')
    .trim(),
});

export const WorkflowSaveSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().max(200).trim().default('Untitled Workflow'),
  nodes: z.array(z.any()).max(500, 'Workflow cannot exceed 500 nodes').default([]),
  edges: z.array(z.any()).max(1000, 'Workflow cannot exceed 1,000 edges').default([]),
});

export const PromptCreateSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  snippet: z.string().max(1000).trim().default(''),
  full_content: z.string().min(1).max(50000),
  tags: z.union([z.array(z.string().max(50)).max(20), z.string().max(200)]).default([]),
  target_type: z.string().max(100).default('coding_agent'),
});

export const TraceCreateSchema = z.object({
  id: z.string().min(1).max(100).trim(),
  node_origin: z.string().max(200).trim(),
  model_target: z.string().max(200).trim(),
  tokens_used: z.number().int().min(0).max(1000000).default(0),
  latency_ms: z.number().int().min(0).max(300000).default(0),
  status: z.string().max(50).default('success'),
});

// Section 6: Razorpay & Billing Schemas
export const CreateOrderSchema = z.object({
  tier: z.enum(['advanced', 'ultimate']),
});

export const VerifyPaymentSchema = z.object({
  orderId: z.string().min(1).max(100),
  paymentId: z.string().min(1).max(100),
  signature: z.string().min(1).max(255),
  tier: z.enum(['advanced', 'ultimate']),
});
