-- 0002_indexes DOWN: removes only the indexes added by 0002. No table data is touched.
-- migrate:break
DROP INDEX CONCURRENTLY IF EXISTS "Trace_user_id_created_at_idx";
-- migrate:break
DROP INDEX CONCURRENTLY IF EXISTS "Prompt_user_id_updated_at_idx";
-- migrate:break
DROP INDEX CONCURRENTLY IF EXISTS "BranchingTree_user_id_updated_at_idx";
-- migrate:break
DROP INDEX CONCURRENTLY IF EXISTS "SecurityLog_user_event_created_idx";
-- migrate:break
DROP INDEX CONCURRENTLY IF EXISTS "SecurityLog_anon_ip_event_created_idx";
-- migrate:break
DROP INDEX CONCURRENTLY IF EXISTS "SecurityLog_created_at_idx";
-- migrate:break
DROP INDEX CONCURRENTLY IF EXISTS "Trace_created_at_idx";
