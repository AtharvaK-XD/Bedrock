// Read-only growth and health numbers for the database (used by db/stats.mjs; tested on in-memory Postgres).
// Counts and sizes only. User ids are shortened (first 6 characters) and never shown with emails or names.
// Retention rules mirror purge_old_logs() (0004): quota rows 1 day, quota log lines 1 day, other logs 90 days,
// traces 90 days, expired idempotency keys.

export const TABLES = ['User', 'Prompt', 'BranchingTree', 'Trace', 'SecurityLog', 'QuotaEvent', 'IdempotencyKey'];
export const WARN = {
  securityLogRows: 1_000_000,
  traceRows: 2_000_000,
  databaseBytes: 400 * 1024 * 1024, // Neon's smallest plans are 512 MB: check the plan in the console (NOT known here)
  promptsNearCap: 1800, // cap 2,000
  workflowsNearCap: 450, // cap 500
  tracesPerDayNearCap: 4000, // cap 5,000 (0015)
};

const exists = async (sql, name) => (await sql.query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [`public."${name}"`]))[0].ok;
const short = (id) => (id.length > 6 ? `${id.slice(0, 6)}...` : id);

export async function collectStats(sql) {
  const out = { databaseBytes: 0, tables: [], last24h: {}, overdue: {}, oldestDays: {}, topUsers: [], warnings: [], missing: [] };
  out.databaseBytes = Number((await sql.query(`SELECT pg_database_size(current_database()) AS b`))[0].b);

  for (const t of TABLES) {
    if (!(await exists(sql, t))) { out.missing.push(t); continue; }
    const [r] = await sql.query(`SELECT count(*)::bigint AS n, pg_total_relation_size($1::regclass)::bigint AS b FROM "${t}"`, [`public."${t}"`]);
    out.tables.push({ name: t, rows: Number(r.n), bytes: Number(r.b) });
  }
  const has = (t) => !out.missing.includes(t);

  if (has('SecurityLog')) {
    out.last24h.securityLogs = Number((await sql.query(`SELECT count(*) AS n FROM "SecurityLog" WHERE created_at > (now() AT TIME ZONE 'UTC') - interval '24 hours'`))[0].n);
    out.overdue.securityLogs = Number((await sql.query(`SELECT count(*) AS n FROM "SecurityLog" WHERE (event_type LIKE 'AI\\_QUOTA\\_%' AND created_at < (now() AT TIME ZONE 'UTC') - interval '1 day') OR created_at < (now() AT TIME ZONE 'UTC') - interval '90 days'`))[0].n);
    out.oldestDays.securityLogs = Number((await sql.query(`SELECT floor(extract(epoch FROM ((now() AT TIME ZONE 'UTC') - min(created_at))) / 86400) AS d FROM "SecurityLog"`))[0].d);
  }
  if (has('Trace')) {
    out.last24h.traces = Number((await sql.query(`SELECT count(*) AS n FROM "Trace" WHERE created_at > (now() AT TIME ZONE 'UTC') - interval '24 hours'`))[0].n);
    out.overdue.traces = Number((await sql.query(`SELECT count(*) AS n FROM "Trace" WHERE created_at < (now() AT TIME ZONE 'UTC') - interval '90 days'`))[0].n);
    out.oldestDays.traces = Number((await sql.query(`SELECT floor(extract(epoch FROM ((now() AT TIME ZONE 'UTC') - min(created_at))) / 86400) AS d FROM "Trace"`))[0].d);
  }
  if (has('QuotaEvent')) {
    out.overdue.quotaEvents = Number((await sql.query(`SELECT count(*) AS n FROM "QuotaEvent" WHERE created_at < clock_timestamp() - interval '1 day'`))[0].n);
  }
  if (has('IdempotencyKey')) {
    out.overdue.idempotencyKeys = Number((await sql.query(`SELECT count(*) AS n FROM "IdempotencyKey" WHERE expires_at < (now() AT TIME ZONE 'UTC')`))[0].n);
  }
  if (has('User')) {
    out.last24h.newUsers = Number((await sql.query(`SELECT count(*) AS n FROM "User" WHERE created_at > (now() AT TIME ZONE 'UTC') - interval '24 hours'`))[0].n);
  }

  if (has('Prompt') && has('BranchingTree') && has('Trace')) {
    out.topUsers = (await sql.query(`
      SELECT u AS id, max(p)::int AS prompts, max(w)::int AS workflows, max(t)::int AS traces_24h FROM (
        SELECT user_id AS u, count(*) AS p, 0 AS w, 0 AS t FROM "Prompt" GROUP BY user_id
        UNION ALL SELECT user_id, 0, count(*), 0 FROM "BranchingTree" GROUP BY user_id
        UNION ALL SELECT user_id, 0, 0, count(*) FROM "Trace" WHERE created_at > (now() AT TIME ZONE 'UTC') - interval '24 hours' GROUP BY user_id
      ) x GROUP BY u ORDER BY greatest(max(p), max(w), max(t)) DESC LIMIT 5`)).map((r) => ({ user: short(r.id), prompts: r.prompts, workflows: r.workflows, traces24h: r.traces_24h }));
  }

  // warnings, in plain words
  const rowsOf = (n) => out.tables.find((t) => t.name === n)?.rows ?? 0;
  const overdue = Object.entries(out.overdue).filter(([, n]) => n > 0);
  if (overdue.length) out.warnings.push(`The daily cleanup is behind: ${overdue.map(([k, n]) => `${k} ${n}`).join(', ')} row(s) are past their keep time. Run the cleanup by hand (db/RUNBOOK.md section 4) and check the daily job.`);
  if (rowsOf('SecurityLog') > WARN.securityLogRows) out.warnings.push(`SecurityLog has ${rowsOf('SecurityLog')} rows (more than ${WARN.securityLogRows}): look for a log flood.`);
  if (rowsOf('Trace') > WARN.traceRows) out.warnings.push(`Trace has ${rowsOf('Trace')} rows (more than ${WARN.traceRows}).`);
  if (out.databaseBytes > WARN.databaseBytes) out.warnings.push(`The database is ${(out.databaseBytes / 1048576).toFixed(0)} MB. Check the storage limit of your Neon plan in the console (not known here).`);
  for (const u of out.topUsers) {
    if (u.prompts >= WARN.promptsNearCap) out.warnings.push(`Account ${u.user} has ${u.prompts} saved prompts (cap 2,000).`);
    if (u.workflows >= WARN.workflowsNearCap) out.warnings.push(`Account ${u.user} has ${u.workflows} workflows (cap 500).`);
    if (u.traces24h >= WARN.tracesPerDayNearCap) out.warnings.push(`Account ${u.user} wrote ${u.traces24h} usage records in 24 hours (cap 5,000).`);
  }
  return out;
}
