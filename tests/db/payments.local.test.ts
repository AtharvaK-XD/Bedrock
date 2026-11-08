// In-memory Postgres (PGlite) tests for migration 0019 (OPEN-0090): deleting an account no longer fails for people
// who ever opened checkout; paid records are kept without the link to the person; unpaid orders are deleted.
import { describe, expect, it } from 'vitest';
import { errorOf, loadPglite, migrateUp, newPrompt, readMigration, rows, runSql } from './helper';

const PGlite = await loadPglite();

const pay = (db: any, id: string, userId: string, status: 'created' | 'captured') =>
  db.query(
    `INSERT INTO "PaymentRecord"(id,user_id,order_id,payment_id,signature,amount,currency,status,tier,updated_at)
     VALUES ($1,$2,$3,$4,$5,47082,'INR',$6,'pro',now())`,
    [id, userId, `order_${id}`, status === 'captured' ? `pay_${id}` : null, status === 'captured' ? 'sig' : null, status],
  );
const user = (db: any, id: string) =>
  db.query(`INSERT INTO "User"(id,email,password_hash,name,updated_at) VALUES ($1,$2,'x','n',now())`, [id, `${id}@x.test`]);
const nullable = async (db: any) =>
  (await rows(db, `SELECT is_nullable n FROM information_schema.columns WHERE table_name='PaymentRecord' AND column_name='user_id'`))[0].n;

describe.skipIf(!PGlite)('0019 payment records survive account erasure (OPEN-0090)', () => {
  it('before 0019: an account with orders cannot be erased and the column is NOT NULL; after: both are fixed', async () => {
    const old = new PGlite();
    await migrateUp(old, new Set<string>(), '0018');
    await user(old, 'u1');
    await pay(old, 'a1', 'u1', 'created');
    expect(await errorOf(old, `SELECT * FROM delete_user_data('u1')`)).toMatch(/OTHER_RECORDS/);
    expect(await errorOf(old, `UPDATE "PaymentRecord" SET user_id = NULL`)).toMatch(/null value|not-null/i);
    await old.close();

    const db = new PGlite();
    await migrateUp(db, new Set<string>());
    expect(await nullable(db)).toBe('YES');
    const [fk] = await rows(db, `SELECT confdeltype d, convalidated v FROM pg_constraint WHERE conrelid = '"PaymentRecord"'::regclass AND contype = 'f'`);
    expect(fk).toEqual({ d: 'n', v: true });
    expect(await rows(db, `SELECT 1 FROM pg_indexes WHERE indexname = 'PaymentRecord_user_id_status_idx'`)).toHaveLength(1);
    await db.close();
  }, 120_000);

  it('erases the account and its unpaid orders, KEEPS paid orders with the link to the person removed', async () => {
    const db = new PGlite();
    await migrateUp(db, new Set<string>());
    await user(db, 'buyer');
    await user(db, 'other');
    await newPrompt(db, 'bp1', 'buyer');
    await pay(db, 'paid1', 'buyer', 'captured');
    await pay(db, 'open1', 'buyer', 'created');
    await pay(db, 'open2', 'buyer', 'created');
    await pay(db, 'otherpaid', 'other', 'captured');
    await pay(db, 'otheropen', 'other', 'created');
    const before = (await rows(db, `SELECT * FROM "PaymentRecord" WHERE id = 'paid1'`))[0];

    const [r] = await rows(db, `SELECT * FROM delete_user_data('buyer')`);
    expect(r).toMatchObject({ deleted_user: true, prompts: 1 });
    expect(await rows(db, `SELECT count(*)::int c FROM "User" WHERE id = 'buyer'`)).toEqual([{ c: 0 }]);
    expect(await rows(db, `SELECT id FROM "PaymentRecord" WHERE id IN ('open1','open2')`)).toHaveLength(0);
    const kept = (await rows(db, `SELECT * FROM "PaymentRecord" WHERE id = 'paid1'`))[0];
    expect(kept.user_id).toBeNull();
    for (const k of ['order_id', 'payment_id', 'signature', 'amount', 'currency', 'status', 'tier', 'created_at']) expect(kept[k], k).toEqual(before[k]);
    // nobody else is touched
    expect(await rows(db, `SELECT id, user_id FROM "PaymentRecord" WHERE id IN ('otherpaid','otheropen') ORDER BY id`)).toEqual([
      { id: 'otheropen', user_id: 'other' },
      { id: 'otherpaid', user_id: 'other' },
    ]);
    // running it again is safe and keeps the unlinked record
    expect((await rows(db, `SELECT deleted_user FROM delete_user_data('buyer')`))[0].deleted_user).toBe(false);
    expect(await rows(db, `SELECT count(*)::int c FROM "PaymentRecord" WHERE id = 'paid1'`)).toEqual([{ c: 1 }]);
    await db.close();
  }, 120_000);

  it('an account with only unpaid orders is erased and leaves no order behind', async () => {
    const db = new PGlite();
    await migrateUp(db, new Set<string>());
    await user(db, 'lurker');
    await pay(db, 'l1', 'lurker', 'created');
    expect((await rows(db, `SELECT deleted_user FROM delete_user_data('lurker')`))[0].deleted_user).toBe(true);
    expect(await rows(db, `SELECT count(*)::int c FROM "PaymentRecord"`)).toEqual([{ c: 0 }]);
    await db.close();
  }, 120_000);

  it('even a plain DELETE of the account (not through the function) cannot destroy paid records (ON DELETE SET NULL)', async () => {
    const db = new PGlite();
    await migrateUp(db, new Set<string>());
    await user(db, 'direct');
    await pay(db, 'dp1', 'direct', 'captured');
    await db.query(`DELETE FROM "User" WHERE id = 'direct'`);
    expect(await rows(db, `SELECT user_id FROM "PaymentRecord" WHERE id = 'dp1'`)).toEqual([{ user_id: null }]);
    await db.close();
  }, 120_000);

  it('still refuses (and changes nothing, including the orders) when ANOTHER table holds records for the account', async () => {
    const db = new PGlite();
    await migrateUp(db, new Set<string>());
    await user(db, 'guarded');
    await newPrompt(db, 'gp1', 'guarded');
    await pay(db, 'gpay', 'guarded', 'captured');
    await pay(db, 'gopen', 'guarded', 'created');
    await db.query(`CREATE TABLE future_feature_notes (id text PRIMARY KEY, user_id text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE)`);
    await db.query(`INSERT INTO future_feature_notes VALUES ('n1','guarded')`);
    expect(await errorOf(db, `SELECT * FROM delete_user_data('guarded')`)).toMatch(/OTHER_RECORDS: 1 record\(s\) in future_feature_notes/);
    expect(await rows(db, `SELECT id, user_id FROM "PaymentRecord" ORDER BY id`)).toEqual([
      { id: 'gopen', user_id: 'guarded' },
      { id: 'gpay', user_id: 'guarded' },
    ]);
    expect(await rows(db, `SELECT count(*)::int c FROM "Prompt" WHERE user_id = 'guarded'`)).toEqual([{ c: 1 }]);
    await db.close();
  }, 120_000);

  it('the order-verification statement of api/billing/verify-payment.ts behaves the same next to unlinked history', async () => {
    const db = new PGlite();
    await migrateUp(db, new Set<string>());
    await user(db, 'gone');
    await pay(db, 'old1', 'gone', 'captured');
    await db.query(`SELECT * FROM delete_user_data('gone')`);
    await user(db, 'newbie');
    await pay(db, 'n1', 'newbie', 'created');
    const run = (order: string, pid: string, uid: string | null) =>
      rows(
        db,
        `WITH paid AS (
           UPDATE "PaymentRecord" SET payment_id = $2, signature = 's', status = 'captured', updated_at = NOW()
           WHERE order_id = $1 AND user_id = $3 AND status = 'created' AND currency = 'INR' AND amount >= 47082
           RETURNING user_id, 'pro' AS tier)
         UPDATE "User" AS u SET subscription_tier = paid.tier, plan = 'Pro Plan', updated_at = NOW()
         FROM paid WHERE u.id = paid.user_id RETURNING paid.tier AS tier`,
        [order, pid, uid],
      );
    expect(await run('order_n1', 'pay_n1', 'newbie')).toEqual([{ tier: 'pro' }]);
    expect(await run('order_n1', 'pay_n1', 'newbie')).toEqual([]); // the same payment again: nothing changes twice
    expect(await run('order_old1', 'pay_x', 'newbie')).toEqual([]); // an unlinked record can never be claimed by another account
    expect(await run('order_old1', 'pay_x', null)).toEqual([]); // ...nor by a missing user id
    await db.close();
  }, 120_000);

  it('0019 up can run again (interrupted run); down refuses while unlinked payment rows exist and works when there are none', async () => {
    const db = new PGlite();
    await migrateUp(db, new Set<string>());
    await user(db, 'x1');
    await pay(db, 'xp1', 'x1', 'captured');
    await runSql(db, readMigration('0019_payment_records_survive_erasure.up.sql'));
    await runSql(db, readMigration('0019_payment_records_survive_erasure.up.sql'));
    await db.query(`SELECT * FROM delete_user_data('x1')`);
    await expect(runSql(db, readMigration('0019_payment_records_survive_erasure.down.sql'))).rejects.toThrow(/PAYMENT_RECORDS_UNLINKED: 1 payment row/);
    expect(await nullable(db)).toBe('YES'); // nothing was changed by the refused down
    await db.query(`DELETE FROM "PaymentRecord" WHERE id = 'xp1'`); // the test deletes it; the product never does
    await runSql(db, readMigration('0019_payment_records_survive_erasure.down.sql'));
    expect(await nullable(db)).toBe('NO');
    expect((await rows(db, `SELECT confdeltype d FROM pg_constraint WHERE conrelid = '"PaymentRecord"'::regclass AND contype = 'f'`))[0].d).toBe('c');
    await user(db, 'x2');
    await pay(db, 'xp2', 'x2', 'created');
    expect(await errorOf(db, `SELECT * FROM delete_user_data('x2')`)).toMatch(/OTHER_RECORDS/); // the 0014 behaviour is back
    await db.close();
  }, 120_000);
});
