#!/usr/bin/env node
// READ-ONLY check of the live dev database against what the migrations and the API expect.
//   node db/check-schema.mjs
// Reads only DATABASE_URL_DEV. Prints the host, never the password. Prints counts only, never user data.
import { neon } from '@neondatabase/serverless';

const url = (process.env.DATABASE_URL_DEV || '').trim().replace(/^"|"$/g, '');
if (!url) {
  console.error('DATABASE_URL_DEV is not set. Nothing was done.');
  process.exit(1);
}
console.log(`Target database host: ${new URL(url).host}\n`);
const sql = neon(url);

// [data_type, is_nullable] per column, from 0001_baseline and 0004 ("QuotaEvent")
const TS = 'timestamp without time zone';
const EXPECTED = {
  User: {
    id: ['text', 'NO'], email: ['text', 'NO'], password_hash: ['text', 'NO'], name: ['text', 'NO'],
    username: ['text', 'YES'], avatar_url: ['text', 'YES'], avatar_initials: ['text', 'YES'],
    plan: ['text', 'NO'], role: ['text', 'NO'], bio: ['text', 'YES'], location: ['text', 'YES'],
    organization: ['text', 'YES'], github: ['text', 'YES'], huggingface: ['text', 'YES'], website: ['text', 'YES'],
    joined_date: ['text', 'YES'], email_verified: ['boolean', 'NO'], mfa_enabled: ['boolean', 'NO'],
    razorpay_customer_id: ['text', 'YES'], razorpay_subscription_id: ['text', 'YES'],
    subscription_tier: ['text', 'NO'], created_at: [TS, 'NO'], updated_at: [TS, 'NO'],
  },
  Prompt: {
    id: ['text', 'NO'], user_id: ['text', 'NO'], title: ['text', 'NO'], snippet: ['text', 'NO'],
    full_content: ['text', 'NO'], tags: ['text', 'NO'], target_type: ['text', 'NO'], created_at: [TS, 'NO'], updated_at: [TS, 'NO'],
  },
  Trace: {
    id: ['text', 'NO'], user_id: ['text', 'NO'], node_origin: ['text', 'NO'], model_target: ['text', 'NO'],
    tokens_used: ['integer', 'NO'], latency_ms: ['integer', 'NO'], status: ['text', 'NO'], created_at: [TS, 'NO'],
  },
  BranchingTree: {
    id: ['text', 'NO'], user_id: ['text', 'NO'], title: ['text', 'NO'], nodes: ['text', 'NO'], edges: ['text', 'NO'],
    created_at: [TS, 'NO'], updated_at: [TS, 'NO'],
  },
  SecurityLog: {
    id: ['text', 'NO'], user_id: ['text', 'YES'], event_type: ['text', 'NO'], severity: ['text', 'NO'],
    ip_address: ['text', 'YES'], endpoint: ['text', 'YES'], message: ['text', 'NO'], created_at: [TS, 'NO'],
  },
  IdempotencyKey: {
    id: ['text', 'NO'], key: ['text', 'NO'], user_id: ['text', 'YES'], endpoint: ['text', 'NO'], status: ['text', 'NO'],
    response_body: ['text', 'YES'], response_code: ['integer', 'YES'], created_at: [TS, 'NO'], expires_at: [TS, 'NO'],
  },
  QuotaEvent: {
    id: ['text', 'NO'], user_id: ['text', 'YES'], ip_address: ['text', 'YES'], bucket: ['text', 'NO'],
    endpoint: ['text', 'YES'], created_at: ['timestamp with time zone', 'NO'],
  },
};
// Columns the API reads from "User" in GET /api/user/profile (api/user/profile.ts, CHG-0013)
const PROFILE_COLUMNS = ['id', 'name', 'username', 'email', 'avatar_url', 'avatar_initials', 'plan', 'role', 'bio', 'location',
  'organization', 'github', 'huggingface', 'website', 'joined_date', 'created_at', 'subscription_tier'];

let differences = 0;
const diff = (msg) => { differences++; console.log(`DIFF  ${msg}`); };

const cols = await sql`
  SELECT table_name, column_name, data_type, is_nullable
  FROM information_schema.columns WHERE table_schema = 'public'
`;
const live = {};
for (const c of cols) (live[c.table_name] ||= {})[c.column_name] = [c.data_type, c.is_nullable];

console.log('== Columns');
for (const [table, expected] of Object.entries(EXPECTED)) {
  if (!live[table]) { diff(`table "${table}" is missing`); continue; }
  for (const [col, [type, nullable]] of Object.entries(expected)) {
    const got = live[table][col];
    if (!got) diff(`"${table}".${col} is missing`);
    else if (got[0] !== type || got[1] !== nullable) diff(`"${table}".${col} is ${got[0]} nullable=${got[1]}, expected ${type} nullable=${nullable}`);
  }
  for (const col of Object.keys(live[table])) if (!expected[col]) diff(`"${table}".${col} exists live but not in the migrations`);
}
for (const t of Object.keys(live)) {
  if (!EXPECTED[t] && t !== 'schema_migrations' && t !== 'PaymentRecord') diff(`table "${t}" exists live but not in the migrations`);
}
const missingProfile = PROFILE_COLUMNS.filter((c) => !live.User?.[c]);
console.log(missingProfile.length ? `DIFF  profile GET columns missing: ${missingProfile.join(', ')}` : 'OK    every column of the profile GET exists in "User"');
if (missingProfile.length) differences++;

console.log('\n== Primary keys, foreign keys, unique and check constraints');
const cons = await sql`
  SELECT conrelid::regclass::text AS tbl, conname, contype, convalidated, pg_get_constraintdef(oid) AS def,
         CASE confdeltype WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' ELSE NULL END AS on_delete
  FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND conrelid::regclass::text <> '"PaymentRecord"'
  ORDER BY 1, 2
`;
for (const c of cons) {
  console.log(`      ${c.tbl} ${c.conname} [${c.contype}]${c.convalidated ? '' : ' NOT VALID'}${c.on_delete ? ' ON DELETE ' + c.on_delete : ''}: ${c.def}`);
}
for (const t of ['"Prompt"', '"BranchingTree"', '"Trace"', '"User"', '"QuotaEvent"']) {
  if (!cons.some((c) => c.tbl === t && c.contype === 'p' && /\(id\)/.test(c.def))) diff(`${t} has no PRIMARY KEY (id)`);
}
for (const t of ['"Prompt"', '"BranchingTree"', '"Trace"']) {
  if (!cons.some((c) => c.tbl === t && c.contype === 'f' && c.on_delete === 'CASCADE')) diff(`${t}.user_id has no FOREIGN KEY to "User" with ON DELETE CASCADE`);
}

console.log('\n== Indexes');
const idx = await sql`SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename <> 'PaymentRecord' ORDER BY 1, 2`;
for (const i of idx) console.log(`      ${i.indexdef}`);
const invalid = await sql`SELECT c.relname FROM pg_index x JOIN pg_class c ON c.oid = x.indexrelid WHERE NOT x.indisvalid`;
for (const i of invalid) diff(`index ${i.relname} is INVALID (an interrupted CONCURRENTLY build): run that migration's down, then up`);
const userIdx = idx.filter((i) => i.tablename === 'User').map((i) => i.indexdef);
console.log(`INFO  unique index on User.username: ${userIdx.some((d) => /UNIQUE/.test(d) && /username/.test(d)) ? 'yes' : 'NO'}`);
console.log(`INFO  unique index on lower(email): ${userIdx.some((d) => /UNIQUE/.test(d) && /lower\(email\)/.test(d)) ? 'yes' : 'NO'}`);

console.log('\n== Triggers and functions');
const trg = await sql`SELECT tgrelid::regclass::text AS tbl, tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY 1`;
for (const t of trg) console.log(`      trigger ${t.tgname} on ${t.tbl}`);
const fns = await sql`
  SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, pg_get_userbyid(p.proowner) AS owner,
         coalesce(array_to_string(p.proacl, ', '), '(default: PUBLIC may execute)') AS acl
  FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace ORDER BY 1
`;
for (const f of fns) console.log(`      ${f.proname}(${f.args}) owner=${f.owner} grants=${f.acl}`);

console.log('\n== Roles and table grants');
const [{ me }] = await sql`SELECT current_user AS me`;
console.log(`      connected as role: ${me}`);
const grants = await sql`
  SELECT grantee, table_name, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
  FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name <> 'PaymentRecord'
  GROUP BY 1, 2 ORDER BY 1, 2
`;
for (const g of grants) console.log(`      ${g.grantee} on ${g.table_name}: ${g.privs}`);
const colGrant = await sql`
  SELECT grantee, privilege_type FROM information_schema.column_privileges
  WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'password_hash' ORDER BY 1, 2
`;
console.log(`      column grants on "User".password_hash: ${colGrant.map((g) => `${g.grantee}:${g.privilege_type}`).join(', ') || 'none listed'}`);

console.log('\n== Data facts (counts only)');
const [facts] = await sql`
  SELECT
    (SELECT count(*)::int FROM "User") AS users,
    (SELECT count(*)::int FROM "User" WHERE email_verified) AS email_verified_true,
    (SELECT count(*)::int FROM (SELECT 1 FROM "User" GROUP BY lower(email) HAVING count(*) > 1) d) AS dup_emails_ci,
    (SELECT count(*)::int FROM (SELECT 1 FROM "User" WHERE username IS NOT NULL GROUP BY username HAVING count(*) > 1) d) AS dup_usernames,
    (SELECT count(*)::int FROM (SELECT 1 FROM "User" WHERE username IS NOT NULL GROUP BY lower(username) HAVING count(*) > 1) d) AS dup_usernames_ci,
    (SELECT count(*)::int FROM "SecurityLog") AS security_logs,
    (SELECT count(*)::int FROM "SecurityLog" WHERE char_length(message) > 2000 OR char_length(coalesce(ip_address,'')) > 64
       OR char_length(event_type) > 100 OR char_length(coalesce(endpoint,'')) > 200) AS security_logs_over_limit,
    (SELECT count(*)::int FROM "Trace") AS traces,
    (SELECT string_agg(DISTINCT status, ',') FROM "Trace") AS trace_statuses
`;
for (const [k, v] of Object.entries(facts)) console.log(`      ${k}: ${v ?? 0}`);

console.log(`\n${differences} difference(s) found.`);
