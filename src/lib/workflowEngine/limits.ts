import type { EngineLimits, EngineTier } from './types';

/** Per-run caps. Every AI call still counts against the normal server quota as well. */
export const ENGINE_LIMITS: Record<EngineTier, EngineLimits> = {
  // maxNodes mirrors TIER_LIMITS.dagNodeLimit in src/lib/subscriptionTiers.ts
  free: { maxAiCalls: 15, maxForEachItems: 5, maxNodes: 3 },
  pro: { maxAiCalls: 60, maxForEachItems: 20, maxNodes: 15 },
  ultimate: { maxAiCalls: 200, maxForEachItems: 50, maxNodes: Infinity },
};

export function resolveLimits(tier: EngineTier, override?: Partial<EngineLimits>): EngineLimits {
  return { ...(ENGINE_LIMITS[tier] ?? ENGINE_LIMITS.free), ...(override ?? {}) };
}

/** The model an AI node uses when it names none (same default as the page's addNode). */
export const DEFAULT_MODEL_ID = 'gemini-3.5-flash-lite';

/** Text the original Run button writes on a node whose incoming paths were all turned off. */
export const LEGACY_SKIP_TEXT = '[Branch Skipped: Condition criteria was not met]';
export const UPSTREAM_FAILED_SKIP_TEXT = '[Skipped: an earlier step failed]';
