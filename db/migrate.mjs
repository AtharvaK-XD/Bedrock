#!/usr/bin/env node
// Tiny migration runner for the Neon database.
//   node db/migrate.mjs status
//   node db/migrate.mjs up   --yes          (apply every pending migration, in order)
//   node db/migrate.mjs down --yes          (undo the most recent migration)
// Safety: it reads ONLY the env var DATABASE_URL_DEV (a Neon dev branch). It never reads DATABASE_URL.
// It prints the database HOST (never the password) so you can confirm it is the dev branch before anything runs.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
const [command = 'status', ...flags] = process.argv.slice(2);
const confirmed = flags.includes('--yes');

const url = (process.env.DATABASE_URL_DEV || '').trim().replace(/^"|"$/g, '');
if (!url) {
  console.error('DATABASE_URL_DEV is not set. Point it at a Neon DEV branch (never production). Nothing was done.');
  process.exit(1);
}
console.log(`Target database host: ${new URL(url).host}`);

const sql = neon(url);
const BREAK = /^\s*-- migrate:break\s*$/m;

async function files(kind) {
  return (await readdir(dir)).filter((f) => f.endsWith(`.${kind}.sql`)).sort();
}
const nameOf = (file) => file.replace(/\.(up|down)\.sql$/, '');

async function run(file) {
  const text = await readFile(path.join(dir, file), 'utf8');
  const statements = text.split(BREAK).map((s) => s.trim()).filter((s) => s && !/^(--[^\n]*\n?)+$/.test(s));
  for (const stmt of statements) await sql.query(stmt);
}

await sql.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
const applied = new Set((await sql.query('SELECT name FROM schema_migrations')).map((r) => r.name));
const ups = await files('up');

if (command === 'status') {
  for (const f of ups) console.log(`${applied.has(nameOf(f)) ? 'applied ' : 'PENDING '} ${nameOf(f)}`);
} else if (command === 'up' || command === 'down') {
  if (!confirmed) {
    console.error(`Add --yes to run "${command}" against the host above.`);
    process.exit(1);
  }
  if (command === 'up') {
    for (const f of ups.filter((u) => !applied.has(nameOf(u)))) {
      console.log(`applying ${nameOf(f)} ...`);
      await run(f);
      await sql.query('INSERT INTO schema_migrations(name) VALUES ($1)', [nameOf(f)]);
    }
    console.log('done');
  } else {
    const last = ups.filter((u) => applied.has(nameOf(u))).pop();
    if (!last) { console.log('nothing to undo'); process.exit(0); }
    console.log(`reverting ${nameOf(last)} ...`);
    await run(`${nameOf(last)}.down.sql`);
    await sql.query('DELETE FROM schema_migrations WHERE name = $1', [nameOf(last)]);
    console.log('done');
  }
} else {
  console.error('Usage: node db/migrate.mjs status | up --yes | down --yes');
  process.exit(1);
}
