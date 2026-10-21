/**
 * Bedrock Subscription Tiers and Feature Access Guard
 *
 * Tier Hierarchy:
 * 1. Free Plan ($0 / ₹0) - 100% Free models (Gemini Flash Lite, Groq Qwen, OpenRouter Free), max 10 prompts/day, 3 DAG nodes, 5 library items.
 * 2. Pro Plan (₹399 / ~$5/mo) - Free models + Fast Frontier (GPT-4o Mini, Claude Haiku, Llama 3.3 70B, Mistral Large), unlimited prompts, 15 DAG nodes, .cursorrules export.
 * 3. Ultimate Plan (₹999 / ~$12-$15/mo) - Everything in Pro + Frontier Flagships (Claude 3.5 Sonnet, GPT-4o, o3-mini, Sonar Pro), unlimited DAG nodes, automated evals, priority queue.
 */

export type SubscriptionTier = 'free' | 'advanced' | 'pro' | 'ultimate';

export interface PlanLimits {
  name: string;
  tier: SubscriptionTier;
  dailyGenerationsLimit: number;
  dagNodeLimit: number;
  libraryPromptLimit: number;
  allowedExportFormats: ('txt' | 'md' | 'cursor' | 'windsurf' | 'json')[];
  hasLiveTelemetry: boolean;
  hasAutomatedEvals: boolean;
  hasPriorityQueue: boolean;
  features: string[];
}

export const TIER_LIMITS: Record<SubscriptionTier, PlanLimits> = {
  free: {
    name: 'Free Plan',
    tier: 'free',
    dailyGenerationsLimit: 10,
    dagNodeLimit: 3,
    libraryPromptLimit: 5,
    allowedExportFormats: ['txt'],
    hasLiveTelemetry: true,
    hasAutomatedEvals: false,
    hasPriorityQueue: false,
    features: [
      'Gemini 3.5 Flash Lite & Groq Qwen 27B models ($0)',
      '10 prompt generations per day',
      '3 DAG canvas pipeline nodes',
      'Up to 5 custom prompt library slots',
    ],
  },
  advanced: {
    name: 'Pro Plan',
    tier: 'pro',
    dailyGenerationsLimit: Infinity,
    dagNodeLimit: 15,
    libraryPromptLimit: 100,
    allowedExportFormats: ['txt', 'md', 'cursor', 'windsurf'],
    hasLiveTelemetry: true,
    hasAutomatedEvals: false,
    hasPriorityQueue: true,
    features: [
      'Unlimited daily prompt generations ($0 marginal cost)',
      'GPT-4o Mini, Claude 3.5 Haiku & Llama 3.3 70B',
      '15 DAG canvas pipeline nodes with branching logic',
      'Up to 100 library prompt templates with tags',
      'Export to .cursorrules and system prompts',
    ],
  },
  pro: {
    name: 'Pro Plan',
    tier: 'pro',
    dailyGenerationsLimit: Infinity,
    dagNodeLimit: 15,
    libraryPromptLimit: 100,
    allowedExportFormats: ['txt', 'md', 'cursor', 'windsurf'],
    hasLiveTelemetry: true,
    hasAutomatedEvals: false,
    hasPriorityQueue: true,
    features: [
      'Unlimited daily prompt generations ($0 marginal cost)',
      'GPT-4o Mini, Claude 3.5 Haiku & Llama 3.3 70B',
      '15 DAG canvas pipeline nodes with branching logic',
      'Up to 100 library prompt templates with tags',
      'Export to .cursorrules and system prompts',
    ],
  },
  ultimate: {
    name: 'Ultimate Plan',
    tier: 'ultimate',
    dailyGenerationsLimit: Infinity,
    dagNodeLimit: Infinity,
    libraryPromptLimit: Infinity,
    allowedExportFormats: ['txt', 'md', 'cursor', 'windsurf', 'json'],
    hasLiveTelemetry: true,
    hasAutomatedEvals: true,
    hasPriorityQueue: true,
    features: [
      'Claude 3.5 Sonnet Flagship & GPT-4o Flagship',
      'o3-mini & OpenAI reasoning models',
      'Unlimited DAG nodes & infinite canvas branches',
      'Automated quality evals & rubric judge',
      'VIP low-latency queue & lifetime traces',
    ],
  },
};

/**
 * Normalizes user plan strings from database or profile to a standard SubscriptionTier.
 */
export function normalizeTier(plan?: string | null): SubscriptionTier {
  if (!plan) return 'free';
  const p = plan.toLowerCase().trim();
  if (p.includes('ultimate')) return 'ultimate';
  if (p.includes('advanced') || p.includes('pro')) return 'pro';
  return 'free';
}

/**
 * Returns the plan limits object for a given plan string.
 */
export function getPlanLimits(plan?: string | null): PlanLimits {
  const tier = normalizeTier(plan);
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}

/**
 * Determines which tier is strictly required to execute a specific model.
 */
export function getModelRequiredTier(modelId: string): 'free' | 'pro' | 'ultimate' {
  if (!modelId) return 'free';
  const m = modelId.toLowerCase().trim();

  // 1. Ultimate Tier Models (Frontier reasoning and flagship frontier intelligence)
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

  // 2. Pro Tier Models (Fast frontier compact models & large open weights)
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

  // 3. Free Tier Models ($0.00 zero-cost models)
  // Gemini 3.5 Flash Lite, Groq Qwen 3.8 27B, GPT-OSS 120B/20B, OpenRouter Free, Nemotron Ultra, Poolside, Ollama
  return 'free';
}

/**
 * Evaluates whether a model is permitted under the user's active subscription plan.
 */
export function isModelAllowedForTier(modelId: string, userPlan?: string | null): boolean {
  const userTier = normalizeTier(userPlan);
  const required = getModelRequiredTier(modelId);

  if (userTier === 'ultimate') return true;
  if (userTier === 'pro') return required !== 'ultimate';
  return required === 'free';
}

/**
 * Daily prompt usage tracking for Free plan enforcement in localStorage.
 */
const DAILY_USAGE_STORAGE_KEY = 'bedrock_daily_prompt_usage';

interface DailyUsageRecord {
  date: string;
  count: number;
}

export function getDailyPromptUsage(): { count: number; limit: number; remaining: number } {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(DAILY_USAGE_STORAGE_KEY);
    if (raw) {
      const record: DailyUsageRecord = JSON.parse(raw);
      if (record.date === today) {
        return {
          count: record.count,
          limit: 10,
          remaining: Math.max(0, 10 - record.count),
        };
      }
    }
    return { count: 0, limit: 10, remaining: 10 };
  } catch {
    return { count: 0, limit: 10, remaining: 10 };
  }
}

export function recordPromptGeneration(userPlan?: string | null): { allowed: boolean; remaining: number } {
  const tier = normalizeTier(userPlan);
  if (tier !== 'free') {
    return { allowed: true, remaining: Infinity };
  }

  const today = new Date().toISOString().slice(0, 10);
  const current = getDailyPromptUsage();

  if (current.count >= current.limit) {
    return { allowed: false, remaining: 0 };
  }

  try {
    const nextCount = current.count + 1;
    localStorage.setItem(
      DAILY_USAGE_STORAGE_KEY,
      JSON.stringify({ date: today, count: nextCount })
    );
    return { allowed: true, remaining: Math.max(0, current.limit - nextCount) };
  } catch {
    return { allowed: true, remaining: current.remaining };
  }
}
