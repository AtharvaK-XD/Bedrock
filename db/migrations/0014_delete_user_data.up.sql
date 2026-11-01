-- 0014_delete_user_data: one safe, all-or-nothing way to erase an account's data (right to erasure).
-- delete_user_data(user_id) removes, in ONE transaction:
--   * the account row ("User") and, through the existing cascade, all their prompts, workflows and traces,
--   * their usage-limit rows ("QuotaEvent") and idempotency keys (no foreign key, so removed explicitly).
-- It KEEPS the security log rows (abuse investigation): the database already sets their user_id to NULL when the
-- account is deleted (ON DELETE SET NULL, 0001); they are removed by the 90-day cleanup. NOTE: the log TEXT can still
-- contain the account id (e.g. "User usr_x did ..."); say so in the privacy policy.
-- STOPS and changes nothing (error OTHER_RECORDS) if any table outside the list above still holds records for the
-- account: the cascade would delete those silently, and what happens to them is a human decision, not the function's.
-- Returns one row of counts. Deleting an unknown id changes nothing except leftover usage/idempotency rows (deleted_user = false).
-- SECURITY DEFINER: the app role has no DELETE right on "User" (db/roles.sql); it can delete accounts ONLY through this
-- function. EXECUTE is limited to the owner and bedrock_app (revoked from PUBLIC here; granted in db/roles.sql).
-- Callers (Backend) must make sure the caller may erase that account: the signed-in user for their own id, or a
-- verified Clerk "user.deleted" webhook. This function trusts the id it is given.
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
    -- any other table with a foreign key to "User" that still holds records for this account: refuse
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
    -- Rows that break a size rule added NOT VALID (0005) cannot be updated, which would block the automatic
    -- user_id -> NULL; remove only those.
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
REVOKE EXECUTE ON FUNCTION delete_user_data(text) FROM PUBLIC;
