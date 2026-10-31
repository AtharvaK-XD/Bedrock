-- 0011_row_guards: a second wall behind the API's owner checks.
--   * "User".id / created_at never change.
--   * "Prompt" / "BranchingTree": id, user_id (the owner) and created_at never change, so a saved item can never be
--     moved to another account, whatever SQL runs. Title / content edits by the owner work as before.
--   * "Trace", "QuotaEvent": add and delete only; existing rows cannot be edited (usage history cannot be rewritten).
--   * "SecurityLog": add and delete only; the one allowed change is user_id -> NULL, which the foreign key does
--     itself when a user is deleted (ON DELETE SET NULL, 0001).
--   * TRUNCATE (empty a whole table in one go) is refused on these 6 tables. The cleanup job uses DELETE, not TRUNCATE.
-- Checked against api/** on 2026-10-31: no API query changes any of these fields or updates these tables.
-- Existing data: nothing is changed. Error for a blocked change: ROW_IMMUTABLE / TRUNCATE_BLOCKED, code 42501.
-- An owner role can still drop these triggers on purpose; with the roles in db/roles.sql the app role cannot.
-- migrate:break
CREATE OR REPLACE FUNCTION bedrock_guard_update() RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_ARGV[0] = 'user' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'ROW_IMMUTABLE: "%".id and created_at cannot be changed', TG_TABLE_NAME
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF TG_ARGV[0] = 'owned' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'ROW_IMMUTABLE: "%".id, user_id and created_at cannot be changed', TG_TABLE_NAME
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF TG_ARGV[0] = 'log' THEN
    IF (to_jsonb(NEW) - 'user_id') IS DISTINCT FROM (to_jsonb(OLD) - 'user_id')
       OR (NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id IS NOT NULL) THEN
      RAISE EXCEPTION 'ROW_IMMUTABLE: "%" rows cannot be edited', TG_TABLE_NAME
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSE -- 'append_only'
    IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
      RAISE EXCEPTION 'ROW_IMMUTABLE: "%" rows cannot be edited', TG_TABLE_NAME
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END $$;
-- migrate:break
CREATE OR REPLACE FUNCTION bedrock_block_truncate() RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'TRUNCATE_BLOCKED: "%" cannot be emptied with TRUNCATE; delete rows with DELETE instead', TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END $$;
-- migrate:break
DROP TRIGGER IF EXISTS "User_guard_update" ON "User";
-- migrate:break
CREATE TRIGGER "User_guard_update" BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION bedrock_guard_update('user');
-- migrate:break
DROP TRIGGER IF EXISTS "Prompt_guard_update" ON "Prompt";
-- migrate:break
CREATE TRIGGER "Prompt_guard_update" BEFORE UPDATE ON "Prompt" FOR EACH ROW EXECUTE FUNCTION bedrock_guard_update('owned');
-- migrate:break
DROP TRIGGER IF EXISTS "BranchingTree_guard_update" ON "BranchingTree";
-- migrate:break
CREATE TRIGGER "BranchingTree_guard_update" BEFORE UPDATE ON "BranchingTree" FOR EACH ROW EXECUTE FUNCTION bedrock_guard_update('owned');
-- migrate:break
DROP TRIGGER IF EXISTS "Trace_guard_update" ON "Trace";
-- migrate:break
CREATE TRIGGER "Trace_guard_update" BEFORE UPDATE ON "Trace" FOR EACH ROW EXECUTE FUNCTION bedrock_guard_update('append_only');
-- migrate:break
DROP TRIGGER IF EXISTS "QuotaEvent_guard_update" ON "QuotaEvent";
-- migrate:break
CREATE TRIGGER "QuotaEvent_guard_update" BEFORE UPDATE ON "QuotaEvent" FOR EACH ROW EXECUTE FUNCTION bedrock_guard_update('append_only');
-- migrate:break
DROP TRIGGER IF EXISTS "SecurityLog_guard_update" ON "SecurityLog";
-- migrate:break
CREATE TRIGGER "SecurityLog_guard_update" BEFORE UPDATE ON "SecurityLog" FOR EACH ROW EXECUTE FUNCTION bedrock_guard_update('log');
-- migrate:break
DROP TRIGGER IF EXISTS "User_no_truncate" ON "User";
-- migrate:break
CREATE TRIGGER "User_no_truncate" BEFORE TRUNCATE ON "User" FOR EACH STATEMENT EXECUTE FUNCTION bedrock_block_truncate();
-- migrate:break
DROP TRIGGER IF EXISTS "Prompt_no_truncate" ON "Prompt";
-- migrate:break
CREATE TRIGGER "Prompt_no_truncate" BEFORE TRUNCATE ON "Prompt" FOR EACH STATEMENT EXECUTE FUNCTION bedrock_block_truncate();
-- migrate:break
DROP TRIGGER IF EXISTS "BranchingTree_no_truncate" ON "BranchingTree";
-- migrate:break
CREATE TRIGGER "BranchingTree_no_truncate" BEFORE TRUNCATE ON "BranchingTree" FOR EACH STATEMENT EXECUTE FUNCTION bedrock_block_truncate();
-- migrate:break
DROP TRIGGER IF EXISTS "Trace_no_truncate" ON "Trace";
-- migrate:break
CREATE TRIGGER "Trace_no_truncate" BEFORE TRUNCATE ON "Trace" FOR EACH STATEMENT EXECUTE FUNCTION bedrock_block_truncate();
-- migrate:break
DROP TRIGGER IF EXISTS "QuotaEvent_no_truncate" ON "QuotaEvent";
-- migrate:break
CREATE TRIGGER "QuotaEvent_no_truncate" BEFORE TRUNCATE ON "QuotaEvent" FOR EACH STATEMENT EXECUTE FUNCTION bedrock_block_truncate();
-- migrate:break
DROP TRIGGER IF EXISTS "SecurityLog_no_truncate" ON "SecurityLog";
-- migrate:break
CREATE TRIGGER "SecurityLog_no_truncate" BEFORE TRUNCATE ON "SecurityLog" FOR EACH STATEMENT EXECUTE FUNCTION bedrock_block_truncate();
