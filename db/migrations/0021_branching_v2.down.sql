-- 0021 down: removes the Branching v2 storage (versions, run records, share links) and puts delete_user_data() back
-- to the 0019 version. Existing tables and rows are not touched.
-- REFUSES (nothing is changed) while any of the three tables holds rows: dropping them would destroy people's saved
-- versions and history and switch off their share links. If the Branching v2 API misbehaves, roll back the CODE (the
-- tables are harmless when nothing uses them). Only if the tables really must go: empty them on purpose first, with
-- Atharva's explicit approval (db/RUNBOOK.md, "Branching v2 (0021)").
-- Deploy code that does not use these tables BEFORE running this, or the new API answers 503 FEATURE_NOT_READY.
-- migrate:break
DO $$
DECLARE v_rows bigint := 0;
BEGIN
  IF to_regclass('public."WorkflowVersion"') IS NOT NULL THEN
    v_rows := v_rows + (SELECT count(*) FROM "WorkflowVersion");
  END IF;
  IF to_regclass('public."WorkflowRun"') IS NOT NULL THEN
    v_rows := v_rows + (SELECT count(*) FROM "WorkflowRun");
  END IF;
  IF to_regclass('public."WorkflowShare"') IS NOT NULL THEN
    v_rows := v_rows + (SELECT count(*) FROM "WorkflowShare");
  END IF;
  IF v_rows > 0 THEN
    RAISE EXCEPTION 'BRANCHING_V2_HAS_DATA: % row(s) in "WorkflowVersion" / "WorkflowRun" / "WorkflowShare" (saved versions, run history, share links). Undoing 0021 would delete them. Nothing was changed.', v_rows;
  END IF;
END $$;
-- migrate:break
-- delete_user_data(): back to exactly the 0019 function (before the tables go, so it never names a missing table).
CREATE OR REPLACE FUNCTION delete_user_data(p_user_id text)
RETURNS TABLE(deleted_user boolean, prompts integer, workflows integer, traces integer,
              quota_events integer, idempotency_keys integer, logs_unlinked integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
SET lock_timeout = '5s'
AS $$
DECLARE
  r record;
  n bigint;
  v_prompts integer := 0;
  v_workflows integer := 0;
  v_traces integer := 0;
  v_quota integer := 0;
  v_idem integer := 0;
  v_logs integer := 0;
  v_found boolean;
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = '' THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED: an account id is needed' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Same lock order as api/billing/verify-payment.ts (order rows first, then the account row): no deadlock when a
  -- payment is verified while the account is being deleted.
  PERFORM 1 FROM "PaymentRecord" WHERE user_id = p_user_id ORDER BY id FOR UPDATE;
  PERFORM 1 FROM "User" WHERE id = p_user_id FOR UPDATE;
  v_found := FOUND;

  IF v_found THEN
    -- any other table with a foreign key to "User" that still holds records for this account: refuse.
    -- "PaymentRecord" is handled below (unpaid orders deleted, paid ones unlinked), so it is not in this check.
    FOR r IN
      SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f' AND c.confrelid = '"User"'::regclass AND array_length(c.conkey, 1) = 1
        AND c.conrelid::regclass::text NOT IN ('"Prompt"', '"BranchingTree"', '"Trace"', '"SecurityLog"', '"PaymentRecord"')
    LOOP
      EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.tbl, r.col) INTO n USING p_user_id;
      IF n > 0 THEN
        RAISE EXCEPTION 'OTHER_RECORDS: % record(s) in % depend on this account; nothing was deleted. Decide what to do with them first.', n, r.tbl
          USING ERRCODE = 'restrict_violation';
      END IF;
    END LOOP;

    SELECT count(*) INTO v_prompts FROM "Prompt" WHERE user_id = p_user_id;
    SELECT count(*) INTO v_workflows FROM "BranchingTree" WHERE user_id = p_user_id;
    SELECT count(*) INTO v_traces FROM "Trace" WHERE user_id = p_user_id;
    SELECT count(*) INTO v_logs FROM "SecurityLog" WHERE user_id = p_user_id;
    -- Rows that break a size rule added NOT VALID (0005) cannot be updated, which would block the automatic
    -- user_id -> NULL; remove only those.
    DELETE FROM "SecurityLog" WHERE user_id = p_user_id
      AND (char_length(message) > 2000 OR char_length(coalesce(ip_address, '')) > 64
           OR char_length(event_type) > 100 OR char_length(coalesce(endpoint, '')) > 200);

    -- Orders nobody paid: nothing to keep. Everything else (paid): keep the row, drop the link to the person.
    DELETE FROM "PaymentRecord" WHERE user_id = p_user_id AND status = 'created';
    UPDATE "PaymentRecord" SET user_id = NULL, updated_at = NOW() WHERE user_id = p_user_id;
  END IF;

  DELETE FROM "QuotaEvent" WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_quota = ROW_COUNT;
  DELETE FROM "IdempotencyKey" WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_idem = ROW_COUNT;

  IF v_found THEN
    DELETE FROM "User" WHERE id = p_user_id;
  END IF;

  RETURN QUERY SELECT v_found, v_prompts, v_workflows, v_traces, v_quota, v_idem, v_logs;
END $$;
-- migrate:break
-- Reverse order. Dropping a table also drops its indexes, constraints and triggers.
DROP TABLE IF EXISTS "WorkflowShare";
-- migrate:break
DROP TABLE IF EXISTS "WorkflowRun";
-- migrate:break
DROP TABLE IF EXISTS "WorkflowVersion";
-- migrate:break
DROP FUNCTION IF EXISTS bedrock_enforce_run_daily_cap();
-- migrate:break
DROP FUNCTION IF EXISTS bedrock_workflow_owner_check();
