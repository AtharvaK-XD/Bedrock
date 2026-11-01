// In-memory Postgres (PGlite) tests for 0014 (erase an account), 0015 (daily usage-record cap) and
// 0016 (validate the older size rules).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorOf, loadPglite, migrateUp, newPrompt, readMigration, rows, runSql, seedUsers, splitStatements } from './helper';

const PGlite = await loadPglite();

describe.skipIf(!PGlite)('0014 delete_user_data', () => {
  let db: any;
  beforeAll(async () => {
    db = new PGlite();
    await migrateUp(db, new Set<string>(), '0016');
    await seedUsers(db);
  }, 120_000);
  afterAll(async () => {
    await db?.close();
  });

  const fill = async (u: string) => {
    await db.query(`INSERT INTO "User"(id,email,password_hash,name,updated_at) VALUES ($1,$2,'x','n',now()) ON CONFLICT DO NOTHING`, [u, `${u}@x.test`]);
    await newPrompt(db, `${u}_p1`, u);
    await newPrompt(db, `${u}_p2`, u);
    await db.query(`INSERT INTO "BranchingTree"(id,user_id,title,nodes,edges,created_at,updated_at) VALUES ($1,$2,'t','[]','[]',now(),now())`, [`${u}_w1`, u]);
    await db.query(`INSERT INTO "Trace"(id,user_id,node_origin,model_target,tokens_used,latency_ms,status) VALUES ($1,$2,'n','m',1,1,'OK'),($3,$2,'n','m',1,1,'OK'),($4,$2,'n','m',1,1,'OK')`, [`${u}_t1`, u, `${u}_t2`, `${u}_t3`]);
    await db.query(`SELECT reserve_quota($1,$2::text,'1.1.1.1','generation','/x',10::int)`, [`${u}_q1`, u]);
    await db.query(`INSERT INTO "IdempotencyKey"(id,key,user_id,endpoint,status,expires_at) VALUES ($1,$1,$2,'/x','done',now())`, [`${u}_k1`, u]);
    await db.query(`INSERT INTO "SecurityLog"(id,user_id,event_type,message) VALUES ($1,$2,'X','m'),($3,$2,'X','m')`, [`${u}_s1`, u, `${u}_s2`]);
  };

  it('erases the account and everything that belongs to it, in one go, and returns the counts', async () => {
    await fill('del1');
    await fill('keep1');
    const [r] = await rows(db, `SELECT * FROM delete_user_data('del1')`);
    expect(r).toEqual({ deleted_user: true, prompts: 2, workflows: 1, traces: 3, quota_events: 1, idempotency_keys: 1, logs_unlinked: 2 });
    for (const t of ['User', 'Prompt', 'BranchingTree', 'Trace']) {
      const col = t === 'User' ? 'id' : 'user_id';
      expect((await rows(db, `SELECT count(*)::int c FROM "${t}" WHERE ${col} = 'del1'`))[0].c, t).toBe(0);
    }
    expect((await rows(db, `SELECT count(*)::int c FROM "QuotaEvent" WHERE user_id = 'del1'`))[0].c).toBe(0);
    expect((await rows(db, `SELECT count(*)::int c FROM "IdempotencyKey" WHERE user_id = 'del1'`))[0].c).toBe(0);
  });

  it('keeps the security log rows, without the account id', async () => {
    const left = await rows(db, `SELECT id, user_id FROM "SecurityLog" WHERE id LIKE 'del1_s%' ORDER BY id`);
    expect(left).toEqual([{ id: 'del1_s1', user_id: null }, { id: 'del1_s2', user_id: null }]);
  });

  it('does not touch anyone else', async () => {
    expect((await rows(db, `SELECT count(*)::int c FROM "Prompt" WHERE user_id = 'keep1'`))[0].c).toBe(2);
    expect((await rows(db, `SELECT count(*)::int c FROM "Trace" WHERE user_id = 'keep1'`))[0].c).toBe(3);
    expect((await rows(db, `SELECT count(*)::int c FROM "User" WHERE id = 'keep1'`))[0].c).toBe(1);
  });

  it('an unknown id deletes no account but cleans leftover usage rows; running it twice is fine', async () => {
    await db.query(`SELECT reserve_quota('ghost_q','ghost'::text,'1.1.1.1','generation','/x',10::int)`);
    const [r] = await rows(db, `SELECT * FROM delete_user_data('ghost')`);
    expect(r).toMatchObject({ deleted_user: false, prompts: 0, quota_events: 1 });
    expect((await rows(db, `SELECT * FROM delete_user_data('del1')`))[0]).toMatchObject({ deleted_user: false, prompts: 0 });
  });

  it('refuses an empty id', async () => {
    expect(await errorOf(db, `SELECT * FROM delete_user_data('')`)).toMatch(/USER_ID_REQUIRED/);
    expect(await errorOf(db, `SELECT * FROM delete_user_data(NULL)`)).toMatch(/USER_ID_REQUIRED/);
  });

  it('stops and deletes NOTHING when another table (outside the plan) still holds records for the account', async () => {
    await fill('other1');
    // "PaymentRecord" is created by the baseline (0001) and has a foreign key to "User"; the function must not cascade into it
    await db.query(`INSERT INTO "PaymentRecord"(id,user_id,order_id,amount,currency,status,tier,updated_at) VALUES ('pr1','other1','ord1',1,'INR','created','pro',now())`);
    expect(await errorOf(db, `SELECT * FROM delete_user_data('other1')`)).toMatch(/OTHER_RECORDS: 1 record\(s\) in "PaymentRecord"/);
    expect((await rows(db, `SELECT count(*)::int c FROM "User" WHERE id = 'other1'`))[0].c).toBe(1);
    expect((await rows(db, `SELECT count(*)::int c FROM "Prompt" WHERE user_id = 'other1'`))[0].c).toBe(2);
    expect((await rows(db, `SELECT count(*)::int c FROM "QuotaEvent" WHERE user_id = 'other1'`))[0].c).toBe(1);
    expect((await rows(db, `SELECT count(*)::int c FROM "PaymentRecord" WHERE id = 'pr1'`))[0].c).toBe(1);
    await db.query(`DELETE FROM "PaymentRecord" WHERE id = 'pr1'`);
    expect((await rows(db, `SELECT deleted_user FROM delete_user_data('other1')`))[0].deleted_user).toBe(true);
  });

  it('works even when an old log row breaks a NOT VALID size rule (such a row cannot be updated, so it is removed)', async () => {
    await fill('old1');
    await db.query(`ALTER TABLE "SecurityLog" DROP CONSTRAINT "SecurityLog_size_chk"`);
    await db.query(`INSERT INTO "SecurityLog"(id,user_id,event_type,message) VALUES ('old1_big','old1','X',repeat('m',3000))`);
    // 0005 body: re-adds the rule NOT VALID
    await db.query(splitStatements(readMigration('0005_securitylog_limits.up.sql'))[0]);
    expect((await rows(db, `SELECT convalidated v FROM pg_constraint WHERE conname = 'SecurityLog_size_chk'`))[0].v).toBe(false);
    expect((await rows(db, `SELECT deleted_user FROM delete_user_data('old1')`))[0].deleted_user).toBe(true);
    expect((await rows(db, `SELECT count(*)::int c FROM "SecurityLog" WHERE id = 'old1_big'`))[0].c).toBe(0);
    expect((await rows(db, `SELECT user_id FROM "SecurityLog" WHERE id = 'old1_s1'`))[0].user_id).toBeNull();
  });

  it('PUBLIC cannot run it', async () => {
    expect((await rows(db, `SELECT has_function_privilege('public','delete_user_data(text)','EXECUTE') p`))[0].p).toBe(false);
  });
});

describe.skipIf(!PGlite)('0015 daily usage-record cap', () => {
  let db: any;
  beforeAll(async () => {
    db = new PGlite();
    await migrateUp(db, new Set<string>(), '0015');
    await seedUsers(db);
  }, 120_000);
  afterAll(async () => {
    await db?.close();
  });
  const addTrace = (id: string, user: string, age = '0 seconds') =>
    errorOf(db, `INSERT INTO "Trace"(id,user_id,node_origin,model_target,tokens_used,latency_ms,status,created_at)
      VALUES ($1,$2,'n','m',1,1,'OK',(now() AT TIME ZONE 'UTC') - $3::interval)`, [id, user, age]);

  it('ships with a cap of 5,000', async () => {
    const [t] = await rows(db, `SELECT encode(tgargs,'escape') a FROM pg_trigger WHERE tgname = 'Trace_daily_cap'`);
    expect(String(t.a).startsWith('5000')).toBe(true); // stored with a trailing NUL, shown as the text \000
    expect(String(t.a).length).toBeLessThanOrEqual(9);
  });

  it('refuses the record after the cap, only for that user, and old records do not count', async () => {
    // same trigger with a cap of 3 so the test is quick
    await db.query(`DROP TRIGGER "Trace_daily_cap" ON "Trace"`);
    await db.query(`CREATE TRIGGER "Trace_daily_cap" BEFORE INSERT ON "Trace" FOR EACH ROW EXECUTE FUNCTION bedrock_enforce_trace_daily_cap(3)`);
    await addTrace('old_a', 'ua', '2 days'); // does not count
    await addTrace('old_b', 'ua', '25 hours');
    for (const i of [1, 2, 3]) expect(await addTrace(`n${i}`, 'ua')).toBeNull();
    expect(await addTrace('n4', 'ua')).toMatch(/DAILY_TRACE_LIMIT: at most 3/);
    expect(await addTrace('other1', 'ub')).toBeNull();
  });

  it('the error is a check violation (23514), which the API maps to a 4xx', async () => {
    try {
      await db.query(`INSERT INTO "Trace"(id,user_id,node_origin,model_target,tokens_used,latency_ms,status) VALUES ('n5','ua','n','m',1,1,'OK')`);
      throw new Error('should have been refused');
    } catch (e: any) {
      expect(e.code).toBe('23514');
    }
  });

  it('the server-written insert (security.ts recordExecutionTrace shape) works under the cap', async () => {
    expect(await errorOf(db, `INSERT INTO "Trace" (id, user_id, node_origin, model_target, tokens_used, latency_ms, status, created_at)
      VALUES ('TRC-1-AAAAA', 'ub', 'synthesize', 'm', 10, 100, 'success', NOW())`)).toBeNull();
  });
});

describe.skipIf(!PGlite)('0016 validate the older size rules', () => {
  const names = ['Prompt_size_chk', 'BranchingTree_size_chk', 'Trace_sanity_chk', 'SecurityLog_size_chk'];
  const validated = async (db: any) =>
    Object.fromEntries((await rows(db, `SELECT conname, convalidated v FROM pg_constraint WHERE conname = ANY($1)`, [names])).map((r: any) => [r.conname, r.v]));

  it('before: all four are NOT VALID; after: all four are validated; running it again is fine', async () => {
    const db = new PGlite();
    await migrateUp(db, new Set<string>(), '0015');
    expect(Object.values(await validated(db))).toEqual([false, false, false, false]);
    await runSql(db, readMigration('0016_validate_size_checks.up.sql'));
    expect(await validated(db)).toEqual({ Prompt_size_chk: true, BranchingTree_size_chk: true, Trace_sanity_chk: true, SecurityLog_size_chk: true });
    await runSql(db, readMigration('0016_validate_size_checks.up.sql'));
    await db.close();
  }, 120_000);

  it('refuses with a clear message when an old row breaks a rule, and works after that row is fixed', async () => {
    const db = new PGlite();
    await migrateUp(db, new Set<string>(), '0015');
    await db.query(`ALTER TABLE "SecurityLog" DROP CONSTRAINT "SecurityLog_size_chk"`);
    await db.query(`INSERT INTO "SecurityLog"(id,event_type,message) VALUES ('big','X',repeat('m',3000))`);
    await db.query(splitStatements(readMigration('0005_securitylog_limits.up.sql'))[0]); // re-add NOT VALID
    const err = await errorOf(db, splitStatements(readMigration('0016_validate_size_checks.up.sql'))[3]);
    expect(err).toMatch(/OLD_ROWS_BREAK_RULE: some "SecurityLog" rows/);
    expect((await validated(db)).SecurityLog_size_chk).toBe(false);
    await db.query(`DELETE FROM "SecurityLog" WHERE id = 'big'`);
    await runSql(db, readMigration('0016_validate_size_checks.up.sql'));
    expect((await validated(db)).SecurityLog_size_chk).toBe(true);
    await db.close();
  }, 120_000);
});
