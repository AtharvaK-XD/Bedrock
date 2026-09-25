import { logSecurityEvent } from '../db.js';

export interface ThreatRecord {
  ip: string;
  score: number;
  lastSeen: number;
  offenseCount: number;
  isJailed: boolean;
  jailedUntil: number;
  violations: Array<{
    category: string;
    timestamp: number;
    endpoint: string;
    detail: string;
  }>;
}

export interface AttackStats {
  totalBlocked: number;
  categoryCounts: Record<string, number>;
  activeJails: number;
}

export class ThreatIntelligence {
  private static threats: Map<string, ThreatRecord> = new Map();
  private static JAIL_THRESHOLD = 100;
  private static DEFAULT_JAIL_MS = 60 * 60 * 1000; // 1 hour
  private static MAX_RECORDS = 5000; // Prevent memory leak

  // Attack category statistics
  private static stats: AttackStats = {
    totalBlocked: 0,
    categoryCounts: {
      SQLI: 0,
      XSS: 0,
      RCE: 0,
      PATH_TRAVERSAL: 0,
      SCANNER_BOT: 0,
      HONEYPOT_PROBE: 0,
      PROTOTYPE_POLLUTION: 0,
      PROMPT_INJECTION: 0,
      HEADER_INJECTION: 0,
    },
    activeJails: 0,
  };

  /**
   * Check if an IP address is currently banned/jailed
   */
  public static isIpJailed(ip: string): { jailed: boolean; remainingMs: number } {
    const record = this.threats.get(ip);
    if (!record || !record.isJailed) {
      return { jailed: false, remainingMs: 0 };
    }

    const now = Date.now();
    if (now >= record.jailedUntil) {
      // Jail time expired, unjail
      record.isJailed = false;
      record.score = Math.floor(record.score / 2); // Decay score
      return { jailed: false, remainingMs: 0 };
    }

    return { jailed: true, remainingMs: record.jailedUntil - now };
  }

  /**
   * Record a security violation from an IP address
   */
  public static recordViolation(params: {
    ip: string;
    category: string;
    score: number;
    endpoint: string;
    detail: string;
    userAgent?: string;
  }): { nowJailed: boolean; currentScore: number } {
    const { ip, category, score, endpoint, detail, userAgent } = params;
    const now = Date.now();

    // Clean up oldest records if map exceeds maximum allowed size
    if (this.threats.size >= this.MAX_RECORDS) {
      const oldestKey = this.threats.keys().next().value;
      if (oldestKey) this.threats.delete(oldestKey);
    }

    let record = this.threats.get(ip);
    if (!record) {
      record = {
        ip,
        score: 0,
        lastSeen: now,
        offenseCount: 0,
        isJailed: false,
        jailedUntil: 0,
        violations: [],
      };
      this.threats.set(ip, record);
    }

    // Accumulate score and offense details
    record.score += score;
    record.offenseCount += 1;
    record.lastSeen = now;
    record.violations.push({
      category,
      timestamp: now,
      endpoint,
      detail: detail.slice(0, 200), // Cap length
    });

    // Update global attack metrics
    this.stats.totalBlocked += 1;
    this.stats.categoryCounts[category] = (this.stats.categoryCounts[category] || 0) + 1;

    // Keep only the last 10 violations per IP
    if (record.violations.length > 10) {
      record.violations.shift();
    }

    // Jailing evaluation
    let nowJailed = false;
    if (record.score >= this.JAIL_THRESHOLD && !record.isJailed) {
      // Escalating jail penalty for repeat offenders
      const multiplier = Math.min(record.offenseCount, 5);
      const jailDuration = this.DEFAULT_JAIL_MS * multiplier;

      record.isJailed = true;
      record.jailedUntil = now + jailDuration;
      nowJailed = true;

      // Log critical security event to DB
      logSecurityEvent({
        eventType: 'IP_JAILED_MALICIOUS_ACTIVITY',
        severity: 'CRITICAL',
        ipAddress: ip,
        endpoint,
        message: `IP ${ip} automatically jailed for ${jailDuration / 60000} minutes. Score: ${record.score}. Trigger: ${category} - ${detail}`,
      }).catch(() => {});
    } else {
      // Log individual attack attempt
      logSecurityEvent({
        eventType: `WAF_BLOCK_${category}`,
        severity: score >= 50 ? 'CRITICAL' : 'WARN',
        ipAddress: ip,
        endpoint,
        message: `Blocked ${category} attack attempt from ${ip} using UA: ${userAgent || 'unknown'}. Detail: ${detail.slice(0, 100)}`,
      }).catch(() => {});
    }

    return { nowJailed, currentScore: record.score };
  }

  /**
   * Retrieve active statistics for admin/monitoring endpoints
   */
  public static getStats(): AttackStats & { activeJailedIps: Array<{ ip: string; remainingMinutes: number; score: number }> } {
    const now = Date.now();
    const activeJailedIps: Array<{ ip: string; remainingMinutes: number; score: number }> = [];

    for (const [ip, rec] of this.threats.entries()) {
      if (rec.isJailed && rec.jailedUntil > now) {
        activeJailedIps.push({
          ip,
          remainingMinutes: Math.ceil((rec.jailedUntil - now) / 60000),
          score: rec.score,
        });
      }
    }

    return {
      ...this.stats,
      activeJails: activeJailedIps.length,
      activeJailedIps,
    };
  }

  /**
   * Reset threat record for a specific IP (e.g. testing or admin unban)
   */
  public static unjailIp(ip: string): void {
    const record = this.threats.get(ip);
    if (record) {
      record.isJailed = false;
      record.score = 0;
      record.jailedUntil = 0;
    }
  }
}
