// In-memory Postgres (PGlite) tests for db/roles.sql: the limited database key (bedrock_app).
// Proves the script refuses unsafe roles, that every query the API runs works as bedrock_app, and that the
// dangerous actions (a leaked app key could try) are refused.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorOf, loadPglite, migrateUp, newPrompt, readDbFile, rows, runSql, seedUsers, splitStatements } from './helper';

const PGlite = await loadPglite();

describe.skipIf(!PGlite)('db/roles.sql on in-memory Postgres', () => {
  let db: any;
  const rolesSql = readDbFile('roles.sql');

  beforeAll(async () => {
    db = new PGlite();
    await migrateUp(db, new Set<string>());
    await db.query(`CREATE TABLE schema_migrations(name text primary key)`);
    await seedUsers(db);
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  const asApp = async (fn: () => Promise<void>) => {
    await db.query('SET ROLE bedrock_app');
    try {
      await fn();
    } finally {
      await db.query('RESET ROLE');
    }
  };

  it('refuses when the role is missing, too powerful, or inherits another role', async () => {
    const first = splitStatements(rolesSql)[0];
    expect(await errorOf(db, first)).toMatch(/ROLE_MISSING/);
    await db.query('CREATE ROLE bedrock_app CREATEDB');
    expect(await errorOf(db, first)).toMatch(/ROLE_TOO_POWERFUL/);
    await db.query('ALTER ROLE bedrock_app NOCREATEDB');
    await db.query('CREATE ROLE fake_super');
    await db.query('GRANT fake_super TO bedrock_app');
    expect(await errorOf(db, first)).toMatch(/ROLE_HAS_MEMBERSHIPS/);
    await db.query('REVOKE fake_super FROM bedrock_app');
  });

  it('gives exactly the planned rights: all 17 final checks are OK, also on a second run', async () => {
    for (let i = 0; i < 2; i++) {
      const checks = await runSql(db, rolesSql);
      expect(checks).toHaveLength(17);
      expect(checks.filter((c) => !c.ok).map((c) => c.item)).toEqual([]);
    }
    const [r] = await rows(db, `SELECT array_to_string(rolconfig,' ') c FROM pg_roles WHERE rolname = 'bedrock_app'`);
    expect(r.c).toMatch(/statement_timeout=20s/);
    expect(r.c).toMatch(/lock_timeout=5s/);
    expect(r.c).toMatch(/idle_in_transaction_session_timeout=30s/);
  });

  it('replaces older, wider rights: a stray column right is removed on the next run', async () => {
    await db.query('GRANT UPDATE (email) ON "User" TO bedrock_app');
    expect((await rows(db, `SELECT has_column_privilege('bedrock_app','"User"','email','UPDATE') p`))[0].p).toBe(true);
    await runSql(db, rolesSql);
    expect((await rows(db, `SELECT has_column_privilege('bedrock_app','"User"','email','UPDATE') p`))[0].p).toBe(false);
  });

  it('every query the API runs works as bedrock_app', async () => {
    await newPrompt(db, 'app_seed', 'ua');
    await asApp(async () => {
      const ok = async (sql: string, params: unknown[] = []) => expect(await errorOf(db, sql, params)).toBeNull();
      // sign-in (api/_lib/auth.ts): column list, case-insensitive email, first-login insert, repeat upsert, placeholder insert
      await ok(`SELECT id, email, name, role, subscription_tier, plan FROM "User" WHERE id='ua' OR ('a@x.test'::text IS NOT NULL AND lower(email) = lower('A@X.TEST')) ORDER BY (id='ua') DESC LIMIT 1`);
      const insertUser = `INSERT INTO "User"(id,email,password_hash,name,username,plan,role,email_verified,mfa_enabled,subscription_tier,created_at,updated_at)
        VALUES ($1,$2,'clerk_oauth_external','c',NULL,'Free Plan','Lead Prompt Architect',true,false,'free',now(),now()) ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`;
      await ok(insertUser, ['uc', 'c@x.test']);
      await ok(insertUser, ['uc', 'c@x.test']);
      await ok(insertUser, ['ud', 'ud@clerk.user']);
      // profile and plan
      await ok(`SELECT id, name, username, email, avatar_url, avatar_initials, plan, role, bio, location, organization, github, huggingface, website, joined_date, created_at, subscription_tier FROM "User" WHERE id='uc' LIMIT 1`);
      await ok(`UPDATE "User" SET name='c2', username=NULL, bio='hi', location=NULL, organization=NULL, github=NULL, huggingface=NULL, website=NULL, updated_at=now() WHERE id='uc'`);
      await ok(`UPDATE "User" SET subscription_tier='pro', plan='Pro', updated_at=NOW() WHERE id='uc'`);
      // prompts and workflows
      await ok(`UPDATE "Prompt" SET title='z' WHERE id='app_seed' AND user_id='ua'`);
      await ok(`INSERT INTO "Prompt"(id,user_id,title,snippet,full_content,tags,target_type,created_at,updated_at) SELECT 'app_p','uc','t','s','c','[]','G',now(),now() WHERE (SELECT count(*) FROM "Prompt" WHERE user_id='uc') < 2000 ON CONFLICT (id) DO NOTHING RETURNING id`);
      await ok(`SELECT * FROM "Prompt" WHERE user_id='uc' ORDER BY updated_at DESC`);
      await ok(`DELETE FROM "Prompt" WHERE id='app_p' AND user_id='uc'`);
      await ok(`INSERT INTO "BranchingTree"(id,user_id,title,nodes,edges,created_at,updated_at) SELECT 'app_w','uc','t','[]','[]',now(),now() WHERE (SELECT count(*) FROM "BranchingTree" WHERE user_id='uc') < 200 ON CONFLICT (id) DO NOTHING`);
      await ok(`UPDATE "BranchingTree" SET title='e', updated_at=NOW() WHERE id='app_w' AND user_id='uc'`);
      await ok(`DELETE FROM "BranchingTree" WHERE id='app_w' AND user_id='uc'`);
      // traces, logs, quota, cleanup
      await ok(`INSERT INTO "Trace"(id,user_id,node_origin,model_target,tokens_used,latency_ms,status,created_at) VALUES ('app_t','uc','n','m',1,1,'OK',now())`);
      await ok(`SELECT * FROM "Trace" WHERE user_id='uc' ORDER BY created_at DESC LIMIT 100`);
      await ok(`SELECT * FROM trace_totals('uc')`);
      await ok(`DELETE FROM "Trace" WHERE user_id='uc'`);
      await ok(`INSERT INTO "SecurityLog"(id,user_id,event_type,severity,ip_address,endpoint,message,created_at) VALUES ('app_s','uc','AI_QUOTA_GENERATION','INFO','1.1.1.1','/x','m',now())`);
      await ok(`SELECT count(*) FROM "SecurityLog" WHERE user_id='uc' AND event_type='AI_QUOTA_GENERATION'`);
      await ok(`DELETE FROM "SecurityLog" WHERE id='app_s'`);
      await ok(`SELECT reserve_quota('app_q','uc'::text,'1.1.1.1','generation','/x',10::int)`);
      await ok(`DELETE FROM "QuotaEvent" WHERE id='app_q'`);
      await ok(`SELECT * FROM purge_old_logs()`);
      // erase an account: the only way the app can (no DELETE right on "User")
      await ok(`SELECT * FROM delete_user_data('uc')`);
      expect((await rows(db, `SELECT count(*)::int c FROM "User" WHERE id='uc'`))[0].c).toBe(0);
    });
  });

  it('the onboarding answers (0018) can be read and changed as bedrock_app, and nothing wider was opened', async () => {
    await runSql(db, rolesSql);
    await asApp(async () => {
      expect(await errorOf(db, `SELECT birth_date, referral_source FROM "User" WHERE id='ua' LIMIT 1`)).toBeNull();
      expect(
        await errorOf(db, `UPDATE "User" SET birth_date = '2000-01-31'::text, referral_source = 'youtube'::text, updated_at = NOW() WHERE id='ua'`),
      ).toBeNull();
      // the profile route's CASE form (keeps a value when the answer is absent)
      expect(
        await errorOf(
          db,
          `UPDATE "User" SET birth_date = CASE WHEN $1::boolean THEN $2::text ELSE birth_date END, referral_source = CASE WHEN $3::boolean THEN $4::text ELSE referral_source END, updated_at = NOW() WHERE id = $5`,
          [false, null, true, 'friend', 'ua'],
        ),
      ).toBeNull();
      // still refused: the sign-in columns and password_hash stay out of reach
      expect(await errorOf(db, `UPDATE "User" SET email = 'evil@x.test' WHERE id='ua'`)).toMatch(/permission denied/);
      expect(await errorOf(db, `SELECT password_hash FROM "User" LIMIT 1`)).toMatch(/permission denied/);
    });
    expect(await rows(db, `SELECT birth_date, referral_source FROM "User" WHERE id='ua'`)).toEqual([
      { birth_date: '2000-01-31', referral_source: 'friend' },
    ]);
  });

  it('billing can store and complete orders as bedrock_app, but never delete a payment record', async () => {
    await runSql(db, rolesSql);
    await asApp(async () => {
      expect(
        await errorOf(db, `INSERT INTO "PaymentRecord"(id,user_id,order_id,amount,currency,status,tier,created_at,updated_at) VALUES ('payrec_t','ua','order_RoleTest001',47082,'INR','created','pro',NOW(),NOW())`),
      ).toBeNull();
      expect(
        await errorOf(db, `WITH paid AS (UPDATE "PaymentRecord" SET payment_id='pay_RoleTest0001', signature='s', status='captured', updated_at=NOW() WHERE order_id='order_RoleTest001' AND user_id='ua' AND status='created' RETURNING user_id, tier) UPDATE "User" AS u SET subscription_tier = paid.tier, plan = 'Pro Plan', updated_at = NOW() FROM paid WHERE u.id = paid.user_id RETURNING paid.tier`),
      ).toBeNull();
      expect(await errorOf(db, `SELECT tier, status, payment_id FROM "PaymentRecord" WHERE order_id='order_RoleTest001' AND user_id='ua'`)).toBeNull();
      expect(await errorOf(db, `DELETE FROM "PaymentRecord" WHERE id='payrec_t'`)).toMatch(/permission denied/);
    });
    await db.query(`DELETE FROM "PaymentRecord" WHERE id='payrec_t'`);
    await db.query(`UPDATE "User" SET subscription_tier='free', plan='Free Plan' WHERE id='ua'`);
  });

  it('the app can erase an account that has paid and unpaid orders (0019): paid rows stay, unlinked; the app still cannot delete payment rows itself', async () => {
    await runSql(db, rolesSql);
    await db.query(`INSERT INTO "User"(id,email,password_hash,name,updated_at) VALUES ('payer','payer@x.test','x','p',now())`);
    await db.query(`INSERT INTO "PaymentRecord"(id,user_id,order_id,payment_id,signature,amount,currency,status,tier,updated_at) VALUES
      ('pr_paid','payer','order_PayerPaid01','pay_PayerPaid0001','sig',47082,'INR','captured','pro',now()),
      ('pr_open','payer','order_PayerOpen01',NULL,NULL,47082,'INR','created','pro',now())`);
    await asApp(async () => {
      expect(await errorOf(db, `DELETE FROM "PaymentRecord" WHERE id='pr_open'`)).toMatch(/permission denied/);
      const [r] = (await db.query(`SELECT * FROM delete_user_data('payer')`)).rows;
      expect(r).toMatchObject({ deleted_user: true });
    });
    expect(await rows(db, `SELECT id, user_id, order_id, payment_id, amount, status FROM "PaymentRecord" WHERE id IN ('pr_paid','pr_open') ORDER BY id`)).toEqual([
      { id: 'pr_paid', user_id: null, order_id: 'order_PayerPaid01', payment_id: 'pay_PayerPaid0001', amount: 47082, status: 'captured' },
    ]);
    await db.query(`DELETE FROM "PaymentRecord" WHERE id = 'pr_paid'`);
  });

  it('dangerous actions are refused as bedrock_app', async () => {
    const refused: Record<string, string> = {
      'read password_hash': `SELECT password_hash FROM "User" LIMIT 1`,
      'SELECT * on "User"': `SELECT * FROM "User" LIMIT 1`,
      'change an email': `UPDATE "User" SET email='evil@x.test' WHERE id='ua'`,
      'change password_hash': `UPDATE "User" SET password_hash='x' WHERE id='ua'`,
      'mark an email verified': `UPDATE "User" SET email_verified=true WHERE id='ua'`,
      'change a role': `UPDATE "User" SET role='admin' WHERE id='ua'`,
      'delete a user': `DELETE FROM "User" WHERE id='ub'`,
      'TRUNCATE a table': `TRUNCATE "Trace"`,
      'edit a trace': `UPDATE "Trace" SET tokens_used=1`,
      'edit a log row': `UPDATE "SecurityLog" SET message='x'`,
      'create a table': `CREATE TABLE evil(x int)`,
      'drop a table': `DROP TABLE "Prompt"`,
      'alter a table': `ALTER TABLE "Prompt" ADD COLUMN evil int`,
      'drop the row-guard trigger': `DROP TRIGGER "Prompt_guard_update" ON "Prompt"`,
      'drop a size check': `ALTER TABLE "Prompt" DROP CONSTRAINT "Prompt_size_chk"`,
      'replace reserve_quota()': `CREATE OR REPLACE FUNCTION reserve_quota(text,text,text,text,text,integer,interval) RETURNS boolean LANGUAGE sql AS 'SELECT true'`,
      'read schema_migrations': `SELECT * FROM schema_migrations`,
      'insert an IdempotencyKey': `INSERT INTO "IdempotencyKey"(id,key,endpoint,status,expires_at) VALUES ('k','k','/x','s',now())`,
    };
    await asApp(async () => {
      for (const [name, sql] of Object.entries(refused)) {
        const msg = await errorOf(db, sql);
        expect(msg, name).toMatch(/permission denied|must be owner|ROW_IMMUTABLE|TRUNCATE_BLOCKED/);
      }
    });
  });
});
