#!/usr/bin/env node
// Tiny migration runner for the Neon database.
//   node db/migrate.mjs status
//   node db/migrate.mjs up    --yes --host <host>            (apply every pending migration, in order)
//   node db/migrate.mjs up    --yes --host <host> --to 0004  (apply pending migrations up to and including 0004 only)
//   node db/migrate.mjs down  --yes --host <host>            (undo the most recent migration)
//   node db/migrate.mjs down  --yes --host <host> --all      (undo every applied migration, newest first)
//   node db/migrate.mjs roles --yes --host <host>            (run db/roles.sql: grants for the bedrock_app role)
// Safety: it reads ONLY the env var DATABASE_URL_DEV (a Neon dev branch). It never reads DATABASE_URL.
// It prints the database HOST (never the password); anything that writes needs --yes AND that exact host (db/target.mjs).
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { targetUrl, confirmWrite } from './target.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, 'migrations');
const [command = 'status', ...flags] = process.argv.slice(2);
const all = flags.includes('--all');
const toIndex = flags.indexOf('--to');
const upTo = toIndex >= 0 ? flags[toIndex + 1] : null;
if (toIndex >= 0 && !/^\d{4}$/.test(upTo || '')) {
  console.error('--to needs a 4-digit migration number, e.g. --to 0004. Nothing was done.');
  process.exit(1);
}
if (!['status', 'up', 'down', 'roles'].includes(command)) {
  console.error('Usage: node db/migrate.mjs status | up --yes --host <host> [--to NNNN] | down --yes --host <host> [--all] | roles --yes --host <host>');
  process.exit(1);
}

const url = targetUrl();
if (command !== 'status') confirmWrite(url, flags, `run "${command}"`);

const sql = neon(url);
const BREAK = /^\s*-- migrate:break\s*$/m;

async function files(kind) {
  return (await readdir(dir)).filter((f) => f.endsWith(`.${kind}.sql`)).sort();
}
const nameOf = (file) => file.replace(/\.(up|down)\.sql$/, '');

async function runFile(file) {
  const text = await readFile(file, 'utf8');
  const statements = text.split(BREAK).map((s) => s.trim()).filter((s) => s && !/^(--[^\n]*\n?)+$/.test(s));
  let last = [];
  for (const stmt of statements) last = await sql.query(stmt);
  return last;
}
const run = (file) => runFile(path.join(dir, file));

if (command === 'roles') {
  const rows = await runFile(path.join(here, 'roles.sql'));
  for (const r of rows) console.log(`${r.ok ? 'OK  ' : 'FAIL'}  ${r.item}`);
  console.log(rows.every((r) => r.ok) ? 'done: every check passed' : 'done, but some checks FAILED (see above)');
  process.exit(rows.every((r) => r.ok) ? 0 : 1);
}

await sql.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
const applied = new Set((await sql.query('SELECT name FROM schema_migrations')).map((r) => r.name));
const ups = await files('up');

if (command === 'status') {
  for (const f of ups) console.log(`${applied.has(nameOf(f)) ? 'applied ' : 'PENDING '} ${nameOf(f)}`);
} else if (command === 'up') {
  for (const f of ups.filter((u) => !applied.has(nameOf(u)) && (!upTo || nameOf(u).slice(0, 4) <= upTo))) {
    console.log(`applying ${nameOf(f)} ...`);
    await run(f);
    await sql.query('INSERT INTO schema_migrations(name) VALUES ($1)', [nameOf(f)]);
  }
  console.log('done');
} else {
  const toUndo = ups.filter((u) => applied.has(nameOf(u))).reverse();
  if (toUndo.length === 0) { console.log('nothing to undo'); process.exit(0); }
  for (const f of all ? toUndo : toUndo.slice(0, 1)) {
    console.log(`reverting ${nameOf(f)} ...`);
    await run(`${nameOf(f)}.down.sql`);
    await sql.query('DELETE FROM schema_migrations WHERE name = $1', [nameOf(f)]);
  }
  console.log('done');
}
