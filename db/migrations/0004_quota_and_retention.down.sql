-- 0004 DOWN: removes the quota table and both functions. Only quota counters are lost (they expire after 5 hours anyway).
-- migrate:break
DROP FUNCTION IF EXISTS purge_old_logs(integer);
-- migrate:break
DROP FUNCTION IF EXISTS reserve_quota(text, text, text, text, text, integer, interval);
-- migrate:break
DROP TABLE IF EXISTS "QuotaEvent";
