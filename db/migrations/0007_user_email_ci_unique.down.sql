-- 0007 DOWN: removes the case-insensitive email index. No row data is touched.
-- migrate:break
DROP INDEX CONCURRENTLY IF EXISTS "User_email_lower_key";
