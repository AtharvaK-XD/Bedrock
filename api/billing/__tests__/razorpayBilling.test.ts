import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';

const TEST_KEY_ID = 'rzp_test_TxDt5ASdEdwHRM';
const TEST_KEY_SECRET = 'Y8UNcE1AWjLMac4pzwqpEH4u';

const h = vi.hoisted(() => {
  const state = {
    user: { id: 'usr_test_123', email: 'test@bedrock.app', name: 'Test User' } as any,
    sqlCalls: [] as Array<{ text: string; values: unknown[] }>,
    razorpayOrdersCreate: vi.fn(),
  };

  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('$').replace(/\s+/g, ' ').trim();
    state.sqlCalls.push({ text, values });
    return Promise.resolve([]);
  };

  return {
    state,
    sql,
    authenticateRequest: vi.fn(async () => state.user),
  };
});

vi.mock('../../_lib/auth.js', () => ({
  authenticateRequest: h.authenticateRequest,
}));

vi.mock('../../_lib/db.js', () => ({
  getDb: () => h.sql,
  logSecurityEvent: vi.fn(async () => {}),
}));

vi.mock('razorpay', () => {
  return {
    default: class MockRazorpay {
      orders = {
        create: h.state.razorpayOrdersCreate,
      };
    },
  };
});

import createOrderHandler from '../create-order.js';
import verifyPaymentHandler from '../verify-payment.js';

function mockReq(method: string, body: Record<string, unknown> = {}) {
  return {
    method,
    body,
    headers: {},
  } as any;
}

function mockRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((data: unknown) => {
    res.body = data;
    return res;
  });
  return res;
}

describe('Razorpay Billing Integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      RAZORPAY_KEY_ID: TEST_KEY_ID,
      RAZORPAY_KEY_SECRET: TEST_KEY_SECRET,
    };
    h.state.user = { id: 'usr_test_123', email: 'test@bedrock.app', name: 'Test User' };
    h.state.sqlCalls = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('POST /api/billing/create-order', () => {
    it('rejects non-POST methods with 405', async () => {
      const req = mockReq('GET');
      const res = mockRes();
      await createOrderHandler(req, res);
      expect(res.statusCode).toBe(405);
      expect(res.body.error).toBe('Method not allowed');
    });

    it('rejects unauthenticated requests with 401', async () => {
      h.state.user = null;
      const req = mockReq('POST', { amount: 39900 });
      const res = mockRes();
      await createOrderHandler(req, res);
      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('rejects order amount less than 100 paise with 400', async () => {
      const req = mockReq('POST', { amount: 50 }); // 50 paise is < 100 paise
      const res = mockRes();
      await createOrderHandler(req, res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Amount must be at least 100 paise');
    });

    it('handles Razorpay API errors and returns 500', async () => {
      h.state.razorpayOrdersCreate.mockRejectedValueOnce(new Error('Gateway timeout from Razorpay upstream'));
      const req = mockReq('POST', { amount: 39900 });
      const res = mockRes();
      await createOrderHandler(req, res);
      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Failed to create Razorpay order');
    });

    it('creates Razorpay order successfully with order_id, amount, currency', async () => {
      h.state.razorpayOrdersCreate.mockResolvedValueOnce({
        id: 'order_test_998877',
        amount: 39900,
        currency: 'INR',
      });

      const req = mockReq('POST', { tier: 'pro' });
      const res = mockRes();
      await createOrderHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.order_id).toBe('order_test_998877');
      expect(res.body.amount).toBe(39900);
      expect(res.body.currency).toBe('INR');
      expect(res.body.keyId).toBe(TEST_KEY_ID);

      // Verify DB recording call
      expect(h.state.sqlCalls.length).toBeGreaterThanOrEqual(1);
      expect(h.state.sqlCalls[0].text).toContain('INSERT INTO "PaymentRecord"');
    });
  });

  describe('POST /api/billing/verify-payment', () => {
    it('rejects non-POST methods with 405', async () => {
      const req = mockReq('GET');
      const res = mockRes();
      await verifyPaymentHandler(req, res);
      expect(res.statusCode).toBe(405);
      expect(res.body.error).toBe('Method not allowed');
    });

    it('rejects unauthenticated requests with 401', async () => {
      h.state.user = null;
      const req = mockReq('POST', {
        orderId: 'order_123',
        paymentId: 'pay_123',
        signature: 'sig_123',
      });
      const res = mockRes();
      await verifyPaymentHandler(req, res);
      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('rejects missing fields with 400', async () => {
      const req = mockReq('POST', { orderId: 'order_123' }); // missing paymentId and signature
      const res = mockRes();
      await verifyPaymentHandler(req, res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('rejects invalid signature mismatch with 400 and does NOT mark as paid', async () => {
      const req = mockReq('POST', {
        orderId: 'order_123',
        paymentId: 'pay_123',
        signature: 'forged_invalid_signature_hex',
      });
      const res = mockRes();
      await verifyPaymentHandler(req, res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Invalid payment signature');

      // Verify no DB update occurred for user subscription
      const updateCalls = h.state.sqlCalls.filter((c) => c.text.includes('UPDATE "User"'));
      expect(updateCalls.length).toBe(0);
    });

    it('verifies valid HMAC-SHA256 signature, updates user plan, and returns 200 success', async () => {
      const orderId = 'order_valid_123';
      const paymentId = 'pay_valid_456';
      const text = `${orderId}|${paymentId}`;
      const validSignature = crypto
        .createHmac('sha256', TEST_KEY_SECRET)
        .update(text)
        .digest('hex');

      const req = mockReq('POST', {
        orderId,
        paymentId,
        signature: validSignature,
        tier: 'pro',
      });
      const res = mockRes();
      await verifyPaymentHandler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.order_id).toBe(orderId);
      expect(res.body.payment_id).toBe(paymentId);
      expect(res.body.plan).toBe('Pro Plan');

      // Verify DB updates
      const paymentRecordUpdate = h.state.sqlCalls.find((c) => c.text.includes('UPDATE "PaymentRecord"'));
      const userPlanUpdate = h.state.sqlCalls.find((c) => c.text.includes('UPDATE "User"'));
      expect(paymentRecordUpdate).toBeDefined();
      expect(userPlanUpdate).toBeDefined();
    });
  });
});
