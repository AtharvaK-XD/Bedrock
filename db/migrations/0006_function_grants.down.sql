-- 0006 DOWN: restores the Postgres default (any role may run the two functions).
-- migrate:break
GRANT EXECUTE ON FUNCTION reserve_quota(text, text, text, text, text, integer, interval) TO PUBLIC;
-- migrate:break
GRANT EXECUTE ON FUNCTION purge_old_logs(integer) TO PUBLIC;
