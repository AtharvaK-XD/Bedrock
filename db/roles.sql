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
-- "User": column by column, exactly what api/** uses (checked on main 95bc7c2). No DELETE.
-- Read: every column EXCEPT password_hash (auth.ts sign-in lookup, profile GET; nothing in the API reads password_hash
-- since CHG-0023). `SELECT *` or `SELECT password_hash` as bedrock_app now fails with 42501.
GRANT SELECT (id, email, name, username, avatar_url, avatar_initials, plan, role, bio, location, organization,
  github, huggingface, website, joined_date, email_verified, mfa_enabled, razorpay_customer_id, razorpay_subscription_id,
  subscription_tier, created_at, updated_at, birth_date, referral_source, plan_expires_at) ON "User" TO bedrock_app;
-- migrate:break
-- Add: the first-login insert in auth.ts (these 12 columns; the rest take their defaults).
GRANT INSERT (id, email, password_hash, name, username, plan, role, email_verified, mfa_enabled, subscription_tier,
  created_at, updated_at) ON "User" TO bedrock_app;
-- migrate:break
-- Change: profile PUT (name ... website, birth_date, referral_source), plan/tier change (plan, subscription_tier,
-- plan_expires_at: migration 0020, set by a payment),
-- sign-in upsert (updated_at).
-- email, password_hash, email_verified, mfa_enabled, role, id and created_at cannot be changed by the app.
GRANT UPDATE (name, username, bio, location, organization, github, huggingface, website, birth_date, referral_source,
  plan, subscription_tier, plan_expires_at, updated_at) ON "User" TO bedrock_app;
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
-- payments: create-order inserts the pending order, verify-payment reads it and marks it paid. No DELETE: payment
-- records are kept (tax and dispute evidence).
GRANT SELECT, INSERT, UPDATE ON "PaymentRecord" TO bedrock_app;
-- migrate:break
-- Functions: only the app (and the owner) may run them. This also covers migration 0006, whichever runs first.
REVOKE EXECUTE ON FUNCTION reserve_quota(text, text, text, text, text, integer, interval) FROM PUBLIC;
-- migrate:break
REVOKE EXECUTE ON FUNCTION purge_old_logs(integer) FROM PUBLIC;
-- migrate:break
REVOKE EXECUTE ON FUNCTION trace_totals(text) FROM PUBLIC;
-- migrate:break
REVOKE EXECUTE ON FUNCTION delete_user_data(text) FROM PUBLIC;
-- migrate:break
GRANT EXECUTE ON FUNCTION reserve_quota(text, text, text, text, text, integer, interval) TO bedrock_app;
-- migrate:break
GRANT EXECUTE ON FUNCTION purge_old_logs(integer) TO bedrock_app;
-- migrate:break
GRANT EXECUTE ON FUNCTION trace_totals(text) TO bedrock_app;
-- migrate:break
-- The ONLY way the app can erase an account (it has no DELETE right on "User"): SECURITY DEFINER, migration 0014.
GRANT EXECUTE ON FUNCTION delete_user_data(text) TO bedrock_app;
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
-- migrate:break
-- Branching v2 (migration 0021): version history, run records, share links. Given only when the tables exist, so
-- this file still runs cleanly on a database that does not have 0021 yet (run it again after applying 0021).
--   "WorkflowVersion": save a version, list / open / restore, keep the last 20 (delete). Never edited.
--   "WorkflowRun":     save a run record, stats, 90-day cleanup (delete). Never edited.
--   "WorkflowShare":   create a link, open it, revoke it (revoked_at) and count views (view_count). Nothing else in a
--                      link can change, and links are never deleted by the app (they go with the workflow/account).
DO $$
BEGIN
  IF to_regclass('public."WorkflowVersion"') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, DELETE ON "WorkflowVersion" TO bedrock_app';
  END IF;
  IF to_regclass('public."WorkflowRun"') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, DELETE ON "WorkflowRun" TO bedrock_app';
  END IF;
  IF to_regclass('public."WorkflowShare"') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT ON "WorkflowShare" TO bedrock_app';
    EXECUTE 'GRANT UPDATE (revoked_at, view_count) ON "WorkflowShare" TO bedrock_app';
  END IF;
END $$;
-- migrate:break
--
-- Final check: one row per expected right. The runner prints them and fails if any is wrong.
SELECT c.item, c.ok FROM (VALUES
  ('User: reads the columns the API uses',   has_column_privilege('bedrock_app', '"User"', 'id', 'SELECT') AND has_column_privilege('bedrock_app', '"User"', 'email', 'SELECT') AND has_column_privilege('bedrock_app', '"User"', 'subscription_tier', 'SELECT') AND has_column_privilege('bedrock_app', '"User"', 'joined_date', 'SELECT')),
  ('User: cannot read password_hash',        NOT has_column_privilege('bedrock_app', '"User"', 'password_hash', 'SELECT') AND NOT has_table_privilege('bedrock_app', '"User"', 'SELECT')),
  ('User: first-login insert allowed',       has_column_privilege('bedrock_app', '"User"', 'password_hash', 'INSERT') AND has_column_privilege('bedrock_app', '"User"', 'email_verified', 'INSERT')),
  ('User: profile / plan / updated_at can change', has_column_privilege('bedrock_app', '"User"', 'bio', 'UPDATE') AND has_column_privilege('bedrock_app', '"User"', 'subscription_tier', 'UPDATE') AND has_column_privilege('bedrock_app', '"User"', 'updated_at', 'UPDATE')),
  ('User: email / password_hash / email_verified / role cannot change', NOT has_column_privilege('bedrock_app', '"User"', 'email', 'UPDATE') AND NOT has_column_privilege('bedrock_app', '"User"', 'password_hash', 'UPDATE') AND NOT has_column_privilege('bedrock_app', '"User"', 'email_verified', 'UPDATE') AND NOT has_column_privilege('bedrock_app', '"User"', 'role', 'UPDATE')),
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
  ('app can run reserve_quota / purge_old_logs / trace_totals / delete_user_data',
     has_function_privilege('bedrock_app', 'reserve_quota(text,text,text,text,text,integer,interval)', 'EXECUTE')
     AND has_function_privilege('bedrock_app', 'purge_old_logs(integer)', 'EXECUTE')
     AND has_function_privilege('bedrock_app', 'trace_totals(text)', 'EXECUTE')
     AND has_function_privilege('bedrock_app', 'delete_user_data(text)', 'EXECUTE')),
  ('PUBLIC cannot run those functions',
     NOT has_function_privilege('public', 'reserve_quota(text,text,text,text,text,integer,interval)', 'EXECUTE')
     AND NOT has_function_privilege('public', 'purge_old_logs(integer)', 'EXECUTE')
     AND NOT has_function_privilege('public', 'trace_totals(text)', 'EXECUTE')
     AND NOT has_function_privilege('public', 'delete_user_data(text)', 'EXECUTE')),
  -- 0021 (true when the table does not exist yet: nothing to grant)
  ('WorkflowVersion: read / add / delete, never edit',
     CASE WHEN to_regclass('public."WorkflowVersion"') IS NULL THEN true ELSE
       has_table_privilege('bedrock_app', '"WorkflowVersion"', 'SELECT') AND has_table_privilege('bedrock_app', '"WorkflowVersion"', 'INSERT')
       AND has_table_privilege('bedrock_app', '"WorkflowVersion"', 'DELETE') AND NOT has_any_column_privilege('bedrock_app', '"WorkflowVersion"', 'UPDATE') END),
  ('WorkflowRun: read / add / delete, never edit',
     CASE WHEN to_regclass('public."WorkflowRun"') IS NULL THEN true ELSE
       has_table_privilege('bedrock_app', '"WorkflowRun"', 'SELECT') AND has_table_privilege('bedrock_app', '"WorkflowRun"', 'INSERT')
       AND has_table_privilege('bedrock_app', '"WorkflowRun"', 'DELETE') AND NOT has_any_column_privilege('bedrock_app', '"WorkflowRun"', 'UPDATE') END),
  ('WorkflowShare: read / add / revoke + view count only, never delete',
     CASE WHEN to_regclass('public."WorkflowShare"') IS NULL THEN true ELSE
       has_table_privilege('bedrock_app', '"WorkflowShare"', 'SELECT') AND has_table_privilege('bedrock_app', '"WorkflowShare"', 'INSERT')
       AND has_column_privilege('bedrock_app', '"WorkflowShare"', 'revoked_at', 'UPDATE') AND has_column_privilege('bedrock_app', '"WorkflowShare"', 'view_count', 'UPDATE')
       AND NOT has_column_privilege('bedrock_app', '"WorkflowShare"', 'token', 'UPDATE') AND NOT has_column_privilege('bedrock_app', '"WorkflowShare"', 'workflow_id', 'UPDATE')
       AND NOT has_column_privilege('bedrock_app', '"WorkflowShare"', 'user_id', 'UPDATE') AND NOT has_table_privilege('bedrock_app', '"WorkflowShare"', 'DELETE') END)
) AS c(item, ok);
