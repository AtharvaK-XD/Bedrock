import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { initDb, prisma, logSecurityEvent } from './db.js';
import {
  helmetMiddleware,
  corsMiddleware,
  hppMiddleware,
  sanitizePayloads,
} from './middleware/security.js';
import { wafShield } from './middleware/wafShield.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { MetricsService } from './services/metricsService.js';

// Route imports
import authRoutes from './routes/auth.js';
import aiRoutes from './routes/ai.js';
import userRoutes from './routes/user.js';
import promptRoutes from './routes/prompts.js';
import traceRoutes from './routes/traces.js';
import workflowRoutes from './routes/workflows.js';
import healthRoutes from './routes/health.js';
import billingRoutes from './routes/billing.js';

const app = express();

// Disable framework fingerprinting
app.disable('x-powered-by');

// Trust reverse proxy (Vite, Cloudflare, Tauri, Electron)
app.set('trust proxy', 1);

// =================== Section 5: HTTPS Enforcement ===================
if (config.isProduction) {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https' && !req.secure) {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// =================== Security Middlewares ===================
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(hppMiddleware);

// Strict payload size limits (prevent DoS memory exhaustion)
app.use(express.json({ limit: config.limits.jsonPayloadLimit }));
app.use(express.urlencoded({ extended: true, limit: config.limits.urlEncodedLimit }));
app.use(cookieParser());

// Deep sanitization against Prototype Pollution & Malicious injections
app.use(sanitizePayloads);

// Multi-Vector Web Application Firewall (WAF) Shield & Automated IP Jail
app.use(wafShield);

// Global rate limiting
app.use(generalLimiter);

// Observability: Request metric recorder & audit logger
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    MetricsService.recordRequest(req.originalUrl, res.statusCode, duration);

    // Track failed logins for credential stuffing detection
    if (req.originalUrl.includes('/api/auth/login') && res.statusCode === 401) {
      MetricsService.recordAuthFailure(req.ip || '127.0.0.1');
    }
  });

  if (!config.isProduction) {
    console.log(`[BedrockServer] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  }
  next();
});

// =================== API Routes ===================
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/user', userRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/traces', traceRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/billing', billingRoutes);

// 404 Route Handler for undefined API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Endpoint Not Found',
    message: `The API endpoint ${req.method} ${req.originalUrl} does not exist.`,
  });
});

// =================== Global Error Handler ===================
app.use(errorHandler);

// =================== Anti-Crash Process Protection ===================
process.on('uncaughtException', (err: Error) => {
  console.error('[FATAL] Uncaught Exception:', err);
  logSecurityEvent({
    eventType: 'UNCAUGHT_EXCEPTION',
    severity: 'CRITICAL',
    message: `Uncaught Exception: ${err.message}\n${err.stack || ''}`,
  }).catch(() => {});
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[WARN] Unhandled Rejection:', reason);
  logSecurityEvent({
    eventType: 'UNHANDLED_REJECTION',
    severity: 'WARN',
    message: `Unhandled Promise Rejection: ${String(reason)}`,
  }).catch(() => {});
});

// =================== Graceful Shutdown ===================
async function gracefulShutdown(signal: string) {
  console.log(`[BedrockServer] Received ${signal}. Gracefully shutting down...`);
  try {
    await (prisma as any).$disconnect();
    console.log('[BedrockServer] Database connections closed.');
    process.exit(0);
  } catch (err) {
    console.error('[BedrockServer] Error during graceful shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// =================== Start Server ===================
async function startServer() {
  await initDb();

  const server = app.listen(config.port, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  BEDROCK ENTERPRISE BACKEND - PRODUCTION HARDENED                ║
║  URL: http://localhost:${config.port}                                    ║
║  Environment: ${(config.nodeEnv).toUpperCase().padEnd(16)} Mode: Hardened Vault      ║
║  Database: SQLite/Neon Pool + Query Timeout Protections         ║
║  AI Gateway: Multi-Key Round Robin + Injection Defense Guard     ║
║  Billing: Razorpay Webhook HMAC SHA256 Signature Verification   ║
╚══════════════════════════════════════════════════════════════════╝
    `);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[BedrockServer] Port ${config.port} is already in use.`);
    } else {
      console.error('[BedrockServer] Server startup error:', err);
    }
  });
}

startServer();

export default app;
