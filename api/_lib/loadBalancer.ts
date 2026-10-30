import { getRedisClient } from './rateLimiter.js';

export interface ProviderTarget {
  id: string;
  name: string;
  model: string;
  provider: 'groq' | 'gemini' | 'openrouter';
  priority: number; // 1 = highest
  weight: number;
}

export const AI_PROVIDERS: ProviderTarget[] = [
  {
    id: 'groq-llama-70b',
    name: 'Groq LLaMA 3.3 70B',
    model: 'llama-3.3-70b-versatile',
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
    id: 'groq-llama-8b',
    name: 'Groq LLaMA 3.1 8B',
    model: 'llama-3.1-8b-instant',
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
 * Automatically identifies 429 rate limit errors and cascades cooldown to sibling models sharing the key.
 */
export async function recordProviderFailure(providerId: string, error?: string): Promise<void> {
  const redis = getRedisClient();
  const errMsg = error || '';
  const isRateLimit = errMsg.includes('429') || errMsg.toLowerCase().includes('rate limit');
  const cooldownMs = isRateLimit ? RATE_LIMIT_COOLDOWN_MS : TRIP_DURATION_MS;

  // 1. Update local circuit state
  const local = localCircuitMap.get(providerId) || { trippedUntil: 0, failures: 0 };
  local.failures += 1;

  // If rate-limited or threshold reached, trip immediately
  if (isRateLimit || local.failures >= MAX_FAILURES) {
    local.trippedUntil = Date.now() + cooldownMs;
    console.warn(`[LoadBalancer] Circuit for ${providerId} TRIPPED locally (${isRateLimit ? '429 Rate Limit' : 'Failures: ' + local.failures}). Cooldown: ${cooldownMs / 1000}s`);

    // If rate limit hit, cascade trip to other models sharing the same provider API key
    const prefix = providerId.split('-')[0];
    if (isRateLimit && prefix) {
      for (const p of AI_PROVIDERS) {
        if (p.id.startsWith(prefix) && p.id !== providerId) {
          const sibling = localCircuitMap.get(p.id) || { trippedUntil: 0, failures: 0 };
          sibling.failures = MAX_FAILURES;
          sibling.trippedUntil = Date.now() + cooldownMs;
          localCircuitMap.set(p.id, sibling);
          console.warn(`[LoadBalancer] Cascaded 429 rate-limit cooldown to sibling provider ${p.id}`);
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

      if (isRateLimit || failureCount >= MAX_FAILURES) {
        await redis.set(`circuit:ai:${providerId}`, 'tripped', { ex: Math.round(cooldownMs / 1000) });
        console.warn(`[LoadBalancer] Distributed circuit for ${providerId} TRIPPED in Redis.`);
      }
    } catch (err) {
      console.warn(`[LoadBalancer] Failed to update Redis circuit for ${providerId}:`, err);
    }
  }
}

/**
 * Records a successful response on an AI provider, resetting failures.
 */
export async function recordProviderSuccess(providerId: string): Promise<void> {
  localCircuitMap.set(providerId, { trippedUntil: 0, failures: 0 });

  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(`failures:ai:${providerId}`);
      await redis.del(`circuit:ai:${providerId}`);
      await redis.incr(`metrics:ai:${providerId}:successes`);
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
 * Gets load balancing and circuit status for observability and health endpoints.
 */
export async function getLoadBalancerMetrics() {
  const redis = getRedisClient();
  const statuses: Record<string, { healthy: boolean; distributedState: string }> = {};

  for (const p of AI_PROVIDERS) {
    const isHealthy = await isProviderHealthy(p.id);
    let distState = 'unknown';

    if (redis) {
      try {
        const val = await redis.get(`circuit:ai:${p.id}`);
        distState = val ? 'tripped' : 'active';
      } catch {
        distState = 'redis-unreachable';
      }
    } else {
      distState = 'local-only';
    }

    statuses[p.id] = {
      healthy: isHealthy,
      distributedState: distState,
    };
  }

  return {
    strategy: 'Upstash Distributed Round-Robin & Circuit Breaker',
    redisConnected: Boolean(redis),
    providers: statuses,
  };
}
