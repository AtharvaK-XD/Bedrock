-- 0003_limits_and_checks: size limits, sanity checks and a per-user row cap.
-- Existing data: every CHECK is added NOT VALID, which means it is enforced on NEW and CHANGED rows only;
-- old rows are never rejected or rewritten. Run `VALIDATE CONSTRAINT` later once you have confirmed old rows comply.
-- Limits (tunable): prompt content 200,000 chars, workflow nodes/edges 1,000,000 chars each,
-- titles 500, ids 100, max 2,000 prompts and 500 workflows per user.
-- migrate:break
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Prompt_size_chk') THEN
    ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_size_chk" CHECK (
      char_length(id) <= 100 AND char_length(title) <= 500 AND char_length(snippet) <= 2000
      AND char_length(full_content) <= 200000 AND char_length(tags) <= 5000 AND char_length(target_type) <= 100
    ) NOT VALID;
  END IF;
END $$;
-- migrate:break
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BranchingTree_size_chk') THEN
    ALTER TABLE "BranchingTree" ADD CONSTRAINT "BranchingTree_size_chk" CHECK (
      char_length(id) <= 100 AND char_length(title) <= 500
      AND char_length(nodes) <= 1000000 AND char_length(edges) <= 1000000
    ) NOT VALID;
  END IF;
END $$;
-- migrate:break
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Trace_sanity_chk') THEN
    ALTER TABLE "Trace" ADD CONSTRAINT "Trace_sanity_chk" CHECK (
      tokens_used >= 0 AND latency_ms >= 0
      AND char_length(id) <= 100 AND char_length(node_origin) <= 200
      AND char_length(model_target) <= 200 AND char_length(status) <= 32
    ) NOT VALID;
  END IF;
END $$;
-- migrate:break
-- Row cap. Updates of an existing row (the "ON CONFLICT DO UPDATE" save path) are let through,
-- otherwise a user at the cap could no longer edit what they already have.
CREATE OR REPLACE FUNCTION bedrock_enforce_row_cap() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_cap integer := TG_ARGV[0]::integer;
  v_count integer;
BEGIN
  IF TG_TABLE_NAME = 'Prompt' THEN
    IF EXISTS (SELECT 1 FROM "Prompt" WHERE id = NEW.id) THEN RETURN NEW; END IF;
    SELECT count(*) INTO v_count FROM "Prompt" WHERE user_id = NEW.user_id;
  ELSE
    IF EXISTS (SELECT 1 FROM "BranchingTree" WHERE id = NEW.id) THEN RETURN NEW; END IF;
    SELECT count(*) INTO v_count FROM "BranchingTree" WHERE user_id = NEW.user_id;
  END IF;
  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'ROW_LIMIT_EXCEEDED: % allows at most % rows per user', TG_TABLE_NAME, v_cap
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
-- migrate:break
DROP TRIGGER IF EXISTS "Prompt_row_cap" ON "Prompt";
-- migrate:break
CREATE TRIGGER "Prompt_row_cap" BEFORE INSERT ON "Prompt"
  FOR EACH ROW EXECUTE FUNCTION bedrock_enforce_row_cap(2000);
-- migrate:break
DROP TRIGGER IF EXISTS "BranchingTree_row_cap" ON "BranchingTree";
-- migrate:break
CREATE TRIGGER "BranchingTree_row_cap" BEFORE INSERT ON "BranchingTree"
  FOR EACH ROW EXECUTE FUNCTION bedrock_enforce_row_cap(500);
