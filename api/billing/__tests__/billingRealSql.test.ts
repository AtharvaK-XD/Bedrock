import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Billing SQL on a real Postgres engine (PGlite, in memory, every db/migrations/*.up.sql applied): the atomic
// "mark paid + upgrade" statement, replay and cross-account claims. Only auth, the rate limiter and Razorpay are faked.
// Skipped unless the dev package is installed (npm i -D -E @electric-sql/pglite@0.3.15).
const KEY_SECRET = crypto.randomBytes(18).toString('base64url');

const h = vi.hoisted(() => ({ state: { db: null as any, user: null as any, nextOrder: '' } }));

vi.mock('@neondatabase/serverless', () => ({
  neon: () => (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0];
    for (let i = 1; i < strings.length; i++) text += `$${i}${strings[i]}`;
    return h.state.db.query(text, values).then((r: { rows: unknown[] }) => r.rows);
  },
}));
vi.mock('../../_lib/auth.js', () => ({ authenticateRequest: vi.fn(async () => h.state.user) }));
vi.mock('../../_lib/rateLimiter.js', () => ({ enforceRateLimit: vi.fn(async () => true), getClientIp: () => '203.0.113.9' }));
vi.mock('razorpay', () => ({
  default: class {
    orders = { create: vi.fn(async () => ({ id: h.state.nextOrder })) };
  },
}));

import createOrder from '../create-order.js';
import verifyPayment from '../verify-payment.js';

let PGlite: any = null;
try {
  ({ PGlite } = await import(/* @vite-ignore */ '@electric-sql/pglite'));
} catch {
  PGlite = null;
}

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../db/migrations');
const q = async (text: string, params: unknown[] = []) => (await h.state.db.query(text, params)).rows as any[];
const sign = (o: string, p: string) => crypto.createHmac('sha256', KEY_SECRET).update(`${o}|${p}`).digest('hex');
function as(id: string) {
  h.state.user = { id, email: `${id}@x.test`, name: 'T', role: 'r', plan: 'Free Plan', subscriptionTier: 'free', isGuest: false };
}
async function call(handler: any, body: unknown) {
  const r: any = { statusCode: 200, body: undefined };
  r.status = (c: number) => ((r.statusCode = c), r);
  r.json = (b: unknown) => ((r.body = b), r);
  r.setHeader = () => {};
  await handler({ method: 'POST', body, query: {}, headers: {} }, r);
  return r;
}
const verify = (orderId: string, paymentId: string, extra: Record<string, unknown> = {}) =>
  call(verifyPayment, { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sign(orderId, paymentId), ...extra });

describe.skipIf(!PGlite)('billing on a real Postgres engine', () => {
  const originalEnv = process.env;

  beforeAll(async () => {
    process.env = { ...originalEnv, DATABASE_URL: 'postgres://pglite', RAZORPAY_KEY_ID: 'rzp_test_fake', RAZORPAY_KEY_SECRET: KEY_SECRET };
    h.state.db = new PGlite();
    for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.up.sql')).sort()) {
      const statements = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
        .split(/^\s*-- migrate:break\s*$/m)
        .map((s) => s.trim())
        .filter((s) => s && !/^(--[^\n]*\n?)+$/.test(s));
      for (const s of statements) await h.state.db.exec(s.replace(/\bCONCURRENTLY\b/g, ''));
    }
    await q(`INSERT INTO "User"(id,email,password_hash,name,updated_at) VALUES ('u_alice','a@x.test','x','Alice',now()),('u_bob','b@x.test','x','Bob',now())`);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  }, 120_000);

  afterAll(async () => {
    process.env = originalEnv;
    await h.state.db?.close();
  });

  const userRow = async (id: string) => (await q(`SELECT subscription_tier, plan FROM "User" WHERE id = $1`, [id]))[0];

  it('a Pro order cannot be verified as Ultimate; the stored plan is applied atomically', async () => {
    as('u_alice');
    h.state.nextOrder = 'order_AlicePro0001';
    const order = await call(createOrder, { tier: 'pro', amount: 47_082 });
    expect(order.statusCode).toBe(200);
    expect((await q(`SELECT amount, status, tier FROM "PaymentRecord" WHERE order_id = $1`, [order.body.order_id]))[0]).toEqual({
      amount: 47_082,
      status: 'created',
      tier: 'pro',
    });

    const paid = await verify('order_AlicePro0001', 'pay_AlicePay00001', { tier: 'ultimate' });
    expect(paid.statusCode).toBe(200);
    expect(paid.body.tier).toBe('pro');
    expect(await userRow('u_alice')).toEqual({ subscription_tier: 'pro', plan: 'Pro Plan' });
    expect((await q(`SELECT status, payment_id FROM "PaymentRecord" WHERE order_id = 'order_AlicePro0001'`))[0]).toEqual({
      status: 'captured',
      payment_id: 'pay_AlicePay00001',
    });
  });

  it('the same payment sent again is a harmless success; a second payment for the same order is refused', async () => {
    as('u_alice');
    expect((await verify('order_AlicePro0001', 'pay_AlicePay00001')).statusCode).toBe(200);
    const other = await verify('order_AlicePro0001', 'pay_AliceSecond01');
    expect(other.statusCode).toBe(409);
    expect(other.body.code).toBe('ORDER_ALREADY_PAID');
  });

  it("another account cannot claim Alice's order, even with a valid signature", async () => {
    as('u_bob');
    const r = await verify('order_AlicePro0001', 'pay_AlicePay00001');
    expect(r.statusCode).toBe(404);
    expect(await userRow('u_bob')).toEqual({ subscription_tier: 'free', plan: 'Free Plan' });
  });

  it('an order that create-order never stored is refused, so a payment made elsewhere upgrades nothing', async () => {
    as('u_bob');
    const r = await verify('order_NeverCreated1', 'pay_Somewhere0001');
    expect(r.statusCode).toBe(404);
    expect(await userRow('u_bob')).toEqual({ subscription_tier: 'free', plan: 'Free Plan' });
  });

  it('Ultimate at the Ultimate price works end to end', async () => {
    as('u_bob');
    h.state.nextOrder = 'order_BobUltimate01';
    expect((await call(createOrder, { tier: 'ultimate', amount: '117882' })).statusCode).toBe(200);
    expect((await verify('order_BobUltimate01', 'pay_BobPay0000001')).statusCode).toBe(200);
    expect(await userRow('u_bob')).toEqual({ subscription_tier: 'ultimate', plan: 'Ultimate Plan' });
  });

  it('a 1 rupee order left over from the old create-order cannot unlock any plan, even when paid', async () => {
    // Rows the old create-order wrote with the browser's amount (before 2026-11-07)
    await q(`INSERT INTO "PaymentRecord"(id,user_id,order_id,amount,currency,status,tier,updated_at)
             VALUES ('pr_old1','u_bob','order_OldCheapUlt1',100,'INR','created','ultimate',now()),
                    ('pr_old2','u_bob','order_OldUsdPro001',47082,'USD','created','pro',now())`);
    await q(`UPDATE "User" SET subscription_tier = 'free', plan = 'Free Plan' WHERE id = 'u_bob'`);
    as('u_bob');
    for (const [orderId, paymentId] of [['order_OldCheapUlt1', 'pay_OldCheap00001'], ['order_OldUsdPro001', 'pay_OldUsd000001']]) {
      const r = await verify(orderId, paymentId);
      expect(r.statusCode).toBe(409);
      expect(r.body.code).toBe('ORDER_AMOUNT_MISMATCH');
      expect((await q(`SELECT status FROM "PaymentRecord" WHERE order_id = $1`, [orderId]))[0].status).toBe('created');
    }
    expect(await userRow('u_bob')).toEqual({ subscription_tier: 'free', plan: 'Free Plan' });
  });

  it('a Pro payment never lowers an Ultimate account (the order is still recorded as paid)', async () => {
    await q(`UPDATE "User" SET subscription_tier = 'ultimate', plan = 'Ultimate Plan' WHERE id = 'u_bob'`);
    as('u_bob');
    h.state.nextOrder = 'order_BobProLater1';
    expect((await call(createOrder, { tier: 'pro' })).statusCode).toBe(200);
    expect((await verify('order_BobProLater1', 'pay_BobProLater01')).statusCode).toBe(200);
    expect(await userRow('u_bob')).toEqual({ subscription_tier: 'ultimate', plan: 'Ultimate Plan' });
    expect((await q(`SELECT status FROM "PaymentRecord" WHERE order_id = 'order_BobProLater1'`))[0].status).toBe('captured');
  });

  it('a payment id already used on another order is refused (unique payment_id)', async () => {
    as('u_alice');
    h.state.nextOrder = 'order_AliceAgain001';
    expect((await call(createOrder, { tier: 'ultimate' })).statusCode).toBe(200);
    const reused = await verify('order_AliceAgain001', 'pay_BobPay0000001');
    expect(reused.statusCode).toBe(409);
    expect(await userRow('u_alice')).toEqual({ subscription_tier: 'pro', plan: 'Pro Plan' });
  });
});
