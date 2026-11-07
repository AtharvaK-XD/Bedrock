import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { authenticateRequest } from '../_lib/auth.js';
import { getDb, logSecurityEvent } from '../_lib/db.js';
import { enforceRateLimit, getClientIp } from '../_lib/rateLimiter.js';
import {
  BILLING_CURRENCY,
  BILLING_PLANS,
  normalizePaidTier,
  RAZORPAY_ORDER_ID_RE,
  RAZORPAY_PAYMENT_ID_RE,
  RAZORPAY_SIGNATURE_RE,
} from '../_lib/billing.js';

const PG_UNIQUE_VIOLATION = '23505';

const firstString = (...values: unknown[]): string | null => {
  for (const v of values) if (typeof v === 'string' && v) return v;
  return null;
};

/**
 * POST /api/billing/verify-payment   body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * 1. Razorpay's signature (HMAC-SHA256 of "<order_id>|<payment_id>" with the key secret) proves the payment was made
 *    for that order. Compared in constant time.
 * 2. The plan comes from the order row create-order stored for THIS user, never from the request (a `tier` in the
 *    body is ignored). Before, a valid payment for any order upgraded the account to whatever tier the browser named.
 * 3. One statement marks that order paid (only while it is still unpaid) and upgrades the account, so a payment
 *    cannot be used twice, an order of another account cannot be claimed, and the two updates cannot half-happen.
 * Sending the same verified payment again (a retry after a network error) answers success without changing anything.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');

  if (!(await enforceRateLimit(req, res, 'billing', getClientIp(req)))) return;

  const user = await authenticateRequest(req);
  if (!user || user.isGuest) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const orderId = firstString(body.razorpay_order_id, body.orderId, body.order_id);
  const paymentId = firstString(body.razorpay_payment_id, body.paymentId, body.payment_id);
  const signature = firstString(body.razorpay_signature, body.signature);

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({
      error: 'Missing required parameters: order_id, payment_id, and signature are required',
    });
  }
  if (!RAZORPAY_ORDER_ID_RE.test(orderId) || !RAZORPAY_PAYMENT_ID_RE.test(paymentId) || !RAZORPAY_SIGNATURE_RE.test(signature)) {
    return res.status(400).json({ success: false, error: 'Invalid payment signature. Verification failed.' });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    console.error('[Billing] RAZORPAY_KEY_SECRET missing from server environment.');
    return res.status(503).json({ error: 'Payments are not available right now', code: 'BILLING_NOT_CONFIGURED' });
  }

  const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest();
  const given = Buffer.from(signature, 'hex');
  const isValid = given.length === expected.length && crypto.timingSafeEqual(given, expected);

  if (!isValid) {
    await logSecurityEvent({
      userId: user.id,
      eventType: 'PAYMENT_SIGNATURE_MISMATCH',
      severity: 'CRITICAL',
      ipAddress: getClientIp(req),
      message: `Razorpay signature verification failed for order ${orderId}`,
    });
    return res.status(400).json({ success: false, error: 'Invalid payment signature. Verification failed.' });
  }

  try {
    const sql = getDb();
    // Mark THIS user's still-unpaid order as paid and apply the plan stored on it, in one atomic statement.
    // The stored amount must cover today's price of that plan: an order row written by the old create-order
    // (which took the amount from the browser, so ₹1 orders exist) can never unlock a plan.
    // A Pro payment never lowers an Ultimate account (the order is still recorded as paid).
    const upgraded = (await sql`
      WITH paid AS (
        UPDATE "PaymentRecord"
        SET payment_id = ${paymentId}, signature = ${signature}, status = 'captured', updated_at = NOW()
        WHERE order_id = ${orderId} AND user_id = ${user.id} AND status = 'created'
          AND currency = ${BILLING_CURRENCY}
          AND amount >= CASE WHEN tier = 'ultimate' THEN ${BILLING_PLANS.ultimate.amountPaise}::int ELSE ${BILLING_PLANS.pro.amountPaise}::int END
        RETURNING user_id, CASE WHEN tier = 'ultimate' THEN 'ultimate' ELSE 'pro' END AS tier
      )
      UPDATE "User" AS u
      SET subscription_tier = paid.tier,
          plan = CASE WHEN paid.tier = 'ultimate' THEN 'Ultimate Plan' ELSE 'Pro Plan' END,
          updated_at = NOW()
      FROM paid
      WHERE u.id = paid.user_id
        AND (paid.tier = 'ultimate' OR COALESCE(u.subscription_tier, 'free') <> 'ultimate')
      RETURNING paid.tier AS tier
    `) as Array<{ tier: string }>;

    let tier = normalizePaidTier(upgraded[0]?.tier);
    if (!tier) {
      // Nothing changed: find out why (already verified, someone else's order, or an order we never created)
      const [order] = (await sql`
        SELECT tier, status, payment_id, amount, currency FROM "PaymentRecord" WHERE order_id = ${orderId} AND user_id = ${user.id} LIMIT 1
      `) as Array<{ tier: string; status: string; payment_id: string | null; amount: number; currency: string }>;
      if (!order) {
        await logSecurityEvent({
          userId: user.id,
          eventType: 'PAYMENT_ORDER_UNKNOWN',
          severity: 'CRITICAL',
          ipAddress: getClientIp(req),
          message: `Verified payment ${paymentId} names order ${orderId}, which is not an order of this account`,
        });
        return res.status(404).json({
          success: false,
          error: 'Order not found',
          code: 'ORDER_NOT_FOUND',
          message: 'This payment does not belong to an order of your account. If you were charged, please contact support.',
        });
      }
      if (order.status === 'created') {
        // Still unpaid after the update above: only the price check refuses that (an under-priced old order)
        await logSecurityEvent({
          userId: user.id,
          eventType: 'PAYMENT_AMOUNT_MISMATCH',
          severity: 'CRITICAL',
          ipAddress: getClientIp(req),
          message: `Order ${orderId} (${order.amount} ${order.currency}, ${order.tier}) does not cover the plan price; not upgraded`,
        });
        return res.status(409).json({
          success: false,
          error: 'Order does not match the plan price',
          code: 'ORDER_AMOUNT_MISMATCH',
          message: 'This order was created for a different price, so it cannot unlock a plan. If you were charged, please contact support.',
        });
      }
      if (order.status === 'captured' && order.payment_id === paymentId) {
        tier = normalizePaidTier(order.tier) ?? 'pro'; // the same payment sent again: already applied
      } else {
        return res.status(409).json({
          success: false,
          error: 'Order already paid',
          code: 'ORDER_ALREADY_PAID',
          message: 'This order was already paid with another payment. If you were charged twice, please contact support.',
        });
      }
    } else {
      await logSecurityEvent({
        userId: user.id,
        eventType: 'SUBSCRIPTION_UPGRADED',
        severity: 'INFO',
        message: `Upgraded to ${BILLING_PLANS[tier].planName} via payment ${paymentId} (order ${orderId})`,
      });
    }

    const plan = BILLING_PLANS[tier];
    return res.status(200).json({
      success: true,
      message: `Subscription successfully upgraded to ${plan.planName}`,
      plan: plan.planName,
      tier,
      order_id: orderId,
      payment_id: paymentId,
    });
  } catch (err: any) {
    if (err?.code === PG_UNIQUE_VIOLATION) {
      // The payment id is already stored on another order (payment_id is unique)
      return res.status(409).json({ success: false, error: 'Payment already used', code: 'PAYMENT_ALREADY_USED' });
    }
    console.error('[Billing] Verify payment error:', err?.code || err?.message || err);
    return res.status(500).json({
      success: false,
      error: 'Failed to complete payment verification',
      message: 'Your payment was received but your plan could not be updated yet. Please retry, or contact support.',
    });
  }
}
