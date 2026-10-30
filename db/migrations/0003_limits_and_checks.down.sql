-- 0003 DOWN: removes the limits and the row-cap triggers. No row data is touched.
-- migrate:break
DROP TRIGGER IF EXISTS "Prompt_row_cap" ON "Prompt";
-- migrate:break
DROP TRIGGER IF EXISTS "BranchingTree_row_cap" ON "BranchingTree";
-- migrate:break
DROP FUNCTION IF EXISTS bedrock_enforce_row_cap();
-- migrate:break
ALTER TABLE "Prompt" DROP CONSTRAINT IF EXISTS "Prompt_size_chk";
-- migrate:break
ALTER TABLE "BranchingTree" DROP CONSTRAINT IF EXISTS "BranchingTree_size_chk";
-- migrate:break
ALTER TABLE "Trace" DROP CONSTRAINT IF EXISTS "Trace_sanity_chk";
