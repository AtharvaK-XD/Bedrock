-- 0004_quota_and_retention: race-proof quota counting + cleanup of old logs.
-- Existing data: only NEW objects are created; no existing table is changed.
-- The race it prevents: two requests arriving together both read "9 used", both pass, and the user gets 11.
-- reserve_quota() takes a per-user (or per-IP) lock for the length of the call, so the second request waits
-- until the first one has written its row, then counts it. The same id sent twice (a retry) is counted once.
-- Quota rows now live in their own table so the audit log (SecurityLog) stays small.
-- migrate:break
CREATE TABLE IF NOT EXISTS "QuotaEvent" (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  ip_address TEXT,
  bucket TEXT NOT NULL,
  endpoint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- migrate:break
CREATE INDEX IF NOT EXISTS "QuotaEvent_user_bucket_created_idx" ON "QuotaEvent"(user_id, bucket, created_at DESC);
-- migrate:break
CREATE INDEX IF NOT EXISTS "QuotaEvent_anon_ip_bucket_created_idx" ON "QuotaEvent"(ip_address, bucket, created_at DESC) WHERE user_id IS NULL;
-- migrate:break
CREATE INDEX IF NOT EXISTS "QuotaEvent_created_at_idx" ON "QuotaEvent"(created_at);
-- migrate:break
-- Returns true = unit granted (row written), false = limit reached (nothing written).
CREATE OR REPLACE FUNCTION reserve_quota(
  p_id text, p_user_id text, p_ip text, p_bucket text, p_endpoint text,
  p_limit integer, p_window interval DEFAULT interval '5 hours'
) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  v_key text;
  v_used integer;
BEGIN
  IF p_user_id IS NOT NULL THEN
    v_key := 'u:' || p_user_id || ':' || p_bucket;
  ELSE
    v_key := 'ip:' || coalesce(p_ip, 'unknown') || ':' || p_bucket;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_key, 0));

  IF EXISTS (SELECT 1 FROM "QuotaEvent" WHERE id = p_id) THEN
    RETURN true;  -- retry of an already-granted reservation: do not count twice
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT count(*) INTO v_used FROM "QuotaEvent"
      WHERE user_id = p_user_id AND bucket = p_bucket AND created_at >= clock_timestamp() - p_window;
  ELSE
    SELECT count(*) INTO v_used FROM "QuotaEvent"
      WHERE user_id IS NULL AND ip_address = p_ip AND bucket = p_bucket AND created_at >= clock_timestamp() - p_window;
  END IF;

  IF v_used >= p_limit THEN
    RETURN false;
  END IF;

  INSERT INTO "QuotaEvent"(id, user_id, ip_address, bucket, endpoint) VALUES (p_id, p_user_id, p_ip, p_bucket, p_endpoint);
  RETURN true;
END $$;
-- migrate:break
-- Cleanup in small batches so it never locks the tables for long. Call it repeatedly (e.g. from a daily job)
-- until every returned count is 0. Retention (tunable): quota rows 1 day; SecurityLog 90 days
-- (old-style AI_QUOTA_* rows in SecurityLog: 1 day); Trace 90 days; expired IdempotencyKey rows.
CREATE OR REPLACE FUNCTION purge_old_logs(p_batch integer DEFAULT 5000)
RETURNS TABLE(quota_events integer, security_logs integer, traces integer, idempotency_keys integer)
LANGUAGE plpgsql AS $$
DECLARE a integer; b integer; c integer; d integer;
BEGIN
  DELETE FROM "QuotaEvent" WHERE id IN (
    SELECT id FROM "QuotaEvent" WHERE created_at < clock_timestamp() - interval '1 day' LIMIT p_batch);
  GET DIAGNOSTICS a = ROW_COUNT;

  DELETE FROM "SecurityLog" WHERE id IN (
    SELECT id FROM "SecurityLog"
    WHERE (event_type LIKE 'AI\_QUOTA\_%' AND created_at < (now() AT TIME ZONE 'UTC') - interval '1 day')
       OR created_at < (now() AT TIME ZONE 'UTC') - interval '90 days'
    LIMIT p_batch);
  GET DIAGNOSTICS b = ROW_COUNT;

  DELETE FROM "Trace" WHERE id IN (
    SELECT id FROM "Trace" WHERE created_at < (now() AT TIME ZONE 'UTC') - interval '90 days' LIMIT p_batch);
  GET DIAGNOSTICS c = ROW_COUNT;

  DELETE FROM "IdempotencyKey" WHERE id IN (
    SELECT id FROM "IdempotencyKey" WHERE expires_at < (now() AT TIME ZONE 'UTC') LIMIT p_batch);
  GET DIAGNOSTICS d = ROW_COUNT;

  RETURN QUERY SELECT a, b, c, d;
END $$;
