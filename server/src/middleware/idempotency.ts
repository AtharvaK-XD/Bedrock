import { Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AuthRequest } from '../types.js';

export function idempotencyMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  // Only apply to mutating HTTP methods
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
    return next();
  }

  const idempotencyKey =
    (req.headers['idempotency-key'] as string) ||
    (req.body?.idempotencyKey as string) ||
    (req.body?.event_id as string) ||
    null;

  if (!idempotencyKey) {
    // No idempotency key provided; proceed normally
    return next();
  }

  const sanitizedKey = String(idempotencyKey).trim().slice(0, 128);

  prisma.idempotencyKey
    .findUnique({
      where: { key: sanitizedKey },
    })
    .then(async (existing: any) => {
      const now = new Date();

      if (existing) {
        // Expired check
        if (existing.expires_at < now) {
          await prisma.idempotencyKey.delete({ where: { key: sanitizedKey } });
        } else if (existing.status === 'COMPLETED' && existing.response_body) {
          res.setHeader('X-Idempotent-Replay', 'true');
          res.status(existing.response_code || 200).json(JSON.parse(existing.response_body));
          return;
        } else if (existing.status === 'PENDING') {
          res.status(409).json({
            error: 'Conflict',
            message: 'A request with this Idempotency-Key is currently being processed.',
          });
          return;
        }
      }

      // Record pending execution
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry
      await prisma.idempotencyKey.upsert({
        where: { key: sanitizedKey },
        create: {
          key: sanitizedKey,
          user_id: req.user?.id,
          endpoint: req.originalUrl,
          status: 'PENDING',
          expires_at: expiresAt,
        },
        update: {
          status: 'PENDING',
          expires_at: expiresAt,
        },
      });

      // Intercept response to cache result on completion
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          prisma.idempotencyKey
            .update({
              where: { key: sanitizedKey },
              data: {
                status: 'COMPLETED',
                response_code: res.statusCode,
                response_body: JSON.stringify(body),
              },
            })
            .catch((err: any) => console.warn('[Idempotency] Failed to store response:', err.message));
        } else {
          prisma.idempotencyKey
            .delete({ where: { key: sanitizedKey } })
            .catch(() => {});
        }
        return originalJson(body);
      };

      next();
    })
    .catch((err: any) => {
      console.error('[Idempotency] Database lookup failed:', err);
      next();
    });
}
