// In-memory Postgres (PGlite) test of the REAL payment statement (api/_lib/billing.ts completePaidOrder) on the real
// schema (migrations 0001-0021) and as the limited app role (db/roles.sql). The api/billing tests mock the database;
// this one runs the SQL itself: one atomic statement marks the order paid, sets the plan and the 30-day end date
// (0020); a repeat (webhook after the browser, double redirect) changes nothing; erased accounts (0019) cannot pay.
// PGlite has one connection, so "at the same time" is queued here; the row lock that makes it safe on Neon is the
// UPDATE of the order row (status = 'created' is re-checked after the lock), which this file shows as behaviour.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completePaidOrder, PLAN_PERIOD_DAYS, BILLING_PLANS } from '../../api/_lib/billing';
import { loadPglite, migrateUp, readDbFile, rows, runSql } from './helper';

const PGlite = await loadPglite();
const DAY = 86_400_000;

describe.skipIf(!PGlite)('payment statement (completePaidOrder) on the real schema', () => {
  let db: any;
  // The Neon tagged-template call shape, on PGlite
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) =>
    db.query(strings.reduce((q, s, i) => q + s + (i < values.length ? `$${i + 1}` : ''), ''), values).then((r: any) => r.rows);
  const user = (id: string, tier = 'free', expires: string | null = null) =>
    db.query(`INSERT INTO "User"(id,email,password_hash,name,subscription_tier,plan,plan_expires_at,updated_at)
              VALUES ($1,$1||'@x.test','x','n',$2,'Plan',$3::timestamptz,now())`, [id, tier, expires]);
  const order = (id: string, userId: string, tier = 'pro', amount = BILLING_PLANS.pro.amountPaise) =>
    db.query(`INSERT INTO "PaymentRecord"(id,user_id,order_id,amount,currency,status,tier,updated_at)
              VALUES ($1,$2,'order_'||$1,$3,'INR','created',$4,now())`, [id, userId, amount, tier]);
  const pay = (id: string, userId: string | null) =>
    completePaidOrder(sql, { orderId: `order_${id}`, paymentId: `pay_${id}`, signature: 'sig', userId });
  const account = async (id: string) =>
    (await rows(db, `SELECT subscription_tier, plan, plan_expires_at FROM "User" WHERE id = $1`, [id]))[0];
  const days = (d: unknown) => Math.round((new Date(d as string).getTime() - Date.now()) / DAY);

  beforeAll(async () => {
    db = new PGlite();
    await migrateUp(db, new Set<string>());
    await db.query(`CREATE TABLE schema_migrations(name text primary key)`);
    await db.query('CREATE ROLE bedrock_app');
    await runSql(db, readDbFile('roles.sql'));
    await db.query('SET ROLE bedrock_app'); // every statement below runs with the app's limited rights
  });

  afterAll(async () => {
    await db?.close();
  });

  const asOwner = async (fn: () => Promise<unknown>) => {
    await db.query('RESET ROLE');
    try { await fn(); } finally { await db.query('SET ROLE bedrock_app'); }
  };

  it('pays once: plan set, ends in 30 days; the same payment again changes nothing (no double extension)', async () => {
    await asOwner(async () => { await user('u1'); await order('o1', 'u1'); });
    const first = await pay('o1', 'u1');
    expect(first.kind).toBe('paid');
    const a = await account('u1');
    expect([a.subscription_tier, a.plan]).toEqual(['pro', 'Pro Plan']);
    expect(days(a.plan_expires_at)).toBe(PLAN_PERIOD_DAYS);

    const [again, webhook] = await Promise.all([pay('o1', 'u1'), pay('o1', null)]); // browser retry + webhook
    expect(again.kind).toBe('already_paid');
    expect(webhook.kind).toBe('already_paid');
    expect((await account('u1')).plan_expires_at).toEqual(a.plan_expires_at);
    expect(await rows(db, `SELECT status, payment_id FROM "PaymentRecord" WHERE id = 'o1'`)).toEqual([{ status: 'captured', payment_id: 'pay_o1' }]);
  });

  it('paying early adds 30 days to the current end; paying after it ran out starts from now', async () => {
    await asOwner(async () => {
      await user('u2', 'pro', new Date(Date.now() + 10 * DAY).toISOString());
      await order('o2', 'u2');
      await user('u3', 'pro', new Date(Date.now() - 5 * DAY).toISOString());
      await order('o3', 'u3');
    });
    expect((await pay('o2', 'u2')).kind).toBe('paid');
    expect(days((await account('u2')).plan_expires_at)).toBe(10 + PLAN_PERIOD_DAYS);
    expect((await pay('o3', 'u3')).kind).toBe('paid');
    expect(days((await account('u3')).plan_expires_at)).toBe(PLAN_PERIOD_DAYS);
  });

  it('a plan granted before 0020 (no end date) keeps no end date when the same plan is bought', async () => {
    await asOwner(async () => { await user('u4', 'pro', null); await order('o4', 'u4'); });
    expect((await pay('o4', 'u4')).kind).toBe('paid');
    expect((await account('u4')).plan_expires_at).toBeNull();
  });

  it('a Pro order on a running Ultimate plan is recorded but does not downgrade or extend it', async () => {
    const end = new Date(Date.now() + 20 * DAY).toISOString();
    await asOwner(async () => { await user('u5', 'ultimate', end); await order('o5', 'u5', 'pro'); });
    const r = await pay('o5', 'u5');
    expect(r).toMatchObject({ kind: 'paid', orderTier: 'pro', accountTier: 'ultimate' });
    const a = await account('u5');
    expect(a.subscription_tier).toBe('ultimate');
    expect(new Date(a.plan_expires_at).toISOString()).toBe(end);
  });

  it('refuses: another account\'s order, an under-priced order, an order of an erased account', async () => {
    await asOwner(async () => {
      await user('u6'); await user('u7'); await order('o6', 'u6');
      await order('o7', 'u7', 'pro', BILLING_PLANS.pro.amountPaise - 1);
      await user('u8'); await order('o8', 'u8');
    });
    expect((await pay('o6', 'u7')).kind).toBe('not_found');
    expect((await account('u6')).subscription_tier).toBe('free');
    expect((await pay('o7', 'u7')).kind).toBe('amount_mismatch');
    expect((await account('u7')).subscription_tier).toBe('free');
    // the account is erased (0019 removes its unpaid orders), then the payment arrives
    const [del] = await rows(db, `SELECT * FROM delete_user_data('u8')`);
    expect(del.deleted_user).toBe(true);
    expect((await pay('o8', null)).kind).toBe('not_found');
  });

  it('a paid order survives account deletion without the link to the person, and can never be paid again', async () => {
    await asOwner(async () => { await user('u9'); await order('o9', 'u9'); });
    expect((await pay('o9', 'u9')).kind).toBe('paid');
    await rows(db, `SELECT * FROM delete_user_data('u9')`);
    expect(await rows(db, `SELECT user_id, status FROM "PaymentRecord" WHERE id = 'o9'`)).toEqual([{ user_id: null, status: 'captured' }]);
    expect((await pay('o9', null)).kind).not.toBe('paid');
  });
});
