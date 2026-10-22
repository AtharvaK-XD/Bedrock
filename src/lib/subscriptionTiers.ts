/**
 * Bedrock Workstation Tier & Access Architecture (BYOK - Bring Your Own Keys)
 *
 * Bedrock is a developer workstation powered by user-provided API keys
 * (OpenRouter, Groq, OpenAI, Anthropic, Gemini, Mistral, Ollama).
 *
 * Under the BYOK model, all features, DAG nodes, prompt library slots, export targets,
 * and frontier models are 100% unlocked with zero artificial subscription paywalls.
 */

export type SubscriptionTier = 'free' | 'advanced' | 'pro' | 'ultimate' | 'workstation';

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

const FULL_WORKSTATION_LIMITS: PlanLimits = {
  name: 'Workstation Edition (BYOK)',
  tier: 'workstation',
  dailyGenerationsLimit: Infinity,
  dagNodeLimit: Infinity,
  libraryPromptLimit: Infinity,
  allowedExportFormats: ['txt', 'md', 'cursor', 'windsurf', 'json'],
  hasLiveTelemetry: true,
  hasAutomatedEvals: true,
  hasPriorityQueue: true,
  features: [
    'All frontier models unlocked with your own API keys',
    'Unlimited daily prompt generations & DAG branches',
    'Full IDE & SDK exporters (.cursorrules, CLAUDE.md, Windsurf)',
    'Real-time dual-model benchmark arena with automated assertions',
    'Unlimited prompt library templates & multi-format exports',
  ],
};

export const TIER_LIMITS: Record<SubscriptionTier, PlanLimits> = {
  free: { ...FULL_WORKSTATION_LIMITS, name: 'Workstation Edition (BYOK)' },
  advanced: { ...FULL_WORKSTATION_LIMITS, name: 'Workstation Edition (BYOK)' },
  pro: { ...FULL_WORKSTATION_LIMITS, name: 'Workstation Edition (BYOK)' },
  ultimate: { ...FULL_WORKSTATION_LIMITS, name: 'Workstation Edition (BYOK)' },
  workstation: FULL_WORKSTATION_LIMITS,
};

/**
 * Normalizes user plan strings to standard SubscriptionTier.
 * Under BYOK, all valid sessions resolve to the fully-unlocked Workstation tier.
 */
export function normalizeTier(_plan?: string | null): SubscriptionTier {
  return 'workstation';
}

/**
 * Returns the fully unlocked plan limits for any active session.
 */
export function getPlanLimits(_plan?: string | null): PlanLimits {
  return FULL_WORKSTATION_LIMITS;
}

/**
 * All models are available in the BYOK Workstation environment.
 */
export function getModelRequiredTier(_modelId: string): 'free' | 'pro' | 'ultimate' {
  return 'free';
}

/**
 * Evaluates whether a model is permitted under BYOK.
 * Always returns true since users run with their own configured API keys.
 */
export function isModelAllowedForTier(_modelId: string, _userPlan?: string | null): boolean {
  return true;
}

/**
 * Daily prompt usage tracking for BYOK Workstation (Unlimited).
 */
export function getDailyPromptUsage(): { count: number; limit: number; remaining: number } {
  return {
    count: 0,
    limit: Infinity,
    remaining: Infinity,
  };
}

/**
 * Records prompt generation under BYOK (always permitted).
 */
export function recordPromptGeneration(_userPlan?: string | null): { allowed: boolean; remaining: number } {
  return {
    allowed: true,
    remaining: Infinity,
  };
}
