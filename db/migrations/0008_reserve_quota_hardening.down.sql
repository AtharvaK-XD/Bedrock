-- 0008 DOWN: puts back the 0004 version of reserve_quota() (byte-for-byte the same body). No row data is touched.
-- CREATE OR REPLACE keeps the function's grants (0006), so no re-grant is needed.
-- migrate:break
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
