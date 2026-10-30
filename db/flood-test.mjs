#!/usr/bin/env node
// DEV-ONLY load test of purge_old_logs(): fills "SecurityLog" with old fake rows, then purges them in batches and
// times every round, while a probe keeps writing normal log rows to prove the cleanup does not block the table.
//   node db/flood-test.mjs --yes [--rows 1000000] [--insert-only | --purge-only]
// --insert-only lets you run `node db/explain.mjs` on the big table before purging.
// WARNING: 1,000,000 rows use roughly 150-250 MB on the dev branch until purged. The purge also deletes any other
// SecurityLog row older than 90 days on that branch (that is its job). Reads only DATABASE_URL_DEV.
import { neon } from '@neondatabase/serverless';

const args = process.argv.slice(2);
const url = (process.env.DATABASE_URL_DEV || '').trim().replace(/^"|"$/g, '');
if (!url) { console.error('DATABASE_URL_DEV is not set. Nothing was done.'); process.exit(1); }
console.log(`Target database host: ${new URL(url).host}`);
if (!args.includes('--yes')) { console.error('Add --yes to write test rows to the host above.'); process.exit(1); }
const rowsIdx = args.indexOf('--rows');
const ROWS = rowsIdx >= 0 ? Number(args[rowsIdx + 1]) : 1_000_000;
if (!Number.isInteger(ROWS) || ROWS < 1 || ROWS > 2_000_000) { console.error('--rows must be 1..2000000'); process.exit(1); }
const sql = neon(url);
const ms = (t) => Math.round(performance.now() - t);

if (!args.includes('--purge-only')) {
  const CHUNK = 100_000;
  const t0 = performance.now();
  for (let start = 1; start <= ROWS; start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, ROWS);
    await sql.query(`
      INSERT INTO "SecurityLog" (id, user_id, event_type, severity, ip_address, endpoint, message, created_at)
      SELECT 'flood_' || g, NULL, 'FLOOD_TEST', 'INFO', '198.51.100.1', '/flood', 'flood test row',
             (now() AT TIME ZONE 'UTC') - interval '100 days'
      FROM generate_series(${start}, ${end}) g
      ON CONFLICT (id) DO NOTHING
    `);
    console.log(`inserted up to ${end}`);
  }
  await sql.query('ANALYZE "SecurityLog"');
  console.log(`insert of ${ROWS} rows took ${ms(t0)} ms`);
  if (args.includes('--insert-only')) process.exit(0);
}

// Probe: a normal log write + read, timed, run alongside purge rounds
async function probe(i) {
  const t = performance.now();
  await sql`INSERT INTO "SecurityLog" (id, event_type, message, created_at) VALUES (${'floodprobe_' + i}, 'FLOOD_PROBE', 'probe', NOW())`;
  await sql`SELECT count(*) FROM "SecurityLog" WHERE id = ${'floodprobe_' + i}`;
  return ms(t);
}

const roundTimes = [];
const probeTimes = [];
const t1 = performance.now();
for (let round = 1; round <= 1000; round++) {
  const t = performance.now();
  const [[counts], p] = await Promise.all([sql`SELECT * FROM purge_old_logs(5000)`, probe(round)]);
  roundTimes.push(ms(t));
  probeTimes.push(p);
  if (round % 20 === 0) console.log(`round ${round}: ${roundTimes.at(-1)} ms, probe ${p} ms`);
  if (counts.security_logs === 0) break;
}
await sql`DELETE FROM "SecurityLog" WHERE event_type = 'FLOOD_PROBE'`;
const [{ left }] = await sql`SELECT count(*)::int AS left FROM "SecurityLog" WHERE event_type = 'FLOOD_TEST'`;
const p95 = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)] ?? 0;
console.log(`\npurge rounds: ${roundTimes.length}, total ${ms(t1)} ms`);
console.log(`round time: max ${Math.max(...roundTimes)} ms, p95 ${p95(roundTimes)} ms`);
console.log(`probe (normal log write+read during purge): max ${Math.max(...probeTimes)} ms, p95 ${p95(probeTimes)} ms`);
console.log(`flood rows left: ${left}`);
console.log(`At the API cron limit of 20 rounds per day, a flood this size takes ${Math.ceil(roundTimes.length / 20)} day(s) to clear.`);
