#!/usr/bin/env node
// Tiny migration runner for the Neon database. The logic lives in db/lib/migrator.mjs (tested on in-memory Postgres).
//   node db/migrate.mjs status                               (read only: nothing is created or changed)
//   node db/migrate.mjs up    --yes --host <host>            (apply every pending migration, in order)
//   node db/migrate.mjs up    --yes --host <host> --to 0004  (apply pending migrations up to and including 0004 only)
//   node db/migrate.mjs down  --yes --host <host>            (undo the most recent migration)
//   node db/migrate.mjs down  --yes --host <host> --all      (undo every applied migration, newest first)
//   node db/migrate.mjs roles --yes --host <host>            (run db/roles.sql: grants for the bedrock_app role)
// Safety: it reads ONLY the env var DATABASE_URL_DEV (a Neon dev branch). It never reads DATABASE_URL.
// It prints the database HOST (never the password); anything that writes needs --yes AND that exact host (db/target.mjs).
// Live-site safety (5 s lock limit with retries, one run at a time, checksums): see db/lib/migrator.mjs.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { targetUrl, confirmWrite } from './target.mjs';
import { migrateDown, migrateUp, runText, status } from './lib/migrator.mjs';

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

try {
  if (command === 'status') {
    for (const r of await status(sql, { dir })) {
      const plain = r.state === 'PENDING' || r.state === 'applied';
      console.log(`${r.state === 'PENDING' ? 'PENDING ' : r.state === 'applied' ? 'applied ' : 'CHECK   '} ${r.name}${plain ? '' : `   <- ${r.state}`}`);
    }
  } else if (command === 'up') {
    await migrateUp(sql, { dir, upTo });
  } else if (command === 'down') {
    await migrateDown(sql, { dir, all });
  } else {
    const rows = await runText(sql, await readFile(path.join(here, 'roles.sql'), 'utf8'), { log: console.log });
    for (const r of rows) console.log(`${r.ok ? 'OK  ' : 'FAIL'}  ${r.item}`);
    const good = rows.every((r) => r.ok);
    console.log(good ? 'done: every check passed' : 'done, but some checks FAILED (see above)');
    process.exit(good ? 0 : 1);
  }
} catch (e) {
  console.error(`STOPPED: ${e.message}`);
  process.exit(1);
}
