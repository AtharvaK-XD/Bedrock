-- 0009 DOWN: removes the case-insensitive username index. No row data is touched.
-- migrate:break
DROP INDEX CONCURRENTLY IF EXISTS "User_username_lower_key";
