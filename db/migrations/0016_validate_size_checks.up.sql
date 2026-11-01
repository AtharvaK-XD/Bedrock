-- 0016_validate_size_checks: make the size rules of 0003 and 0005 cover OLD rows too.
-- Until now these four checks were NOT VALID: enforced for new and changed rows only, never looked at old rows.
-- VALIDATE scans each table once. It takes a light lock (reads and writes keep working) and changes no data.
-- Refuses (OLD_ROWS_BREAK_RULE, nothing is changed for that table) if any old row breaks its rule. Check first with
-- `node db/check-schema.mjs` (counts only). If rows break a rule, decide with Atharva whether to shorten or remove them.
-- Why it matters: while a check is NOT VALID, UPDATING an old row that breaks it fails, e.g. the automatic
-- "SecurityLog.user_id -> NULL" when an account is deleted.
-- For a big table run it at a quiet time; if the statement times out, nothing is changed and it can be run again.
-- migrate:break
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Prompt_size_chk' AND NOT convalidated) THEN
    ALTER TABLE "Prompt" VALIDATE CONSTRAINT "Prompt_size_chk";
  END IF;
EXCEPTION WHEN check_violation THEN
  RAISE EXCEPTION 'OLD_ROWS_BREAK_RULE: some "Prompt" rows are longer than Prompt_size_chk allows. Nothing was changed.';
END $$;
-- migrate:break
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BranchingTree_size_chk' AND NOT convalidated) THEN
    ALTER TABLE "BranchingTree" VALIDATE CONSTRAINT "BranchingTree_size_chk";
  END IF;
EXCEPTION WHEN check_violation THEN
  RAISE EXCEPTION 'OLD_ROWS_BREAK_RULE: some "BranchingTree" rows are longer than BranchingTree_size_chk allows. Nothing was changed.';
END $$;
-- migrate:break
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Trace_sanity_chk' AND NOT convalidated) THEN
    ALTER TABLE "Trace" VALIDATE CONSTRAINT "Trace_sanity_chk";
  END IF;
EXCEPTION WHEN check_violation THEN
  RAISE EXCEPTION 'OLD_ROWS_BREAK_RULE: some "Trace" rows break Trace_sanity_chk (negative numbers or too-long text). Nothing was changed.';
END $$;
-- migrate:break
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SecurityLog_size_chk' AND NOT convalidated) THEN
    ALTER TABLE "SecurityLog" VALIDATE CONSTRAINT "SecurityLog_size_chk";
  END IF;
EXCEPTION WHEN check_violation THEN
  RAISE EXCEPTION 'OLD_ROWS_BREAK_RULE: some "SecurityLog" rows are longer than SecurityLog_size_chk allows. Nothing was changed.';
END $$;
