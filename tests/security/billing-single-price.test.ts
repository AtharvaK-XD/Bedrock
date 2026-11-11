// One price per plan and currency: the amount the Pricing page shows is the only amount the server charges, and the
// browser can never pick a cheaper one (until 2026-11-11 create-order accepted a list that still held retired,
// lower INR prices: Ultimate for ₹1,178.82 instead of ₹4,250). Razorpay, auth and the database are faked.
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ ordersCreate: null as any, inserts: [] as unknown[][] }));
vi.mock('../../api/_lib/auth.js', () => ({
  authenticateRequest: async () => ({ id: 'user_P', email: 'p@x.test', name: 'P', role: 'r', plan: 'Free Plan', subscriptionTier: 'free', isGuest: false }),
}));
vi.mock('../../api/_lib/db.js', () => ({
  getDb: () => async (strings: TemplateStringsArray, ...values: unknown[]) => {
    if (strings.join('$').includes('INSERT INTO "PaymentRecord"')) h.inserts.push(values);
    return [];
  },
  logSecurityEvent: async () => {},
}));
vi.mock('../../api/_lib/rateLimiter.js', () => ({ enforceRateLimit: async () => true, getClientIp: () => '203.0.113.5' }));
vi.mock('razorpay', () => ({
  default: class {
    orders = { create: (...a: unknown[]) => h.ordersCreate(...a) };
  },
}));

import createOrder from '../../api/billing/create-order.ts';
import { BILLING_PLANS, planAmount } from '../../api/_lib/billing.ts';
import { getPlanPrice } from '../../src/lib/pricing.ts';

async function order(body: Record<string, unknown>) {
  const r: any = { statusCode: 200 };
  r.status = (c: number) => ((r.statusCode = c), r);
  r.json = (b: unknown) => ((r.body = b), r);
  r.setHeader = () => {};
  await createOrder({ method: 'POST', body, query: {}, headers: {} } as any, r);
  return r;
}

beforeEach(() => {
  h.inserts = [];
  h.ordersCreate = vi.fn(async () => ({ id: `order_${crypto.randomBytes(6).toString('hex')}` }));
  vi.stubEnv('RAZORPAY_KEY_ID', `rzp_test_${crypto.randomBytes(7).toString('hex')}`);
  vi.stubEnv('RAZORPAY_KEY_SECRET', crypto.randomBytes(18).toString('base64url'));
  vi.stubEnv('VERCEL_ENV', '');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('one price per plan and currency', () => {
  it('the server charges exactly what the Pricing page shows, for every plan and currency', async () => {
    for (const tier of ['pro', 'ultimate'] as const) {
      for (const currency of ['USD', 'INR'] as const) {
        const shown = getPlanPrice(tier, currency).totalSubunits;
        expect(planAmount(tier, currency), `${tier} ${currency}`).toBe(shown);
        h.ordersCreate.mockClear();
        const r = await order({ tier, currency, amount: shown });
        expect(r.statusCode, `${tier} ${currency}`).toBe(200);
        expect(h.ordersCreate.mock.calls[0][0]).toMatchObject({ amount: shown, currency });
      }
    }
    expect(BILLING_PLANS.ultimate.amountPaise).toBe(425_000);
  });

  it('refuses every retired or made-up cheaper amount, and creates no order for it', async () => {
    const cheaper: Array<[string, string, number]> = [
      ['ultimate', 'INR', 117_882], // ₹1,178.82 (retired ₹999 + GST)
      ['ultimate', 'INR', 99_900], // ₹999
      ['ultimate', 'INR', 419_900], // ₹4,199
      ['pro', 'INR', 47_082], // ₹470.82
      ['pro', 'INR', 39_900], // ₹399
      ['pro', 'INR', 169_900], // ₹1,699
      ['ultimate', 'USD', 2000], // the Pro price for Ultimate
      ['pro', 'INR', 2000], // a USD amount sent as INR (₹20)
    ];
    for (const [tier, currency, amount] of cheaper) {
      const r = await order({ tier, currency, amount });
      expect(r.statusCode, `${tier} ${currency} ${amount}`).toBe(409);
      expect(r.body.code).toBe('PRICE_MISMATCH');
    }
    expect(h.ordersCreate).not.toHaveBeenCalled();
    expect(h.inserts).toHaveLength(0);
  });

  it('without an amount the order is still made at the full price (never a cheaper default)', async () => {
    await order({ tier: 'ultimate' });
    expect(h.ordersCreate.mock.calls[0][0]).toMatchObject({ amount: 425_000, currency: 'INR' });
    expect(h.inserts[0]).toContain(425_000);
  });
});
