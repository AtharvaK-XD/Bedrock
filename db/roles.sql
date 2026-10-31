-- db/roles.sql: least-privilege rights for the app's own database role, bedrock_app. Background: db/ROLES.md.
-- Run with:  node db/migrate.mjs roles --yes --host <host>   (connected as the CURRENT owner role, dev branch first)
-- Safe to run again: it first takes away every table right bedrock_app has, then gives exactly the list below.
-- It changes rights only. No table, column or row is changed.
-- The role itself must be created first (ROLES.md step 1); this file never contains a password.
-- migrate:break
DO $$
DECLARE r pg_roles%ROWTYPE;
BEGIN
  SELECT * INTO r FROM pg_roles WHERE rolname = 'bedrock_app';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROLE_MISSING: create the role bedrock_app first (db/ROLES.md step 1). Nothing was changed.';
  END IF;
  IF current_user = 'bedrock_app' THEN
    RAISE EXCEPTION 'WRONG_ROLE: run this as the owner role, not as bedrock_app. Nothing was changed.';
  END IF;
  IF r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolbypassrls OR r.rolreplication THEN
    RAISE EXCEPTION 'ROLE_TOO_POWERFUL: bedrock_app has superuser/createrole/createdb/bypassrls/replication. Create it with plain SQL (ROLES.md step 1). Nothing was changed.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles g WHERE g.rolname <> 'bedrock_app' AND pg_has_role('bedrock_app', g.oid, 'USAGE')) THEN
    RAISE EXCEPTION 'ROLE_HAS_MEMBERSHIPS: bedrock_app inherits rights from another role (for example neon_superuser, which roles made in the Neon console get). Create it with plain SQL (ROLES.md step 1). Nothing was changed.';
  END IF;
END $$;
-- migrate:break
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM bedrock_app;
-- migrate:break
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM bedrock_app;
-- migrate:break
-- Nobody but the owner may create objects in the schema (already the default on Postgres 15+).
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
-- migrate:break
GRANT USAGE ON SCHEMA public TO bedrock_app;
-- migrate:break
-- "User": sign-in lookup + first-login insert (api/_lib/auth.ts), profile read/update (api/user/profile.ts). No DELETE.
GRANT SELECT, INSERT, UPDATE ON "User" TO bedrock_app;
-- migrate:break
-- prompts / workflows: list, count, owner-checked update, insert, delete
GRANT SELECT, INSERT, UPDATE, DELETE ON "Prompt", "BranchingTree" TO bedrock_app;
-- migrate:break
-- usage history and logs: add, read, delete (refund, "clear my traces", cleanup). Never edit (also blocked by 0011).
GRANT SELECT, INSERT, DELETE ON "Trace", "SecurityLog", "QuotaEvent" TO bedrock_app;
-- migrate:break
-- cleanup of expired keys only
GRANT SELECT, DELETE ON "IdempotencyKey" TO bedrock_app;
-- migrate:break
-- Functions: only the app (and the owner) may run them. This also covers migration 0006, whichever runs first.
REVOKE EXECUTE ON FUNCTION reserve_quota(text, text, text, text, text, integer, interval) FROM PUBLIC;
-- migrate:break
REVOKE EXECUTE ON FUNCTION purge_old_logs(integer) FROM PUBLIC;
-- migrate:break
REVOKE EXECUTE ON FUNCTION trace_totals(text) FROM PUBLIC;
-- migrate:break
GRANT EXECUTE ON FUNCTION reserve_quota(text, text, text, text, text, integer, interval) TO bedrock_app;
-- migrate:break
GRANT EXECUTE ON FUNCTION purge_old_logs(integer) TO bedrock_app;
-- migrate:break
GRANT EXECUTE ON FUNCTION trace_totals(text) TO bedrock_app;
-- migrate:break
-- A runaway query or a stuck transaction from the app is stopped instead of holding the database.
-- (Takes effect on new connections. Every API query today finishes in well under a second.)
ALTER ROLE bedrock_app SET statement_timeout = '20s';
-- migrate:break
ALTER ROLE bedrock_app SET lock_timeout = '5s';
-- migrate:break
ALTER ROLE bedrock_app SET idle_in_transaction_session_timeout = '30s';
-- migrate:break
-- Tables not listed above (and any table a future migration adds) give bedrock_app NO access until a line is added
-- here. Add the rights for a new feature's table in the same change that adds the table, BEFORE Vercel uses bedrock_app.
--
-- OPTIONAL, only after api/_lib/auth.ts stops using SELECT * on "User" (OPEN-0030): hide password_hash from the app.
--   REVOKE SELECT ON "User" FROM bedrock_app;
--   GRANT SELECT (id, email, name, username, avatar_url, avatar_initials, plan, role, bio, location, organization,
--     github, huggingface, website, joined_date, email_verified, mfa_enabled, subscription_tier, created_at, updated_at)
--     ON "User" TO bedrock_app;
--
-- Final check: one row per expected right. The runner prints them and fails if any is wrong.
SELECT c.item, c.ok FROM (VALUES
  ('User: read / add / change',              has_table_privilege('bedrock_app', '"User"', 'SELECT,INSERT,UPDATE')),
  ('User: cannot delete or truncate',        NOT has_table_privilege('bedrock_app', '"User"', 'DELETE') AND NOT has_table_privilege('bedrock_app', '"User"', 'TRUNCATE')),
  ('Prompt: read / add / change / delete',   has_table_privilege('bedrock_app', '"Prompt"', 'SELECT') AND has_table_privilege('bedrock_app', '"Prompt"', 'INSERT') AND has_table_privilege('bedrock_app', '"Prompt"', 'UPDATE') AND has_table_privilege('bedrock_app', '"Prompt"', 'DELETE')),
  ('BranchingTree: read / add / change / delete', has_table_privilege('bedrock_app', '"BranchingTree"', 'SELECT') AND has_table_privilege('bedrock_app', '"BranchingTree"', 'INSERT') AND has_table_privilege('bedrock_app', '"BranchingTree"', 'UPDATE') AND has_table_privilege('bedrock_app', '"BranchingTree"', 'DELETE')),
  ('Trace: cannot edit rows',                NOT has_table_privilege('bedrock_app', '"Trace"', 'UPDATE')),
  ('SecurityLog: cannot edit rows',          NOT has_table_privilege('bedrock_app', '"SecurityLog"', 'UPDATE')),
  ('QuotaEvent: cannot edit rows',           NOT has_table_privilege('bedrock_app', '"QuotaEvent"', 'UPDATE')),
  ('IdempotencyKey: read / delete only',     has_table_privilege('bedrock_app', '"IdempotencyKey"', 'SELECT') AND NOT has_table_privilege('bedrock_app', '"IdempotencyKey"', 'INSERT')),
  ('no table can be truncated by the app',   NOT EXISTS (SELECT 1 FROM pg_tables t WHERE t.schemaname = 'public' AND has_table_privilege('bedrock_app', format('%I.%I', t.schemaname, t.tablename), 'TRUNCATE'))),
  ('no rights on schema_migrations',         CASE WHEN to_regclass('public.schema_migrations') IS NULL THEN true ELSE NOT has_table_privilege('bedrock_app', 'public.schema_migrations', 'SELECT') END),
  ('cannot create objects in the schema',    NOT has_schema_privilege('bedrock_app', 'public', 'CREATE')),
  ('app can run reserve_quota / purge_old_logs / trace_totals',
     has_function_privilege('bedrock_app', 'reserve_quota(text,text,text,text,text,integer,interval)', 'EXECUTE')
     AND has_function_privilege('bedrock_app', 'purge_old_logs(integer)', 'EXECUTE')
     AND has_function_privilege('bedrock_app', 'trace_totals(text)', 'EXECUTE')),
  ('PUBLIC cannot run those functions',
     NOT has_function_privilege('public', 'reserve_quota(text,text,text,text,text,integer,interval)', 'EXECUTE')
     AND NOT has_function_privilege('public', 'purge_old_logs(integer)', 'EXECUTE')
     AND NOT has_function_privilege('public', 'trace_totals(text)', 'EXECUTE'))
) AS c(item, ok);
