import { QueueService } from './queueService.js';
import { logSecurityEvent } from '../db.js';

interface RequestMetric {
  endpoint: string;
  statusCode: number;
  durationMs: number;
  timestamp: number;
}

export class MetricsService {
  private static metricsWindow: RequestMetric[] = [];
  private static MAX_WINDOW_SIZE = 1000;
  private static authFailuresByIp: Map<string, { count: number; firstAt: number }> = new Map();

  public static recordRequest(endpoint: string, statusCode: number, durationMs: number): void {
    this.metricsWindow.push({
      endpoint,
      statusCode,
      durationMs,
      timestamp: Date.now(),
    });

    if (this.metricsWindow.length > this.MAX_WINDOW_SIZE) {
      this.metricsWindow.shift();
    }
  }

  public static recordAuthFailure(ip: string): void {
    const now = Date.now();
    const existing = this.authFailuresByIp.get(ip) || { count: 0, firstAt: now };

    // Reset window after 15 minutes
    if (now - existing.firstAt > 15 * 60 * 1000) {
      existing.count = 1;
      existing.firstAt = now;
    } else {
      existing.count++;
    }

    this.authFailuresByIp.set(ip, existing);

    // Section 7: Sentry / Alert threshold for credential stuffing
    if (existing.count >= 5) {
      logSecurityEvent({
        eventType: 'CREDENTIAL_STUFFING_ALERT',
        severity: 'CRITICAL',
        ipAddress: ip,
        endpoint: '/api/auth/login',
        message: `ALERT: ${existing.count} failed login attempts from ${ip}. Potential brute force / credential stuffing.`,
      });
    }
  }

  public static getMetricsSummary() {
    const now = Date.now();
    const recent = this.metricsWindow.filter((m) => now - m.timestamp < 15 * 60 * 1000); // Last 15 minutes

    const totalRequests = recent.length;
    const errorCount = recent.filter((m) => m.statusCode >= 500).length;
    const clientErrorCount = recent.filter((m) => m.statusCode >= 400 && m.statusCode < 500).length;
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

    const latencies = recent.map((m) => m.durationMs).sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

    const queueStats = QueueService.getStats();

    // Check alerting thresholds
    const alerts: string[] = [];
    if (errorRate > 5) {
      alerts.push(`High Server Error Rate: ${errorRate.toFixed(1)}%`);
    }
    if (p95 > 5000) {
      alerts.push(`High p95 Latency: ${p95}ms`);
    }
    if (queueStats.queuedRequests > 20) {
      alerts.push(`Queue Backlog Growing: ${queueStats.queuedRequests} pending`);
    }

    return {
      windowMinutes: 15,
      totalRequests,
      statusCodes: {
        serverErrors: errorCount,
        clientErrors: clientErrorCount,
        success: totalRequests - errorCount - clientErrorCount,
      },
      errorRatePercent: Math.round(errorRate * 10) / 10,
      latencyMs: {
        p50,
        p95,
        p99,
      },
      queue: queueStats,
      alerts,
      systemStatus: alerts.length === 0 ? 'OPERATIONAL' : 'DEGRADED',
    };
  }
}
