import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logSecurityEvent } from '../db.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    const issues = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(400).json({
      error: 'Validation Error',
      message: issues[0]?.message || 'Invalid input data',
      details: issues,
    });
    return;
  }

  // 2. Prisma Database Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        error: 'Conflict',
        message: 'A record with that unique value already exists.',
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found.',
      });
      return;
    }
  }

  // 3. CORS Error
  if (err.message && err.message.includes('CORS')) {
    logSecurityEvent({
      eventType: 'CORS_VIOLATION',
      severity: 'WARN',
      ipAddress: req.ip,
      endpoint: req.originalUrl,
      message: `Origin ${req.headers.origin} rejected by CORS`,
    });
    res.status(403).json({
      error: 'Forbidden',
      message: 'Cross-Origin Request Blocked by Security Policy',
    });
    return;
  }

  // 4. Rate Limit or Token Errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Session expired or token invalid. Please log in again.',
    });
    return;
  }

  // 5. Generic / Uncaught Errors - Never leak internal details
  console.error('[ServerError]', err);

  const statusCode = typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
    ? err.statusCode
    : 500;

  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : err.name || 'Error',
    message: err.isSafeMessage
      ? err.message
      : 'An unexpected error occurred. Please try again.',
  });
}
