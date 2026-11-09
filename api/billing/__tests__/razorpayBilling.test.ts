import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';

// Billing routes with Razorpay and the database faked. Keys are generated per run (never a real key in the repo:
// the scanner flags key secrets written as literals).
const TEST_KEY_ID = `rzp_test_${crypto.randomBytes(7).toString('hex')}`;
const TEST_SECRET = crypto.randomBytes(18).toString('base64url');

const h = vi.hoisted(() => {
  const state = {
    user: null as any,
    sqlCalls: [] as Array<{ text: string; values: unknown[] }>,
    responder: (_text: string, _values: unknown[]): unknown => [],
    razorpayOrdersCreate: vi.fn(),
    securityEvents: [] as any[],
  };
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('$').replace(/\s+/g, ' ').trim();
    state.sqlCalls.push({ text, values });
    try {
      return Promise.resolve(state.responder(text, values));
    } catch (err) {
      return Promise.reject(err);
    }
  };
  return { state, sql };
});

vi.mock('../../_lib/auth.js', () => ({ authenticateRequest: vi.fn(async () => h.state.user) }));
vi.mock('../../_lib/db.js', () => ({
  getDb: () => h.sql,
  logSecurityEvent: vi.fn(async (e: any) => void h.state.securityEvents.push(e)),
}));
vi.mock('../../_lib/rateLimiter.js', () => ({
  enforceRateLimit: vi.fn(async () => true),
  getClientIp: () => '203.0.113.9',
}));
vi.mock('razorpay', () => ({
  default: class MockRazorpay {
    orders = { create: h.state.razorpayOrdersCreate };
  },
}));

import createOrder from '../create-order.js';
import verifyPayment from '../verify-payment.js';
import { BILLING_PLANS } from '../../_lib/billing.js';

const req = (method: string, body: unknown = {}) => ({ method, body, query: {}, headers: {} }) as any;
function res() {
  const r: any = { statusCode: 200, body: undefined, headers: {} as Record<string, string> };
  r.status = vi.fn((c: number) => ((r.statusCode = c), r));
  r.json = vi.fn((b: unknown) => ((r.body = b), r));
  r.setHeader = vi.fn((k: string, v: string) => void (r.headers[k] = v));
  return r;
}
const call = async (handler: any, method: string, body?: unknown) => {
  const r = res();
  await handler(req(method, body), r);
  return r;
};
const sign = (orderId: string, paymentId: string) => crypto.createHmac('sha256', TEST_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
const userUpdates = () => h.state.sqlCalls.filter((c) => c.text.includes('UPDATE "User"'));

const ORDER = 'order_Abc123Def456';
const PAYMENT = 'pay_Xyz789Uvw012';

const originalEnv = process.env;
beforeEach(() => {
  process.env = { ...originalEnv, RAZORPAY_KEY_ID: TEST_KEY_ID, RAZORPAY_KEY_SECRET: TEST_SECRET };
  h.state.user = { id: 'user_A', email: 'a@x.test', name: 'A', role: 'r', plan: 'Free Plan', subscriptionTier: 'free', isGuest: false };
  h.state.sqlCalls = [];
  h.state.securityEvents = [];
  h.state.responder = () => [];
  h.state.razorpayOrdersCreate.mockReset().mockResolvedValue({ id: ORDER });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  process.env = originalEnv;
  vi.restoreAllMocks();
});

describe('plan prices', () => {
  it('match the pricing page: base price + 18% GST, in paise', () => {
    for (const p of Object.values(BILLING_PLANS)) {
      expect(p.amountPaise, p.tier).toBe(Math.round(p.basePriceInr * 1.18 * 100));
    }
    expect(BILLING_PLANS.pro.amountPaise).toBe(47_082); // ₹470.82
    expect(BILLING_PLANS.ultimate.amountPaise).toBe(117_882); // ₹1,178.82
  });
});

describe('POST /api/billing/create-order', () => {
  it('405 for other methods; 401 without an account (also the local guest)', async () => {
    expect((await call(createOrder, 'GET')).statusCode).toBe(405);
    h.state.user = null;
    expect((await call(createOrder, 'POST', { tier: 'pro' })).statusCode).toBe(401);
    h.state.user = { id: 'guest', isGuest: true };
    expect((await call(createOrder, 'POST', { tier: 'pro' })).statusCode).toBe(401);
    expect(h.state.razorpayOrdersCreate).not.toHaveBeenCalled();
  });

  it.each([[undefined], ['free'], ['enterprise'], [42], [{ tier: 'pro' }], [['pro']]])(
    'refuses tier %j with 400 (was: a non-string tier crashed the route, a missing one silently charged Pro)',
    async (tier) => {
      const r = await call(createOrder, 'POST', { tier });
      expect(r.statusCode).toBe(400);
      expect(r.body.code).toBe('INVALID_TIER');
      expect(h.state.razorpayOrdersCreate).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['pro', 100, 'a ₹1 order (amount tampered)'],
    ['ultimate', 100, 'what the old page sent for Ultimate (parseFloat("1,178.82") = 1)'],
    ['ultimate', BILLING_PLANS.pro.amountPaise, 'the Pro price for Ultimate'],
    ['pro', 'abc', 'a non-number'],
  ])('refuses %s with amount %j: %s', async (tier, amount, _why) => {
    const r = await call(createOrder, 'POST', { tier, amount });
    expect(r.statusCode).toBe(409);
    expect(r.body.code).toBe('PRICE_MISMATCH');
    expect(h.state.razorpayOrdersCreate).not.toHaveBeenCalled();
    expect(h.state.securityEvents.map((e) => e.eventType)).toContain('PAYMENT_PRICE_MISMATCH');
  });

  it('refuses another currency', async () => {
    const r = await call(createOrder, 'POST', { tier: 'pro', currency: 'EUR' });
    expect(r.statusCode).toBe(400);
    expect(r.body.code).toBe('INVALID_CURRENCY');
  });

  it('accepts USD for international payments', async () => {
    const r = await call(createOrder, 'POST', { tier: 'pro', currency: 'USD' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ tier: 'pro', amount: 2000, currency: 'USD' });
  });

  it('creates a USD order for Ultimate ($50 = 5000 cents)', async () => {
    const r = await call(createOrder, 'POST', { tier: 'ultimate', currency: 'USD', amount: 5000 });
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ tier: 'ultimate', amount: 5000, currency: 'USD' });
  });

  it('refuses a USD order when amount does not match plan cents', async () => {
    const r = await call(createOrder, 'POST', { tier: 'ultimate', currency: 'USD', amount: 2000 });
    expect(r.statusCode).toBe(409);
    expect(r.body.code).toBe('PRICE_MISMATCH');
  });

  it('creates the order at the SERVER price, with server-set notes and receipt only', async () => {
    const r = await call(createOrder, 'POST', {
      tier: 'Ultimate',
      amount: '117882',
      currency: 'INR',
      receipt: 'attacker-receipt',
      notes: { userId: 'someone_else', tier: 'ultimate-forever' },
    });
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ order_id: ORDER, orderId: ORDER, amount: 117_882, currency: 'INR', tier: 'ultimate', keyId: TEST_KEY_ID });
    expect(JSON.stringify(r.body)).not.toContain(TEST_SECRET);
    const sent = h.state.razorpayOrdersCreate.mock.calls[0][0];
    expect(sent).toMatchObject({ amount: 117_882, currency: 'INR', notes: { userId: 'user_A', tier: 'ultimate' } });
    expect(sent.receipt).toMatch(/^rcpt_[0-9a-f]{30}$/);
    expect(sent.receipt.length).toBeLessThanOrEqual(40);
    const insert = h.state.sqlCalls.find((c) => c.text.startsWith('INSERT INTO "PaymentRecord"'))!;
    expect(insert.values).toEqual([expect.stringMatching(/^payrec_/), 'user_A', ORDER, 117_882, 'INR', 'created', 'ultimate']);
  });

  it('accepts a request without an amount, and "advanced" as the older name of Pro', async () => {
    const r = await call(createOrder, 'POST', { tier: 'advanced' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ tier: 'pro', amount: 47_082 });
  });

  it('refuses the order (503) when it cannot be stored, so it can never be paid without a record', async () => {
    h.state.responder = (text) => {
      if (text.startsWith('INSERT INTO "PaymentRecord"')) throw Object.assign(new Error('db down'), { code: '08006' });
      return [];
    };
    const r = await call(createOrder, 'POST', { tier: 'pro' });
    expect(r.statusCode).toBe(503);
    expect(r.body.code).toBe('BILLING_UNAVAILABLE');
    expect(r.body).not.toHaveProperty('order_id');
  });

  it('Razorpay failure: 502 with a plain message, no upstream detail', async () => {
    h.state.razorpayOrdersCreate.mockRejectedValue(Object.assign(new Error('BAD_REQUEST_ERROR: key xyz invalid'), { error: { description: 'internal detail' } }));
    const r = await call(createOrder, 'POST', { tier: 'pro' });
    expect(r.statusCode).toBe(502);
    expect(JSON.stringify(r.body)).not.toMatch(/internal detail|BAD_REQUEST|xyz/);
  });

  it('503 when the gateway keys are not configured', async () => {
    delete process.env.RAZORPAY_KEY_SECRET;
    const r = await call(createOrder, 'POST', { tier: 'pro' });
    expect(r.statusCode).toBe(503);
    expect(r.body.code).toBe('BILLING_NOT_CONFIGURED');
  });
});

describe('POST /api/billing/verify-payment', () => {
  const body = (over: Record<string, unknown> = {}) => ({
    razorpay_order_id: ORDER,
    razorpay_payment_id: PAYMENT,
    razorpay_signature: sign(ORDER, PAYMENT),
    ...over,
  });

  it('405 / 401 / 400 for missing fields', async () => {
    expect((await call(verifyPayment, 'GET')).statusCode).toBe(405);
    h.state.user = null;
    expect((await call(verifyPayment, 'POST', body())).statusCode).toBe(401);
    h.state.user = { id: 'user_A', isGuest: false };
    expect((await call(verifyPayment, 'POST', { orderId: ORDER })).statusCode).toBe(400);
  });

  it.each([
    ['a number as signature (used to crash Buffer.from)', { razorpay_signature: 12345 }],
    ['an object as signature', { razorpay_signature: { a: 1 } }],
    ['a non-hex signature', { razorpay_signature: 'z'.repeat(64) }],
    ['a short signature', { razorpay_signature: 'ab' }],
    ['a malformed order id', { razorpay_order_id: "order_x'; DROP TABLE" }],
    ['a malformed payment id', { razorpay_payment_id: 'pay_' }],
  ])('refuses %s with 400 and touches nothing', async (_why, over) => {
    const r = await call(verifyPayment, 'POST', body(over));
    expect(r.statusCode).toBe(400);
    expect(h.state.sqlCalls).toHaveLength(0);
  });

  it('a wrong signature: 400, logged as CRITICAL, no plan change', async () => {
    const r = await call(verifyPayment, 'POST', body({ razorpay_signature: sign(ORDER, 'pay_Other000000') }));
    expect(r.statusCode).toBe(400);
    expect(userUpdates()).toHaveLength(0);
    expect(h.state.securityEvents.find((e) => e.eventType === 'PAYMENT_SIGNATURE_MISMATCH')?.severity).toBe('CRITICAL');
  });

  it('a valid payment applies the plan STORED ON THE ORDER, never the tier the browser names', async () => {
    // The order row says Pro; the browser claims Ultimate
    h.state.responder = (text) => (text.startsWith('WITH paid AS') ? [{ user_id: 'user_A', tier: 'pro', upgraded: 1 }] : []);
    const r = await call(verifyPayment, 'POST', body({ tier: 'ultimate' }));
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ success: true, tier: 'pro', plan: 'Pro Plan', order_id: ORDER, payment_id: PAYMENT });
    const stmt = h.state.sqlCalls[0];
    expect(stmt.text).toContain("AND status = 'created'");
    expect(stmt.text).toContain('user_id = $::text');
    // the price guard uses today's Ultimate / Pro prices (server constants, never from the request)
    expect(stmt.values).toEqual(expect.arrayContaining([PAYMENT, body().razorpay_signature, ORDER, 'user_A', 'INR', 117_882, 47_082]));
    expect(stmt.values).not.toContain('ultimate');
  });

  it('an Ultimate account that pays for Pro keeps Ultimate, and the answer says so (was: "upgraded to Pro Plan")', async () => {
    // the order was paid, but the account update was skipped because the account already has Ultimate
    h.state.responder = (text) => (text.startsWith('WITH paid AS') ? [{ user_id: 'user_A', tier: 'pro', upgraded: 0 }] : []);
    const r = await call(verifyPayment, 'POST', body());
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ success: true, tier: 'ultimate', plan: 'Ultimate Plan' });
    expect(r.body.message).toMatch(/keeps the Ultimate Plan/);
  });

  it("an order that is not this account's (or unknown): 404, no upgrade", async () => {
    h.state.responder = () => [];
    const r = await call(verifyPayment, 'POST', body());
    expect(r.statusCode).toBe(404);
    expect(r.body.code).toBe('ORDER_NOT_FOUND');
    expect(h.state.securityEvents.find((e) => e.eventType === 'PAYMENT_ORDER_UNKNOWN')?.severity).toBe('CRITICAL');
  });

  it('the same verified payment sent again (a retry): success, nothing changed twice', async () => {
    h.state.responder = (text) =>
      text.startsWith('SELECT o.user_id') ? [{ user_id: 'user_A', tier: 'ultimate', status: 'captured', payment_id: PAYMENT, subscription_tier: 'ultimate' }] : [];
    const r = await call(verifyPayment, 'POST', body());
    expect(r.statusCode).toBe(200);
    expect(r.body.tier).toBe('ultimate');
    expect(h.state.securityEvents.map((e) => e.eventType)).not.toContain('SUBSCRIPTION_UPGRADED');
  });

  it('an order already paid with ANOTHER payment: 409', async () => {
    h.state.responder = (text) =>
      text.startsWith('SELECT o.user_id') ? [{ user_id: 'user_A', tier: 'pro', status: 'captured', payment_id: 'pay_Earlier00000', subscription_tier: 'pro' }] : [];
    const r = await call(verifyPayment, 'POST', body());
    expect(r.statusCode).toBe(409);
    expect(r.body.code).toBe('ORDER_ALREADY_PAID');
  });

  it('a payment id already stored on another order: 409', async () => {
    h.state.responder = () => {
      throw Object.assign(new Error('duplicate key value violates unique constraint "PaymentRecord_payment_id_key"'), { code: '23505' });
    };
    const r = await call(verifyPayment, 'POST', body());
    expect(r.statusCode).toBe(409);
    expect(JSON.stringify(r.body)).not.toContain('PaymentRecord_payment_id_key');
  });

  it('a database failure: 500 with a plain message, no internals', async () => {
    h.state.responder = () => {
      throw Object.assign(new Error('connection to server at 10.0.0.1 failed'), { code: '08006' });
    };
    const r = await call(verifyPayment, 'POST', body());
    expect(r.statusCode).toBe(500);
    expect(JSON.stringify(r.body)).not.toContain('10.0.0.1');
  });
});
