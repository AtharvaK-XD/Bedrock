-- 0002_indexes: speeds up the quota count and the per-user lists. Additive only; no data is changed.
-- CONCURRENTLY = built without blocking live traffic (that is why each index is its own statement).
-- If a build is interrupted Postgres leaves an INVALID index: run the .down file, then run this again.
-- migrate:break
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Trace_user_id_created_at_idx" ON "Trace"(user_id, created_at DESC);
-- migrate:break
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Prompt_user_id_updated_at_idx" ON "Prompt"(user_id, updated_at DESC);
-- migrate:break
CREATE INDEX CONCURRENTLY IF NOT EXISTS "BranchingTree_user_id_updated_at_idx" ON "BranchingTree"(user_id, updated_at DESC);
-- migrate:break
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SecurityLog_user_event_created_idx" ON "SecurityLog"(user_id, event_type, created_at DESC);
-- migrate:break
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SecurityLog_anon_ip_event_created_idx" ON "SecurityLog"(ip_address, event_type, created_at DESC) WHERE user_id IS NULL;
-- migrate:break
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SecurityLog_created_at_idx" ON "SecurityLog"(created_at);
-- migrate:break
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Trace_created_at_idx" ON "Trace"(created_at);
