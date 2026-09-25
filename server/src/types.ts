import { Request } from 'express';
import { z } from 'zod';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  isGuest?: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

// =================== Zod Validation Schemas ===================

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  name: z.string().min(1, 'Name is required').max(100),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const ProfileUpdateSchema = z.object({
  name: z.string().max(100).optional(),
  username: z.string().max(50).optional(),
  role: z.string().max(100).optional(),
  bio: z.string().max(1000).optional(),
  plan: z.string().max(50).optional(),
  location: z.string().max(100).optional(),
  organization: z.string().max(100).optional(),
  avatarInitials: z.string().max(5).optional(),
  avatar_initials: z.string().max(5).optional(),
  avatarUrl: z.string().url().max(1000).optional().or(z.literal('')),
  avatar_url: z.string().url().max(1000).optional().or(z.literal('')),
  github: z.string().max(100).optional(),
  huggingface: z.string().max(100).optional(),
  website: z.string().max(200).optional(),
});

export const GenerateQuestionsSchema = z.object({
  ideaText: z.string().min(3, 'Idea text must be at least 3 characters').max(10000),
  targetType: z.enum(['coding_agent', 'freelancer_brief', 'hackathon_pitch', 'no_code']).default('coding_agent'),
});

export const SynthesizeSchema = z.object({
  idea: z.object({
    ideaText: z.string().min(1),
    targetType: z.string(),
  }),
  answers: z.array(
    z.object({
      questionId: z.string(),
      value: z.union([z.string(), z.array(z.string())]),
    })
  ),
  questions: z.array(
    z.object({
      id: z.string(),
      questionText: z.string(),
      questionType: z.string(),
      options: z.array(z.string()).optional(),
    })
  ),
});

export const RefineSchema = z.object({
  currentPrompt: z.string().min(1, 'Current prompt is required').max(50000),
  followUp: z.string().min(1, 'Follow-up instruction is required').max(10000),
});

export const TestPromptSchema = z.object({
  modelId: z.string().min(1, 'Model ID is required').max(100),
  systemPrompt: z.string().max(20000).optional().default(''),
  userPrompt: z.string().min(1, 'User prompt is required').max(20000),
});

export const WorkflowSaveSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().max(200).default('Untitled Workflow'),
  nodes: z.array(z.any()).default([]),
  edges: z.array(z.any()).default([]),
});

export const PromptCreateSchema = z.object({
  title: z.string().min(1).max(200),
  snippet: z.string().max(1000).default(''),
  full_content: z.string().min(1),
  tags: z.union([z.array(z.string()), z.string()]).default([]),
  target_type: z.string().default('coding_agent'),
});

export const TraceCreateSchema = z.object({
  id: z.string().min(1).max(100),
  node_origin: z.string().max(200),
  model_target: z.string().max(200),
  tokens_used: z.number().int().min(0).default(0),
  latency_ms: z.number().int().min(0).default(0),
  status: z.string().max(50).default('success'),
});
