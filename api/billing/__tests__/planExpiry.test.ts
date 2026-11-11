import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  completePaidOrder,
  effectivePlan,
  isPlanExpired,
  receiptSplit,
  PLAN_PERIOD_DAYS,
  BILLING_PLANS,
} from '../../_lib/billing.js';
import { renderInvoiceEmail } from '../../_lib/email.js';

// Plan end date (migration 0020, OPEN-0086): each payment adds 30 days; a plan whose end date has passed is read as
// free. The SQL runs on a real Postgres engine (PGlite, in memory, every db/migrations/*.up.sql applied).

const DAY = 86_400_000;

describe('effectivePlan / isPlanExpired (pure)', () => {
  const now = Date.parse('2026-11-11T12:00:00Z');

  it('no end date never expires (plans granted by hand, or paid before 0020)', () => {
    expect(isPlanExpired(null, now)).toBe(false);
    expect(effectivePlan('ultimate', 'Ultimate Plan', null, now)).toEqual({ subscriptionTier: 'ultimate', plan: 'Ultimate Plan', planExpiresAt: null, planExpired: false });
  });

  it('a passed end date reads as the free plan; a future one keeps the paid plan', () => {
    expect(effectivePlan('pro', 'Pro Plan', new Date(now - 1), now)).toMatchObject({ subscriptionTier: 'free', plan: 'Free Plan', planExpired: true });
    expect(effectivePlan('pro', 'Pro Plan', '2026-11-11T12:00:00Z', now)).toMatchObject({ subscriptionTier: 'free', planExpired: true }); // exactly now = ended
    expect(effectivePlan('pro', 'Pro Plan', new Date(now + DAY), now)).toMatchObject({ subscriptionTier: 'pro', plan: 'Pro Plan', planExpired: false });
  });

  it('a free account is never "expired", and junk dates count as no end date', () => {
    expect(effectivePlan('free', 'Free Plan', new Date(now - DAY), now).planExpired).toBe(false);
    expect(effectivePlan(null, null, 'not a date', now)).toEqual({ subscriptionTier: 'free', plan: 'Free Plan', planExpiresAt: null, planExpired: false });
  });
});

describe('receipts use what was actually charged', () => {
  it('INR splits out 18% GST; USD carries no Indian GST', () => {
    expect(receiptSplit(170_000, 'INR')).toEqual({ basePaise: 144_068, gstPaise: 25_932 });
    expect(receiptSplit(2000, 'USD')).toEqual({ basePaise: 2000, gstPaise: 0 });
  });

  it('the invoice email shows the currency, the real total and the end date (no "permanently upgraded")', () => {
    const usd = renderInvoiceEmail({
      email: 'a@x.test', planName: 'Pro Plan', tier: 'pro', amountPaise: 2000, basePaise: 2000, gstPaise: 0,
      orderId: 'order_X', paymentId: 'pay_X', currency: 'USD', planExpiresAt: '2026-12-11T12:00:00.000Z',
    });
    expect(usd.html).toContain('$20.00');
    expect(usd.html).not.toContain('&#8377;');
    expect(usd.html).toContain('active until 11 Dec 2026');
    expect(usd.html).not.toContain('permanently');

    const inr = renderInvoiceEmail({
      email: 'a@x.test', planName: 'Pro Plan', tier: 'pro', amountPaise: 170_000, basePaise: 144_068, gstPaise: 25_932,
      orderId: 'order_Y', paymentId: 'pay_Y',
    });
    expect(inr.html).toContain('&#8377;1700.00');
    expect(inr.html).toContain('Applicable GST (18%)');
  });
});

let PGlite: any = null;
try {
  ({ PGlite } = await import(/* @vite-ignore */ '@electric-sql/pglite'));
} catch {
  PGlite = null;
}

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../db/migrations');

describe.skipIf(!PGlite)('plan end date on a real Postgres engine', () => {
  let db: any;
  const q = async (text: string, params: unknown[] = []) => (await db.query(text, params)).rows as any[];
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0]!;
    for (let i = 1; i < strings.length; i++) text += `$${i}${strings[i]}`;
    return db.query(text, values).then((r: { rows: unknown[] }) => r.rows);
  };
  let n = 0;
  async function order(userId: string, tier: 'pro' | 'ultimate', currency: 'INR' | 'USD' = 'INR') {
    n++;
    const orderId = `order_Exp${String(n).padStart(6, '0')}`;
    const amount = currency === 'USD' ? BILLING_PLANS[tier].amountCents : tier === 'ultimate' ? 425_000 : 170_000;
    await q(`INSERT INTO "PaymentRecord"(id,user_id,order_id,amount,currency,status,tier,updated_at) VALUES ($1,$2,$3,$4,$5,'created',$6,now())`,
      [`pr_exp${n}`, userId, orderId, amount, currency, tier]);
    return completePaidOrder(sql, { orderId, paymentId: `pay_Exp${String(n).padStart(6, '0')}`, signature: null, userId });
  }
  const user = async (id: string) => (await q(`SELECT subscription_tier, plan, plan_expires_at FROM "User" WHERE id = $1`, [id]))[0];
  const daysFromNow = (d: unknown) => (new Date(d as string).getTime() - Date.now()) / DAY;

  beforeAll(async () => {
    db = new PGlite();
    for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.up.sql')).sort()) {
      const statements = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
        .split(/^\s*-- migrate:break\s*$/m)
        .map((s) => s.trim())
        .filter((s) => s && !/^(--[^\n]*\n?)+$/.test(s));
      for (const s of statements) await db.exec(s.replace(/\bCONCURRENTLY\b/g, ''));
    }
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await q(`DELETE FROM "PaymentRecord"`);
    await q(`DELETE FROM "User"`);
    await q(`INSERT INTO "User"(id,email,password_hash,name,updated_at) VALUES ('u_a','a@x.test','x','A',now())`);
  });

  it('migration 0020 adds a nullable timestamptz and leaves existing accounts without an end date', async () => {
    const [col] = await q(`SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'plan_expires_at'`);
    expect(col).toEqual({ data_type: 'timestamp with time zone', is_nullable: 'YES' });
    expect((await user('u_a')).plan_expires_at).toBeNull();
  });

  it('a first payment gives 30 days (INR and USD), and the answer carries the end date, amount and currency', async () => {
    const inr = await order('u_a', 'pro');
    expect(inr).toMatchObject({ kind: 'paid', accountTier: 'pro', amount: 170_000, currency: 'INR' });
    const row = await user('u_a');
    expect(row.subscription_tier).toBe('pro');
    expect(daysFromNow(row.plan_expires_at)).toBeGreaterThan(PLAN_PERIOD_DAYS - 0.01);
    expect(daysFromNow(row.plan_expires_at)).toBeLessThan(PLAN_PERIOD_DAYS + 0.01);
    expect(inr.kind === 'paid' && inr.planExpiresAt).toBe(new Date(row.plan_expires_at).toISOString());

    await q(`INSERT INTO "User"(id,email,password_hash,name,updated_at) VALUES ('u_usd','u@x.test','x','U',now())`);
    const usd = await order('u_usd', 'ultimate', 'USD');
    expect(usd).toMatchObject({ kind: 'paid', accountTier: 'ultimate', amount: 5000, currency: 'USD' });
    expect(daysFromNow((await user('u_usd')).plan_expires_at)).toBeGreaterThan(29.99);
  });

  it('paying again before the end adds 30 days on top (nothing is lost)', async () => {
    await order('u_a', 'pro');
    await order('u_a', 'pro');
    expect(daysFromNow((await user('u_a')).plan_expires_at)).toBeGreaterThan(2 * PLAN_PERIOD_DAYS - 0.01);
  });

  it('paying after the end starts 30 days from now (the lapsed time is not charged)', async () => {
    await q(`UPDATE "User" SET subscription_tier = 'pro', plan = 'Pro Plan', plan_expires_at = now() - interval '10 days' WHERE id = 'u_a'`);
    await order('u_a', 'pro');
    const d = daysFromNow((await user('u_a')).plan_expires_at);
    expect(d).toBeGreaterThan(29.99);
    expect(d).toBeLessThan(30.01);
  });

  it('a Pro payment does not touch a running Ultimate plan, but works once that Ultimate plan has ended', async () => {
    await order('u_a', 'ultimate');
    const ultimateEnd = (await user('u_a')).plan_expires_at;
    const pro = await order('u_a', 'pro');
    expect(pro).toMatchObject({ kind: 'paid', orderTier: 'pro', accountTier: 'ultimate' });
    expect(await user('u_a')).toMatchObject({ subscription_tier: 'ultimate', plan_expires_at: ultimateEnd });

    await q(`UPDATE "User" SET plan_expires_at = now() - interval '1 day' WHERE id = 'u_a'`);
    const after = await order('u_a', 'pro');
    expect(after).toMatchObject({ kind: 'paid', accountTier: 'pro' });
    expect((await user('u_a')).subscription_tier).toBe('pro');
    expect(daysFromNow((await user('u_a')).plan_expires_at)).toBeGreaterThan(29.99);
  });

  it('Pro to Ultimate: the remaining Pro days carry over as Ultimate days', async () => {
    await order('u_a', 'pro');
    await order('u_a', 'ultimate');
    const row = await user('u_a');
    expect(row.subscription_tier).toBe('ultimate');
    expect(daysFromNow(row.plan_expires_at)).toBeGreaterThan(2 * PLAN_PERIOD_DAYS - 0.01);
  });

  it('an account that already has this plan with no end date keeps no end date', async () => {
    await q(`UPDATE "User" SET subscription_tier = 'ultimate', plan = 'Ultimate Plan', plan_expires_at = NULL WHERE id = 'u_a'`);
    const r = await order('u_a', 'ultimate');
    expect(r).toMatchObject({ kind: 'paid', planExpiresAt: null });
    expect((await user('u_a')).plan_expires_at).toBeNull();
  });

  it('the same payment again changes nothing and reports the same end date', async () => {
    const first = await order('u_a', 'pro');
    const end = (await user('u_a')).plan_expires_at;
    const again = await completePaidOrder(sql, { orderId: `order_Exp${String(n).padStart(6, '0')}`, paymentId: `pay_Exp${String(n).padStart(6, '0')}`, signature: null, userId: 'u_a' });
    expect(again).toMatchObject({ kind: 'already_paid', planExpiresAt: first.kind === 'paid' ? first.planExpiresAt : 'x' });
    expect((await user('u_a')).plan_expires_at).toEqual(end);
  });
});

describe('a deploy ahead of migration 0020 still applies the payment', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('falls back to the statement without an end date and raises a BILLING_ALERT line', async () => {
    const texts: string[] = [];
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join('?');
      texts.push(text);
      if (text.includes('plan_expires_at')) throw Object.assign(new Error('column "plan_expires_at" does not exist'), { code: '42703' });
      return [{ user_id: 'u_a', tier: 'pro', amount: 170_000, currency: 'INR', upgraded: 1 }];
    });
    const r = await completePaidOrder(sql as any, { orderId: 'order_Fallback01', paymentId: 'pay_Fallback01', signature: null, userId: 'u_a' });
    expect(r).toEqual({ kind: 'paid', orderTier: 'pro', accountTier: 'pro', userId: 'u_a', planExpiresAt: null, amount: 170_000, currency: 'INR' });
    expect(texts).toHaveLength(2);
    expect(texts[1]).not.toContain('plan_expires_at');
    expect((console.error as any).mock.calls.flat().join(' ')).toContain('[BILLING_ALERT]');
    expect((console.error as any).mock.calls.flat().join(' ')).toContain('PLAN_EXPIRY_COLUMN_MISSING');
  });

  it('other database errors are not swallowed', async () => {
    const sql = vi.fn(async () => {
      throw Object.assign(new Error('connection reset'), { code: '08006' });
    });
    await expect(completePaidOrder(sql as any, { orderId: 'order_Fallback02', paymentId: 'pay_Fallback02', signature: null, userId: 'u_a' })).rejects.toThrow('connection reset');
    expect(sql).toHaveBeenCalledTimes(1);
  });
});
