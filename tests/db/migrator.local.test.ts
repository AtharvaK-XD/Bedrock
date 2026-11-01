// In-memory Postgres (PGlite) tests for the migration tool (db/lib/migrator.mjs), driven through a small stand-in for
// the Neon driver (query + transaction), so the exact code that runs against Neon is the code under test.
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPglite, MIGRATIONS_DIR, neonLike } from './helper';
// @ts-ignore plain .mjs without types
import * as migrator from '../../db/lib/migrator.mjs';

const PGlite = await loadPglite();
const quiet = () => {};
/** A folder with the first N real migrations (copied), so edits never touch the repo. */
function tempMigrations(count: number) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'bedrock-mig-'));
  const ups = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.up.sql')).sort().slice(0, count);
  for (const up of ups) {
    copyFileSync(path.join(MIGRATIONS_DIR, up), path.join(dir, up));
    const down = up.replace('.up.sql', '.down.sql');
    copyFileSync(path.join(MIGRATIONS_DIR, down), path.join(dir, down));
  }
  return dir;
}

describe.skipIf(!PGlite)('migration tool on in-memory Postgres', () => {
  it('status is read only: it creates nothing and lists everything as PENDING', async () => {
    const db = new PGlite();
    const dir = tempMigrations(4);
    const rows = await migrator.status(neonLike(db), { dir });
    expect(rows.map((r: any) => r.state)).toEqual(['PENDING', 'PENDING', 'PENDING', 'PENDING']);
    expect((await db.query(`SELECT to_regclass('public.schema_migrations') t`)).rows[0].t).toBeNull();
    await db.close();
  });

  it('up applies in order, records a checksum for each, and a second run does nothing', async () => {
    const db = new PGlite();
    const dir = tempMigrations(4);
    const log: string[] = [];
    await migrator.migrateUp(neonLike(db), { dir, log: (m: string) => log.push(m) });
    expect(log.filter((m) => m.startsWith('applying'))).toHaveLength(4);
    const applied = (await db.query(`SELECT name, checksum FROM schema_migrations ORDER BY name`)).rows;
    expect(applied).toHaveLength(4);
    expect(applied.every((r: any) => /^[0-9a-f]{64}$/.test(r.checksum))).toBe(true);
    const again: string[] = [];
    await migrator.migrateUp(neonLike(db), { dir, log: (m: string) => again.push(m) });
    expect(again.filter((m) => m.startsWith('applying'))).toHaveLength(0);
    expect((await migrator.status(neonLike(db), { dir })).every((r: any) => r.state === 'applied')).toBe(true);
    // the lock is released after every run
    expect((await db.query(`SELECT count(*)::int c FROM schema_migrations_lock`)).rows[0].c).toBe(0);
    await db.close();
  }, 60_000);

  it('--to stops at the given migration', async () => {
    const db = new PGlite();
    const dir = tempMigrations(4);
    await migrator.migrateUp(neonLike(db), { dir, upTo: '0002', log: quiet });
    expect((await db.query(`SELECT name FROM schema_migrations ORDER BY name`)).rows.map((r: any) => r.name.slice(0, 4))).toEqual(['0001', '0002']);
    await db.close();
  }, 60_000);

  it('a migration file edited after it was applied is reported CHANGED and up refuses to continue', async () => {
    const db = new PGlite();
    const dir = tempMigrations(3);
    await migrator.migrateUp(neonLike(db), { dir, log: quiet });
    const file = path.join(dir, readdirSync(dir).filter((f) => f.endsWith('.up.sql')).sort()[1]);
    writeFileSync(file, readFileSync(file, 'utf8') + '\n-- sneaky edit\n');
    const rows = await migrator.status(neonLike(db), { dir });
    expect(rows.map((r: any) => r.state)).toEqual(['applied', 'CHANGED after it was applied', 'applied']);
    await expect(migrator.migrateUp(neonLike(db), { dir, log: quiet })).rejects.toThrow(/edited after it was applied/);
    expect((await db.query(`SELECT count(*)::int c FROM schema_migrations_lock`)).rows[0].c).toBe(0); // lock released on error
    await db.close();
  }, 60_000);

  it('line endings do not matter for the checksum (Windows vs Linux checkout)', () => {
    expect(migrator.checksum('a\r\nb\r\n')).toBe(migrator.checksum('a\nb\n'));
  });

  it('a database from before checksums existed gets them filled in, without re-running anything', async () => {
    const db = new PGlite();
    const dir = tempMigrations(2);
    await migrator.migrateUp(neonLike(db), { dir, log: quiet });
    await db.query('UPDATE schema_migrations SET checksum = NULL');
    expect((await migrator.status(neonLike(db), { dir })).map((r: any) => r.state)).toEqual(['applied (no checksum yet)', 'applied (no checksum yet)']);
    const log: string[] = [];
    await migrator.migrateUp(neonLike(db), { dir, log: (m: string) => log.push(m) });
    expect(log.filter((m) => m.startsWith('recorded checksum'))).toHaveLength(2);
    expect(log.filter((m) => m.startsWith('applying'))).toHaveLength(0);
    await db.close();
  }, 60_000);

  it('only one run at a time: a fresh lock stops a second run; a stale one (older than 30 minutes) is taken over', async () => {
    const db = new PGlite();
    const dir = tempMigrations(2);
    await migrator.ensureTables(neonLike(db));
    await db.query(`INSERT INTO schema_migrations_lock(id, locked_at, holder) VALUES (1, now(), 'other run')`);
    await expect(migrator.migrateUp(neonLike(db), { dir, log: quiet })).rejects.toThrow(/Another migration run holds the lock/);
    expect((await db.query(`SELECT count(*)::int c FROM schema_migrations`)).rows[0].c).toBe(0);
    await db.query(`UPDATE schema_migrations_lock SET locked_at = now() - interval '31 minutes'`);
    await migrator.migrateUp(neonLike(db), { dir, log: quiet });
    expect((await db.query(`SELECT count(*)::int c FROM schema_migrations`)).rows[0].c).toBe(2);
    await db.close();
  }, 60_000);

  it('normal statements run in a transaction with a 5 s lock limit; CREATE INDEX CONCURRENTLY runs outside one', async () => {
    const db = new PGlite();
    const dir = tempMigrations(2); // 0002 has the CONCURRENTLY indexes
    const spy = { inTx: [] as string[], plain: [] as string[] };
    await migrator.migrateUp(neonLike(db, spy), { dir, log: quiet });
    expect(spy.inTx.filter((t) => t.startsWith('SET LOCAL lock_timeout')).length).toBeGreaterThan(5);
    expect(spy.inTx.every((t) => !/CONCURRENTLY/i.test(t))).toBe(true);
    expect(spy.plain.filter((t) => /CREATE INDEX CONCURRENTLY/i.test(t)).length).toBeGreaterThanOrEqual(5);
    await db.close();
  }, 60_000);

  it('a lock timeout is retried, then succeeds; after 5 tries it stops with a clear message and applies nothing', async () => {
    const db = new PGlite();
    const dir = tempMigrations(1);
    let fails = 2;
    const flaky = neonLike(db, { inTx: [], plain: [], txFail: () => (fails-- > 0 ? Object.assign(new Error('canceling statement due to lock timeout'), { code: '55P03' }) : null) });
    const waits: number[] = [];
    const log: string[] = [];
    await migrator.migrateUp(flaky, { dir, log: (m: string) => log.push(m), wait: async (ms: number) => { waits.push(ms); } });
    expect(waits).toEqual([2000, 4000]);
    expect(log.some((m) => /waiting for a lock/.test(m))).toBe(true);
    expect((await db.query(`SELECT count(*)::int c FROM schema_migrations`)).rows[0].c).toBe(1);

    const db2 = new PGlite();
    const stuck = neonLike(db2, { inTx: [], plain: [], txFail: () => Object.assign(new Error('canceling statement due to lock timeout'), { code: '55P03' }) });
    await expect(migrator.migrateUp(stuck, { dir, log: quiet, wait: async () => {} })).rejects.toThrow(/Gave up after 5 tries/);
    expect((await db2.query(`SELECT count(*)::int c FROM schema_migrations`)).rows[0].c).toBe(0);
    await db.close();
    await db2.close();
  }, 60_000);

  it('other errors are not retried', async () => {
    const db = new PGlite();
    const dir = tempMigrations(1);
    let calls = 0;
    const broken = neonLike(db, { inTx: [], plain: [], txFail: () => { calls++; return Object.assign(new Error('syntax error'), { code: '42601' }); } });
    await expect(migrator.migrateUp(broken, { dir, log: quiet, wait: async () => {} })).rejects.toThrow(/syntax error/);
    expect(calls).toBe(1);
    await db.close();
  }, 60_000);

  it('down --all undoes everything newest first and clears the records', async () => {
    const db = new PGlite();
    const dir = tempMigrations(4);
    await migrator.migrateUp(neonLike(db), { dir, log: quiet });
    const log: string[] = [];
    await migrator.migrateDown(neonLike(db), { dir, all: true, log: (m: string) => log.push(m) });
    expect(log.filter((m) => m.startsWith('reverting')).map((m) => m.slice(10, 14))).toEqual(['0004', '0003', '0002', '0001']);
    expect((await db.query(`SELECT count(*)::int c FROM schema_migrations`)).rows[0].c).toBe(0);
    await db.close();
  }, 60_000);
});
