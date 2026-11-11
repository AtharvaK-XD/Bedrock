// The live site must never sell plans through Razorpay TEST mode (test cards are public, test payments carry valid
// signatures). Razorpay, auth, rate limits and the database are faked; keys are generated per run.
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_KEY_ID = `rzp_test_${crypto.randomBytes(7).toString('hex')}`;
const LIVE_KEY_ID = `rzp_live_${crypto.randomBytes(7).toString('hex')}`;
const SECRET = crypto.randomBytes(18).toString('base64url');

const h = vi.hoisted(() => ({
  sqlCalls: [] as string[],
  ordersCreate: null as any,
}));
vi.mock('../../api/_lib/auth.js', () => ({
  authenticateRequest: async () => ({ id: 'user_T', email: 't@x.test', name: 'T', role: 'r', plan: 'Free Plan', subscriptionTier: 'free', isGuest: false }),
}));
vi.mock('../../api/_lib/db.js', () => ({
  getDb: () => async (strings: TemplateStringsArray) => {
    h.sqlCalls.push(strings.join('$'));
    // completePaidOrder(): the atomic "mark paid + upgrade" statement answers the order's owner, tier and whether upgraded
    return strings.join('$').includes('WITH paid AS') ? [{ user_id: 'user_T', tier: 'pro', upgraded: 1 }] : [];
  },
  logSecurityEvent: async () => {},
}));
vi.mock('../../api/_lib/rateLimiter.js', () => ({ enforceRateLimit: async () => true, getClientIp: () => '203.0.113.7' }));
vi.mock('razorpay', () => ({
  default: class {
    orders = { create: (...a: unknown[]) => h.ordersCreate(...a) };
  },
}));

import createOrder from '../../api/billing/create-order.ts';
import verifyPayment from '../../api/billing/verify-payment.ts';

async function call(handler: any, body: unknown, query: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const r: any = { statusCode: 200, body: undefined, headersSent: false };
  r.status = (c: number) => ((r.statusCode = c), r);
  r.json = (b: unknown) => ((r.body = b), r);
  r.setHeader = () => {};
  await handler({ method: 'POST', body, query, headers }, r);
  return r;
}
const WEBHOOK_SECRET = crypto.randomBytes(18).toString('base64url');
const capturedEvent = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_TestMode00001', order_id: 'order_TestMode0001', amount: 170000, currency: 'INR' } } } };
const webhook = () =>
  call(verifyPayment, capturedEvent, { action: 'webhook' }, { 'x-razorpay-signature': crypto.createHmac('sha256', WEBHOOK_SECRET).update(JSON.stringify(capturedEvent)).digest('hex') });
const ORDER = 'order_TestMode0001';
const PAYMENT = 'pay_TestMode00001';
const signed = { razorpay_order_id: ORDER, razorpay_payment_id: PAYMENT, razorpay_signature: crypto.createHmac('sha256', SECRET).update(`${ORDER}|${PAYMENT}`).digest('hex') };

beforeEach(() => {
  h.sqlCalls = [];
  h.ordersCreate = vi.fn(async () => ({ id: ORDER }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('RAZORPAY_KEY_SECRET', SECRET);
  vi.stubEnv('RAZORPAY_WEBHOOK_SECRET', WEBHOOK_SECRET);
  vi.stubEnv('BILLING_ALLOW_TEST_MODE', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Razorpay test keys on the live site', () => {
  it('production with a test key: no order is created and no account is upgraded', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('RAZORPAY_KEY_ID', TEST_KEY_ID);
    const order = await call(createOrder, { tier: 'ultimate' });
    expect(order.statusCode).toBe(503);
    expect(order.body.code).toBe('BILLING_TEST_MODE');
    expect(h.ordersCreate).not.toHaveBeenCalled();
    const verified = await call(verifyPayment, signed);
    expect(verified.statusCode).toBe(503);
    expect(verified.body.code).toBe('BILLING_TEST_MODE');
    // Razorpay's webhook for a test payment: acknowledged (no endless retries) but nothing is completed
    const hook = await webhook();
    expect(hook.statusCode).toBe(200);
    expect(hook.body).toMatchObject({ ignored: true, reason: 'test_mode' });
    expect(h.sqlCalls.some((s) => s.includes('UPDATE "User"') || s.includes('WITH paid AS'))).toBe(false);
  });

  it('the owner can switch test payments on for a test run (BILLING_ALLOW_TEST_MODE=true)', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('RAZORPAY_KEY_ID', TEST_KEY_ID);
    vi.stubEnv('BILLING_ALLOW_TEST_MODE', 'true');
    expect((await call(createOrder, { tier: 'pro' })).statusCode).toBe(200);
    expect((await call(verifyPayment, signed)).statusCode).toBe(200);
    expect((await webhook()).body.reason).toBeUndefined();
    expect(h.sqlCalls.some((s) => s.includes('WITH paid AS'))).toBe(true);
  });

  it('live keys on production, and test keys on previews / local development, work as before', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('RAZORPAY_KEY_ID', LIVE_KEY_ID);
    expect((await call(createOrder, { tier: 'pro' })).statusCode).toBe(200);
    expect((await call(verifyPayment, signed)).statusCode).toBe(200);
    for (const env of ['preview', '']) {
      vi.stubEnv('VERCEL_ENV', env);
      vi.stubEnv('RAZORPAY_KEY_ID', TEST_KEY_ID);
      expect((await call(createOrder, { tier: 'pro' })).statusCode).toBe(200);
    }
  });
});
