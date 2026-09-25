import { Router } from 'express';
import { prisma } from '../db.js';
import { config } from '../config.js';

const router = Router();

// GET /api/health
router.get('/health', async (req, res) => {
  let dbHealthy = false;
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  const memory = process.memoryUsage();

  res.json({
    status: dbHealthy ? 'ok' : 'degraded',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'connected' : 'disconnected',
      groqAi: Boolean(config.ai.groqKey),
      openRouterAi: Boolean(config.ai.openRouterKey),
      huggingFaceAi: Boolean(config.ai.huggingFaceKey),
      geminiAi: Boolean(config.ai.geminiKey),
    },
    system: {
      nodeVersion: process.version,
      heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
      rssMb: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
    },
  });
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
      helmetCsp: true,
      corsWhitelisting: true,
      hppProtection: true,
      prototypePollutionGuard: true,
      rateLimiting: {
        general: `${config.rateLimit.maxGeneral} req / 15m`,
        auth: `${config.rateLimit.maxAuth} req / 15m`,
        ai: `${config.rateLimit.maxAi} req / 15m`,
      },
      passwordHashing: 'Argon2id',
      tokenSigning: 'HMAC-SHA256 (Locked)',
      cookieFlags: 'HttpOnly, SameSite=Lax',
    },
    auditLogCount: recentAuditEvents,
  });
});

export default router;
