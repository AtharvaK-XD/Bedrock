-- 0006_function_grants: Postgres lets EVERY database role (PUBLIC) run a new function by default.
-- This removes that default for the two app functions. The role that runs migrations owns the functions and keeps
-- full rights. No table data is touched.
-- APPLY ONLY IF the app connects with the same role that runs migrations (compare `SELECT current_user` on both
-- connections), or after you add `GRANT EXECUTE ... TO <app role>` below. Otherwise every AI request gets 503
-- (quota check fails closed) and the daily cleanup stops. See db/ROLES.md.
-- migrate:break
REVOKE EXECUTE ON FUNCTION reserve_quota(text, text, text, text, text, integer, interval) FROM PUBLIC;
-- migrate:break
REVOKE EXECUTE ON FUNCTION purge_old_logs(integer) FROM PUBLIC;
