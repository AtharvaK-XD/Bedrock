import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Razorpay from 'razorpay';
import { authenticateRequest } from '../_lib/auth.js';
import { getDb, logSecurityEvent } from '../_lib/db.js';
import { enforceRateLimit, getClientIp } from '../_lib/rateLimiter.js';
import {
  normalizePaidTier,
  planAmount,
  billingError,
  billingTestModeBlocked,
  withTimeout,
  BillingTimeoutError,
  RAZORPAY_ORDER_ID_RE,
} from '../_lib/billing.js';

/**
 * POST /api/billing/create-order   body: { tier: "pro" | "ultimate", amount?: <paise>, currency?: "INR" }
 *
 * The price comes from BILLING_PLANS, never from the browser. A browser that sends an `amount` must send exactly the
 * plan's price: anything else is refused (409 PRICE_MISMATCH) instead of creating an order for a different amount.
 * The order is stored BEFORE it is returned, so verify-payment can always find which plan it was for.
 * Every failure answers JSON { success: false, error, code, message? } (billingError), never a platform error page.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await createOrder(req, res);
  } catch (err: any) {
    // Last line of defence: an unexpected throw must still give the app a readable answer
    console.error('[Billing] create-order failed unexpectedly:', err?.code || err?.message || err);
    if (res.headersSent) return;
    return billingError(res, 500, 'BILLING_INTERNAL_ERROR', 'Payment could not be started', 'Something went wrong on our side. Nothing was charged. Please try again.');
  }
}

async function createOrder(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return billingError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }
  res.setHeader('Cache-Control', 'no-store');

  if (!(await enforceRateLimit(req, res, 'billing', getClientIp(req)))) return;

  const user = await authenticateRequest(req);
  // The local development guest has no real account to upgrade
  if (!user || user.isGuest) {
    return billingError(res, 401, 'AUTH_REQUIRED', 'Unauthorized', 'Please sign in to upgrade your plan.');
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  const tier = normalizePaidTier(body.tier);
  if (!tier) {
    return billingError(res, 400, 'INVALID_TIER', 'tier must be "pro" or "ultimate"');
  }

  // Infer currency: explicit currency, or USD if amount is in USD cents (2000/5000), or INR if amount is paise / default
  const rawCurrency = body.currency !== undefined && body.currency !== null
    ? String(body.currency).toUpperCase().trim()
    : (body.amount === 2000 || body.amount === 5000 ? 'USD' : 'INR');

  if (rawCurrency !== 'INR' && rawCurrency !== 'USD') {
    return billingError(res, 400, 'INVALID_CURRENCY', 'Only USD and INR payments are supported');
  }
  const currency: 'USD' | 'INR' = rawCurrency as 'USD' | 'INR';

  // One server price per plan and currency. The browser's amount never chooses it (it used to pick from a list that
  // still held older, lower prices, e.g. Ultimate for ₹1,178.82 instead of ₹4,250): it is only a check of what the
  // user was shown, and anything else is refused.
  const expectedAmount = planAmount(tier, currency);
  if (body.amount !== undefined && body.amount !== null) {
    const shown = typeof body.amount === 'number' ? body.amount : Number(body.amount);
    const isValid = Number.isFinite(shown) && Math.round(shown) === expectedAmount;
    if (!isValid) {
      await logSecurityEvent({
        userId: user.id,
        eventType: 'PAYMENT_PRICE_MISMATCH',
        severity: 'WARN',
        ipAddress: getClientIp(req),
        message: `Order refused: ${tier} in ${currency} costs ${expectedAmount}, the request said ${String(body.amount).slice(0, 40)}`,
      });
      return res.status(409).json({
        success: false,
        error: 'Price mismatch',
        code: 'PRICE_MISMATCH',
        message: 'The price changed or could not be confirmed. Please reload the page and try again.',
        amount: expectedAmount,
        currency,
      });
    }
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.error('[Billing] Razorpay credentials missing from server environment.');
    return billingError(res, 503, 'BILLING_NOT_CONFIGURED', 'Payments are not available right now', 'Payments are not available right now. Please try again later.');
  }
  if (billingTestModeBlocked(keyId)) {
    console.error('[Billing] Production is configured with a Razorpay TEST key: refusing orders (set live keys, or BILLING_ALLOW_TEST_MODE=true for a test run).');
    return billingError(res, 503, 'BILLING_TEST_MODE', 'Payments are not available right now', 'Payments are not available right now. Please try again later.');
  }

  // Our own receipt id: never taken from the request (Razorpay allows 40 characters)
  const receipt = `rcpt_${crypto.randomUUID().replace(/-/g, '').slice(0, 30)}`;

  let orderId: string;
  try {
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    // The SDK has no timeout of its own: without this, a hung call ran into Vercel's 60 s limit (a non-JSON 504)
    const rzOrder = await withTimeout(
      razorpay.orders.create({
        amount: expectedAmount,
        currency,
        receipt,
        // Server-set only: notes are shown in the Razorpay dashboard and sent in webhooks
        notes: { userId: user.id, tier },
      })
    );
    if (typeof rzOrder?.id !== 'string' || !RAZORPAY_ORDER_ID_RE.test(rzOrder.id)) {
      throw new Error('Razorpay answered without a valid order id');
    }
    orderId = rzOrder.id;
  } catch (rzErr: any) {
    // The detail stays in the server log: Razorpay's error text is not for end users
    console.error('[Billing] Razorpay order creation failed:', rzErr?.error?.description || rzErr?.message || rzErr);
    if (rzErr instanceof BillingTimeoutError) {
      return billingError(res, 504, 'BILLING_GATEWAY_TIMEOUT', 'The payment service did not answer', 'The payment could not be started. Nothing was charged. Please try again in a moment.');
    }
    return billingError(res, 502, 'BILLING_ORDER_FAILED', 'Failed to create Razorpay order', 'The payment could not be started. Please try again in a moment.');
  }

  // Must be stored: without this row, verify-payment cannot tell which plan the payment bought and refuses it.
  // (It used to be "non-fatal", so a user could pay for an order that could then never be verified.)
  try {
    const sql = getDb();
    await sql`
      INSERT INTO "PaymentRecord" (id, user_id, order_id, amount, currency, status, tier, created_at, updated_at)
      VALUES (${`payrec_${crypto.randomUUID()}`}, ${user.id}, ${orderId}, ${expectedAmount}, ${currency}, ${'created'}, ${tier}, NOW(), NOW())
    `;
  } catch (dbErr: any) {
    console.error('[Billing] Could not store the new order; refusing it so it cannot be paid:', dbErr?.code || dbErr?.message || dbErr);
    return billingError(res, 503, 'BILLING_UNAVAILABLE', 'Payments are not available right now', 'The payment could not be started. Nothing was charged. Please try again in a moment.');
  }

  await logSecurityEvent({
    userId: user.id,
    eventType: 'PAYMENT_ORDER_CREATED',
    severity: 'INFO',
    message: `Created order ${orderId} for tier ${tier} (${expectedAmount} ${currency})`,
  });

  return res.status(200).json({
    success: true,
    order_id: orderId,
    orderId,
    amount: expectedAmount,
    currency,
    receipt,
    tier,
    // The key id is public by design (Razorpay Checkout needs it in the browser); the secret never leaves the server
    keyId,
  });
}
