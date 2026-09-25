import { Router } from 'express';
import { prisma } from '../db.js';
import { config } from '../config.js';
import { MetricsService } from '../services/metricsService.js';
import { CacheService } from '../services/cacheService.js';
import { ThreatIntelligence } from '../services/threatIntelligence.js';
import { CircuitBreaker } from '../services/circuitBreaker.js';

const router = Router();

// GET /api/health
router.get('/health', async (req, res) => {
  let dbHealthy = false;
  try {
    await (prisma as any).$queryRawUnsafe('SELECT 1');
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  const memory = process.memoryUsage();

  res.json({
    status: dbHealthy ? 'ok' : 'degraded',
    version: '1.1.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'connected' : 'disconnected',
      groqKeysConfigured: config.ai.groqKeys.length,
      openRouterKeysConfigured: config.ai.openRouterKeys.length,
      geminiKeysConfigured: config.ai.geminiKeys.length,
    },
    system: {
      nodeVersion: process.version,
      heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
      rssMb: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
    },
  });
});

// GET /api/health/providers - Circuit Breaker telemetry
router.get('/health/providers', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    providers: CircuitBreaker.getAllStatuses(),
  });
});

// GET /api/health/threats - Real-time Threat Intelligence and Jailed IPs
router.get('/health/threats', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    ...ThreatIntelligence.getStats(),
  });
});

// Section 16: Public Status Endpoint (with SWR Cache)
router.get('/status', async (req, res) => {
  const { data } = await CacheService.getOrSet(
    'public_status_page',
    async () => {
      let dbHealthy = false;
      try {
        await (prisma as any).$queryRawUnsafe('SELECT 1');
        dbHealthy = true;
      } catch {
        dbHealthy = false;
      }

      const metrics = MetricsService.getMetricsSummary();

      return {
        service: 'Bedrock Prompt Engineering Studio',
        status: dbHealthy && metrics.alerts.length === 0 ? 'ALL_SYSTEMS_OPERATIONAL' : 'DEGRADED',
        updatedAt: new Date().toISOString(),
        components: [
          { name: 'Core API Gateway', status: 'OPERATIONAL' },
          { name: 'AI Generation Pipeline', status: config.ai.groqKeys.length > 0 ? 'OPERATIONAL' : 'DEGRADED' },
          { name: 'Database Persistence (SQLite/Neon)', status: dbHealthy ? 'OPERATIONAL' : 'DEGRADED' },
          { name: 'Razorpay Billing Webhook', status: 'OPERATIONAL' },
        ],
        metrics: {
          uptimeSeconds: Math.floor(process.uptime()),
          p95LatencyMs: metrics.latencyMs.p95,
          activeAlerts: metrics.alerts,
        },
      };
    },
    30000, // 30 sec fresh
    120000 // 2 min stale tolerance
  );

  res.json(data);
});

// Section 15: Observability & Alerting Metrics
router.get('/metrics', async (req, res) => {
  res.json(MetricsService.getMetricsSummary());
});

// GET /api/security/status
router.get('/security/status', async (req, res) => {
  let recentAuditEvents = 0;
  try {
    recentAuditEvents = await prisma.securityLog.count();
  } catch {
    recentAuditEvents = 0;
  }

  res.json({
    securityLevel: 'MAXIMUM',
    protections: {
      wafShield: true,
      circuitBreaker: true,
      helmetCsp: true,
      corsWhitelisting: true,
      hppProtection: true,
      prototypePollutionGuard: true,
      idempotencyGuard: true,
      rateLimiting: 'Per-Endpoint Multi-Tier Active',
      passwordHashing: 'Argon2id',
      tokenSigning: 'HMAC-SHA256 (Locked)',
      cookieFlags: 'HttpOnly, SameSite=Lax',
      emailVerificationEnforced: true,
      adminMfaEnforced: true,
    },
    threats: ThreatIntelligence.getStats(),
    auditLogCount: recentAuditEvents,
  });
});

export default router;
