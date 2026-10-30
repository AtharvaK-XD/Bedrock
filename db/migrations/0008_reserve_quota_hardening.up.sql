-- 0008_reserve_quota_hardening: closes 3 weak spots found by tests (approved by Atharva 2026-10-31).
-- Same function name, inputs and true/false answer, so the API (api/_lib/security.ts) needs no change.
--   1. no user AND no IP was never limited (count matched nothing)  -> a missing/empty IP now counts as 'unknown'
--   2. reusing another caller's reservation id returned a free "yes" -> a repeated id only counts as a retry when
--      it belongs to the same user (or the same IP for anonymous callers) and the same bucket; otherwise "no"
--   3. a very long IP / endpoint was stored as-is                   -> cut to 64 / 200 characters
--   plus: a limit of 0 or less, or a window of 0 or less, always answers "no".
-- Not reachable through today's API (it always sends a cut IP and a random server id); this is defense in depth.
-- Existing data: none changed. Rows written before this keep counting normally.
-- migrate:break
CREATE OR REPLACE FUNCTION reserve_quota(
  p_id text, p_user_id text, p_ip text, p_bucket text, p_endpoint text,
  p_limit integer, p_window interval DEFAULT interval '5 hours'
) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  v_ip text := left(coalesce(nullif(btrim(p_ip), ''), 'unknown'), 64);
  v_key text;
  v_used integer;
BEGIN
  IF p_limit IS NULL OR p_limit <= 0 OR p_window IS NULL OR p_window <= interval '0' THEN
    RETURN false;
  END IF;

  IF p_user_id IS NOT NULL THEN
    v_key := 'u:' || p_user_id || ':' || p_bucket;
  ELSE
    v_key := 'ip:' || v_ip || ':' || p_bucket;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_key, 0));

  IF EXISTS (SELECT 1 FROM "QuotaEvent" WHERE id = p_id) THEN
    -- a retry of the caller's own reservation counts once; someone else's id is never a free unit
    RETURN EXISTS (
      SELECT 1 FROM "QuotaEvent"
      WHERE id = p_id AND bucket = p_bucket
        AND user_id IS NOT DISTINCT FROM p_user_id
        AND (p_user_id IS NOT NULL OR ip_address = v_ip)
    );
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT count(*) INTO v_used FROM "QuotaEvent"
      WHERE user_id = p_user_id AND bucket = p_bucket AND created_at >= clock_timestamp() - p_window;
  ELSE
    SELECT count(*) INTO v_used FROM "QuotaEvent"
      WHERE user_id IS NULL AND ip_address = v_ip AND bucket = p_bucket AND created_at >= clock_timestamp() - p_window;
  END IF;

  IF v_used >= p_limit THEN
    RETURN false;
  END IF;

  INSERT INTO "QuotaEvent"(id, user_id, ip_address, bucket, endpoint)
    VALUES (p_id, p_user_id, v_ip, p_bucket, left(p_endpoint, 200));
  RETURN true;
END $$;
