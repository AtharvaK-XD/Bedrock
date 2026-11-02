// Migration logic used by db/migrate.mjs (command line) and tests/db/migrator.local.test.ts (in-memory Postgres).
// `sql` is anything shaped like the Neon driver: sql.query(text, params) -> rows, and
// sql.transaction((tx) => [tx.query(text, params), ...]) -> array of row arrays, all in one transaction.
//
// Safety for a live site (the Neon HTTP driver gives every call its own session, so session settings and advisory
// locks do not survive between calls; everything below is built around that):
//  * Every normal statement runs in its own transaction with `SET LOCAL lock_timeout = '5s'`: if a slow user query
//    holds a lock, the migration gives up after 5 s (retrying a few times) instead of making every request queue
//    behind it. Statements are idempotent (IF NOT EXISTS / DO blocks), so a retry is safe.
//  * CREATE INDEX CONCURRENTLY cannot run inside a transaction, so those statements run on their own (they never
//    block normal reads and writes).
//  * One run at a time: a row in "schema_migrations_lock" (expires after 30 minutes if a run crashed).
//  * Each applied migration stores a checksum of its .up.sql; a file edited after it was applied is reported as
//    CHANGED and `up` refuses to continue (never edit an applied migration; add a new one).
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export const BREAK = /^\s*-- migrate:break\s*$/m;
export const LOCK_TIMEOUT = '5s';
export const LOCK_RETRIES = 5;
export const LOCK_STALE_MINUTES = 30;

export const splitStatements = (text) =>
  text.split(BREAK).map((s) => s.trim()).filter((s) => s && !/^(--[^\n]*\n?)+$/.test(s));

/** Line endings are normalised so a Windows checkout and a Linux checkout give the same checksum. */
export const checksum = (text) => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');

const nameOf = (file) => file.replace(/\.(up|down)\.sql$/, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function listMigrations(dir) {
  return (await readdir(dir)).filter((f) => f.endsWith('.up.sql')).sort().map(nameOf);
}

/** Read-only: which migrations are applied (with their stored checksum). Creates nothing. */
export async function readState(sql) {
  const [t] = await sql.query(`SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists`);
  if (!t.exists) return { exists: false, applied: new Map() };
  const [c] = await sql.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schema_migrations' AND column_name = 'checksum') AS has`);
  const list = c.has
    ? await sql.query('SELECT name, checksum FROM schema_migrations')
    : (await sql.query('SELECT name FROM schema_migrations')).map((r) => ({ ...r, checksum: null }));
  return { exists: true, applied: new Map(list.map((r) => [r.name, r.checksum])) };
}

/** Table rows for `status`: applied / PENDING / CHANGED after apply / applied (no checksum yet). */
export async function status(sql, { dir }) {
  const state = await readState(sql);
  const out = [];
  for (const name of await listMigrations(dir)) {
    if (!state.applied.has(name)) { out.push({ name, state: 'PENDING' }); continue; }
    const stored = state.applied.get(name);
    if (!stored) { out.push({ name, state: 'applied (no checksum yet)' }); continue; }
    const now = checksum(await readFile(path.join(dir, `${name}.up.sql`), 'utf8'));
    out.push({ name, state: stored === now ? 'applied' : 'CHANGED after it was applied' });
  }
  return out;
}

export async function ensureTables(sql) {
  await sql.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  await sql.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum TEXT');
  await sql.query(`CREATE TABLE IF NOT EXISTS schema_migrations_lock (
    id INTEGER PRIMARY KEY CHECK (id = 1), locked_at TIMESTAMPTZ NOT NULL, holder TEXT NOT NULL)`);
}

export async function acquireLock(sql, holder) {
  const got = await sql.query(
    `INSERT INTO schema_migrations_lock (id, locked_at, holder) VALUES (1, now(), $1)
     ON CONFLICT (id) DO UPDATE SET locked_at = now(), holder = $1
       WHERE schema_migrations_lock.locked_at < now() - make_interval(mins => $2)
     RETURNING id`, [holder, LOCK_STALE_MINUTES]);
  if (got.length === 0) {
    throw new Error(`Another migration run holds the lock (it expires after ${LOCK_STALE_MINUTES} minutes). `
      + `If you are sure no run is active, delete it: DELETE FROM schema_migrations_lock; Nothing was changed.`);
  }
}
export const releaseLock = (sql) => sql.query('DELETE FROM schema_migrations_lock WHERE id = 1');

const isLockTimeout = (e) => e && (e.code === '55P03' || /lock timeout/i.test(String(e.message)));

/** Runs one statement; returns the rows of that statement. */
export async function runStatement(sql, stmt, { log = () => {}, wait = sleep } = {}) {
  if (/\bCONCURRENTLY\b/i.test(stmt)) return sql.query(stmt);
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await sql.transaction((tx) => [tx.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`), tx.query(stmt)]);
      return res[1];
    } catch (e) {
      if (!isLockTimeout(e) || attempt >= LOCK_RETRIES) {
        if (isLockTimeout(e)) throw new Error(`Gave up after ${LOCK_RETRIES} tries: a lock held by another query never cleared (lock_timeout ${LOCK_TIMEOUT}). Nothing from this statement was applied; run it again later.`);
        throw e;
      }
      log(`  waiting for a lock (try ${attempt}/${LOCK_RETRIES}), retrying in ${attempt * 2}s ...`);
      await wait(attempt * 2000);
    }
  }
}

/** Runs every statement of a SQL text; returns the rows of the last one. */
export async function runText(sql, text, opts) {
  let rows = [];
  for (const stmt of splitStatements(text)) rows = await runStatement(sql, stmt, opts);
  return rows;
}

export async function migrateUp(sql, { dir, upTo = null, log = console.log, holder = 'migrate.mjs', wait } = {}) {
  await ensureTables(sql);
  await acquireLock(sql, holder);
  try {
    const state = await readState(sql);
    const names = await listMigrations(dir);
    // 1. refuse if an applied migration was edited; fill in missing checksums from the current files
    for (const name of names) {
      if (!state.applied.has(name)) continue;
      const now = checksum(await readFile(path.join(dir, `${name}.up.sql`), 'utf8'));
      const stored = state.applied.get(name);
      if (!stored) {
        await sql.query('UPDATE schema_migrations SET checksum = $1 WHERE name = $2', [now, name]);
        log(`recorded checksum for ${name}`);
      } else if (stored !== now) {
        throw new Error(`${name} was edited after it was applied (checksum differs). Never edit an applied migration: put the change in a new migration. Nothing was changed.`);
      }
    }
    // 2. apply the pending ones in order
    const pending = names.filter((n) => !state.applied.has(n) && (!upTo || n.slice(0, 4) <= upTo));
    for (const name of pending) {
      log(`applying ${name} ...`);
      const text = await readFile(path.join(dir, `${name}.up.sql`), 'utf8');
      await runText(sql, text, { log, wait });
      await sql.query('INSERT INTO schema_migrations(name, checksum) VALUES ($1, $2)', [name, checksum(text)]);
    }
    log('done');
    if (pending.length) await remindRoles(sql, log);
  } finally {
    await releaseLock(sql);
  }
}

export async function migrateDown(sql, { dir, all = false, log = console.log, holder = 'migrate.mjs', wait } = {}) {
  await ensureTables(sql);
  await acquireLock(sql, holder);
  try {
    const state = await readState(sql);
    const toUndo = (await listMigrations(dir)).filter((n) => state.applied.has(n)).reverse();
    if (toUndo.length === 0) { log('nothing to undo'); return; }
    for (const name of all ? toUndo : toUndo.slice(0, 1)) {
      log(`reverting ${name} ...`);
      await runText(sql, await readFile(path.join(dir, `${name}.down.sql`), 'utf8'), { log, wait });
      await sql.query('DELETE FROM schema_migrations WHERE name = $1', [name]);
    }
    log('done');
    await remindRoles(sql, log);
  } finally {
    await releaseLock(sql);
  }
}

/**
 * A migration that drops and re-creates a function (any `down` of 0004/0010/0014, then `up`) also drops the app
 * role's right to run it: the app then gets "permission denied" and every AI request fails (seen on the dev branch,
 * 2026-11-02). When the role exists, say so loudly after every up/down that changed something.
 */
async function remindRoles(sql, log) {
  const [r] = await sql.query(`SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bedrock_app') AS e`);
  if (r?.e) {
    log('IMPORTANT: role bedrock_app exists. Run `node db/migrate.mjs roles --yes --host <host>` now, or the app may lose '
      + 'the right to run re-created functions (AI requests would fail with 503).');
  }
}
