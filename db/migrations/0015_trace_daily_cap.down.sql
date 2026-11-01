-- 0015 down: removes the daily usage-record cap. Data is not touched.
-- migrate:break
DROP TRIGGER IF EXISTS "Trace_daily_cap" ON "Trace";
-- migrate:break
DROP FUNCTION IF EXISTS bedrock_enforce_trace_daily_cap();
