-- 0019_payment_records_survive_erasure (OPEN-0090): deleting an account no longer fails for people who ever opened
-- checkout, and paid records are kept (tax and audit rules usually require it; check the period with your accountant).
-- What changes:
--   1. "PaymentRecord".user_id may be NULL, and the link to "User" becomes ON DELETE SET NULL (it was NOT NULL and
--      ON DELETE CASCADE, so a plain account delete would have destroyed the paid records).
--   2. delete_user_data() now: deletes the account's UNPAID orders (status 'created': nothing was paid, nothing to keep);
--      keeps every other order (captured) and only removes the link to the person (user_id -> NULL). The row keeps order
--      id, payment id, signature, amount, currency, status, tier and dates; none of that identifies a person without
--      the account. (Razorpay's own dashboard keeps the account id in the order notes: that is outside this database.)
--      It no longer refuses because of payment rows; it still refuses (OTHER_RECORDS) for any OTHER unknown table.
--   3. Lock order: payment rows first, then the account row. verify-payment locks the order first and the account
--      second, so paying and deleting at the same moment cannot deadlock.
--   4. Index "PaymentRecord_user_id_status_idx": the lookups above and the SET NULL action no longer scan the table.
-- Existing data: nothing is changed. Every existing row keeps its user_id. Same function name, inputs and result columns.
-- The foreign key swap takes a short exclusive lock on "PaymentRecord" and "User" (milliseconds: the check is added
-- NOT VALID and validated in the next step); the migration tool waits at most 5 s for it and retries.
-- migrate:break
ALTER TABLE "PaymentRecord" ALTER COLUMN user_id DROP NOT NULL;
-- migrate:break
-- Replace the foreign key on user_id (found by its columns, whatever it is called) with ON DELETE SET NULL.
-- Done in one block: there is no moment without the constraint.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname, c.confdeltype
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.conrelid = '"PaymentRecord"'::regclass AND c.confrelid = '"User"'::regclass
      AND array_length(c.conkey, 1) = 1 AND a.attname = 'user_id'
  LOOP
    IF r.confdeltype <> 'n' THEN
      EXECUTE format('ALTER TABLE "PaymentRecord" DROP CONSTRAINT %I', r.conname);
      ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_user_id_fkey"
        FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
    END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.conrelid = '"PaymentRecord"'::regclass AND c.confrelid = '"User"'::regclass AND a.attname = 'user_id'
  ) THEN
    ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_user_id_fkey"
      FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
  END IF;
END $$;
-- migrate:break
-- Reads the table once with a light lock (reads and writes keep working). Safe to run again.
ALTER TABLE "PaymentRecord" VALIDATE CONSTRAINT "PaymentRecord_user_id_fkey";
-- migrate:break
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PaymentRecord_user_id_status_idx" ON "PaymentRecord"(user_id, status);
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
