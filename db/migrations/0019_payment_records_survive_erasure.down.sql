-- 0019 down: back to the 0014 behaviour (payment rows must belong to an account; deleting an account is refused while
-- it has payment rows). REFUSES (nothing is changed) when unlinked payment rows exist, because they cannot get a
-- NOT NULL user_id back. Those rows are the records 0019 was written to keep: do not delete them to make this pass.
-- migrate:break
DO $$
DECLARE v_orphans bigint;
BEGIN
  SELECT count(*) INTO v_orphans FROM "PaymentRecord" WHERE user_id IS NULL;
  IF v_orphans > 0 THEN
    RAISE EXCEPTION 'PAYMENT_RECORDS_UNLINKED: % payment row(s) no longer belong to an account (kept on purpose after account deletion); this migration cannot be undone while they exist. Nothing was changed.', v_orphans;
  END IF;
END $$;
-- migrate:break
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

  PERFORM 1 FROM "User" WHERE id = p_user_id FOR UPDATE;
  v_found := FOUND;

  IF v_found THEN
    FOR r IN
      SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f' AND c.confrelid = '"User"'::regclass AND array_length(c.conkey, 1) = 1
        AND c.conrelid::regclass::text NOT IN ('"Prompt"', '"BranchingTree"', '"Trace"', '"SecurityLog"')
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
    DELETE FROM "SecurityLog" WHERE user_id = p_user_id
      AND (char_length(message) > 2000 OR char_length(coalesce(ip_address, '')) > 64
           OR char_length(event_type) > 100 OR char_length(coalesce(endpoint, '')) > 200);
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
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.conrelid = '"PaymentRecord"'::regclass AND c.confrelid = '"User"'::regclass
      AND array_length(c.conkey, 1) = 1 AND a.attname = 'user_id' AND c.confdeltype <> 'c'
  LOOP
    EXECUTE format('ALTER TABLE "PaymentRecord" DROP CONSTRAINT %I', r.conname);
    ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_user_id_fkey"
      FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
  END LOOP;
END $$;
-- migrate:break
ALTER TABLE "PaymentRecord" VALIDATE CONSTRAINT "PaymentRecord_user_id_fkey";
-- migrate:break
ALTER TABLE "PaymentRecord" ALTER COLUMN user_id SET NOT NULL;
-- migrate:break
DROP INDEX CONCURRENTLY IF EXISTS "PaymentRecord_user_id_status_idx";
