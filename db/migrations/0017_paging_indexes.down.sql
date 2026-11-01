-- 0017 down: removes the paging indexes (the 0002 indexes still serve the old queries). Data is not touched.
-- migrate:break
DROP INDEX CONCURRENTLY IF EXISTS "Prompt_user_updated_id_idx";
-- migrate:break
DROP INDEX CONCURRENTLY IF EXISTS "BranchingTree_user_updated_id_idx";
