import { getRedisClient } from './rateLimiter.js';

export interface ProviderTarget {
  id: string;
  name: string;
  model: string;
  priority: number; // 1 = highest
  weight: number;
}

export const AI_PROVIDERS: ProviderTarget[] = [
  {
    id: 'groq-oss-120b',
    name: 'Groq GPT-OSS 120B',
    model: 'openai/gpt-oss-120b',
    priority: 1,
    weight: 5,
  },
  {
    id: 'groq-oss-20b',
    name: 'Groq GPT-OSS 20B',
    model: 'openai/gpt-oss-20b',
    priority: 1,
    weight: 4,
  },
  {
    id: 'groq-qwen',
    name: 'Groq Qwen 3.8 27B',
    model: 'qwen/qwen3.8-27b',
    priority: 2,
    weight: 3,
  },
  {
    id: 'gemini-flash',
    name: 'Google Gemini Flash Latest',
    model: 'gemini-flash-latest',
    priority: 2,
    weight: 4,
  },
  {
    id: 'openrouter-gpt4o',
    name: 'OpenRouter GPT-4o Mini',
    model: 'openai/gpt-4o-mini',
    priority: 3,
    weight: 3,
  },
];

// Local in-memory circuit fallback
const localCircuitMap = new Map<string, { trippedUntil: number; failures: number }>();

const TRIP_DURATION_MS = 30000; // 30s cooldown before probing
const MAX_FAILURES = 3;

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
 * Records a failure on an AI provider. Trips circuit breaker if threshold is exceeded.
 */
export async function recordProviderFailure(providerId: string, error?: string): Promise<void> {
  const redis = getRedisClient();

  // 1. Update local circuit state
  const local = localCircuitMap.get(providerId) || { trippedUntil: 0, failures: 0 };
  local.failures += 1;

  if (local.failures >= MAX_FAILURES) {
    local.trippedUntil = Date.now() + TRIP_DURATION_MS;
    console.warn(`[LoadBalancer] Circuit for ${providerId} TRIPPED locally. Error: ${error || 'Unknown'}`);
  }
  localCircuitMap.set(providerId, local);

  // 2. Update distributed Redis circuit state
  if (redis) {
    try {
      const failureCount = await redis.incr(`failures:ai:${providerId}`);
      await redis.expire(`failures:ai:${providerId}`, 60);

      if (failureCount >= MAX_FAILURES) {
        await redis.set(`circuit:ai:${providerId}`, 'tripped', { ex: Math.round(TRIP_DURATION_MS / 1000) });
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
 * Selects the next healthy AI provider using distributed round-robin and weighted load balancing.
 */
export async function selectOptimalProvider(
  availableProviders: ProviderTarget[] = AI_PROVIDERS
): Promise<ProviderTarget | null> {
  // Filter for healthy providers
  const healthy: ProviderTarget[] = [];
  for (const p of availableProviders) {
    if (await isProviderHealthy(p.id)) {
      healthy.push(p);
    }
  }

  if (healthy.length === 0) {
    // If all are tripped, fail-open to the highest priority provider to probe recovery
    return availableProviders[0] || null;
  }

  const redis = getRedisClient();
  let index = 0;

  if (redis) {
    try {
      const counter = await redis.incr('loadbalance:ai:counter');
      index = Math.abs(counter) % healthy.length;
    } catch {
      localRoundRobin = (localRoundRobin + 1) % healthy.length;
      index = localRoundRobin;
    }
  } else {
    localRoundRobin = (localRoundRobin + 1) % healthy.length;
    index = localRoundRobin;
  }

  return healthy[index];
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
