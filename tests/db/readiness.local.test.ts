// In-memory Postgres (PGlite) tests for the read-only readiness report (db/lib/readiness.mjs, db/readiness.mjs).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadPglite, MIGRATIONS_DIR, neonLike, readDbFile, rows, runSql } from './helper';
// @ts-ignore plain .mjs without types
import * as migrator from '../../db/lib/migrator.mjs';
// @ts-ignore plain .mjs without types
import { collectReadiness, FEATURES } from '../../db/lib/readiness.mjs';

const PGlite = await loadPglite();
const quiet = () => {};

describe.skipIf(!PGlite)('readiness report', () => {
  it('an empty database: every feature is OFF, one clear problem, nothing is created', async () => {
    const db = new PGlite();
    const r = await collectReadiness(neonLike(db), { dir: MIGRATIONS_DIR });
    expect(r.features.every((f: any) => f.on === false)).toBe(true);
    expect(r.features).toHaveLength(FEATURES.length);
    expect(r.problems.join(' ')).toMatch(/\d+ migration\(s\) not applied/);
    expect((await rows(db, `SELECT to_regclass('public.schema_migrations') t`))[0].t).toBeNull(); // read only
    await db.close();
  }, 120_000);

  describe('a fully migrated database', () => {
    let db: any;
    beforeAll(async () => {
      db = new PGlite();
      await migrator.migrateUp(neonLike(db), { dir: MIGRATIONS_DIR, log: quiet });
    }, 180_000);
    afterAll(async () => {
      await db?.close();
    });

    it('every feature is ON and there are no problems; the missing app role is only a note', async () => {
      const r = await collectReadiness(neonLike(db), { dir: MIGRATIONS_DIR });
      expect(r.features.filter((f: any) => !f.on)).toEqual([]);
      expect(r.problems).toEqual([]);
      expect(r.role.appRoleExists).toBe(false);
      expect(r.notes.join(' ')).toMatch(/bedrock_app does not exist/);
    });

    it('every migration number in the feature list matches a real migration file', async () => {
      const r = await collectReadiness(neonLike(db), { dir: MIGRATIONS_DIR });
      const numbers = new Set(r.migrations.map((m: any) => m.name.slice(0, 4)));
      for (const f of FEATURES) expect(numbers.has(f[0]), f[0]).toBe(true);
    });

    it('with the app role set up by db/roles.sql there are still no problems', async () => {
      await db.query('CREATE ROLE bedrock_app');
      await runSql(db, readDbFile('roles.sql'));
      const r = await collectReadiness(neonLike(db), { dir: MIGRATIONS_DIR });
      expect(r.role.appRoleExists).toBe(true);
      expect(r.problems).toEqual([]);
    });

    it('catches rights that are too wide or missing', async () => {
      await db.query(`GRANT SELECT ON "User" TO bedrock_app`);
      await db.query(`GRANT DELETE ON "User" TO bedrock_app`);
      await db.query(`GRANT UPDATE ON "Trace" TO bedrock_app`);
      await db.query(`REVOKE EXECUTE ON FUNCTION reserve_quota(text,text,text,text,text,integer,interval) FROM bedrock_app`);
      await db.query(`REVOKE EXECUTE ON FUNCTION delete_user_data(text) FROM bedrock_app`);
      const text = (await collectReadiness(neonLike(db), { dir: MIGRATIONS_DIR })).problems.join(' | ');
      expect(text).toMatch(/can read password_hash/);
      expect(text).toMatch(/delete accounts directly/);
      expect(text).toMatch(/edit usage records/);
      expect(text).toMatch(/cannot run reserve_quota/);
      expect(text).toMatch(/cannot run delete_user_data/);
      await runSql(db, readDbFile('roles.sql')); // the script puts everything right again
      expect((await collectReadiness(neonLike(db), { dir: MIGRATIONS_DIR })).problems).toEqual([]);
    });

    it('catches the launch-day mistake: 0020 / 0021 applied but roles.sql not re-run', async () => {
      await db.query(`REVOKE ALL ON "WorkflowVersion", "WorkflowRun", "WorkflowShare" FROM bedrock_app`);
      await db.query(`REVOKE UPDATE (plan_expires_at) ON "User" FROM bedrock_app`);
      const text = (await collectReadiness(neonLike(db), { dir: MIGRATIONS_DIR })).problems.join(' | ');
      expect(text).toMatch(/no rights on the Branching v2 tables/);
      expect(text).toMatch(/cannot set plan_expires_at/);
      await runSql(db, readDbFile('roles.sql'));
      expect((await collectReadiness(neonLike(db), { dir: MIGRATIONS_DIR })).problems).toEqual([]);
    });

    it('catches a too-powerful app role', async () => {
      await db.query('ALTER ROLE bedrock_app CREATEDB');
      expect((await collectReadiness(neonLike(db), { dir: MIGRATIONS_DIR })).problems.join(' ')).toMatch(/bedrock_app is too powerful/);
      await db.query('ALTER ROLE bedrock_app NOCREATEDB');
    });

    it('catches a migration file that was edited after it was applied, and an interrupted index build', async () => {
      await db.query(`UPDATE schema_migrations SET checksum = 'deadbeef' WHERE name LIKE '0005_%'`);
      await db.query(`UPDATE pg_index SET indisvalid = false WHERE indexrelid = '"Prompt_user_updated_id_idx"'::regclass`);
      const r = await collectReadiness(neonLike(db), { dir: MIGRATIONS_DIR });
      const text = r.problems.join(' | ');
      expect(text).toMatch(/edited after they were applied: 0005/);
      expect(text).toMatch(/INVALID index\(es\): Prompt_user_updated_id_idx/);
    });

    it('reports a growing backlog of old log rows as a problem (the cleanup is behind)', async () => {
      await db.query(`UPDATE pg_index SET indisvalid = true WHERE indexrelid = '"Prompt_user_updated_id_idx"'::regclass`);
      await db.query(`UPDATE schema_migrations SET checksum = NULL`);
      await db.query(`INSERT INTO "SecurityLog"(id,event_type,message,created_at) VALUES ('old1','X','m',(now() AT TIME ZONE 'UTC') - interval '120 days')`);
      const r = await collectReadiness(neonLike(db), { dir: MIGRATIONS_DIR });
      expect(r.problems.join(' ')).toMatch(/cleanup is behind/);
    });
  });
});
