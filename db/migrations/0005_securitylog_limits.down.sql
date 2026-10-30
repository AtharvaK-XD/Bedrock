-- 0005 DOWN: removes the SecurityLog size limit. No row data is touched.
-- migrate:break
ALTER TABLE "SecurityLog" DROP CONSTRAINT IF EXISTS "SecurityLog_size_chk";
