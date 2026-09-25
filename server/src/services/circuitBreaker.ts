export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface ProviderHealth {
  provider: string;
  state: CircuitState;
  consecutiveFailures: number;
  totalSuccesses: number;
  totalFailures: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  nextAllowedAttemptTime: number;
}

export class CircuitBreaker {
  private static providers: Map<string, ProviderHealth> = new Map();
  private static FAILURE_THRESHOLD = 3; // Trip after 3 consecutive failures
  private static RECOVERY_COOLDOWN_MS = 30000; // 30 seconds wait before probing

  private static getOrCreate(provider: string): ProviderHealth {
    let health = this.providers.get(provider);
    if (!health) {
      health = {
        provider,
        state: 'CLOSED',
        consecutiveFailures: 0,
        totalSuccesses: 0,
        totalFailures: 0,
        nextAllowedAttemptTime: 0,
      };
      this.providers.set(provider, health);
    }
    return health;
  }

  /**
   * Determine whether a request can be dispatched to the provider
   */
  public static canAttempt(provider: string): boolean {
    const health = this.getOrCreate(provider);
    const now = Date.now();

    if (health.state === 'CLOSED') {
      return true;
    }

    if (health.state === 'OPEN') {
      if (now >= health.nextAllowedAttemptTime) {
        // Cooldown passed, allow a probe attempt
        health.state = 'HALF_OPEN';
        return true;
      }
      return false; // Trip active: fail-fast to backup provider
    }

    if (health.state === 'HALF_OPEN') {
      // In half-open, allow one probe through
      return true;
    }

    return true;
  }

  /**
   * Record a successful response from a provider
   */
  public static recordSuccess(provider: string): void {
    const health = this.getOrCreate(provider);
    health.consecutiveFailures = 0;
    health.totalSuccesses += 1;
    health.lastSuccessTime = Date.now();
    health.state = 'CLOSED';
  }

  /**
   * Record a failure (timeout, 5xx, 429 rate limit) from a provider
   */
  public static recordFailure(provider: string, error?: string): { tripped: boolean } {
    const health = this.getOrCreate(provider);
    const now = Date.now();

    health.consecutiveFailures += 1;
    health.totalFailures += 1;
    health.lastFailureTime = now;

    let tripped = false;
    if (health.consecutiveFailures >= this.FAILURE_THRESHOLD || health.state === 'HALF_OPEN') {
      health.state = 'OPEN';
      health.nextAllowedAttemptTime = now + this.RECOVERY_COOLDOWN_MS;
      tripped = true;
      console.warn(
        `[CircuitBreaker] Circuit for ${provider.toUpperCase()} TRIPPED to OPEN state. Failures: ${health.consecutiveFailures}. Next probe in ${this.RECOVERY_COOLDOWN_MS / 1000}s. Error: ${error || 'Unknown'}`
      );
    }

    return { tripped };
  }

  /**
   * Get all provider health metrics for observability endpoints
   */
  public static getAllStatuses(): ProviderHealth[] {
    return Array.from(this.providers.values());
  }

  /**
   * Manually reset circuit state for a provider (e.g. admin or tests)
   */
  public static reset(provider: string): void {
    const health = this.getOrCreate(provider);
    health.state = 'CLOSED';
    health.consecutiveFailures = 0;
  }
}
