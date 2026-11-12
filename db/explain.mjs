#!/usr/bin/env node
// READ-ONLY query plans for the SQL the API actually runs (api/prompts, api/workflows, api/traces,
// reserve_quota() internals, purge_old_logs() internals). Uses only SELECT, never deletes.
//   node db/explain.mjs
// Each query is shown twice: the planner's natural choice (on tiny tables Postgres often scans the whole table,
// which is correct and cheap), and with seq scans discouraged, which proves an index CAN serve the query
// once the table grows. Reads only DATABASE_URL_DEV.
import { neon } from '@neondatabase/serverless';

const url = (process.env.DATABASE_URL_DEV || '').trim().replace(/^"|"$/g, '');
if (!url) {
  console.error('DATABASE_URL_DEV is not set. Nothing was done.');
  process.exit(1);
}
console.log(`Target database host: ${new URL(url).host}\n`);
const sql = neon(url);

const U = 'explain_probe_user';
const IP = '203.0.113.7';
const QUERIES = [
  ['Prompt per-user COUNT (save cap)', `SELECT COUNT(*) FROM "Prompt" WHERE user_id = '${U}'`],
  ['BranchingTree per-user COUNT (save cap)', `SELECT COUNT(*) FROM "BranchingTree" WHERE user_id = '${U}'`],
  ['Prompt list', `SELECT * FROM "Prompt" WHERE user_id = '${U}' ORDER BY updated_at DESC`],
  ['BranchingTree list', `SELECT * FROM "BranchingTree" WHERE user_id = '${U}' ORDER BY updated_at DESC`],
  ['Trace list (last 100)', `SELECT * FROM "Trace" WHERE user_id = '${U}' ORDER BY created_at DESC LIMIT 100`],
  ['QuotaEvent count, signed-in user (inside reserve_quota)',
    `SELECT count(*) FROM "QuotaEvent" WHERE user_id = '${U}' AND bucket = 'generation' AND created_at >= clock_timestamp() - interval '5 hours'`],
  ['QuotaEvent count, anonymous IP (inside reserve_quota)',
    `SELECT count(*) FROM "QuotaEvent" WHERE user_id IS NULL AND ip_address = '${IP}' AND bucket = 'generation' AND created_at >= clock_timestamp() - interval '5 hours'`],
  ['SecurityLog fallback count, user (old quota path)',
    `SELECT COUNT(*) FROM "SecurityLog" WHERE user_id = '${U}' AND event_type = 'AI_QUOTA_GENERATION' AND created_at >= NOW() - INTERVAL '5 hours'`],
  ['SecurityLog fallback count, anonymous IP (old quota path)',
    `SELECT COUNT(*) FROM "SecurityLog" WHERE user_id IS NULL AND ip_address = '${IP}' AND event_type = 'AI_QUOTA_GENERATION' AND created_at >= NOW() - INTERVAL '5 hours'`],
  ['purge: QuotaEvent batch', `SELECT id FROM "QuotaEvent" WHERE created_at < clock_timestamp() - interval '1 day' LIMIT 5000`],
  ['purge: SecurityLog batch',
    `SELECT id FROM "SecurityLog" WHERE (event_type LIKE 'AI\\_QUOTA\\_%' AND created_at < (now() AT TIME ZONE 'UTC') - interval '1 day') OR created_at < (now() AT TIME ZONE 'UTC') - interval '90 days' LIMIT 5000`],
  ['purge: Trace batch', `SELECT id FROM "Trace" WHERE created_at < (now() AT TIME ZONE 'UTC') - interval '90 days' LIMIT 5000`],
  ['purge: IdempotencyKey batch', `SELECT id FROM "IdempotencyKey" WHERE expires_at < (now() AT TIME ZONE 'UTC') LIMIT 5000`],
];

// 0021 Branching v2 (db/PAGING.md, second half). Shown only when the tables exist. Writes are explained as the
// SELECT that finds their rows, so nothing is changed.
const W = 'explain_probe_workflow';
const [v2] = await sql`SELECT to_regclass('public."WorkflowVersion"') IS NOT NULL AS ok`;
if (v2.ok) {
  QUERIES.push(
    ['v2: next version number (version_insert)', `SELECT COALESCE(MAX(version), 0) + 1 FROM "WorkflowVersion" WHERE workflow_id = '${W}'`],
    ['v2: versions to prune (versions_prune)',
      `SELECT id FROM "WorkflowVersion" WHERE workflow_id = '${W}' AND user_id = '${U}' AND version <= (SELECT MAX(version) - 20 FROM "WorkflowVersion" WHERE workflow_id = '${W}')`],
    ['v2: versions list', `SELECT version, title, created_at, node_count FROM "WorkflowVersion" WHERE workflow_id = '${W}' AND user_id = '${U}' ORDER BY version DESC LIMIT 20`],
    ['v2: runs of one account (run_stats input)', `SELECT status, created_at, node_types FROM "WorkflowRun" WHERE user_id = '${U}'`],
    ['v2: daily run cap count (trigger)', `SELECT 1 FROM "WorkflowRun" WHERE user_id = '${U}' AND created_at > now() - interval '24 hours' LIMIT 2000`],
    ['v2: run purge batch (runs_purge)', `SELECT id FROM "WorkflowRun" WHERE created_at < now() - interval '90 days' LIMIT 5000`],
    ['v2: active share of a workflow (share_create / share_revoke)', `SELECT token FROM "WorkflowShare" WHERE workflow_id = '${W}' AND user_id = '${U}' AND revoked_at IS NULL`],
    ['v2: open a share link (shared_open)', `SELECT workflow_id FROM "WorkflowShare" WHERE token = 'explain_probe_token_0123456789abcdef' AND revoked_at IS NULL`],
    ['v2: runs of a deleted workflow (ON DELETE SET NULL)', `SELECT id FROM "WorkflowRun" WHERE workflow_id = '${W}'`],
  );
} else {
  console.log('Branching v2 tables (0021) not on this database: their plans are skipped.\n');
}

const sizes = await sql`
  SELECT relname, reltuples::bigint AS est_rows FROM pg_class
  WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace AND relname <> 'PaymentRecord' ORDER BY 1
`;
console.log('Estimated rows: ' + sizes.map((s) => `${s.relname}=${s.est_rows}`).join(', ') + '\n');

for (const [label, q] of QUERIES) {
  const natural = await sql.query(`EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) ${q}`);
  const [, forced] = await sql.transaction([
    sql.query('SET LOCAL enable_seqscan = off'),
    sql.query(`EXPLAIN (COSTS OFF) ${q}`),
  ]);
  const plan = (rows) => rows.map((r) => '    ' + r['QUERY PLAN']).join('\n');
  const usesIndex = forced.some((r) => /Index|Bitmap/.test(r['QUERY PLAN']));
  console.log(`== ${label}  [index usable: ${usesIndex ? 'yes' : 'NO'}]`);
  console.log('  natural plan:\n' + plan(natural));
  console.log('  with seq scans discouraged:\n' + plan(forced) + '\n');
}
