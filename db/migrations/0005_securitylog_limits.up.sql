-- 0005_securitylog_limits: size limits on "SecurityLog" so one bad or hostile request cannot write huge log rows.
-- Existing data: the CHECK is added NOT VALID, so old rows are never rejected or rewritten; it applies to new rows only.
-- Effect on the API: an over-long row is refused. logSecurityEvent (api/_lib/db.ts) catches the error, so the request
-- still works but that one log line is lost; callers should cut values to size before inserting (REQUEST to Backend).
-- migrate:break
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SecurityLog_size_chk') THEN
    ALTER TABLE "SecurityLog" ADD CONSTRAINT "SecurityLog_size_chk" CHECK (
      char_length(message) <= 2000
      AND (ip_address IS NULL OR char_length(ip_address) <= 64)
      AND char_length(event_type) <= 100
      AND (endpoint IS NULL OR char_length(endpoint) <= 200)
    ) NOT VALID;
  END IF;
END $$;
