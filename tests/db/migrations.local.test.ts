// In-memory Postgres (PGlite) tests for migrations 0005 and newer. Each protection is shown to be MISSING at 0004
// and PRESENT after its migration, and the API's real query shapes are checked to still work.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorOf, loadPglite, migrateDown, migrateUp, newPrompt, readMigration, rows, runSql, seedUsers, splitStatements } from './helper';

const PGlite = await loadPglite();

describe.skipIf(!PGlite)('migrations on in-memory Postgres', () => {
  let oldDb: any; // 0001-0004 only
  let db: any; // everything
  const oldApplied = new Set<string>();
  const applied = new Set<string>();
  let n = 0;
  const id = (p: string) => `${p}_${++n}`;

  beforeAll(async () => {
    oldDb = new PGlite();
    await migrateUp(oldDb, oldApplied, '0004');
    await seedUsers(oldDb);
    db = new PGlite();
    await migrateUp(db, applied);
    await seedUsers(db);
  }, 120_000);

  afterAll(async () => {
    await oldDb?.close();
    await db?.close();
  });

  describe('0005 SecurityLog limits', () => {
    const bad = [
      `INSERT INTO "SecurityLog"(id,event_type,message) VALUES ('m'||random(),'X',repeat('x',2001))`,
      `INSERT INTO "SecurityLog"(id,event_type,message,ip_address) VALUES ('i'||random(),'X','m',repeat('1',65))`,
      `INSERT INTO "SecurityLog"(id,event_type,message) VALUES ('e'||random(),repeat('E',101),'m')`,
      `INSERT INTO "SecurityLog"(id,event_type,message,endpoint) VALUES ('p'||random(),'X','m',repeat('/',201))`,
    ];
    it('before: huge log values are accepted', async () => {
      for (const s of bad) expect(await errorOf(oldDb, s)).toBeNull();
    });
    it('after: all four are refused, a normal row is accepted', async () => {
      for (const s of bad) expect(await errorOf(db, s)).toMatch(/SecurityLog_size_chk/);
      expect(await errorOf(db, `INSERT INTO "SecurityLog"(id,event_type,message,ip_address,endpoint) VALUES ('ok'||random(),'AUTH_SIGNATURE_INVALID','x','203.0.113.9','/api/ai/synthesize')`)).toBeNull();
    });
  });

  describe('0006 function rights', () => {
    const q = `SELECT has_function_privilege('public','reserve_quota(text,text,text,text,text,integer,interval)','EXECUTE') a,
                      has_function_privilege('public','purge_old_logs(integer)','EXECUTE') b`;
    it('before: anyone may run them; after: PUBLIC may not, the owner still can', async () => {
      expect((await rows(oldDb, q))[0]).toEqual({ a: true, b: true });
      expect((await rows(db, q))[0]).toEqual({ a: false, b: false });
      expect(await errorOf(db, `SELECT reserve_quota('own'||random(),'ua','1.2.3.4','assist','/t',1000)`)).toBeNull();
    });
  });

  describe('0007 / 0009 account guards', () => {
    it('before: case-variant email and username duplicates are accepted', async () => {
      expect(await errorOf(oldDb, `INSERT INTO "User"(id,email,password_hash,name,updated_at) VALUES ('u_case','A@X.TEST','x','n',now())`)).toBeNull();
      await oldDb.query(`DELETE FROM "User" WHERE id = 'u_case'`);
    });
    it('after: a different-case email is refused', async () => {
      expect(await errorOf(db, `INSERT INTO "User"(id,email,password_hash,name,updated_at) VALUES ('u_case','A@X.TEST','x','n',now())`)).toMatch(/User_email_lower_key/);
    });
    it('after: a different-case username is refused (23505); many empty usernames are fine', async () => {
      await db.query(`UPDATE "User" SET username = 'alice' WHERE id = 'ua'`);
      expect(await errorOf(db, `UPDATE "User" SET username = 'ALICE' WHERE id = 'ub'`)).toMatch(/User_username_lower_key/);
      expect(await errorOf(db, `UPDATE "User" SET username = NULL WHERE id IN ('ua','ub')`)).toBeNull();
    });
    it('0007 and 0009 refuse (change nothing) when duplicates already exist', async () => {
      const d = new PGlite();
      const a = new Set<string>();
      await migrateUp(d, a, '0006');
      await d.query(`INSERT INTO "User"(id,email,password_hash,name,username,updated_at) VALUES ('d1','Dup@x.test','x','n','Same',now()),('d2','dup@x.test','x','n','same',now())`);
      expect(await errorOf(d, splitStatements(readMigration('0007_user_email_ci_unique.up.sql'))[0])).toMatch(/DUPLICATE_EMAILS/);
      expect(await rows(d, `SELECT 1 FROM pg_indexes WHERE indexname = 'User_email_lower_key'`)).toHaveLength(0);
      await d.query(`UPDATE "User" SET email = 'other@x.test' WHERE id = 'd2'`);
      expect(await errorOf(d, splitStatements(readMigration('0009_user_username_ci_unique.up.sql'))[0])).toMatch(/DUPLICATE_USERNAMES/);
      await d.close();
    });
  });

  describe('0008 reserve_quota hardening', () => {
    const reserve = async (d: any, rid: string, user: string | null, ip: string | null, limit: number, bucket: string) =>
      (await rows(d, `SELECT reserve_quota($1,$2::text,$3,$4,'/t',$5::int) AS ok`, [rid, user, ip, bucket, limit]))[0].ok as boolean;

    it('before: no user + no IP is unlimited; after: it counts as "unknown" and is limited', async () => {
      for (const [d, expected] of [[oldDb, 3], [db, 1]] as const) {
        const tag = id('nn');
        let granted = 0;
        for (let i = 0; i < 3; i++) if (await reserve(d, `${tag}${i}`, null, null, 1, `b_${tag}`)) granted++;
        expect(granted).toBe(expected);
      }
    });
    it('before: someone else reusing a reservation id got a free "yes"; after: "no"', async () => {
      for (const [d, expected] of [[oldDb, true], [db, false]] as const) {
        const rid = id('reuse');
        await reserve(d, rid, 'ua', '1.1.1.1', 100, `b_${rid}`);
        expect(await reserve(d, rid, 'ub', '2.2.2.2', 100, `b_${rid}`)).toBe(expected);
      }
    });
    it('after: own retry counts once, 10,000-char IP is cut to 64, limit <= 0 is "no", anonymous other-IP reuse is "no"', async () => {
      const r = id('retry');
      expect(await reserve(db, r, 'ub', 'x', 1, `b_${r}`)).toBe(true);
      expect(await reserve(db, r, 'ub', 'x', 1, `b_${r}`)).toBe(true);
      expect(await reserve(db, `${r}b`, 'ub', 'x', 1, `b_${r}`)).toBe(false);
      const l = id('long');
      await reserve(db, l, null, 'z'.repeat(10_000), 5, `b_${l}`);
      expect((await rows(db, `SELECT char_length(ip_address) n FROM "QuotaEvent" WHERE id = $1`, [l]))[0].n).toBeLessThanOrEqual(64);
      expect(await reserve(db, id('z0'), 'ua', 'x', 0, 'b_zero')).toBe(false);
      expect(await reserve(db, id('zn'), 'ua', 'x', -1, 'b_zero')).toBe(false);
      const a = id('anon');
      await reserve(db, a, null, '1.1.1.1', 100, `b_${a}`);
      expect(await reserve(db, a, null, '9.9.9.9', 100, `b_${a}`)).toBe(false);
    });
    it('40 requests fired at once at a limit of 10 grant exactly 10, for a signed-in account and for an anonymous IP, and store exactly 10 rows', async () => {
      // NOTE: this engine has ONE connection, so the 40 calls are queued, not truly parallel. This test guards the logic
      // and the row count (no leakage past the limit, retries, separate keys). Real parallel locking was proven on Neon
      // (20 parallel, 2026-11-02) and is checked by agent-sync/quota-race-proof.mjs (40 parallel, OPEN-0071).
      for (const [user, ip] of [['ua', '7.7.7.7'], [null, '8.8.8.8']] as const) {
        const bucket = `b_par_${user ?? 'anon'}`;
        const results = await Promise.all(Array.from({ length: 40 }, (_, i) => reserve(db, `par_${user ?? 'anon'}_${i}`, user, ip, 10, bucket)));
        expect(results.filter(Boolean)).toHaveLength(10);
        const [{ n }] = await rows(db, `SELECT count(*)::int n FROM "QuotaEvent" WHERE bucket = $1`, [bucket]);
        expect(n).toBe(10);
        // the same 40 ids again (retries after a network error): the 10 granted are still "yes", the other 30 still "no", no new rows
        const again = await Promise.all(Array.from({ length: 40 }, (_, i) => reserve(db, `par_${user ?? 'anon'}_${i}`, user, ip, 10, bucket)));
        expect(again).toEqual(results);
        expect((await rows(db, `SELECT count(*)::int n FROM "QuotaEvent" WHERE bucket = $1`, [bucket]))[0].n).toBe(10);
      }
    });

    it('refunds by DELETE and purge_old_logs() returns the 4 counts the cron reads', async () => {
      const b = id('refund');
      const got: boolean[] = [];
      for (let i = 0; i < 3; i++) got.push(await reserve(db, `${b}${i}`, 'ub', '2.2.2.2', 2, b));
      expect(got).toEqual([true, true, false]);
      await db.query(`DELETE FROM "QuotaEvent" WHERE id = $1`, [`${b}0`]);
      expect(await reserve(db, `${b}x`, 'ub', '2.2.2.2', 2, b)).toBe(true);
      const [p] = await rows(db, `SELECT * FROM purge_old_logs()`);
      expect(Object.keys(p).sort()).toEqual(['idempotency_keys', 'quota_events', 'security_logs', 'traces']);
    });
  });

  describe('0010 trace_totals', () => {
    it('adds up ALL rows (150 traces, 3 models), same p99 index the API used', async () => {
      await db.query(`INSERT INTO "Trace"(id,user_id,node_origin,model_target,tokens_used,latency_ms,status)
        SELECT 'tt'||g,'ua','n',(ARRAY['m1','m2','m3'])[1+g%3],10,g,(ARRAY['OK','success','ERR'])[1+g%3] FROM generate_series(0,149) g`);
      const [t] = await rows(db, `SELECT * FROM trace_totals('ua')`);
      expect(t.total_inferences).toBe(150);
      expect(Number(t.total_tokens)).toBe(1500);
      expect(t.avg_latency).toBe(75);
      expect(t.p99_latency).toBe(148);
      expect(Number(t.reliability)).toBe(66.7);
      expect([...t.active_models].sort()).toEqual(['m1', 'm2', 'm3']);
      await db.query(`DELETE FROM "Trace" WHERE id LIKE 'tt%'`);
    });
    it('a user with no traces gets one row of zeros and reliability 100', async () => {
      const [t] = await rows(db, `SELECT * FROM trace_totals('nobody')`);
      expect(t).toMatchObject({ total_inferences: 0, avg_latency: 0, p99_latency: 0 });
      expect(Number(t.reliability)).toBe(100);
      expect(t.active_models).toEqual([]);
    });
  });

  describe('0011 row guards', () => {
    it('before: an owner change, a trace edit and TRUNCATE all work; after: all refused', async () => {
      const tmp = new PGlite();
      const a = new Set<string>();
      await migrateUp(tmp, a, '0004');
      await seedUsers(tmp);
      await newPrompt(tmp, 'p1', 'ua');
      expect(await errorOf(tmp, `UPDATE "Prompt" SET user_id = 'ub' WHERE id = 'p1'`)).toBeNull();
      expect(await errorOf(tmp, `TRUNCATE "Trace" CASCADE`)).toBeNull();
      await tmp.close();

      const p = id('gp');
      await newPrompt(db, p, 'ua');
      await db.query(`INSERT INTO "BranchingTree"(id,user_id,title,nodes,edges,created_at,updated_at) VALUES ($1,'ua','t','[]','[]',now(),now())`, [`${p}w`]);
      expect(await errorOf(db, `UPDATE "Prompt" SET user_id = 'ub' WHERE id = $1`, [p])).toMatch(/ROW_IMMUTABLE/);
      expect(await errorOf(db, `UPDATE "Prompt" SET id = $2 WHERE id = $1`, [p, `${p}x`])).toMatch(/ROW_IMMUTABLE/);
      expect(await errorOf(db, `UPDATE "BranchingTree" SET user_id = 'ub' WHERE id = $1`, [`${p}w`])).toMatch(/ROW_IMMUTABLE/);
      expect(await errorOf(db, `UPDATE "User" SET id = 'ua2' WHERE id = 'ua'`)).toMatch(/ROW_IMMUTABLE/);
      await db.query(`INSERT INTO "Trace"(id,user_id,node_origin,model_target,tokens_used,latency_ms,status) VALUES ($1,'ua','n','m',1,1,'OK')`, [`${p}t`]);
      expect(await errorOf(db, `UPDATE "Trace" SET tokens_used = 999999 WHERE id = $1`, [`${p}t`])).toMatch(/ROW_IMMUTABLE/);
      await db.query(`INSERT INTO "SecurityLog"(id,user_id,event_type,message) VALUES ($1,'ua','X','m')`, [`${p}s`]);
      expect(await errorOf(db, `UPDATE "SecurityLog" SET message = 'rewritten' WHERE id = $1`, [`${p}s`])).toMatch(/ROW_IMMUTABLE/);
      expect(await errorOf(db, `UPDATE "SecurityLog" SET user_id = 'ub' WHERE id = $1`, [`${p}s`])).toMatch(/ROW_IMMUTABLE/);
      for (const t of ['User', 'Prompt', 'BranchingTree', 'Trace', 'QuotaEvent', 'SecurityLog']) {
        expect(await errorOf(db, `TRUNCATE "${t}" CASCADE`)).toMatch(/TRUNCATE_BLOCKED/);
      }
    });
    it('the API\'s own writes still work: owner edit, ON CONFLICT DO NOTHING by another user, sign-in upsert, profile at max sizes, plan change', async () => {
      const p = id('ok');
      await newPrompt(db, p, 'ua');
      expect(await rows(db, `UPDATE "Prompt" SET title = 'new', updated_at = now() WHERE id = $1 AND user_id = 'ua' RETURNING id`, [p])).toHaveLength(1);
      expect(await errorOf(db, `INSERT INTO "Prompt"(id,user_id,title,snippet,full_content,tags,target_type,created_at,updated_at)
        SELECT $1,'ub','t','s','c','[]','G',now(),now() WHERE (SELECT count(*) FROM "Prompt" WHERE user_id='ub') < 2000 ON CONFLICT (id) DO NOTHING`, [p])).toBeNull();
      expect(await rows(db, `SELECT user_id FROM "Prompt" WHERE id = $1`, [p])).toEqual([{ user_id: 'ua' }]);
      expect(await errorOf(db, `INSERT INTO "User"(id,email,password_hash,name,username,plan,role,email_verified,mfa_enabled,subscription_tier,created_at,updated_at)
        VALUES ('ua','a@x.test','clerk_oauth_external','a',NULL,'Free Plan','Lead Prompt Architect',true,false,'free',now(),now()) ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`)).toBeNull();
      expect(await errorOf(db, `UPDATE "User" SET name=repeat('n',100), username=NULL, bio=repeat('b',1000), location=repeat('l',100),
        organization=repeat('o',100), github=repeat('g',300), huggingface=repeat('h',300), website=repeat('w',300), updated_at=now() WHERE id='ua'`)).toBeNull();
      expect(await errorOf(db, `UPDATE "User" SET subscription_tier = 'pro', plan = 'Pro', updated_at = NOW() WHERE id = 'ub'`)).toBeNull();
      await db.query(`UPDATE "User" SET subscription_tier = 'free', plan = 'Free Plan' WHERE id = 'ub'`);
    });
    it('deleting a user still cascades and the log keeps its row with user_id = NULL', async () => {
      const u = id('gone');
      await db.query(`INSERT INTO "User"(id,email,password_hash,name,updated_at) VALUES ($1,$2,'x','g',now())`, [u, `${u}@x.test`]);
      await newPrompt(db, `${u}p`, u);
      await db.query(`INSERT INTO "SecurityLog"(id,user_id,event_type,message) VALUES ($1,$2,'X','m')`, [`${u}s`, u]);
      expect(await errorOf(db, `DELETE FROM "User" WHERE id = $1`, [u])).toBeNull();
      expect(await rows(db, `SELECT count(*)::int c FROM "Prompt" WHERE user_id = $1`, [u])).toEqual([{ c: 0 }]);
      expect(await rows(db, `SELECT user_id FROM "SecurityLog" WHERE id = $1`, [`${u}s`])).toEqual([{ user_id: null }]);
    });
  });

  describe('0012 function hardening', () => {
    it('pins search_path on 4 functions; reserve_quota and purge_old_logs also get lock_timeout 5s', async () => {
      const r = await rows(db, `SELECT proname, array_to_string(proconfig,' ') c FROM pg_proc WHERE proname IN ('reserve_quota','purge_old_logs','trace_totals','bedrock_enforce_row_cap')`);
      expect(r).toHaveLength(4);
      for (const f of r) expect(f.c).toMatch(/search_path=public, pg_temp/);
      expect(r.filter((f) => /lock_timeout=5s/.test(f.c)).map((f) => f.proname).sort()).toEqual(['purge_old_logs', 'reserve_quota']);
    });
  });

  describe('0013 "User" text limits', () => {
    it('refuses over-long bio / website, is validated, and refuses to run over existing long rows', async () => {
      expect(await errorOf(db, `UPDATE "User" SET bio = repeat('b',5001) WHERE id = 'ub'`)).toMatch(/User_text_size_chk/);
      expect(await errorOf(db, `UPDATE "User" SET website = repeat('w',2001) WHERE id = 'ub'`)).toMatch(/User_text_size_chk/);
      expect((await rows(db, `SELECT convalidated v FROM pg_constraint WHERE conname = 'User_text_size_chk'`))[0].v).toBe(true);
      const d = new PGlite();
      const a = new Set<string>();
      await migrateUp(d, a, '0012');
      await seedUsers(d);
      await d.query(`UPDATE "User" SET bio = repeat('b',6000) WHERE id = 'ub'`);
      expect(await errorOf(d, splitStatements(readMigration('0013_user_text_limits.up.sql'))[0])).toMatch(/USER_TEXT_TOO_LONG: 1 /);
      expect(await rows(d, `SELECT 1 FROM pg_constraint WHERE conname = 'User_text_size_chk'`)).toHaveLength(0);
      await d.close();
    });
  });

  describe('0018 onboarding fields (birth_date, referral_source)', () => {
    const NEW_COLUMNS = `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'User' AND column_name IN ('birth_date','referral_source') ORDER BY column_name`;

    it('before: the columns do not exist; after: two nullable text columns, and no existing account is changed', async () => {
      const d = new PGlite();
      const a = new Set<string>();
      await migrateUp(d, a, '0017');
      await seedUsers(d);
      await d.query(`UPDATE "User" SET bio = 'keep me', username = 'alice' WHERE id = 'ua'`);
      expect(await rows(d, NEW_COLUMNS)).toEqual([]);
      expect(await errorOf(d, `SELECT birth_date FROM "User"`)).toMatch(/birth_date/);
      const before = await rows(d, `SELECT * FROM "User" ORDER BY id`);

      // up to 0018 only: later migrations add other columns (0020 plan_expires_at)
      await migrateUp(d, a, '0018');
      expect(await rows(d, NEW_COLUMNS)).toEqual([
        { column_name: 'birth_date', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'referral_source', data_type: 'text', is_nullable: 'YES' },
      ]);
      const after = await rows(d, `SELECT * FROM "User" ORDER BY id`);
      expect(after.map((u: any) => ({ ...u, birth_date: undefined, referral_source: undefined }))).toEqual(
        before.map((u: any) => ({ ...u, birth_date: undefined, referral_source: undefined })),
      );
      expect(after.every((u: any) => u.birth_date === null && u.referral_source === null)).toBe(true);
      await d.close();
    }, 120_000);

    it('the safety-net size check is validated, refuses 151 / 501 characters and accepts the limits', async () => {
      expect((await rows(db, `SELECT convalidated v FROM pg_constraint WHERE conname = 'User_onboarding_size_chk'`))[0].v).toBe(true);
      expect(await errorOf(db, `UPDATE "User" SET birth_date = repeat('1',151) WHERE id = 'ua'`)).toMatch(/User_onboarding_size_chk/);
      expect(await errorOf(db, `UPDATE "User" SET referral_source = repeat('r',501) WHERE id = 'ua'`)).toMatch(/User_onboarding_size_chk/);
      expect(await errorOf(db, `UPDATE "User" SET birth_date = '2000-01-31', referral_source = repeat('r',500) WHERE id = 'ua'`)).toBeNull();
      expect(await errorOf(db, `UPDATE "User" SET birth_date = NULL, referral_source = NULL WHERE id = 'ua'`)).toBeNull();
    });

    it('running the up file a second time (an interrupted run, then a retry) changes nothing and keeps saved answers', async () => {
      const d = new PGlite();
      const a = new Set<string>();
      await migrateUp(d, a);
      await seedUsers(d);
      await d.query(`UPDATE "User" SET birth_date = '2000-01-31', referral_source = 'youtube' WHERE id = 'ua'`);
      await runSql(d, readMigration('0018_onboarding_fields.up.sql'));
      await runSql(d, readMigration('0018_onboarding_fields.up.sql'));
      expect(await rows(d, `SELECT birth_date, referral_source FROM "User" WHERE id = 'ua'`)).toEqual([{ birth_date: '2000-01-31', referral_source: 'youtube' }]);
      expect(await rows(d, `SELECT count(*)::int c FROM pg_constraint WHERE conname = 'User_onboarding_size_chk'`)).toEqual([{ c: 1 }]);
      await d.close();
    }, 120_000);

    it('the existing "User" checks still apply next to it', async () => {
      expect(await errorOf(db, `UPDATE "User" SET bio = repeat('b',5001) WHERE id = 'ub'`)).toMatch(/User_text_size_chk/);
    });

    it('down removes the columns and the check and keeps every account; re-applying works', async () => {
      const d = new PGlite();
      const a = new Set<string>();
      await migrateUp(d, a);
      await seedUsers(d);
      await d.query(`UPDATE "User" SET birth_date = '1999-12-31', referral_source = 'friend' WHERE id = 'ua'`);
      await migrateDown(d, a, '0017');
      expect(a.has('0018')).toBe(false);
      expect(await rows(d, NEW_COLUMNS)).toEqual([]);
      expect(await rows(d, `SELECT 1 FROM pg_constraint WHERE conname = 'User_onboarding_size_chk'`)).toHaveLength(0);
      expect(await rows(d, `SELECT count(*)::int c FROM "User"`)).toEqual([{ c: 2 }]);
      await migrateUp(d, a);
      expect(await rows(d, `SELECT birth_date, referral_source FROM "User" WHERE id = 'ua'`)).toEqual([{ birth_date: null, referral_source: null }]);
      await d.close();
    }, 120_000);

    it('deleting an account removes its onboarding answers with the row', async () => {
      const d = new PGlite();
      const a = new Set<string>();
      await migrateUp(d, a);
      await seedUsers(d);
      await d.query(`UPDATE "User" SET birth_date = '1999-12-31', referral_source = 'friend' WHERE id = 'ub'`);
      await d.query(`SELECT delete_user_data('ub')`);
      expect(await rows(d, `SELECT count(*)::int c FROM "User" WHERE id = 'ub'`)).toEqual([{ c: 0 }]);
      await d.close();
    }, 120_000);
  });

  describe('0020 plan end date (plan_expires_at)', () => {
    it('adds one nullable timestamptz, changes no existing account, and down removes only that column', async () => {
      const d = new PGlite();
      const a = new Set<string>();
      await migrateUp(d, a, '0019');
      await seedUsers(d);
      await d.query(`UPDATE "User" SET subscription_tier = 'pro', plan = 'Pro Plan' WHERE id = 'ua'`);
      expect(await errorOf(d, `SELECT plan_expires_at FROM "User"`)).toMatch(/plan_expires_at/);
      const before = await rows(d, `SELECT * FROM "User" ORDER BY id`);

      await migrateUp(d, a, '0020');
      expect(await rows(d, `SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'plan_expires_at'`))
        .toEqual([{ data_type: 'timestamp with time zone', is_nullable: 'YES' }]);
      const after = await rows(d, `SELECT * FROM "User" ORDER BY id`);
      // existing paid accounts keep their plan with no end date
      expect(after.map(({ plan_expires_at, ...u }: any) => (expect(plan_expires_at).toBeNull(), u))).toEqual(before);

      await runSql(d, readMigration('0020_plan_expiry.up.sql')); // a retry changes nothing
      await d.query(`UPDATE "User" SET plan_expires_at = now() WHERE id = 'ua'`);
      await migrateDown(d, a, '0019');
      expect(a.has('0020')).toBe(false);
      expect(await rows(d, `SELECT * FROM "User" ORDER BY id`)).toEqual(before);
      await d.close();
    }, 120_000);
  });

  describe('up and down', () => {
    it('every migration can be undone and re-applied (twice) and no row is lost', async () => {
      const d = new PGlite();
      const a = new Set<string>();
      await migrateUp(d, a);
      await seedUsers(d);
      const total = a.size;
      await migrateDown(d, a);
      expect(a.size).toBe(0);
      await migrateUp(d, a);
      await migrateDown(d, a);
      await migrateUp(d, a);
      expect(a.size).toBe(total);
      expect(await rows(d, `SELECT count(*)::int c FROM "User"`)).toEqual([{ c: 2 }]);
      await d.close();
    }, 120_000);
  });
});
