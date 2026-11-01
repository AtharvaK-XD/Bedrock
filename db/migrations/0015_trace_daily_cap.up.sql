-- 0015_trace_daily_cap: at most 5,000 usage records ("Trace") per user per rolling 24 hours.
-- Why: POST /api/traces lets any signed-in user write usage records; with only the general request limit (about
-- 170,000 a day) one account could fill the table. Normal use is far below 5,000 a day (a generation is capped by the
-- usage limit, and the dashboard shows 100 rows).
-- The 5,001st record in 24 hours is refused with error 23514 and the text DAILY_TRACE_LIMIT. The count is bounded
-- (it stops counting at the cap), so each insert stays cheap and uses "Trace_user_id_created_at_idx" (0002).
-- Soft cap: two inserts at the very same instant may both pass at 4,999 (can overshoot by a few). Good enough for abuse.
-- Server-written records (recordExecutionTrace) already ignore failures (try/catch), so a refused record never breaks
-- an AI request; the client route should answer 429 (REQUEST to Backend in the HANDOFF).
-- Existing data: nothing is changed. Changing the number later = a new migration (drop + create the trigger).
-- migrate:break
CREATE OR REPLACE FUNCTION bedrock_enforce_trace_daily_cap() RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
DECLARE
  v_cap integer := TG_ARGV[0]::integer;
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM (
    SELECT 1 FROM "Trace"
    WHERE user_id = NEW.user_id AND created_at > (now() AT TIME ZONE 'UTC') - interval '24 hours'
    LIMIT v_cap
  ) recent;
  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'DAILY_TRACE_LIMIT: at most % usage records per user per 24 hours', v_cap
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
-- migrate:break
DROP TRIGGER IF EXISTS "Trace_daily_cap" ON "Trace";
-- migrate:break
CREATE TRIGGER "Trace_daily_cap" BEFORE INSERT ON "Trace"
  FOR EACH ROW EXECUTE FUNCTION bedrock_enforce_trace_daily_cap(5000);
