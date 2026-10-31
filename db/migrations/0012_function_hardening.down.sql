-- 0012 down: back to the default settings (as after 0010). Data is not touched.
-- migrate:break
ALTER FUNCTION reserve_quota(text, text, text, text, text, integer, interval) RESET ALL;
-- migrate:break
ALTER FUNCTION purge_old_logs(integer) RESET ALL;
-- migrate:break
ALTER FUNCTION trace_totals(text) RESET ALL;
-- migrate:break
ALTER FUNCTION bedrock_enforce_row_cap() RESET ALL;
