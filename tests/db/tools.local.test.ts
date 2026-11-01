// In-memory Postgres (PGlite) tests for the read-only growth report (db/lib/stats.mjs) and the dev-data anonymizer
// (db/lib/anonymize.mjs), driven through the same Neon stand-in as the migration tool.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadPglite, migrateUp, neonLike, newPrompt, rows, seedUsers } from './helper';
// @ts-ignore plain .mjs without types
import { collectStats } from '../../db/lib/stats.mjs';
// @ts-ignore plain .mjs without types
import { anonymize, isMarkedDev, markDev } from '../../db/lib/anonymize.mjs';

const PGlite = await loadPglite();

describe.skipIf(!PGlite)('growth report (db/stats.mjs)', () => {
  let db: any;
  beforeAll(async () => {
    db = new PGlite();
    await migrateUp(db, new Set<string>());
    await seedUsers(db);
  }, 120_000);
  afterAll(async () => {
    await db?.close();
  });

  it('a healthy database has no warnings and lists every table', async () => {
    const s = await collectStats(neonLike(db));
    expect(s.warnings).toEqual([]);
    expect(s.tables.map((t: any) => t.name)).toEqual(['User', 'Prompt', 'BranchingTree', 'Trace', 'SecurityLog', 'QuotaEvent', 'IdempotencyKey']);
    expect(s.tables.find((t: any) => t.name === 'User').rows).toBe(2);
  });

  it('shows rows that are past their keep time as "cleanup is behind", and the warning clears after the cleanup', async () => {
    await db.query(`INSERT INTO "SecurityLog"(id,event_type,message,created_at) VALUES
      ('old90','X','m',(now() AT TIME ZONE 'UTC') - interval '100 days'),
      ('oldq','AI_QUOTA_GENERATION','m',(now() AT TIME ZONE 'UTC') - interval '2 days'),
      ('fresh','X','m',(now() AT TIME ZONE 'UTC'))`);
    const behind = await collectStats(neonLike(db));
    expect(behind.overdue.securityLogs).toBe(2);
    expect(behind.last24h.securityLogs).toBe(1);
    expect(behind.oldestDays.securityLogs).toBeGreaterThanOrEqual(100);
    expect(behind.warnings.join(' ')).toMatch(/cleanup is behind/);
    await db.query(`SELECT * FROM purge_old_logs()`);
    const ok = await collectStats(neonLike(db));
    expect(ok.overdue.securityLogs).toBe(0);
    expect(ok.warnings).toEqual([]);
  });

  it('names the busiest accounts with shortened ids only, and warns near a cap', async () => {
    await db.query(`INSERT INTO "User"(id,email,password_hash,name,updated_at) VALUES ('busyuser_123456789','busy@x.test','x','busy',now())`);
    await db.query(`INSERT INTO "Prompt"(id,user_id,title,snippet,full_content,tags,target_type,created_at,updated_at)
      SELECT 'bp'||g,'busyuser_123456789','t','s','c','[]','G',now(),now() FROM generate_series(1,1850) g`);
    const s = await collectStats(neonLike(db));
    expect(s.topUsers[0]).toMatchObject({ user: 'busyus...', prompts: 1850 });
    expect(JSON.stringify(s)).not.toMatch(/busyuser_123456789|busy@x\.test/);
    expect(s.warnings.join(' ')).toMatch(/busyus\.\.\. has 1850 saved prompts/);
  });
});

describe.skipIf(!PGlite)('dev-data anonymizer (db/anonymize-dev.mjs)', () => {
  it('refuses on a database that is not marked as dev, and changes nothing', async () => {
    const db = new PGlite();
    await migrateUp(db, new Set<string>());
    await seedUsers(db);
    expect(await isMarkedDev(neonLike(db))).toBe(false);
    await expect(anonymize(neonLike(db))).rejects.toThrow(/not marked as a dev database/);
    expect((await rows(db, `SELECT email FROM "User" ORDER BY id`)).map((r: any) => r.email)).toEqual(['a@x.test', 'b@x.test']);
    await db.close();
  }, 120_000);

  it('after marking: every personal value becomes fake, sizes stay realistic, logs are removed, ids and counts stay', async () => {
    const db = new PGlite();
    await migrateUp(db, new Set<string>());
    await seedUsers(db);
    await db.query(`UPDATE "User" SET username='alice', bio='my real bio', website='https://real.example', name='Real Person' WHERE id='ua'`);
    await db.query(`INSERT INTO "Prompt"(id,user_id,title,snippet,full_content,tags,target_type,created_at,updated_at)
      VALUES ('p1','ua','My secret title','snippet text',repeat('secret ',1000),'["Real"]','G',now(),now())`);
    await db.query(`INSERT INTO "BranchingTree"(id,user_id,title,nodes,edges,created_at,updated_at) VALUES ('w1','ua','Secret flow','[{"a":"secret"}]','[]',now(),now())`);
    await db.query(`INSERT INTO "SecurityLog"(id,user_id,event_type,ip_address,message) VALUES ('s1','ua','X','198.51.100.7','real ip event')`);
    await db.query(`SELECT reserve_quota('q1','ua'::text,'198.51.100.7','generation','/x',10::int)`);
    await db.query(`INSERT INTO "PaymentRecord"(id,user_id,order_id,amount,currency,status,tier,updated_at) VALUES ('pr1','ua','ord1',1,'INR','created','pro',now())`);

    const sql = neonLike(db);
    await markDev(sql);
    expect(await isMarkedDev(sql)).toBe(true);
    const r = await anonymize(sql);
    expect(r).toEqual({ users: 2, real_emails: 0 });

    const users = await rows(db, `SELECT id, email, name, username, bio, website FROM "User" ORDER BY id`);
    expect(users.map((u: any) => u.id)).toEqual(['ua', 'ub']);
    expect(users[0].email).toMatch(/^user_[0-9a-f]{12}@example\.invalid$/);
    expect(users[0]).toMatchObject({ bio: null, website: null });
    expect(users[0].username).toMatch(/^user_/);
    expect(users[1].username).toBeNull();
    expect(new Set(users.map((u: any) => u.email)).size).toBe(2);
    expect(JSON.stringify(users)).not.toMatch(/real|alice|a@x\.test/i);

    const [p] = await rows(db, `SELECT title, full_content, user_id FROM "Prompt" WHERE id = 'p1'`);
    expect(p.full_content).toHaveLength(7000); // same size as before
    expect(p.full_content).not.toMatch(/secret/);
    expect(p.title).not.toMatch(/secret/i);
    expect(p.user_id).toBe('ua');
    expect((await rows(db, `SELECT nodes FROM "BranchingTree" WHERE id = 'w1'`))[0].nodes).toBe('[]');

    for (const t of ['SecurityLog', 'QuotaEvent', 'PaymentRecord']) {
      expect((await rows(db, `SELECT count(*)::int c FROM "${t}"`))[0].c, t).toBe(0);
    }
    await db.close();
  }, 120_000);
});
