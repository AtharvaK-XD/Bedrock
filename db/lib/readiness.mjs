// One-screen, READ-ONLY readiness report for a database (used by db/readiness.mjs; tested on in-memory Postgres).
// Answers: which migrations does this database have, which app features are therefore ON or OFF, which role is this
// connection, is the limited app role set up, is the cleanup keeping up. Nothing is created or changed.
// Counts only; no user data. It reports THIS connection: what Vercel actually uses is checked in Vercel (not known here).
import { status } from './migrator.mjs';
import { collectStats } from './stats.mjs';

/** What switches on with each migration (same list as db/PRODUCTION.md). */
export const FEATURES = [
  ['0002', 'faster lists and usage counts (indexes)'],
  ['0003', 'size limits and 2,000 prompts / 500 workflows per account'],
  ['0004', 'race-proof usage limits and the daily log cleanup'],
  ['0005', 'log line size limit'],
  ['0006', 'only the app may run the usage and cleanup functions'],
  ['0007', 'one account per email, ignoring case'],
  ['0008', 'the three usage-limit loopholes closed'],
  ['0009', 'one account per username, ignoring case'],
  ['0010', 'dashboard totals over ALL runs'],
  ['0011', 'row guards (no owner change, no log edits, no TRUNCATE)'],
  ['0012', 'safe functions (fixed search path, lock limits)'],
  ['0013', 'profile size limits'],
  ['0014', '"delete my account" (delete_user_data)'],
  ['0015', 'daily cap of 5,000 usage records per account'],
  ['0016', 'old rows checked against the size rules'],
  ['0017', 'fast paging of the prompts and workflows lists'],
  ['0018', 'onboarding answers (birth date, referral source) are saved'],
  ['0019', 'paid orders survive account deletion'],
  ['0020', 'paid plans last 30 days per payment (plan end date)'],
  ['0021', 'Branching v2: version history, run stats and share links'],
];

export async function collectReadiness(sql, { dir }) {
  const out = { migrations: [], features: [], role: {}, stats: null, problems: [], notes: [] };

  // ---- migrations
  const list = await status(sql, { dir });
  out.migrations = list;
  const bad = (name) => list.find((m) => m.name.startsWith(`${name}_`));
  for (const [num, text] of FEATURES) {
    const m = bad(num);
    out.features.push({ migration: num, feature: text, on: !!m && m.state.startsWith('applied') });
  }
  const pending = list.filter((m) => m.state === 'PENDING');
  const changed = list.filter((m) => m.state.startsWith('CHANGED'));
  if (pending.length) out.problems.push(`${pending.length} migration(s) not applied: ${pending.map((m) => m.name.slice(0, 4)).join(', ')}. The features listed as OFF below are not live.`);
  if (changed.length) out.problems.push(`${changed.length} migration file(s) were edited after they were applied: ${changed.map((m) => m.name.slice(0, 4)).join(', ')}. Restore them; put changes in a new migration.`);

  // ---- roles and rights (this connection)
  const [me] = await sql.query(`SELECT current_user AS name,
    (SELECT rolsuper OR rolcreaterole OR rolcreatedb FROM pg_roles WHERE rolname = current_user) AS powerful,
    has_schema_privilege('public', 'public', 'CREATE') AS public_can_create`);
  const [app] = await sql.query(`SELECT rolname, rolcanlogin, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls FROM pg_roles WHERE rolname = 'bedrock_app'`);
  out.role = { connectedAs: me.name, connectedRoleIsPowerful: !!me.powerful, publicCanCreate: !!me.public_can_create, appRoleExists: !!app };
  if (me.public_can_create) out.problems.push('Any database user may create objects in schema "public" (run db/roles.sql).');
  if (!app) {
    out.notes.push('The limited app role bedrock_app does not exist on this database (db/ROLES.md, OPEN-0037). The app can only be least-privilege once it exists AND Vercel uses it.');
  } else {
    if (app.rolsuper || app.rolcreaterole || app.rolcreatedb || app.rolbypassrls) out.problems.push('bedrock_app is too powerful (superuser / createrole / createdb / bypassrls). Recreate it with plain SQL (db/ROLES.md step 1).');
    const [g] = await sql.query(`SELECT
      has_column_privilege('bedrock_app', '"User"', 'password_hash', 'SELECT') AS reads_hash,
      has_table_privilege('bedrock_app', '"User"', 'DELETE') AS deletes_users,
      has_table_privilege('bedrock_app', '"Trace"', 'UPDATE') AS edits_traces,
      to_regprocedure('reserve_quota(text,text,text,text,text,integer,interval)') IS NOT NULL AS has_reserve,
      to_regprocedure('delete_user_data(text)') IS NOT NULL AS has_delete`);
    if (g.reads_hash) out.problems.push('bedrock_app can read password_hash (run db/roles.sql).');
    if (g.deletes_users) out.problems.push('bedrock_app can delete accounts directly (run db/roles.sql).');
    if (g.edits_traces) out.problems.push('bedrock_app can edit usage records (run db/roles.sql).');
    if (g.has_reserve && !(await sql.query(`SELECT has_function_privilege('bedrock_app', 'reserve_quota(text,text,text,text,text,integer,interval)', 'EXECUTE') AS ok`))[0].ok) {
      out.problems.push('bedrock_app cannot run reserve_quota(): every AI request would fail with 503 (run db/roles.sql).');
    }
    if (g.has_delete && !(await sql.query(`SELECT has_function_privilege('bedrock_app', 'delete_user_data(text)', 'EXECUTE') AS ok`))[0].ok) {
      out.problems.push('bedrock_app cannot run delete_user_data(): "delete my account" would fail (run db/roles.sql).');
    }
    // A new migration's tables without their grants = the feature answers 503 (the usual "forgot to re-run roles").
    const [p] = await sql.query(`SELECT
      to_regclass('public."WorkflowRun"') IS NOT NULL AS has_v2,
      to_regclass('public."User"') IS NOT NULL
        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'plan_expires_at') AS has_expiry`);
    if (p.has_v2) {
      const [v] = await sql.query(`SELECT has_table_privilege('bedrock_app', '"WorkflowVersion"', 'INSERT')
        AND has_table_privilege('bedrock_app', '"WorkflowRun"', 'INSERT') AND has_table_privilege('bedrock_app', '"WorkflowShare"', 'INSERT') AS ok`);
      if (!v.ok) out.problems.push('bedrock_app has no rights on the Branching v2 tables (0021): version history, share links and stats answer 503 (run db/roles.sql).');
    }
    if (p.has_expiry && !(await sql.query(`SELECT has_column_privilege('bedrock_app', '"User"', 'plan_expires_at', 'UPDATE') AS ok`))[0].ok) {
      out.problems.push('bedrock_app cannot set plan_expires_at (0020): payments are applied without an end date (run db/roles.sql).');
    }
  }
  if (me.name !== 'bedrock_app' && !me.powerful) out.notes.push(`This connection is the role "${me.name}", not bedrock_app.`);

  // ---- invalid indexes (an interrupted CONCURRENTLY build)
  const invalid = await sql.query(`SELECT c.relname FROM pg_index x JOIN pg_class c ON c.oid = x.indexrelid WHERE NOT x.indisvalid`);
  if (invalid.length) out.problems.push(`${invalid.length} INVALID index(es): ${invalid.map((r) => r.relname).join(', ')} (run that migration's down, then up).`);

  // ---- growth and cleanup health (read only)
  out.stats = await collectStats(sql);
  for (const w of out.stats.warnings) out.problems.push(w);
  return out;
}
