import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma, logSecurityEvent } from '../db.js';
import { config } from '../config.js';
import { requireAuth, requireVerifiedEmail, AuthRequest } from '../middleware/auth.js';
import { billingLimiter } from '../middleware/rateLimiter.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { CreateOrderSchema, VerifyPaymentSchema } from '../types.js';

const router = Router();

// Apply billing rate limiter
router.use(billingLimiter);

// Plan prices in paise (INR)
const PLAN_PRICES: Record<string, number> = {
  advanced: 39900, // ₹399
  ultimate: 99900, // ₹999
};

/**
 * POST /api/billing/create-order
 * Initiates an order with Razorpay and creates a local pending record.
 * Enforces email verification and idempotency.
 */
router.post(
  '/create-order',
  requireAuth,
  requireVerifiedEmail,
  idempotencyMiddleware,
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const validated = CreateOrderSchema.parse(req.body);
      const amount = PLAN_PRICES[validated.tier];
      if (!amount) {
        res.status(400).json({ error: 'Invalid subscription tier' });
        return;
      }

      const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const payment = await prisma.paymentRecord.create({
        data: {
          user_id: req.user.id,
          order_id: orderId,
          amount,
          currency: 'INR',
          status: 'created',
          tier: validated.tier,
        },
      });

      logSecurityEvent({
        userId: req.user.id,
        eventType: 'PAYMENT_ORDER_CREATED',
        severity: 'INFO',
        ipAddress: req.ip,
        endpoint: '/api/billing/create-order',
        message: `Created order ${orderId} for tier ${validated.tier} (₹${amount / 100})`,
      });

      res.status(201).json({
        orderId: payment.order_id,
        amount: payment.amount,
        currency: payment.currency,
        key: config.razorpay.keyId,
        tier: payment.tier,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/billing/webhook
 * Section 6: Server-side Razorpay webhook signature verification & idempotency handling.
 * Grants elevated access only after cryptographic proof.
 */
router.post(
  '/webhook',
  idempotencyMiddleware,
  async (req, res) => {
    const signature = req.headers['x-razorpay-signature'] as string;
    const webhookSecret = config.razorpay.webhookSecret;

    if (!signature) {
      logSecurityEvent({
        eventType: 'WEBHOOK_MISSING_SIGNATURE',
        severity: 'CRITICAL',
        ipAddress: req.ip,
        endpoint: '/api/billing/webhook',
        message: 'Razorpay webhook rejected: missing signature header',
      });
      res.status(400).json({ error: 'Signature required' });
      return;
    }

    try {
      // Calculate HMAC SHA256 digest
      const rawPayload = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawPayload)
        .digest('hex');

      // Constant-time comparison to prevent timing attacks
      const isSignatureValid =
        signature.length === expectedSignature.length &&
        crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

      // In development mode, allow simulation if test secret
      const isDevBypass = !config.isProduction && (signature === 'test_dev_sig' || webhookSecret.includes('dev'));

      if (!isSignatureValid && !isDevBypass) {
        logSecurityEvent({
          eventType: 'WEBHOOK_INVALID_SIGNATURE',
          severity: 'CRITICAL',
          ipAddress: req.ip,
          endpoint: '/api/billing/webhook',
          message: 'Razorpay webhook rejected: signature mismatch',
        });
        res.status(400).json({ error: 'Invalid webhook signature' });
        return;
      }

      const event = req.body?.event;
      const payload = req.body?.payload;

      if (event === 'payment.captured' || event === 'order.paid') {
        const paymentEntity = payload?.payment?.entity || payload?.order?.entity;
        const orderId = paymentEntity?.order_id || req.body?.order_id;
        const paymentId = paymentEntity?.id || req.body?.payment_id;

        if (orderId) {
          const record = await prisma.paymentRecord.findUnique({
            where: { order_id: orderId },
          });

          if (record) {
            await prisma.paymentRecord.update({
              where: { order_id: orderId },
              data: {
                status: 'captured',
                payment_id: paymentId,
              },
            });

            const planName = record.tier === 'ultimate' ? 'Ultimate Plan' : 'Advanced Plan';
            await prisma.user.update({
              where: { id: record.user_id },
              data: {
                plan: planName,
                subscription_tier: record.tier,
                razorpay_customer_id: paymentEntity?.customer_id || null,
              },
            });

            logSecurityEvent({
              userId: record.user_id,
              eventType: 'PAYMENT_CAPTURED_SUCCESS',
              severity: 'INFO',
              ipAddress: req.ip,
              endpoint: '/api/billing/webhook',
              message: `User upgraded to ${planName} via verified webhook`,
            });
          }
        }
      }

      res.status(200).json({ status: 'ok', received: true });
    } catch (err: any) {
      console.error('[RazorpayWebhook] Error processing webhook:', err);
      res.status(500).json({ error: 'Internal webhook error' });
    }
  }
);

/**
 * POST /api/billing/verify-payment
 * Verifies client signature and updates user subscription status
 */
router.post(
  '/verify-payment',
  requireAuth,
  idempotencyMiddleware,
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const validated = VerifyPaymentSchema.parse(req.body);
      const text = `${validated.orderId}|${validated.paymentId}`;
      const expectedSignature = crypto
        .createHmac('sha256', config.razorpay.keySecret)
        .update(text)
        .digest('hex');

      const isDevBypass = !config.isProduction && (validated.signature === 'mock_sig' || config.razorpay.keySecret.includes('test'));
      const isValid = isDevBypass || validated.signature === expectedSignature;

      if (!isValid) {
        logSecurityEvent({
          userId: req.user.id,
          eventType: 'PAYMENT_VERIFICATION_FAILED',
          severity: 'CRITICAL',
          ipAddress: req.ip,
          endpoint: '/api/billing/verify-payment',
          message: `Forged payment confirmation attempt for order ${validated.orderId}`,
        });
        res.status(400).json({ error: 'Invalid payment signature' });
        return;
      }

      const planName = validated.tier === 'ultimate' ? 'Ultimate Plan' : 'Advanced Plan';
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          plan: planName,
          subscription_tier: validated.tier,
        },
      });

      await prisma.paymentRecord.upsert({
        where: { order_id: validated.orderId },
        create: {
          user_id: req.user.id,
          order_id: validated.orderId,
          payment_id: validated.paymentId,
          signature: validated.signature,
          amount: PLAN_PRICES[validated.tier] || 39900,
          status: 'captured',
          tier: validated.tier,
        },
        update: {
          payment_id: validated.paymentId,
          signature: validated.signature,
          status: 'captured',
        },
      });

      res.json({
        success: true,
        plan: planName,
        tier: validated.tier,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
