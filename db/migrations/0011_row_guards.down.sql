-- 0011 down: removes the row guards and TRUNCATE blocks. Data is not touched.
-- migrate:break
DROP TRIGGER IF EXISTS "User_guard_update" ON "User";
-- migrate:break
DROP TRIGGER IF EXISTS "Prompt_guard_update" ON "Prompt";
-- migrate:break
DROP TRIGGER IF EXISTS "BranchingTree_guard_update" ON "BranchingTree";
-- migrate:break
DROP TRIGGER IF EXISTS "Trace_guard_update" ON "Trace";
-- migrate:break
DROP TRIGGER IF EXISTS "QuotaEvent_guard_update" ON "QuotaEvent";
-- migrate:break
DROP TRIGGER IF EXISTS "SecurityLog_guard_update" ON "SecurityLog";
-- migrate:break
DROP TRIGGER IF EXISTS "User_no_truncate" ON "User";
-- migrate:break
DROP TRIGGER IF EXISTS "Prompt_no_truncate" ON "Prompt";
-- migrate:break
DROP TRIGGER IF EXISTS "BranchingTree_no_truncate" ON "BranchingTree";
-- migrate:break
DROP TRIGGER IF EXISTS "Trace_no_truncate" ON "Trace";
-- migrate:break
DROP TRIGGER IF EXISTS "QuotaEvent_no_truncate" ON "QuotaEvent";
-- migrate:break
DROP TRIGGER IF EXISTS "SecurityLog_no_truncate" ON "SecurityLog";
-- migrate:break
DROP FUNCTION IF EXISTS bedrock_guard_update();
-- migrate:break
DROP FUNCTION IF EXISTS bedrock_block_truncate();
