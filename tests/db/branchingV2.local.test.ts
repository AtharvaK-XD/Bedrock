// In-memory Postgres (PGlite) tests for migration 0021 (Branching v2: versions, run records, share links), the
// matching rights in db/roles.sql, and the EXACT queries Backend copies from db/PAGING.md (second half).
// Real SQL on a real Postgres engine; no Neon connection, no secrets.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-ignore plain .mjs without types
import { anonymize, markDev } from '../../db/lib/anonymize.mjs';
import {
  errorOf, loadPglite, migrateDown, migrateUp, neonLike, readDbFile, readMigration, rows, runSql, seedUsers,
} from './helper';

const PGlite = await loadPglite();

function sqlBlocks(): Record<string, string> {
  const out: Record<string, string> = {};
  const doc = readDbFile('PAGING.md').replace(/\r\n/g, '\n');
  for (const m of doc.matchAll(/`sql\n-- name: (\w+)\n([\s\S]*?)`/g)) out[m[1]] = m[2].trim();
  return out;
}
const Q = sqlBlocks();
const TOKEN = (c: string, n = 43) => c.repeat(n);
const newWorkflow = (db: any, id: string, user: string) =>
  db.query(`INSERT INTO "BranchingTree"(id,user_id,title,nodes,edges,created_at,updated_at) VALUES ($1,$2,'wf','[]','[]',now(),now())`, [id, user]);
const run = (db: any, id: string, user: string, wf: string | null, at = 'now()', status = 'success', types = '{prompt}') =>
  db.query(`INSERT INTO "WorkflowRun"(id,user_id,workflow_id,status,node_count,ai_calls,duration_ms,node_types,created_at)
            VALUES ($1,$2,$3,$4,1,0,10,$5::text[],${at})`, [id, user, wf, status, types]);

describe.skipIf(!PGlite)('0021 Branching v2 storage', () => {
  let db: any;

  beforeAll(async () => {
    db = new PGlite();
    await migrateUp(db, new Set<string>());
    await seedUsers(db);
  });

  afterAll(async () => {
    await db?.close();
  });

  it('every query block Backend needs is in PAGING.md', () => {
    for (const name of ['version_insert', 'versions_prune', 'versions_list', 'version_one', 'run_insert', 'run_stats',
      'runs_purge', 'share_create', 'share_revoke', 'shared_open']) expect(Q[name], name).toBeTruthy();
  });

  it('up, down and up again; a second up changes nothing; down puts delete_user_data back to 0019', async () => {
    const d = new PGlite();
    const a = new Set<string>();
    await migrateUp(d, a, '0020');
    // compared without \r: the 0019 file may be checked out with Windows line ends, which end up inside the body
    const fnDef = async () => (await rows(d, `SELECT pg_get_functiondef('delete_user_data(text)'::regprocedure) f`))[0].f.replace(/\r/g, '');
    const fnBefore = await fnDef();
    await migrateUp(d, a, '0021');
    const tables = async () => (await rows(d, `SELECT tablename FROM pg_tables WHERE tablename LIKE 'Workflow%' ORDER BY 1`)).map((r: any) => r.tablename);
    expect(await tables()).toEqual(['WorkflowRun', 'WorkflowShare', 'WorkflowVersion']);
    expect((await rows(d, `SELECT pg_get_functiondef('delete_user_data(text)'::regprocedure) f`))[0].f).toMatch(/"WorkflowShare"/);
    await runSql(d, readMigration('0021_branching_v2.up.sql')); // a retry changes nothing and does not fail
    await migrateDown(d, a, '0020');
    expect(await tables()).toEqual([]);
    expect(await fnDef()).toBe(fnBefore);
    expect(await rows(d, `SELECT proname FROM pg_proc WHERE proname IN ('bedrock_workflow_owner_check','bedrock_enforce_run_daily_cap')`)).toEqual([]);
    await migrateUp(d, a, '0021');
    expect(await tables()).toEqual(['WorkflowRun', 'WorkflowShare', 'WorkflowVersion']);
    await d.close();
  });

  it('down refuses while the tables hold data (saved versions, history, links) and changes nothing', async () => {
    const d = new PGlite();
    const a = new Set<string>();
    await migrateUp(d, a);
    await seedUsers(d);
    await run(d, 'r_keep', 'ua', null);
    const down = readMigration('0021_branching_v2.down.sql');
    await expect(runSql(d, down)).rejects.toThrow(/BRANCHING_V2_HAS_DATA/);
    expect(await rows(d, `SELECT id FROM "WorkflowRun"`)).toEqual([{ id: 'r_keep' }]);
    await d.close();
  });

  it('refuses bad rows', async () => {
    await newWorkflow(db, 'wf_c', 'ua');
    const v = (extra: string) => `INSERT INTO "WorkflowVersion"(id,workflow_id,user_id,version,title,nodes,edges,node_count) VALUES ${extra}`;
    expect(await errorOf(db, v(`('v_big','wf_c','ua',1,'t',repeat('n',1000001),'[]',0)`))).toMatch(/WorkflowVersion_size_chk/);
    expect(await errorOf(db, v(`('v_title','wf_c','ua',1,repeat('t',501),'[]','[]',0)`))).toMatch(/WorkflowVersion_size_chk/);
    expect(await errorOf(db, v(`('v_zero','wf_c','ua',0,'t','[]','[]',0)`))).toMatch(/WorkflowVersion_numbers_chk/);
    expect(await errorOf(db, v(`('v_neg','wf_c','ua',1,'t','[]','[]',-1)`))).toMatch(/WorkflowVersion_numbers_chk/);
    // the largest workflow "BranchingTree" accepts is accepted as a version too
    expect(await errorOf(db, v(`('v_max','wf_c','ua',1,repeat('t',500),repeat('n',1000000),repeat('e',1000000),0)`))).toBeNull();
    expect(await errorOf(db, v(`('v_dup','wf_c','ua',1,'t','[]','[]',0)`))).toMatch(/WorkflowVersion_workflow_id_version_key/);

    const r = (vals: string) => `INSERT INTO "WorkflowRun"(id,user_id,workflow_id,status,node_count,ai_calls,duration_ms,error_count,node_types) VALUES ${vals}`;
    expect(await errorOf(db, r(`('r1','ua',NULL,'success',-1,0,0,0,'{}')`))).toMatch(/WorkflowRun_sanity_chk/);
    expect(await errorOf(db, r(`('r1','ua',NULL,'success',0,-1,0,0,'{}')`))).toMatch(/WorkflowRun_sanity_chk/);
    expect(await errorOf(db, r(`('r1','ua',NULL,'success',0,0,-1,0,'{}')`))).toMatch(/WorkflowRun_sanity_chk/);
    expect(await errorOf(db, r(`('r1','ua',NULL,'success',0,0,0,-1,'{}')`))).toMatch(/WorkflowRun_sanity_chk/);
    expect(await errorOf(db, r(`('r1','ua',NULL,'success',0,0,3600001,0,'{}')`))).toMatch(/WorkflowRun_sanity_chk/);
    expect(await errorOf(db, r(`('r1','ua',NULL,'done',0,0,0,0,'{}')`))).toMatch(/check constraint/);
    const types31 = `'{${Array.from({ length: 31 }, (_, i) => `t${i}`).join(',')}}'`;
    expect(await errorOf(db, r(`('r1','ua',NULL,'success',0,0,0,0,${types31})`))).toMatch(/WorkflowRun_sanity_chk/);
    expect(await errorOf(db, r(`('r1','ua',NULL,'success',0,0,0,0,ARRAY[repeat('x',1001)])`))).toMatch(/WorkflowRun_sanity_chk/);
    expect(await errorOf(db, r(`('r1','ua',NULL,'success',0,0,0,0,'{{a,b},{c,d}}')`))).toMatch(/WorkflowRun_sanity_chk/);
    expect(await errorOf(db, r(`('r_ok','ua',NULL,'cancelled',30,200,3600000,3,'{prompt,switch}')`))).toBeNull();

    const s = (token: string, extra = '') => `INSERT INTO "WorkflowShare"(token,workflow_id,user_id${extra ? ',view_count' : ''}) VALUES ('${token}','wf_c','ua'${extra})`;
    expect(await errorOf(db, s(TOKEN('a', 31)))).toMatch(/check constraint/);
    expect(await errorOf(db, s(TOKEN('a', 129)))).toMatch(/check constraint/);
    expect(await errorOf(db, s(TOKEN('a', 40), ',-1'))).toMatch(/check constraint/);
    expect(await errorOf(db, s(TOKEN('a', 32)))).toBeNull();
    expect(await errorOf(db, s(TOKEN('b', 128)))).toMatch(/WorkflowShare_one_active_idx/); // second ACTIVE link
    await db.query(`UPDATE "WorkflowShare" SET revoked_at = now() WHERE workflow_id = 'wf_c'`);
    expect(await errorOf(db, s(TOKEN('b', 128)))).toBeNull(); // after revoking, a new link is fine
  });

  it('a version, run or share cannot point at another account\'s workflow', async () => {
    await newWorkflow(db, 'wf_owned_by_a', 'ua');
    const msgs = [
      await errorOf(db, `INSERT INTO "WorkflowVersion"(id,workflow_id,user_id,version,title,nodes,edges) VALUES ('vx','wf_owned_by_a','ub',1,'t','[]','[]')`),
      await errorOf(db, `INSERT INTO "WorkflowRun"(id,user_id,workflow_id,status,node_count,ai_calls,duration_ms) VALUES ('rx','ub','wf_owned_by_a','success',0,0,0)`),
      await errorOf(db, `INSERT INTO "WorkflowShare"(token,workflow_id,user_id) VALUES ('${TOKEN('x')}','wf_owned_by_a','ub')`),
      await errorOf(db, `INSERT INTO "WorkflowVersion"(id,workflow_id,user_id,version,title,nodes,edges) VALUES ('vy','no_such_workflow','ub',1,'t','[]','[]')`),
    ];
    for (const m of msgs) expect(m).toMatch(/WORKFLOW_NOT_OWNED/);
    expect(await errorOf(db, `INSERT INTO "WorkflowRun"(id,user_id,workflow_id,status,node_count,ai_calls,duration_ms) VALUES ('r_unsaved','ub',NULL,'success',0,0,0)`)).toBeNull();
  });

  it('deleting a workflow removes its versions and links; its runs stay with workflow_id NULL', async () => {
    await newWorkflow(db, 'wf_del', 'ua');
    await db.query(`INSERT INTO "WorkflowVersion"(id,workflow_id,user_id,version,title,nodes,edges) VALUES ('vd1','wf_del','ua',1,'t','[]','[]'),('vd2','wf_del','ua',2,'t','[]','[]')`);
    await db.query(`INSERT INTO "WorkflowShare"(token,workflow_id,user_id,revoked_at) VALUES ('${TOKEN('d')}','wf_del','ua',now())`);
    await db.query(`INSERT INTO "WorkflowShare"(token,workflow_id,user_id) VALUES ('${TOKEN('e')}','wf_del','ua')`);
    await run(db, 'rd1', 'ua', 'wf_del');
    await db.query(`DELETE FROM "BranchingTree" WHERE id = 'wf_del' AND user_id = 'ua'`);
    expect(await rows(db, `SELECT id FROM "WorkflowVersion" WHERE workflow_id = 'wf_del'`)).toEqual([]);
    expect(await rows(db, `SELECT token FROM "WorkflowShare" WHERE workflow_id = 'wf_del'`)).toEqual([]);
    expect(await rows(db, `SELECT workflow_id FROM "WorkflowRun" WHERE id = 'rd1'`)).toEqual([{ workflow_id: null }]);
  });

  it('delete_user_data erases versions, runs and links with the account, and still keeps paid orders (0019)', async () => {
    await db.query(`INSERT INTO "User"(id,email,password_hash,name,updated_at) VALUES ('ux','x@x.test','x','x',now())`);
    await newWorkflow(db, 'wf_x', 'ux');
    await db.query(`INSERT INTO "WorkflowVersion"(id,workflow_id,user_id,version,title,nodes,edges) VALUES ('vx1','wf_x','ux',1,'t','[]','[]')`);
    await db.query(`INSERT INTO "WorkflowShare"(token,workflow_id,user_id) VALUES ('${TOKEN('x')}','wf_x','ux')`);
    await run(db, 'rx1', 'ux', 'wf_x');
    await run(db, 'rx2', 'ux', null);
    await db.query(`INSERT INTO "PaymentRecord"(id,user_id,order_id,payment_id,signature,amount,currency,status,tier,updated_at) VALUES
      ('px_paid','ux','order_X_paid','pay_X','sig',47082,'INR','captured','pro',now()),
      ('px_open','ux','order_X_open',NULL,NULL,47082,'INR','created','pro',now())`);
    const [res] = await rows(db, `SELECT * FROM delete_user_data('ux')`);
    expect(res.deleted_user).toBe(true);
    expect(res.workflows).toBe(1);
    for (const t of ['WorkflowVersion', 'WorkflowRun', 'WorkflowShare']) {
      expect(await rows(db, `SELECT 1 FROM "${t}" WHERE user_id = 'ux'`), t).toEqual([]);
    }
    expect(await rows(db, `SELECT id, user_id FROM "PaymentRecord" WHERE id LIKE 'px_%' ORDER BY id`)).toEqual([{ id: 'px_paid', user_id: null }]);
    // another account's data is untouched
    expect((await rows(db, `SELECT count(*)::int n FROM "WorkflowRun" WHERE user_id = 'ua'`))[0].n).toBeGreaterThan(0);
  });

  it('a plain DELETE of the account (no function) cascades too', async () => {
    await db.query(`INSERT INTO "User"(id,email,password_hash,name,updated_at) VALUES ('uy','y@x.test','x','y',now())`);
    await newWorkflow(db, 'wf_y', 'uy');
    await db.query(`INSERT INTO "WorkflowVersion"(id,workflow_id,user_id,version,title,nodes,edges) VALUES ('vy1','wf_y','uy',1,'t','[]','[]')`);
    await db.query(`INSERT INTO "WorkflowShare"(token,workflow_id,user_id) VALUES ('${TOKEN('y')}','wf_y','uy')`);
    await run(db, 'ry1', 'uy', 'wf_y');
    await db.query(`DELETE FROM "User" WHERE id = 'uy'`);
    for (const t of ['WorkflowVersion', 'WorkflowRun', 'WorkflowShare']) {
      expect(await rows(db, `SELECT 1 FROM "${t}" WHERE user_id = 'uy'`), t).toEqual([]);
    }
  });

  it('versions: numbered 1, 2, 3...; the newest 20 are kept; list and open work', async () => {
    await newWorkflow(db, 'wf_v', 'ua');
    for (let i = 1; i <= 25; i++) {
      const [r] = await rows(db, Q.version_insert, [`wv${i}`, 'wf_v', 'ua', `title ${i}`, `[${i}]`, '[]', i]);
      expect(r.version).toBe(i);
      await db.query(Q.versions_prune, ['wf_v', 'ua']);
    }
    const list = await rows(db, Q.versions_list, ['wf_v', 'ua']);
    expect(list.map((r: any) => r.version)).toEqual(Array.from({ length: 20 }, (_, i) => 25 - i));
    expect(Object.keys(list[0]).sort()).toEqual(['created_at', 'node_count', 'title', 'version']);
    expect(await rows(db, Q.versions_list, ['wf_v', 'ub'])).toEqual([]); // not the owner: nothing
    const [one] = await rows(db, Q.version_one, ['wf_v', 'ua', 24]);
    expect(one.nodes).toBe('[24]');
    expect(await rows(db, Q.version_one, ['wf_v', 'ua', 3])).toEqual([]); // pruned
    expect(await rows(db, Q.version_one, ['wf_v', 'ub', 24])).toEqual([]);
    // the same number twice (two saves at the same instant) is refused, so the API can retry
    expect(await errorOf(db, `INSERT INTO "WorkflowVersion"(id,workflow_id,user_id,version,title,nodes,edges) VALUES ('wv_race','wf_v','ua',25,'t','[]','[]')`)).toMatch(/duplicate key/);
    const [retry] = await rows(db, Q.version_insert, ['wv_race', 'wf_v', 'ua', 't', '[]', '[]', 0]);
    expect(retry.version).toBe(26);
  });

  it('runs: insert, 90-day purge, and the daily cap of 2,000 records', async () => {
    await db.query(`INSERT INTO "User"(id,email,password_hash,name,updated_at) VALUES ('ucap','cap@x.test','x','c',now())`);
    await db.query(Q.run_insert, ['ri1', 'ucap', null, 'partial', 3, 1, 1500, 1, ['prompt', 'output']]);
    expect((await rows(db, `SELECT node_types FROM "WorkflowRun" WHERE id = 'ri1'`))[0].node_types).toEqual(['prompt', 'output']);
    await run(db, 'old1', 'ucap', null, `now() - interval '91 days'`);
    await run(db, 'old2', 'ucap', null, `now() - interval '89 days'`);
    await db.query(Q.runs_purge);
    expect((await rows(db, `SELECT id FROM "WorkflowRun" WHERE user_id = 'ucap' ORDER BY id`)).map((r: any) => r.id)).toEqual(['old2', 'ri1']);

    await db.query(`INSERT INTO "WorkflowRun"(id,user_id,status,node_count,ai_calls,duration_ms)
      SELECT 'cap'||g,'ucap','success',1,0,1 FROM generate_series(1,1998) g`); // + ri1 = 1,999 in the last 24 h
    expect(await errorOf(db, Q.run_insert, ['cap_2000', 'ucap', null, 'success', 1, 0, 1, 0, []])).toBeNull();
    expect(await errorOf(db, Q.run_insert, ['cap_2001', 'ucap', null, 'success', 1, 0, 1, 0, []])).toMatch(/DAILY_RUN_LIMIT/);
    expect(await errorOf(db, Q.run_insert, ['other_user', 'ub', null, 'success', 1, 0, 1, 0, []])).toBeNull(); // per account
    await db.query(`DELETE FROM "WorkflowRun" WHERE user_id = 'ucap'`);
  });

  it('stats: today and the streak are counted in India time, right around midnight IST', async () => {
    await db.query(`INSERT INTO "User"(id,email,password_hash,name,updated_at) VALUES ('ust','st@x.test','x','s',now())`);
    // 2026-11-10 23:59 IST = 18:29 UTC; 2026-11-11 00:01 IST = 18:31 UTC (the same UTC day!)
    await run(db, 's1', 'ust', null, `'2026-11-10 18:29:00+00'`, 'success', '{prompt,output}');
    await run(db, 's2', 'ust', null, `'2026-11-10 18:31:00+00'`, 'error', '{switch,prompt}');
    const stats = async (now: string) => (await rows(db, Q.run_stats, ['ust', now]))[0];

    let s = await stats('2026-11-11 10:00:00+05:30');
    expect(s.runs_today).toBe(1); // only the 00:01 IST run is "today"
    expect(s.streak_days).toBe(2); // 10 and 11 November (in UTC both are the 10th: that would give 1)
    expect(s.total_runs).toBe(2);
    expect(s.success_runs).toBe(1);
    expect(s.node_types_used).toEqual(['output', 'prompt', 'switch']);
    expect(new Date(s.first_run_at).toISOString()).toBe('2026-11-10T18:29:00.000Z');

    s = await stats('2026-11-11 23:59:59+05:30');
    expect([s.runs_today, s.streak_days]).toEqual([1, 2]);
    s = await stats('2026-11-12 00:00:01+05:30'); // just after midnight IST, no run yet today: streak still alive
    expect([s.runs_today, s.streak_days]).toEqual([0, 2]);
    s = await stats('2026-11-13 00:00:01+05:30'); // a whole day (12 Nov) missed: streak broken
    expect([s.runs_today, s.streak_days]).toEqual([0, 0]);

    // a gap: 10, 11, (12 missed), 13, 14 -> on the 14th the streak is 2, not 4
    await run(db, 's3', 'ust', null, `'2026-11-13 12:00:00+05:30'`);
    await run(db, 's4', 'ust', null, `'2026-11-14 08:00:00+05:30'`);
    await run(db, 's5', 'ust', null, `'2026-11-14 09:00:00+05:30'`);
    s = await stats('2026-11-14 20:00:00+05:30');
    expect([s.runs_today, s.streak_days, s.total_runs]).toEqual([2, 2, 5]);

    // an account with no runs
    const [empty] = await rows(db, Q.run_stats, ['ub_no_runs', null]);
    expect(empty).toMatchObject({ total_runs: 0, success_runs: 0, runs_today: 0, streak_days: 0, node_types_used: [], first_run_at: null });
  });

  it('share links: one active link per workflow, open counts a view, revoke turns it off', async () => {
    await newWorkflow(db, 'wf_s', 'ua');
    const [first] = await rows(db, Q.share_create, [TOKEN('s'), 'wf_s', 'ua']);
    expect(first.token).toBe(TOKEN('s'));
    const [again] = await rows(db, Q.share_create, [TOKEN('t'), 'wf_s', 'ua']); // second click: the same link
    expect(again.token).toBe(TOKEN('s'));
    expect(await errorOf(db, Q.share_create, [TOKEN('u'), 'wf_s', 'ub'])).toMatch(/WORKFLOW_NOT_OWNED/); // not the owner
    expect((await rows(db, `SELECT count(*)::int n FROM "WorkflowShare" WHERE workflow_id = 'wf_s'`))[0].n).toBe(1);

    const [open] = await rows(db, Q.shared_open, [TOKEN('s')]);
    expect(open).toMatchObject({ title: 'wf', nodes: '[]', edges: '[]' });
    await rows(db, Q.shared_open, [TOKEN('s')]);
    expect((await rows(db, `SELECT view_count FROM "WorkflowShare" WHERE token = $1`, [TOKEN('s')]))[0].view_count).toBe(2);
    expect(await rows(db, Q.shared_open, [TOKEN('z')])).toEqual([]); // unknown link

    expect(await rows(db, Q.share_revoke, ['wf_s', 'ub'])).toEqual([]); // not the owner: nothing happens
    expect(await rows(db, Q.share_revoke, ['wf_s', 'ua'])).toEqual([{ token: TOKEN('s') }]);
    expect(await rows(db, Q.shared_open, [TOKEN('s')])).toEqual([]); // revoked: same answer as unknown
    const [fresh] = await rows(db, Q.share_create, [TOKEN('v'), 'wf_s', 'ua']);
    expect(fresh.token).toBe(TOKEN('v'));
  });

  it('the lookups use the new indexes (with sequential scans discouraged, as on a big table)', async () => {
    const plan = async (q: string) => {
      await db.query('SET enable_seqscan = off');
      try {
        return (await rows(db, `EXPLAIN ${q}`)).map((r: any) => r['QUERY PLAN']).join('\n');
      } finally {
        await db.query('RESET enable_seqscan');
      }
    };
    const cases: [string, RegExp][] = [
      [`SELECT COALESCE(MAX(version), 0) + 1 FROM "WorkflowVersion" WHERE workflow_id = 'wf_v'`, /WorkflowVersion_workflow_id_version_key/],
      [`SELECT version FROM "WorkflowVersion" WHERE workflow_id = 'wf_v' ORDER BY version DESC LIMIT 20`, /WorkflowVersion_workflow_id_version_key/],
      [`SELECT 1 FROM "WorkflowVersion" WHERE user_id = 'ua'`, /WorkflowVersion_user_id_idx/],
      [`SELECT 1 FROM "WorkflowRun" WHERE user_id = 'ua' AND created_at > now() - interval '24 hours'`, /WorkflowRun_user_id_created_at_idx/],
      [`SELECT 1 FROM "WorkflowRun" WHERE workflow_id = 'wf_v'`, /WorkflowRun_workflow_id_idx/],
      [`SELECT 1 FROM "WorkflowShare" WHERE token = 'abc'`, /WorkflowShare_pkey/],
      [`SELECT 1 FROM "WorkflowShare" WHERE workflow_id = 'wf_s' AND revoked_at IS NULL`, /WorkflowShare_(one_active|workflow_id)_idx/],
      [`SELECT 1 FROM "WorkflowShare" WHERE user_id = 'ua'`, /WorkflowShare_user_id_idx/],
    ];
    for (const [q, idx] of cases) expect(await plan(q), q).toMatch(idx);
  });
});

describe.skipIf(!PGlite)('0021 rights for the app role (db/roles.sql)', () => {
  let db: any;
  const rolesSql = readDbFile('roles.sql');

  beforeAll(async () => {
    db = new PGlite();
    await migrateUp(db, new Set<string>());
    await db.query(`CREATE TABLE schema_migrations(name text primary key)`);
    await seedUsers(db);
    await db.query('CREATE ROLE bedrock_app');
  });

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

  it('roles.sql passes all its checks, including the three new ones', async () => {
    const checks = await runSql(db, rolesSql);
    expect(checks.filter((c: any) => !c.ok).map((c: any) => c.item)).toEqual([]);
    expect(checks.filter((c: any) => /^Workflow/.test(c.item))).toHaveLength(3);
  });

  it('every Branching v2 query works as bedrock_app; editing or deleting what must not change is refused', async () => {
    await newWorkflow(db, 'wf_app', 'ua');
    await asApp(async () => {
      const ok = async (q: string, p: unknown[] = []) => expect(await errorOf(db, q, p), q).toBeNull();
      await ok(Q.version_insert, ['av1', 'wf_app', 'ua', 't', '[]', '[]', 0]);
      await ok(Q.versions_prune, ['wf_app', 'ua']);
      await ok(Q.versions_list, ['wf_app', 'ua']);
      await ok(Q.version_one, ['wf_app', 'ua', 1]);
      await ok(Q.run_insert, ['ar1', 'ua', 'wf_app', 'success', 1, 1, 10, 0, ['prompt']]);
      await ok(Q.run_stats, ['ua', null]);
      await ok(Q.runs_purge);
      await ok(Q.share_create, [TOKEN('p'), 'wf_app', 'ua']);
      await ok(Q.shared_open, [TOKEN('p')]);
      await ok(Q.share_revoke, ['wf_app', 'ua']);
      await ok(`SELECT * FROM delete_user_data('nobody')`);

      const refused = async (q: string) => expect(await errorOf(db, q), q).toMatch(/permission denied|must be owner/);
      await refused(`UPDATE "WorkflowVersion" SET nodes = '[1]' WHERE id = 'av1'`);
      await refused(`UPDATE "WorkflowRun" SET status = 'error' WHERE id = 'ar1'`);
      await refused(`UPDATE "WorkflowShare" SET workflow_id = 'other' WHERE token = '${TOKEN('p')}'`);
      await refused(`UPDATE "WorkflowShare" SET token = '${TOKEN('q')}' WHERE token = '${TOKEN('p')}'`);
      await refused(`DELETE FROM "WorkflowShare" WHERE token = '${TOKEN('p')}'`);
      await refused(`TRUNCATE "WorkflowRun"`);
      await refused(`DROP TABLE "WorkflowVersion"`);
      await refused(`DROP TRIGGER "WorkflowShare_owner_check" ON "WorkflowShare"`);
    });
  });

  it('account deletion through the app still works with Branching v2 data present', async () => {
    await db.query(`INSERT INTO "User"(id,email,password_hash,name,updated_at) VALUES ('uapp','app@x.test','x','a',now())`);
    await newWorkflow(db, 'wf_uapp', 'uapp');
    await asApp(async () => {
      await db.query(Q.version_insert, ['uv1', 'wf_uapp', 'uapp', 't', '[]', '[]', 0]);
      await db.query(Q.run_insert, ['ur1', 'uapp', 'wf_uapp', 'success', 1, 0, 1, 0, []]);
      await db.query(Q.share_create, [TOKEN('w'), 'wf_uapp', 'uapp']);
      const [r] = await rows(db, `SELECT * FROM delete_user_data('uapp')`);
      expect(r.deleted_user).toBe(true);
    });
    for (const t of ['WorkflowVersion', 'WorkflowRun', 'WorkflowShare']) {
      expect(await rows(db, `SELECT 1 FROM "${t}" WHERE user_id = 'uapp'`), t).toEqual([]);
    }
  });

  it('roles.sql still runs cleanly on a database WITHOUT 0021 (no half-applied rights)', async () => {
    const d = new PGlite();
    await migrateUp(d, new Set<string>(), '0020');
    await d.query(`CREATE TABLE schema_migrations(name text primary key)`);
    await d.query('CREATE ROLE bedrock_app');
    const checks = await runSql(d, rolesSql);
    expect(checks.filter((c: any) => !c.ok).map((c: any) => c.item)).toEqual([]);
    await d.close();
  });
});

describe.skipIf(!PGlite)('0021 and the dev-copy anonymizer', () => {
  it('empties version contents, deletes share links (they open production), keeps run records', async () => {
    const db = new PGlite();
    await migrateUp(db, new Set<string>());
    await seedUsers(db);
    await newWorkflow(db, 'wf_an', 'ua');
    await db.query(`INSERT INTO "WorkflowVersion"(id,workflow_id,user_id,version,title,nodes,edges) VALUES ('an1','wf_an','ua',1,'secret title','[{"prompt":"private"}]','[1]')`);
    await db.query(`INSERT INTO "WorkflowShare"(token,workflow_id,user_id) VALUES ('${TOKEN('k')}','wf_an','ua')`);
    await run(db, 'anr1', 'ua', 'wf_an');
    const sql = neonLike(db);
    await markDev(sql);
    expect(await anonymize(sql)).toEqual({ users: 2, real_emails: 0 });
    const [v] = await rows(db, `SELECT title, nodes, edges FROM "WorkflowVersion" WHERE id = 'an1'`);
    expect(v.title).toMatch(/^Test workflow /);
    expect([v.nodes, v.edges]).toEqual(['[]', '[]']);
    expect(await rows(db, `SELECT 1 FROM "WorkflowShare"`)).toEqual([]);
    expect(await rows(db, `SELECT id FROM "WorkflowRun"`)).toEqual([{ id: 'anr1' }]);
    await db.close();
  });
});
