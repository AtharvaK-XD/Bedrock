import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { authenticateRequest } from '../_lib/auth.js';
import { getDb, logSecurityEvent } from '../_lib/db.js';
import { enforceRateLimit, getClientIp } from '../_lib/rateLimiter.js';
import { readRawBody } from '../_lib/accountDeletion.js';
import {
  BILLING_PLANS,
  billingError,
  billingTestModeBlocked,
  completePaidOrder,
  normalizePaidTier,
  splitGst,
  RAZORPAY_ORDER_ID_RE,
  RAZORPAY_PAYMENT_ID_RE,
  RAZORPAY_SIGNATURE_RE,
} from '../_lib/billing.js';
import {
  sendBedrockEmail,
  renderInvoiceEmail,
  DEFAULT_FROM_BILLING,
} from '../_lib/email.js';

const PG_UNIQUE_VIOLATION = '23505';

const firstString = (...values: unknown[]): string | null => {
  for (const v of values) if (typeof v === 'string' && v) return v;
  return null;
};

/**
 * Billing routes that share this one function file (Vercel Hobby allows 12 function files, all in use):
 *   POST /api/billing/verify-payment                      the browser confirms a payment (below)
 *   POST /api/billing/webhook  -> ?action=webhook         Razorpay reports payments itself (handleWebhook)
 *   GET  /api/billing/history  -> ?action=history         the signed-in user's paid orders (handleHistory)
 * (the two rewrites are in vercel.json). Every failure answers { success: false, error, code, message? }.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const action = req.query?.action;
    if (action === 'webhook') return await handleWebhook(req, res);
    if (action === 'history') return await handleHistory(req, res);
    return await handleVerify(req, res);
  } catch (err: any) {
    // Last line of defence: an unexpected throw must still give the caller a readable answer
    console.error('[Billing] Unexpected failure:', err?.code || err?.message || err);
    if (res.headersSent) return;
    return billingError(res, 500, 'BILLING_INTERNAL_ERROR', 'Billing request failed', 'Something went wrong on our side. Please try again.');
  }
}

/**
 * POST /api/billing/verify-payment   body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * 1. Razorpay's signature (HMAC-SHA256 of "<order_id>|<payment_id>" with the key secret) proves the payment was made
 *    for that order. Compared in constant time.
 * 2. completePaidOrder() marks THIS user's still-unpaid order paid and applies the plan stored on it (a `tier` in the
 *    body is ignored), in one statement. Another account's order, an unknown order, a second payment for a paid
 *    order and an under-priced old order are refused. The same payment sent again answers success, changing nothing.
 * 3. The answer names the plan the ACCOUNT has now (an Ultimate account that pays for Pro keeps Ultimate).
 */
async function handleVerify(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return billingError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }
  if (!(await enforceRateLimit(req, res, 'billing', getClientIp(req)))) return;

  const user = await authenticateRequest(req);
  if (!user || user.isGuest) {
    return billingError(res, 401, 'AUTH_REQUIRED', 'Unauthorized', 'Please sign in again to finish the upgrade.');
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const orderId = firstString(body.razorpay_order_id, body.orderId, body.order_id);
  const paymentId = firstString(body.razorpay_payment_id, body.paymentId, body.payment_id);
  const signature = firstString(body.razorpay_signature, body.signature);

  if (!orderId || !paymentId || !signature) {
    return billingError(res, 400, 'MISSING_PARAMETERS', 'Missing required parameters: order_id, payment_id, and signature are required');
  }
  if (!RAZORPAY_ORDER_ID_RE.test(orderId) || !RAZORPAY_PAYMENT_ID_RE.test(paymentId) || !RAZORPAY_SIGNATURE_RE.test(signature)) {
    return billingError(res, 400, 'INVALID_SIGNATURE', 'Invalid payment signature. Verification failed.');
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    console.error('[Billing] RAZORPAY_KEY_SECRET missing from server environment.');
    return billingError(res, 503, 'BILLING_NOT_CONFIGURED', 'Payments are not available right now');
  }
  // A test-mode payment proves nothing on the live site (public test cards): never upgrade from one there
  if (billingTestModeBlocked()) {
    console.error('[Billing] Production is configured with a Razorpay TEST key: refusing to upgrade from a test payment.');
    return billingError(res, 503, 'BILLING_TEST_MODE', 'Payments are not available right now');
  }

  const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest();
  const given = Buffer.from(signature, 'hex');
  if (!(given.length === expected.length && crypto.timingSafeEqual(given, expected))) {
    await logSecurityEvent({
      userId: user.id,
      eventType: 'PAYMENT_SIGNATURE_MISMATCH',
      severity: 'CRITICAL',
      ipAddress: getClientIp(req),
      message: `Razorpay signature verification failed for order ${orderId}`,
    });
    return billingError(res, 400, 'INVALID_SIGNATURE', 'Invalid payment signature. Verification failed.');
  }

  let outcome;
  try {
    outcome = await completePaidOrder(getDb(), { orderId, paymentId, signature, userId: user.id });
  } catch (err: any) {
    if (err?.code === PG_UNIQUE_VIOLATION) {
      // The payment id is already stored on another order (payment_id is unique)
      return billingError(res, 409, 'PAYMENT_ALREADY_USED', 'Payment already used');
    }
    console.error('[Billing] Verify payment error:', err?.code || err?.message || err);
    return billingError(
      res,
      500,
      'BILLING_UPDATE_FAILED',
      'Failed to complete payment verification',
      'Your payment was received but your plan could not be updated yet. Please retry, or contact support.'
    );
  }

  switch (outcome.kind) {
    case 'not_found':
      await logSecurityEvent({
        userId: user.id,
        eventType: 'PAYMENT_ORDER_UNKNOWN',
        severity: 'CRITICAL',
        ipAddress: getClientIp(req),
        message: `Verified payment ${paymentId} names order ${orderId}, which is not an order of this account`,
      });
      return billingError(res, 404, 'ORDER_NOT_FOUND', 'Order not found', 'This payment does not belong to an order of your account. If you were charged, please contact support.');
    case 'amount_mismatch':
      await logSecurityEvent({
        userId: user.id,
        eventType: 'PAYMENT_AMOUNT_MISMATCH',
        severity: 'CRITICAL',
        ipAddress: getClientIp(req),
        message: `Order ${orderId} (${outcome.amount} ${outcome.currency}, ${outcome.tier}) does not cover the plan price; not upgraded`,
      });
      return billingError(res, 409, 'ORDER_AMOUNT_MISMATCH', 'Order does not match the plan price', 'This order was created for a different price, so it cannot unlock a plan. If you were charged, please contact support.');
    case 'paid_by_other_payment':
      return billingError(res, 409, 'ORDER_ALREADY_PAID', 'Order already paid', 'This order was already paid with another payment. If you were charged twice, please contact support.');
    case 'paid': {
      await logSecurityEvent({
        userId: user.id,
        eventType: 'SUBSCRIPTION_UPGRADED',
        severity: 'INFO',
        message: `Order ${orderId} (${outcome.orderTier}) paid with ${paymentId}; account plan: ${outcome.accountTier}`,
      });

      // Dispatch official tax invoice & payment receipt email via Resend
      if (user.email && user.email.includes('@')) {
        try {
          const planInfo = BILLING_PLANS[outcome.orderTier] || BILLING_PLANS.pro;
          const { basePaise, gstPaise } = splitGst(planInfo.amountPaise);
          const { subject, html } = renderInvoiceEmail({
            name: user.name,
            email: user.email,
            planName: planInfo.planName,
            tier: outcome.orderTier,
            amountPaise: planInfo.amountPaise,
            basePaise,
            gstPaise,
            orderId,
            paymentId,
          });

          sendBedrockEmail({
            to: user.email,
            from: DEFAULT_FROM_BILLING,
            subject,
            html,
          }).catch((err) => {
            console.error('[Billing] Invoice email dispatch error:', err?.message || err);
          });
        } catch (mailErr) {
          console.error('[Billing] Invoice email preparation error:', mailErr);
        }
      }
      break;
    }
    case 'already_paid':
      break;
  }

  const plan = BILLING_PLANS[outcome.accountTier];
  return res.status(200).json({
    success: true,
    message: outcome.accountTier === outcome.orderTier ? `Subscription successfully upgraded to ${plan.planName}` : `Payment received. Your account keeps the ${plan.planName}.`,
    plan: plan.planName,
    tier: outcome.accountTier,
    order_id: orderId,
    payment_id: paymentId,
  });
}

/**
 * POST /api/billing/webhook (rewritten to ?action=webhook). Razorpay calls this itself, so a user who closes the tab
 * right after paying is still upgraded. Set it up in Razorpay Dashboard > Webhooks with this URL, a secret, and the
 * events payment.captured and order.paid (refund.processed / payment.failed are logged for a human).
 *
 * - Signature: X-Razorpay-Signature = HMAC-SHA256(raw body, RAZORPAY_WEBHOOK_SECRET), compared in constant time.
 * - Replay-safe: completing an order only moves it from unpaid to paid once, so a repeated or re-sent event changes
 *   nothing. Razorpay retries non-2xx answers, so: bad signature 401, not configured 503, database error 500, and
 *   events that need no action (or a human) 200.
 */
async function handleWebhook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return billingError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }
  const secret = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    console.error('[RazorpayWebhook] RAZORPAY_WEBHOOK_SECRET is not configured');
    return billingError(res, 503, 'WEBHOOK_NOT_CONFIGURED', 'Webhook not configured');
  }
  const header = req.headers['x-razorpay-signature'];
  const signature = (Array.isArray(header) ? header[0] : header) || '';
  if (!RAZORPAY_SIGNATURE_RE.test(signature)) {
    return billingError(res, 401, 'INVALID_SIGNATURE', 'Invalid signature');
  }

  // The exact bytes Razorpay signed; a compact re-serialization only as a fallback (the signature must still match)
  const raw = await readRawBody(req);
  const candidates = [raw, req.body && typeof req.body === 'object' ? JSON.stringify(req.body) : typeof req.body === 'string' ? req.body : null]
    .filter((b): b is string => typeof b === 'string' && b.length > 0);
  const given = Buffer.from(signature, 'hex');
  const verifiedBody = candidates.find((b) => {
    const expected = crypto.createHmac('sha256', secret).update(b).digest();
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
  if (!verifiedBody) {
    // Log only, no database row: unauthenticated callers must not be able to fill a table
    console.warn('[RazorpayWebhook] Rejected a request with an invalid signature');
    return billingError(res, 401, 'INVALID_SIGNATURE', 'Invalid signature');
  }

  let event: any;
  try {
    event = JSON.parse(verifiedBody);
  } catch {
    return billingError(res, 400, 'INVALID_PAYLOAD', 'Payload is not JSON');
  }
  const eventName = typeof event?.event === 'string' ? event.event : '';
  const payment = event?.payload?.payment?.entity ?? {};
  const orderId = typeof payment.order_id === 'string' ? payment.order_id : event?.payload?.order?.entity?.id;
  const paymentId = typeof payment.id === 'string' ? payment.id : null;

  if (eventName === 'payment.captured' || eventName === 'order.paid') {
    // Same rule as verify: on the live site a TEST-mode payment unlocks nothing. Answered 200 so Razorpay stops retrying.
    if (billingTestModeBlocked()) {
      console.error(`[RazorpayWebhook] Ignored ${eventName} for order ${String(orderId).slice(0, 60)}: production runs on a Razorpay TEST key`);
      return res.status(200).json({ success: true, ignored: true, reason: 'test_mode' });
    }
    if (typeof orderId !== 'string' || !RAZORPAY_ORDER_ID_RE.test(orderId) || !paymentId || !RAZORPAY_PAYMENT_ID_RE.test(paymentId)) {
      // Not a payment for an order (e.g. a payment link): nothing of ours to complete
      return res.status(200).json({ success: true, ignored: true });
    }
    let outcome;
    try {
      outcome = await completePaidOrder(getDb(), {
        orderId,
        paymentId,
        signature: null,
        userId: null,
        paidAmount: typeof payment.amount === 'number' ? payment.amount : undefined,
        paidCurrency: typeof payment.currency === 'string' ? payment.currency : undefined,
      });
    } catch (err: any) {
      if (err?.code === PG_UNIQUE_VIOLATION) {
        await logSecurityEvent({ eventType: 'PAYMENT_WEBHOOK_REVIEW', severity: 'CRITICAL', message: `Webhook: payment ${paymentId} is already stored on another order (order ${orderId})` });
        return res.status(200).json({ success: true, review: true });
      }
      console.error('[RazorpayWebhook] Database error:', err?.code || err?.message || err);
      return billingError(res, 500, 'BILLING_UPDATE_FAILED', 'Could not record the payment'); // Razorpay retries
    }
    if (outcome.kind === 'paid') {
      await logSecurityEvent({
        userId: outcome.userId,
        eventType: 'SUBSCRIPTION_UPGRADED',
        severity: 'INFO',
        message: `Webhook ${eventName}: order ${orderId} (${outcome.orderTier}) paid with ${paymentId}; account plan: ${outcome.accountTier}`,
      });
    } else if (outcome.kind !== 'already_paid') {
      // Money arrived for an order we cannot complete: a human must look (refund or upgrade by hand)
      await logSecurityEvent({
        eventType: 'PAYMENT_WEBHOOK_REVIEW',
        severity: 'CRITICAL',
        message: `Webhook ${eventName}: payment ${paymentId} for order ${orderId} not applied (${outcome.kind})`,
      });
    }
    return res.status(200).json({ success: true, result: outcome.kind });
  }

  if (eventName === 'refund.processed' || eventName === 'payment.refunded' || eventName.startsWith('payment.dispute')) {
    // What a refund or dispute does to the plan is a business decision (OPEN-0086): record it for a human
    await logSecurityEvent({
      eventType: 'PAYMENT_WEBHOOK_REVIEW',
      severity: 'CRITICAL',
      message: `Webhook ${eventName} for payment ${paymentId ?? 'unknown'} (order ${typeof orderId === 'string' ? orderId : 'unknown'}): plan unchanged, review by hand`,
    });
    return res.status(200).json({ success: true, review: true });
  }

  // payment.failed, payment.authorized and anything else: no action needed
  return res.status(200).json({ success: true, ignored: true });
}

/**
 * GET /api/billing/history (rewritten to ?action=history): the signed-in user's PAID orders, newest first, for the
 * Billing page (replaces its invented sample invoices, OPEN-0092). Unpaid orders (checkout opened, never paid) are
 * not listed. Amounts are in paise, with the 18% GST split out; the payment signature is never returned.
 */
async function handleHistory(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return billingError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }
  if (!(await enforceRateLimit(req, res, 'general', getClientIp(req)))) return;
  const user = await authenticateRequest(req);
  if (!user || user.isGuest) {
    return billingError(res, 401, 'AUTH_REQUIRED', 'Unauthorized');
  }

  try {
    const rows = (await getDb()`
      SELECT order_id, payment_id, amount, currency, tier, created_at, updated_at
      FROM "PaymentRecord"
      WHERE user_id = ${user.id} AND status = 'captured'
      ORDER BY updated_at DESC
      LIMIT 100
    `) as Array<{ order_id: string; payment_id: string | null; amount: number; currency: string; tier: string; created_at: string; updated_at: string }>;

    return res.status(200).json({
      success: true,
      items: rows.map((r) => {
        const tier = normalizePaidTier(r.tier) ?? 'pro';
        const amountPaise = Number(r.amount) || 0;
        return {
          orderId: r.order_id,
          paymentId: r.payment_id,
          tier,
          planName: BILLING_PLANS[tier].planName,
          amountPaise,
          ...splitGst(amountPaise),
          currency: r.currency,
          status: 'paid',
          orderedAt: r.created_at,
          paidAt: r.updated_at,
        };
      }),
    });
  } catch (err: any) {
    console.error('[Billing] Payment history error:', err?.code || err?.message || err);
    return billingError(res, 500, 'BILLING_HISTORY_FAILED', 'Could not load payment history', 'Your payment history could not be loaded. Please try again.');
  }
}
