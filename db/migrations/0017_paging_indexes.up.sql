-- 0017_paging_indexes: indexes that make "page 2, page 3 ..." of the saved prompts and workflows lists fast and stable.
-- The list queries in db/PAGING.md sort by (updated_at DESC, id DESC) and continue after the last row seen (keyset
-- paging). The id tie-break keeps pages stable when several rows share the same updated_at. These indexes match that
-- order exactly, so a page of 50 reads 50 index entries no matter how many rows the user has.
-- Existing data: nothing is changed. Built CONCURRENTLY (no blocking). If a build is interrupted, run the .down file,
-- then this file again (check-schema reports INVALID indexes).
-- The older (user_id, updated_at DESC) indexes from 0002 stay; they become redundant once the lists are paged. Drop
-- them in a later migration after production has run with paging for a while (saves a little write cost).
-- migrate:break
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Prompt_user_updated_id_idx" ON "Prompt"(user_id, updated_at DESC, id DESC);
-- migrate:break
CREATE INDEX CONCURRENTLY IF NOT EXISTS "BranchingTree_user_updated_id_idx" ON "BranchingTree"(user_id, updated_at DESC, id DESC);
