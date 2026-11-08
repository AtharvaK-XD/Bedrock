import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

// create-order failure envelopes, the Razorpay webhook and payment history (verify-payment.ts router), with Razorpay
// and the database faked. Keys are generated per run.
const KEY_SECRET = crypto.randomBytes(18).toString('base64url');
const WEBHOOK_SECRET = crypto.randomBytes(18).toString('base64url');

const h = vi.hoisted(() => {
  const state = {
    user: null as any,
    sqlCalls: [] as Array<{ text: string; values: unknown[] }>,
    responder: (_text: string, _values: unknown[]): unknown => [],
    ordersCreate: vi.fn(),
    events: [] as any[],
    authThrows: false,
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

vi.mock('../../_lib/auth.js', () => ({
  authenticateRequest: vi.fn(async () => {
    if (h.state.authThrows) throw new Error('auth exploded');
    return h.state.user;
  }),
}));
vi.mock('../../_lib/db.js', () => ({ getDb: () => h.sql, logSecurityEvent: vi.fn(async (e: any) => void h.state.events.push(e)) }));
vi.mock('../../_lib/rateLimiter.js', () => ({ enforceRateLimit: vi.fn(async () => true), getClientIp: () => '203.0.113.9' }));
vi.mock('razorpay', () => ({ default: class { orders = { create: h.state.ordersCreate }; } }));

import createOrder from '../create-order.js';
import billingRouter from '../verify-payment.js';
import { RAZORPAY_TIMEOUT_MS, withTimeout, BillingTimeoutError, splitGst } from '../../_lib/billing.js';

function res() {
  const r: any = { statusCode: 200, body: undefined, headersSent: false };
  r.status = vi.fn((c: number) => ((r.statusCode = c), r));
  r.json = vi.fn((b: unknown) => ((r.body = b), r));
  r.setHeader = vi.fn();
  return r;
}
async function call(handler: any, method: string, body?: unknown, query: Record<string, string> = {}) {
  const r = res();
  await handler({ method, body, query, headers: {} }, r);
  return r;
}
/** A request whose raw body can be read from its "data"/"end" events, like Vercel's (restoreBody). */
function webhookReq(raw: string, signature: string | null, parsed: unknown = JSON.parse(raw)) {
  const req: any = new EventEmitter();
  req.method = 'POST';
  req.query = { action: 'webhook' };
  req.headers = signature === null ? {} : { 'x-razorpay-signature': signature };
  req.body = parsed;
  const on = req.on.bind(req);
  let scheduled = false;
  req.on = (ev: string, fn: any) => {
    on(ev, fn);
    if (!scheduled) {
      scheduled = true;
      setImmediate(() => {
        req.emit('data', Buffer.from(raw));
        req.emit('end');
      });
    }
    return req;
  };
  return req;
}
const hookSig = (raw: string, secret = WEBHOOK_SECRET) => crypto.createHmac('sha256', secret).update(raw).digest('hex');
async function hook(raw: string, signature: string | null = hookSig(raw)) {
  const r = res();
  await billingRouter(webhookReq(raw, signature), r);
  return r;
}
const captured = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_Hook000000001', order_id: 'order_Hook00000001', amount: 47_082, currency: 'INR', status: 'captured', ...over } } },
  });

const originalEnv = process.env;
beforeEach(() => {
  process.env = { ...originalEnv, RAZORPAY_KEY_ID: 'rzp_test_fake', RAZORPAY_KEY_SECRET: KEY_SECRET, RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET };
  h.state.user = { id: 'user_A', email: 'a@x.test', name: 'A', role: 'r', plan: 'Free Plan', subscriptionTier: 'free', isGuest: false };
  h.state.sqlCalls = [];
  h.state.events = [];
  h.state.authThrows = false;
  h.state.responder = () => [];
  h.state.ordersCreate.mockReset().mockResolvedValue({ id: 'order_Abc123Def456' });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  process.env = originalEnv;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const expectEnvelope = (r: any, status: number, code: string) => {
  expect(r.statusCode).toBe(status);
  expect(r.body).toMatchObject({ success: false, code });
  expect(typeof r.body.error).toBe('string');
};

describe('create-order: every failure is { success: false, error, code }', () => {
  it('405 / 401 / 400 carry the same envelope', async () => {
    expectEnvelope(await call(createOrder, 'GET'), 405, 'METHOD_NOT_ALLOWED');
    h.state.user = null;
    expectEnvelope(await call(createOrder, 'POST', { tier: 'pro' }), 401, 'AUTH_REQUIRED');
    h.state.user = { id: 'user_A', isGuest: false };
    expectEnvelope(await call(createOrder, 'POST', { tier: 'gold' }), 400, 'INVALID_TIER');
    expectEnvelope(await call(createOrder, 'POST', { tier: 'pro', amount: 1 }), 409, 'PRICE_MISMATCH');
  });

  it('Razorpay that never answers: 504 BILLING_GATEWAY_TIMEOUT after the timeout, not Vercel\'s 60 s error page', async () => {
    vi.useFakeTimers();
    h.state.ordersCreate.mockReturnValue(new Promise(() => {})); // hangs forever
    const pending = call(createOrder, 'POST', { tier: 'pro' });
    await vi.advanceTimersByTimeAsync(RAZORPAY_TIMEOUT_MS + 1);
    const r = await pending;
    expectEnvelope(r, 504, 'BILLING_GATEWAY_TIMEOUT');
    expect(h.state.sqlCalls).toHaveLength(0); // no order row for an order we never received
  });

  it.each([
    ['a 502 from Razorpay', () => Promise.reject(Object.assign(new Error('Request failed with status code 502'), { statusCode: 502 }))],
    ['a 504 from Razorpay', () => Promise.reject(Object.assign(new Error('Request failed with status code 504'), { statusCode: 504 }))],
    ['a network reset', () => Promise.reject(Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }))],
    ['an answer without an order id', () => Promise.resolve({})],
    ['an answer with a malformed order id', () => Promise.resolve({ id: "order_'; DROP" })],
  ])('%s: 502 BILLING_ORDER_FAILED, no order stored, no upstream text', async (_why, impl) => {
    h.state.ordersCreate.mockImplementation(impl);
    const r = await call(createOrder, 'POST', { tier: 'pro' });
    expectEnvelope(r, 502, 'BILLING_ORDER_FAILED');
    expect(JSON.stringify(r.body)).not.toMatch(/status code|socket|DROP/);
    expect(h.state.sqlCalls).toHaveLength(0);
  });

  it('an unexpected throw anywhere still answers JSON (500 BILLING_INTERNAL_ERROR)', async () => {
    h.state.authThrows = true;
    const r = await call(createOrder, 'POST', { tier: 'pro' });
    expectEnvelope(r, 500, 'BILLING_INTERNAL_ERROR');
    expect(JSON.stringify(r.body)).not.toContain('auth exploded');
  });

  it('success says so', async () => {
    const r = await call(createOrder, 'POST', { tier: 'pro' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ success: true, order_id: 'order_Abc123Def456' });
  });
});

describe('withTimeout', () => {
  it('passes through a value in time, and clears its timer', async () => {
    await expect(withTimeout(Promise.resolve(7), 50)).resolves.toBe(7);
  });
  it('rejects with BillingTimeoutError when late', async () => {
    await expect(withTimeout(new Promise(() => {}), 10)).rejects.toBeInstanceOf(BillingTimeoutError);
  });
});

describe('verify-payment: unexpected throws and envelopes', () => {
  it('405 and 401 use the envelope; an unexpected throw is a JSON 500', async () => {
    expectEnvelope(await call(billingRouter, 'GET'), 405, 'METHOD_NOT_ALLOWED');
    h.state.user = null;
    expectEnvelope(await call(billingRouter, 'POST', {}), 401, 'AUTH_REQUIRED');
    h.state.authThrows = true;
    expectEnvelope(await call(billingRouter, 'POST', {}), 500, 'BILLING_INTERNAL_ERROR');
  });
});

describe('POST /api/billing/webhook (Razorpay calls it)', () => {
  const PAID = (upgraded = 1) => (text: string) =>
    text.startsWith('WITH paid AS') ? [{ user_id: 'user_B', tier: 'pro', upgraded }] : [];

  it('503 when the webhook secret is not configured (Razorpay retries later)', async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    expectEnvelope(await hook(captured()), 503, 'WEBHOOK_NOT_CONFIGURED');
  });

  it.each([
    ['no signature header', null],
    ['a malformed signature', 'not-hex'],
    ['a signature made with another secret', hookSig(captured(), 'some-other-secret')],
    ['the payment-verification signature scheme instead of the webhook one', crypto.createHmac('sha256', KEY_SECRET).update(captured()).digest('hex')],
  ])('401 and nothing changes for %s', async (_why, sig) => {
    const r = await hook(captured(), sig as string | null);
    expectEnvelope(r, 401, 'INVALID_SIGNATURE');
    expect(h.state.sqlCalls).toHaveLength(0);
  });

  it('a body changed after signing is refused (the signature covers the exact bytes)', async () => {
    const raw = captured();
    const r = await hook(raw.replace('47082', '1'), hookSig(raw));
    expect(r.statusCode).toBe(401);
  });

  it('payment.captured completes the order for its owner, with the captured amount checked', async () => {
    h.state.responder = PAID();
    const r = await hook(captured());
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ success: true, result: 'paid' });
    const stmt = h.state.sqlCalls[0];
    expect(stmt.text.startsWith('WITH paid AS')).toBe(true);
    // no account from the request: the order row names it (user filter null), and Razorpay's amount must cover it
    expect(stmt.values).toEqual(expect.arrayContaining(['pay_Hook000000001', 'order_Hook00000001', null, 47_082, 'INR']));
    expect(h.state.events.find((e) => e.eventType === 'SUBSCRIPTION_UPGRADED')).toMatchObject({ userId: 'user_B' });
  });

  it('order.paid is handled the same way', async () => {
    h.state.responder = PAID();
    const raw = JSON.stringify({
      event: 'order.paid',
      payload: {
        order: { entity: { id: 'order_Hook00000001' } },
        payment: { entity: { id: 'pay_Hook000000001', order_id: 'order_Hook00000001', amount: 47_082, currency: 'INR' } },
      },
    });
    expect((await hook(raw)).body).toMatchObject({ result: 'paid' });
  });

  it('a replayed event changes nothing (the order is already paid by this payment)', async () => {
    h.state.responder = (text) =>
      text.startsWith('SELECT o.user_id') ? [{ user_id: 'user_B', tier: 'pro', status: 'captured', payment_id: 'pay_Hook000000001', subscription_tier: 'pro' }] : [];
    const r = await hook(captured());
    expect(r.body).toMatchObject({ success: true, result: 'already_paid' });
    expect(h.state.events.map((e) => e.eventType)).not.toContain('SUBSCRIPTION_UPGRADED');
  });

  it('money for an order we cannot complete is flagged for a human (200, so Razorpay does not retry forever)', async () => {
    h.state.responder = () => [];
    const r = await hook(captured());
    expect(r.statusCode).toBe(200);
    expect(r.body.result).toBe('not_found');
    expect(h.state.events.find((e) => e.eventType === 'PAYMENT_WEBHOOK_REVIEW')?.severity).toBe('CRITICAL');
  });

  it('refunds and disputes are recorded for review, the plan is not changed', async () => {
    const raw = JSON.stringify({ event: 'refund.processed', payload: { payment: { entity: { id: 'pay_Hook000000001', order_id: 'order_Hook00000001' } } } });
    const r = await hook(raw);
    expect(r.body).toMatchObject({ success: true, review: true });
    expect(h.state.sqlCalls).toHaveLength(0);
    expect(h.state.events[0]).toMatchObject({ eventType: 'PAYMENT_WEBHOOK_REVIEW', severity: 'CRITICAL' });
  });

  it('other events and payments that belong to no order are acknowledged and ignored', async () => {
    expect((await hook(JSON.stringify({ event: 'payment.failed', payload: {} }))).body).toMatchObject({ ignored: true });
    expect((await hook(captured({ order_id: null }))).body).toMatchObject({ ignored: true });
    expect(h.state.sqlCalls).toHaveLength(0);
  });

  it('a database error answers 500 so Razorpay retries', async () => {
    h.state.responder = () => {
      throw Object.assign(new Error('db down'), { code: '08006' });
    };
    expectEnvelope(await hook(captured()), 500, 'BILLING_UPDATE_FAILED');
  });
});

describe('GET /api/billing/history', () => {
  it('401 without an account', async () => {
    h.state.user = null;
    expectEnvelope(await call(billingRouter, 'GET', undefined, { action: 'history' }), 401, 'AUTH_REQUIRED');
  });

  it("lists only this user's PAID orders, newest first, with GST split out and no signature", async () => {
    h.state.responder = (text) =>
      text.startsWith('SELECT order_id')
        ? [{ order_id: 'order_P1', payment_id: 'pay_P1', amount: 117_882, currency: 'INR', tier: 'ultimate', created_at: '2026-11-08T10:00:00Z', updated_at: '2026-11-08T10:01:00Z' }]
        : [];
    const r = await call(billingRouter, 'GET', undefined, { action: 'history' });
    expect(r.statusCode).toBe(200);
    expect(r.body.items).toEqual([
      expect.objectContaining({ orderId: 'order_P1', paymentId: 'pay_P1', tier: 'ultimate', planName: 'Ultimate Plan', amountPaise: 117_882, basePaise: 99_900, gstPaise: 17_982, status: 'paid' }),
    ]);
    const q = h.state.sqlCalls[0];
    expect(q.text).toContain("WHERE user_id = $ AND status = 'captured'");
    expect(q.values).toEqual(['user_A']);
    expect(q.text).not.toContain('signature');
  });

  it('a database error is a JSON 500', async () => {
    h.state.responder = () => {
      throw new Error('db down');
    };
    expectEnvelope(await call(billingRouter, 'GET', undefined, { action: 'history' }), 500, 'BILLING_HISTORY_FAILED');
  });

  it('GST split matches the plan prices exactly', () => {
    expect(splitGst(47_082)).toEqual({ basePaise: 39_900, gstPaise: 7_182 });
    expect(splitGst(117_882)).toEqual({ basePaise: 99_900, gstPaise: 17_982 });
  });
});
