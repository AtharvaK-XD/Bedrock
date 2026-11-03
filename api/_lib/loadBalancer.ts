import { getRedisClient } from './rateLimiter.js';

export interface ProviderTarget {
  id: string;
  name: string;
  model: string;
  provider: 'groq' | 'gemini' | 'openrouter';
  priority: number; // 1 = highest
  weight: number;
}

// Groq retired llama-3.3-70b-versatile and llama-3.1-8b-instant: on 2026-11-03 both answered
// 404 model_not_found, so every Groq attempt failed and production ran on Gemini and OpenRouter only.
// Replaced by the GPT-OSS models Groq offers now (checked with a live call the same day).
export const AI_PROVIDERS: ProviderTarget[] = [
  {
    id: 'groq-gpt-oss-120b',
    name: 'Groq GPT-OSS 120B',
    model: 'openai/gpt-oss-120b',
    provider: 'groq',
    priority: 1,
    weight: 5,
  },
  {
    id: 'gemini-flash',
    name: 'Google Gemini 2.5 Flash',
    model: 'gemini-flash-latest',
    provider: 'gemini',
    priority: 1,
    weight: 5,
  },
  {
    id: 'groq-gpt-oss-20b',
    name: 'Groq GPT-OSS 20B',
    model: 'openai/gpt-oss-20b',
    provider: 'groq',
    priority: 2,
    weight: 4,
  },
  {
    id: 'openrouter-gpt4o',
    name: 'OpenRouter GPT-4o Mini',
    model: 'openai/gpt-4o-mini',
    provider: 'openrouter',
    priority: 2,
    weight: 4,
  },
  {
    id: 'gemini-flash-lite',
    name: 'Google Gemini Flash Lite',
    model: 'gemini-flash-lite-latest',
    provider: 'gemini',
    priority: 3,
    weight: 3,
  },
  // groq-deepseek (deepseek-r1-distill-llama-70b) removed: as a reasoning model it can emit
  // <think> notes into the user's prompt, and its availability on Groq is unconfirmed.
];

// Local in-memory circuit fallback
const localCircuitMap = new Map<string, { trippedUntil: number; failures: number }>();

const TRIP_DURATION_MS = 30000; // 30s cooldown before probing for standard errors
const RATE_LIMIT_COOLDOWN_MS = 15000; // 15s cooldown for 429 rate limit resets
const MAX_FAILURES = 2; // Trip faster to prevent user latency lag

/**
 * Checks whether a provider is healthy and not tripped by circuit breaker.
 */
export async function isProviderHealthy(providerId: string): Promise<boolean> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const tripped = await redis.get(`circuit:ai:${providerId}`);
      if (tripped) return false;
    } catch (err) {
      console.warn(`[LoadBalancer] Redis check failed for ${providerId}, using local circuit:`, err);
    }
  }

  const local = localCircuitMap.get(providerId);
  if (local && Date.now() < local.trippedUntil) {
    return false;
  }
  return true;
}

/**
 * Same check as isProviderHealthy for many providers at once: one Redis MGET instead of one GET
 * per provider. Falls back to the per-provider path (local circuit state) if Redis is unreachable.
 */
async function filterHealthyProviders(providers: ProviderTarget[]): Promise<ProviderTarget[]> {
  const redis = getRedisClient();
  let trippedInRedis: Set<string> | null = null;

  if (redis && providers.length > 0) {
    try {
      const values = await redis.mget<Array<string | null>>(...providers.map((p) => `circuit:ai:${p.id}`));
      trippedInRedis = new Set(providers.filter((_, i) => Boolean(values[i])).map((p) => p.id));
    } catch (err) {
      console.warn('[LoadBalancer] Redis batch check failed, using local circuit:', err);
    }
  }

  return providers.filter((p) => {
    if (trippedInRedis?.has(p.id)) return false;
    const local = localCircuitMap.get(p.id);
    return !(local && Date.now() < local.trippedUntil);
  });
}

/**
 * Records a failure on an AI provider. Trips circuit breaker if threshold is exceeded.
 * A rate limit (429) trips this model at once, for `cooldownMs` when the caller knows the provider's own wait time.
 * The sibling models on the same key are cooled too only when `siblings` is true (the key itself was refused):
 * Groq and Gemini count rate limits per model, so one model being out of quota says nothing about its sibling.
 */
export async function recordProviderFailure(
  providerId: string,
  error?: string,
  opts?: { rateLimited?: boolean; cooldownMs?: number; siblings?: boolean }
): Promise<void> {
  const redis = getRedisClient();
  const errMsg = error || '';
  // Prefer the HTTP status decided by the caller; fall back to the message text only when it is not known
  const isRateLimit = opts?.rateLimited ?? (errMsg.includes('429') || errMsg.toLowerCase().includes('rate limit'));
  const cooldownMs = opts?.cooldownMs ?? (isRateLimit ? RATE_LIMIT_COOLDOWN_MS : TRIP_DURATION_MS);
  const cascade = opts?.siblings === true;

  // 1. Update local circuit state
  const local = localCircuitMap.get(providerId) || { trippedUntil: 0, failures: 0 };
  local.failures += 1;

  // Rate limited, key refused, or threshold reached: trip immediately
  if (isRateLimit || cascade || local.failures >= MAX_FAILURES) {
    local.trippedUntil = Date.now() + cooldownMs;
    console.warn(`[LoadBalancer] Circuit for ${providerId} TRIPPED locally (${isRateLimit ? '429 Rate Limit' : cascade ? 'Key refused' : 'Failures: ' + local.failures}). Cooldown: ${cooldownMs / 1000}s`);

    // The key itself was refused: cool the other models that use the same key too
    const prefix = providerId.split('-')[0];
    if (cascade && prefix) {
      for (const p of AI_PROVIDERS) {
        if (p.id.startsWith(prefix) && p.id !== providerId) {
          const sibling = localCircuitMap.get(p.id) || { trippedUntil: 0, failures: 0 };
          sibling.failures = MAX_FAILURES;
          sibling.trippedUntil = Date.now() + cooldownMs;
          localCircuitMap.set(p.id, sibling);
          console.warn(`[LoadBalancer] Cascaded key-refused cooldown to sibling provider ${p.id}`);
        }
      }
    }
  }
  localCircuitMap.set(providerId, local);

  // 2. Update distributed Redis circuit state
  if (redis) {
    try {
      const failureCount = await redis.incr(`failures:ai:${providerId}`);
      await redis.expire(`failures:ai:${providerId}`, 60);

      if (isRateLimit || cascade || failureCount >= MAX_FAILURES) {
        await redis.set(`circuit:ai:${providerId}`, 'tripped', { ex: Math.round(cooldownMs / 1000) });
        console.warn(`[LoadBalancer] Distributed circuit for ${providerId} TRIPPED in Redis.`);

        // The key itself was refused, so the models sharing it are unusable too: tell the other server
        // instances as well, not only this one (the local cascade above only protects this instance)
        const prefix = providerId.split('-')[0];
        if (cascade && prefix) {
          for (const p of AI_PROVIDERS) {
            if (p.id.startsWith(prefix) && p.id !== providerId) {
              await redis.set(`circuit:ai:${p.id}`, 'tripped', { ex: Math.round(cooldownMs / 1000) });
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[LoadBalancer] Failed to update Redis circuit for ${providerId}:`, err);
    }
  }
}

/**
 * Records a successful response on an AI provider, resetting failures.
 * One Redis command (DEL takes both keys): this runs after every successful AI call, and Upstash bills and
 * limits per command. A per-provider success counter used to be written here too; nothing ever read it.
 */
export async function recordProviderSuccess(providerId: string): Promise<void> {
  localCircuitMap.set(providerId, { trippedUntil: 0, failures: 0 });

  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(`failures:ai:${providerId}`, `circuit:ai:${providerId}`);
    } catch {
      // Ignore
    }
  }
}

let localRoundRobin = 0;

/**
 * Smooth weighted round-robin order for one cycle: each provider appears `weight` times, spread out
 * (weights 5/5 alternate A, B, A, B ... instead of A x5 then B x5).
 */
function weightedCycle(providers: ProviderTarget[]): ProviderTarget[] {
  const weights = providers.map((p) => Math.max(1, Math.round(p.weight)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const current = weights.map(() => 0);
  const cycle: ProviderTarget[] = [];
  for (let step = 0; step < total; step++) {
    let best = 0;
    for (let i = 0; i < providers.length; i++) {
      current[i] += weights[i];
      if (current[i] > current[best]) best = i;
    }
    current[best] -= total;
    cycle.push(providers[best]);
  }
  return cycle;
}

/**
 * Selects the next healthy AI provider. Only the best healthy priority tier is used
 * (1 = strongest models); lower tiers take traffic only while every provider above them is
 * tripped. Within the tier, providers share traffic by weight via a distributed counter.
 */
export async function selectOptimalProvider(
  availableProviders: ProviderTarget[] = AI_PROVIDERS
): Promise<ProviderTarget | null> {
  // Filter for healthy providers
  const healthy = await filterHealthyProviders(availableProviders);

  if (healthy.length === 0) {
    // If all are tripped, fail-open to the highest priority provider to probe recovery
    return availableProviders[0] || null;
  }

  const bestPriority = Math.min(...healthy.map((p) => p.priority));
  const cycle = weightedCycle(healthy.filter((p) => p.priority === bestPriority));

  const redis = getRedisClient();
  let index = 0;

  if (redis) {
    try {
      const counter = await redis.incr('loadbalance:ai:counter');
      index = Math.abs(counter) % cycle.length;
    } catch {
      localRoundRobin = (localRoundRobin + 1) % cycle.length;
      index = localRoundRobin;
    }
  } else {
    localRoundRobin = (localRoundRobin + 1) % cycle.length;
    index = localRoundRobin;
  }

  return cycle[index];
}

/**
 * Order in which to try providers for one request: the chosen one first, then the others that are
 * not tripped (best priority first, then by weight), and providers with an open circuit last.
 * Stops a request from spending its time budget on providers already known to be down.
 */
export async function orderForFailover(
  candidates: ProviderTarget[],
  primary: ProviderTarget
): Promise<ProviderTarget[]> {
  const others = candidates.filter((c) => c.id !== primary.id);
  const healthy = await filterHealthyProviders(others);
  const healthyIds = new Set(healthy.map((p) => p.id));
  const byQuality = (a: ProviderTarget, b: ProviderTarget) => a.priority - b.priority || b.weight - a.weight;
  return [
    primary,
    ...others.filter((p) => healthyIds.has(p.id)).sort(byQuality),
    ...others.filter((p) => !healthyIds.has(p.id)).sort(byQuality),
  ];
}
