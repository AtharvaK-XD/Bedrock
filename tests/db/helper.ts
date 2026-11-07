// Shared helper for the in-memory database tests in tests/db/*.local.test.ts.
// They run the real db/migrations/*.sql and db/roles.sql on PGlite (a real Postgres engine inside Node), so they need
// no Neon connection, no secrets and finish in seconds. They never read DATABASE_URL or DATABASE_URL_DEV.
// Skipped (not failed) when the dev package is missing: npm i -D -E @electric-sql/pglite@0.3.15
// Limits: PGlite has one connection, so (1) CREATE INDEX CONCURRENTLY is run without CONCURRENTLY, and (2) lock
// behaviour under real parallel load is only tested on a Neon dev branch (tests/db.migrations.test.ts).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';

// Every file in tests/db imports this helper, so this applies to all of them. Starting an in-memory Postgres (a
// WebAssembly engine) takes 1-3 s on an idle machine and several times that when the whole repo's tests run in parallel
// (OPEN-0084); vitest's default of 5 s per test then fails a healthy test at random. 120 s only matters when
// something is really stuck.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

export const DB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db');
export const MIGRATIONS_DIR = path.join(DB_DIR, 'migrations');

const BREAK = /^\s*-- migrate:break\s*$/m;

/** Same split as db/migrate.mjs: statements separated by a "-- migrate:break" line, comment-only chunks dropped. */
export function splitStatements(text: string): string[] {
  return text
    .split(BREAK)
    .map((s) => s.trim())
    .filter((s) => s && !/^(--[^\n]*\n?)+$/.test(s));
}

/** Loads PGlite, or returns null when it is not installed (the tests are then skipped). */
export async function loadPglite(): Promise<any | null> {
  const name = '@electric-sql/pglite';
  try {
    return (await import(/* @vite-ignore */ name)).PGlite;
  } catch {
    const fallback = process.env.BEDROCK_PGLITE_URL; // optional file:// URL to a local copy
    if (!fallback) return null;
    try {
      return (await import(/* @vite-ignore */ fallback)).PGlite;
    } catch {
      return null;
    }
  }
}

/** Runs every statement of a SQL file text; returns the rows of the LAST statement. */
export async function runSql(db: any, text: string): Promise<any[]> {
  let rows: any[] = [];
  for (const stmt of splitStatements(text)) {
    rows = (await db.query(stmt.replace(/\bCONCURRENTLY\b/g, ''))).rows;
  }
  return rows;
}

const files = (kind: 'up' | 'down') => readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(`.${kind}.sql`)).sort();
export const migrationNumbers = () => files('up').map((f) => f.slice(0, 4));

/** Applies pending migrations up to and including `upTo` (default: all). `applied` tracks what is already in. */
export async function migrateUp(db: any, applied: Set<string>, upTo = '9999') {
  for (const f of files('up')) {
    const n = f.slice(0, 4);
    if (n <= upTo && !applied.has(n)) {
      await runSql(db, readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
      applied.add(n);
    }
  }
}

/** Undoes applied migrations newer than `downTo` (default: all), newest first. */
export async function migrateDown(db: any, applied: Set<string>, downTo = '0000') {
  for (const f of files('down').reverse()) {
    const n = f.slice(0, 4);
    if (n > downTo && applied.has(n)) {
      await runSql(db, readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
      applied.delete(n);
    }
  }
}

export const readDbFile = (name: string) => readFileSync(path.join(DB_DIR, name), 'utf8');
export const readMigration = (file: string) => readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

/** Runs SQL and returns the error message, or null when it worked. */
export async function errorOf(db: any, sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params);
    return null;
  } catch (e: any) {
    return String(e?.message ?? e);
  }
}

export async function rows(db: any, sql: string, params: unknown[] = []): Promise<any[]> {
  return (await db.query(sql, params)).rows;
}

/** Two accounts every test file can use. */
export async function seedUsers(db: any) {
  await db.query(`INSERT INTO "User"(id,email,password_hash,name,updated_at) VALUES
    ('ua','a@x.test','x','a',now()),('ub','b@x.test','x','b',now()) ON CONFLICT DO NOTHING`);
}

export async function newPrompt(db: any, id: string, user: string) {
  await db.query(
    `INSERT INTO "Prompt"(id,user_id,title,snippet,full_content,tags,target_type,created_at,updated_at)
     VALUES ($1,$2,'t','s','c','[]','G',now(),now())`, [id, user]);
}

/** A stand-in for the Neon driver (query + transaction) on top of PGlite, so the exact tool code is tested. */
export function neonLike(db: any, spy?: { inTx: string[]; plain: string[]; txFail?: () => Error | null }) {
  const strip = (t: string) => t.replace(/\bCONCURRENTLY\b/g, ''); // PGlite has one connection
  return {
    query: async (text: string, params: unknown[] = []) => {
      spy?.plain.push(text);
      return (await db.query(strip(text), params)).rows;
    },
    transaction: async (fn: (tx: any) => any[]) => {
      const err = spy?.txFail?.();
      if (err) throw err;
      const items = fn({ query: (text: string, params: unknown[] = []) => ({ text, params }) });
      spy?.inTx.push(...items.map((i: any) => i.text));
      return db.transaction(async (tx: any) => {
        const out: any[] = [];
        for (const it of items) out.push((await tx.query(strip(it.text), it.params)).rows);
        return out;
      });
    },
  };
}
