import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Razorpay from 'razorpay';
import { authenticateRequest } from '../_lib/auth.js';
import { getDb, logSecurityEvent } from '../_lib/db.js';
import { enforceRateLimit, getClientIp } from '../_lib/rateLimiter.js';
import { BILLING_PLANS, BILLING_CURRENCY, normalizePaidTier } from '../_lib/billing.js';

/**
 * POST /api/billing/create-order   body: { tier: "pro" | "ultimate", amount?: <paise>, currency?: "INR" }
 *
 * The price comes from BILLING_PLANS, never from the browser. A browser that sends an `amount` must send exactly the
 * plan's price: anything else is refused (409 PRICE_MISMATCH) instead of creating an order for a different amount.
 * The order is stored BEFORE it is returned, so verify-payment can always find which plan it was for.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'no-store');

  if (!(await enforceRateLimit(req, res, 'billing', getClientIp(req)))) return;

  const user = await authenticateRequest(req);
  // The local development guest has no real account to upgrade
  if (!user || user.isGuest) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  const tier = normalizePaidTier(body.tier);
  if (!tier) {
    return res.status(400).json({ error: 'tier must be "pro" or "ultimate"', code: 'INVALID_TIER' });
  }
  const plan = BILLING_PLANS[tier];

  if (body.currency !== undefined && body.currency !== null && body.currency !== BILLING_CURRENCY) {
    return res.status(400).json({ error: `Only ${BILLING_CURRENCY} payments are supported`, code: 'INVALID_CURRENCY' });
  }

  // The browser's amount is only a check of what the user was shown: it never sets the price
  if (body.amount !== undefined && body.amount !== null) {
    const shown = typeof body.amount === 'number' ? body.amount : Number(body.amount);
    if (!Number.isFinite(shown) || Math.round(shown) !== plan.amountPaise) {
      await logSecurityEvent({
        userId: user.id,
        eventType: 'PAYMENT_PRICE_MISMATCH',
        severity: 'WARN',
        ipAddress: getClientIp(req),
        message: `Order refused: ${tier} costs ${plan.amountPaise} paise, the request said ${String(body.amount).slice(0, 40)}`,
      });
      return res.status(409).json({
        error: 'Price mismatch',
        code: 'PRICE_MISMATCH',
        message: 'The price changed or could not be confirmed. Please reload the page and try again.',
        amount: plan.amountPaise,
        currency: BILLING_CURRENCY,
      });
    }
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.error('[Billing] Razorpay credentials missing from server environment.');
    return res.status(503).json({
      error: 'Payments are not available right now',
      code: 'BILLING_NOT_CONFIGURED',
      message: 'Payments are not available right now. Please try again later.',
    });
  }

  // Our own receipt id: never taken from the request (Razorpay allows 40 characters)
  const receipt = `rcpt_${crypto.randomUUID().replace(/-/g, '').slice(0, 30)}`;

  let orderId: string;
  try {
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const rzOrder = await razorpay.orders.create({
      amount: plan.amountPaise,
      currency: BILLING_CURRENCY,
      receipt,
      // Server-set only: notes are shown in the Razorpay dashboard and sent in webhooks
      notes: { userId: user.id, tier },
    });
    orderId = rzOrder.id;
  } catch (rzErr: any) {
    // The detail stays in the server log: Razorpay's error text is not for end users
    console.error('[Billing] Razorpay order creation failed:', rzErr?.error?.description || rzErr?.message || rzErr);
    return res.status(502).json({
      error: 'Failed to create Razorpay order',
      code: 'BILLING_ORDER_FAILED',
      message: 'The payment could not be started. Please try again in a moment.',
    });
  }

  // Must be stored: without this row, verify-payment cannot tell which plan the payment bought and refuses it.
  // (It used to be "non-fatal", so a user could pay for an order that could then never be verified.)
  try {
    const sql = getDb();
    await sql`
      INSERT INTO "PaymentRecord" (id, user_id, order_id, amount, currency, status, tier, created_at, updated_at)
      VALUES (${`payrec_${crypto.randomUUID()}`}, ${user.id}, ${orderId}, ${plan.amountPaise}, ${BILLING_CURRENCY}, ${'created'}, ${tier}, NOW(), NOW())
    `;
  } catch (dbErr: any) {
    console.error('[Billing] Could not store the new order; refusing it so it cannot be paid:', dbErr?.code || dbErr?.message || dbErr);
    return res.status(503).json({
      error: 'Payments are not available right now',
      code: 'BILLING_UNAVAILABLE',
      message: 'The payment could not be started. Nothing was charged. Please try again in a moment.',
    });
  }

  await logSecurityEvent({
    userId: user.id,
    eventType: 'PAYMENT_ORDER_CREATED',
    severity: 'INFO',
    message: `Created order ${orderId} for tier ${tier} (${plan.amountPaise} paise)`,
  });

  return res.status(200).json({
    order_id: orderId,
    orderId,
    amount: plan.amountPaise,
    currency: BILLING_CURRENCY,
    receipt,
    tier,
    // The key id is public by design (Razorpay Checkout needs it in the browser); the secret never leaves the server
    keyId,
  });
}
