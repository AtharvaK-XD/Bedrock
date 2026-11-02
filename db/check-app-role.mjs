#!/usr/bin/env node
// Proves the bedrock_app rights on a DEV branch: every query the API runs works, every dangerous action is refused.
//   node db/check-app-role.mjs                          (connected as the owner via DATABASE_URL_DEV; uses SET ROLE)
//   DATABASE_URL_APP_DEV=<bedrock_app string> node db/check-app-role.mjs   (logs in as bedrock_app itself; also checks
//                                                        the role's time limits apply over the Neon HTTP driver)
// Nothing is kept: every check runs inside one transaction that ends with a forced error, so it is always rolled back.
// "works" = only that forced error came back; "refused" = Postgres said permission denied / must be owner / ROW_IMMUTABLE.
// If the owner may not switch to bedrock_app yet, it prints the one GRANT needed; with --yes --host <host> it runs it.
import { neon } from '@neondatabase/serverless';
import { targetUrl, confirmWrite } from './target.mjs';

const flags = process.argv.slice(2);
const appUrl = (process.env.DATABASE_URL_APP_DEV || '').trim().replace(/^"|"$/g, '');
const url = appUrl || targetUrl();
if (appUrl) console.log(`Target database host: ${new URL(appUrl).host} (logged in as ${decodeURIComponent(new URL(appUrl).username)})`);
const sql = neon(url);

const [me] = await sql`SELECT current_user AS name, current_setting('server_version') AS version`;
console.log(`connected as ${me.name}, Postgres ${me.version}`);
const direct = me.name === 'bedrock_app';
if (!direct) {
  const [r] = await sql`SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bedrock_app') AS exists`;
  if (!r.exists) { console.error('role bedrock_app does not exist on this branch (db/ROLES.md step 1). Nothing was done.'); process.exit(1); }
  const [s] = await sql`SELECT pg_has_role(current_user, 'bedrock_app', 'SET') AS can_set`;
  if (!s.can_set) {
    const grant = 'GRANT bedrock_app TO CURRENT_USER WITH INHERIT FALSE, SET TRUE';
    if (!flags.includes('--yes')) {
      console.error(`The owner may not act as bedrock_app yet. Run once (dev branch), or re-run with --yes --host <host>:\n  ${grant};`);
      process.exit(1);
    }
    confirmWrite(url, flags, 'let the owner act as bedrock_app');
    await sql.query(grant);
    console.log(`ran: ${grant} (the owner can switch to bedrock_app; bedrock_app itself gains nothing)`);
  }
}

const SENTINEL = 'SELECT 1 / 0 AS always_rolled_back';
const P = `chk_${Math.random().toString(36).slice(2, 8)}`;
const newUser = `INSERT INTO "User"(id,email,password_hash,name,username,plan,role,email_verified,mfa_enabled,subscription_tier,created_at,updated_at)
  VALUES ('${P}','${P}@test.invalid','clerk_oauth_external','probe',NULL,'Free Plan','Lead Prompt Architect',false,false,'free',now(),now())
  ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`;

const works = {
  'sign-in lookup + first-login insert + repeat upsert': [
    `SELECT id, email, name, role, subscription_tier, plan FROM "User" WHERE id = '${P}' OR ('${P}@test.invalid'::text IS NOT NULL AND lower(email) = lower('${P}@TEST.invalid')) ORDER BY (id = '${P}') DESC LIMIT 1`,
    newUser, newUser],
  'profile GET (17 columns) + PUT': [newUser,
    `SELECT id, name, username, email, avatar_url, avatar_initials, plan, role, bio, location, organization, github, huggingface, website, joined_date, created_at, subscription_tier FROM "User" WHERE id = '${P}' LIMIT 1`,
    `UPDATE "User" SET name = 'p2', username = NULL, bio = 'b', location = NULL, organization = NULL, github = NULL, huggingface = NULL, website = NULL, updated_at = NOW() WHERE id = '${P}'`],
  'plan / tier change': [newUser, `UPDATE "User" SET subscription_tier = 'free', plan = 'Free Plan', updated_at = NOW() WHERE id = '${P}'`],
  'prompt: save (update, then insert-if-under-cap), list, delete': [newUser,
    `UPDATE "Prompt" SET title = 't' WHERE id = '${P}_p' AND user_id = '${P}'`,
    `INSERT INTO "Prompt"(id,user_id,title,snippet,full_content,tags,target_type,created_at,updated_at) SELECT '${P}_p','${P}','t','s','c','[]','G',now(),now() WHERE (SELECT count(*) FROM "Prompt" WHERE user_id = '${P}') < 2000 ON CONFLICT (id) DO NOTHING RETURNING id`,
    `SELECT * FROM "Prompt" WHERE user_id = '${P}' ORDER BY updated_at DESC`,
    `DELETE FROM "Prompt" WHERE id = '${P}_p' AND user_id = '${P}'`],
  'workflow: save, edit, delete': [newUser,
    `INSERT INTO "BranchingTree"(id,user_id,title,nodes,edges,created_at,updated_at) SELECT '${P}_w','${P}','t','[]','[]',now(),now() WHERE (SELECT count(*) FROM "BranchingTree" WHERE user_id = '${P}') < 200 ON CONFLICT (id) DO NOTHING`,
    `UPDATE "BranchingTree" SET title = 'e', updated_at = NOW() WHERE id = '${P}_w' AND user_id = '${P}'`,
    `DELETE FROM "BranchingTree" WHERE id = '${P}_w' AND user_id = '${P}'`],
  // api/prompts + api/workflows paging (CHG-0041): first page, next page, summary and full variants, single item
  'prompt list paging (summary + full) and single item': [newUser,
    `INSERT INTO "Prompt"(id,user_id,title,snippet,full_content,tags,target_type,created_at,updated_at) VALUES ('${P}_p1','${P}','t','s','c','[]','G',now(),now()), ('${P}_p2','${P}','t','s','c','[]','G',now(),now())`,
    `SELECT id, title, snippet, char_length(full_content) AS content_length, tags, target_type, created_at, updated_at, updated_at::text AS cursor_ts FROM "Prompt" WHERE user_id = '${P}' AND (NULL::text IS NULL OR (updated_at, id) < (NULL::timestamp, NULL::text)) ORDER BY updated_at DESC, id DESC LIMIT 51`,
    `SELECT id, title, snippet, full_content, tags, target_type, created_at, updated_at, updated_at::text AS cursor_ts FROM "Prompt" WHERE user_id = '${P}' AND ('2999-01-01 00:00:00'::text IS NULL OR (updated_at, id) < ('2999-01-01 00:00:00'::timestamp, 'z'::text)) ORDER BY updated_at DESC, id DESC LIMIT 51`,
    `SELECT id, title, snippet, full_content, tags, target_type, created_at, updated_at FROM "Prompt" WHERE id = '${P}_p1' AND user_id = '${P}' LIMIT 1`],
  'workflow list paging (summary + full) and single item': [newUser,
    `INSERT INTO "BranchingTree"(id,user_id,title,nodes,edges,created_at,updated_at) VALUES ('${P}_w1','${P}','t','[]','[]',now(),now())`,
    `SELECT id, title, created_at, updated_at, char_length(nodes) + char_length(edges) AS size_chars, updated_at::text AS cursor_ts FROM "BranchingTree" WHERE user_id = '${P}' AND (NULL::text IS NULL OR (updated_at, id) < (NULL::timestamp, NULL::text)) ORDER BY updated_at DESC, id DESC LIMIT 51`,
    `SELECT id, title, nodes, edges, created_at, updated_at, updated_at::text AS cursor_ts FROM "BranchingTree" WHERE user_id = '${P}' AND ('2999-01-01 00:00:00'::text IS NULL OR (updated_at, id) < ('2999-01-01 00:00:00'::timestamp, 'z'::text)) ORDER BY updated_at DESC, id DESC LIMIT 51`,
    `SELECT id, title, nodes, edges, created_at, updated_at FROM "BranchingTree" WHERE id = '${P}_w1' AND user_id = '${P}' LIMIT 1`],
  'traces: insert (success + failure trace), list, totals, clear': [newUser,
    `INSERT INTO "Trace"(id,user_id,node_origin,model_target,tokens_used,latency_ms,status,created_at) VALUES ('${P}_t','${P}','n','m',1,1,'OK',now())`,
    `INSERT INTO "Trace" (id, user_id, node_origin, model_target, tokens_used, latency_ms, status, created_at) VALUES ('${P}_te', '${P}', 'synthesize', 'last-provider', 0, 30000, 'error', NOW())`,
    `SELECT * FROM "Trace" WHERE user_id = '${P}' ORDER BY created_at DESC LIMIT 100`,
    `SELECT * FROM trace_totals('${P}')`,
    `DELETE FROM "Trace" WHERE user_id = '${P}'`],
  'security log: insert, count, delete': [
    `INSERT INTO "SecurityLog"(id,user_id,event_type,severity,ip_address,endpoint,message,created_at) VALUES ('${P}_s',NULL,'DBCHECK','INFO','203.0.113.9','/x','m',now())`,
    `SELECT count(*) FROM "SecurityLog" WHERE ip_address = '203.0.113.9' AND event_type = 'DBCHECK'`,
    `DELETE FROM "SecurityLog" WHERE id = '${P}_s'`],
  'erase an account through delete_user_data()': [newUser, `SELECT * FROM delete_user_data('${P}')`],
  'quota: reserve_quota, refund, purge_old_logs': [newUser,
    `SELECT reserve_quota('${P}_q', '${P}'::text, '203.0.113.9', 'generation', '/x', 10::int)`,
    `DELETE FROM "QuotaEvent" WHERE id = '${P}_q'`,
    `SELECT * FROM purge_old_logs()`],
};
const refused = {
  'read password_hash': `SELECT password_hash FROM "User" LIMIT 1`,
  'SELECT * from "User"': `SELECT * FROM "User" LIMIT 1`,
  'change an email': `UPDATE "User" SET email = 'x@test.invalid' WHERE id = '${P}'`,
  'change password_hash': `UPDATE "User" SET password_hash = 'x' WHERE id = '${P}'`,
  'mark an email verified': `UPDATE "User" SET email_verified = true WHERE id = '${P}'`,
  'change a role': `UPDATE "User" SET role = 'admin' WHERE id = '${P}'`,
  'delete a user': `DELETE FROM "User" WHERE id = '${P}'`,
  'TRUNCATE a table': `TRUNCATE "Trace"`,
  'edit a trace': `UPDATE "Trace" SET tokens_used = 1 WHERE id = '${P}'`,
  'edit a log row': `UPDATE "SecurityLog" SET message = 'x' WHERE id = '${P}'`,
  'drop a table': `DROP TABLE "Prompt"`,
  'alter a table': `ALTER TABLE "Prompt" ADD COLUMN probe int`,
  'drop the row-guard trigger': `DROP TRIGGER "Prompt_guard_update" ON "Prompt"`,
  'drop a size check': `ALTER TABLE "Prompt" DROP CONSTRAINT "Prompt_size_chk"`,
  'create a table': `CREATE TABLE probe_${P}(x int)`,
  'replace reserve_quota()': `CREATE OR REPLACE FUNCTION reserve_quota(text,text,text,text,text,integer,interval) RETURNS boolean LANGUAGE sql AS 'SELECT true'`,
  'read schema_migrations': `SELECT * FROM schema_migrations`,
  'insert an IdempotencyKey': `INSERT INTO "IdempotencyKey"(id,key,endpoint,status,expires_at) VALUES ('${P}','${P}','/x','s',now())`,
};

async function attempt(statements) {
  try {
    await sql.transaction((tx) => [
      ...(direct ? [] : [tx.query('SET LOCAL ROLE bedrock_app')]),
      ...statements.map((s) => tx.query(s)),
      tx.query(SENTINEL),
    ]);
    return 'NO ERROR (sentinel did not fire?)';
  } catch (e) {
    return String(e.message || e);
  }
}

let failures = 0;
for (const [name, list] of Object.entries(works)) {
  const msg = await attempt(list);
  const ok = /division by zero/.test(msg);
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  works:   ${name}${ok ? '' : `  -> ${msg.slice(0, 120)}`}`);
}
for (const [name, stmt] of Object.entries(refused)) {
  const msg = await attempt([newUser, stmt]);
  const ok = /permission denied|must be owner|ROW_IMMUTABLE|TRUNCATE_BLOCKED/.test(msg);
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  refused: ${name}  -> ${msg.slice(0, 80)}`);
}
if (direct) {
  const [t] = await sql`SELECT current_setting('statement_timeout') AS st, current_setting('lock_timeout') AS lt, current_setting('idle_in_transaction_session_timeout') AS it`;
  const ok = t.st === '20s' && t.lt === '5s' && t.it === '30s';
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  role time limits in effect over this connection: statement_timeout=${t.st} lock_timeout=${t.lt} idle_in_transaction=${t.it}`);
} else {
  console.log('INFO  role time limits apply only to real bedrock_app logins: set DATABASE_URL_APP_DEV to check them');
}
console.log(`\n${failures === 0 ? 'every check passed' : `${failures} check(s) FAILED`} (nothing was kept: every check was rolled back)`);
process.exit(failures === 0 ? 0 : 1);
