-- 0012_function_hardening: pins how the database functions find tables, and stops them from waiting forever on a lock.
--   * search_path = public, pg_temp: the functions always use the real tables in "public" (Postgres' own functions
--     are always looked up first), never a same-named object someone placed elsewhere. Standard hardening.
--   * lock_timeout = 5s on reserve_quota() and purge_old_logs(): if a lock is stuck, the call fails after 5 s instead
--     of hanging until Vercel kills the request. For reserve_quota() the API then refuses the AI request
--     (api/_lib/security.ts treats any error other than "function missing" as "quota unavailable": fail closed).
-- Same names, inputs and answers as before. Existing data: nothing is changed.
-- NOTE for later migrations: CREATE OR REPLACE FUNCTION on these functions drops these settings unless repeated there.
-- migrate:break
ALTER FUNCTION reserve_quota(text, text, text, text, text, integer, interval) SET search_path = public, pg_temp;
-- migrate:break
ALTER FUNCTION reserve_quota(text, text, text, text, text, integer, interval) SET lock_timeout = '5s';
-- migrate:break
ALTER FUNCTION purge_old_logs(integer) SET search_path = public, pg_temp;
-- migrate:break
ALTER FUNCTION purge_old_logs(integer) SET lock_timeout = '5s';
-- migrate:break
ALTER FUNCTION trace_totals(text) SET search_path = public, pg_temp;
-- migrate:break
ALTER FUNCTION bedrock_enforce_row_cap() SET search_path = public, pg_temp;
