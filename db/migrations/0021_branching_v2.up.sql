-- 0021_branching_v2: storage for Branching v2 (BRANCHING_PROMPTS.md section 0.7): saved versions of a workflow, a
-- small record of every run (for stats and badges), and read-only share links.
-- New tables only. Nothing in an existing table is changed; every existing row stays as it is.
--   "WorkflowVersion"  a full copy (title, nodes, edges) of a workflow as it was saved. The API keeps the last 20.
--   "WorkflowRun"      counts, node types, status and duration of one run. NEVER prompt text or outputs.
--   "WorkflowShare"    a secret token that opens a read-only copy of one workflow. One active link per workflow.
-- Types match the tables they point to: "User".id and "BranchingTree".id are text (0001_baseline). Times are
-- timestamptz (like "QuotaEvent"), so "today" and streaks can be computed in India time without guessing.
-- Size rule for a version = the rule for the workflow itself ("BranchingTree_size_chk", 0003): title <= 500,
-- nodes <= 1,000,000 and edges <= 1,000,000 characters, id <= 100. A workflow that saves can always be versioned.
-- Deleting an account removes its versions, runs and share links (ON DELETE CASCADE). Deleting a workflow removes its
-- versions and share links; its runs stay (they are the account's history) with workflow_id set to NULL.
-- delete_user_data() (0019) refused to delete an account that had rows in a table it did not know. It is replaced
-- here by the same function that also knows these three tables (they are removed by the cascade). Nothing else in it
-- changes: paid orders are still kept without the link to the person (0019).
-- Two guards, in the database itself (a bug or a leaked app key cannot get around them):
--   * a version, run or share must belong to the owner of its workflow (error 23503, text WORKFLOW_NOT_OWNED);
--   * at most 2,000 run records per account per 24 hours (error 23514, text DAILY_RUN_LIMIT), like 0015 for "Trace".
-- Rights: bedrock_app gets rights on the new tables only when `node db/migrate.mjs roles --yes --host <host>` is run
-- AFTER this migration (db/roles.sql). Until then the app is refused on these tables and the API answers 503
-- FEATURE_NOT_READY; every existing route keeps working.
-- ORDER: apply this migration (and re-run roles) BEFORE deploying the Branching v2 API.
-- The tables are new and empty, so plain CREATE INDEX is instant (no CONCURRENTLY needed).
-- migrate:break
CREATE TABLE IF NOT EXISTS "WorkflowVersion" (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES "BranchingTree"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  nodes TEXT NOT NULL,
  edges TEXT NOT NULL,
  node_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "WorkflowVersion_size_chk" CHECK (
    char_length(id) <= 100 AND char_length(title) <= 500
    AND char_length(nodes) <= 1000000 AND char_length(edges) <= 1000000
  ),
  CONSTRAINT "WorkflowVersion_numbers_chk" CHECK (version >= 1 AND node_count >= 0)
);
-- migrate:break
-- One index does both jobs: UNIQUE (workflow_id, version) and the newest-first list / "last 20" order.
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowVersion_workflow_id_version_key" ON "WorkflowVersion"(workflow_id, version DESC);
-- migrate:break
-- Account deletion (cascade on user_id) finds the rows by index instead of reading the whole table.
CREATE INDEX IF NOT EXISTS "WorkflowVersion_user_id_idx" ON "WorkflowVersion"(user_id);
-- migrate:break
CREATE TABLE IF NOT EXISTS "WorkflowRun" (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  workflow_id TEXT NULL REFERENCES "BranchingTree"(id) ON DELETE SET NULL ON UPDATE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'error', 'cancelled')),
  node_count INTEGER NOT NULL,
  ai_calls INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  error_count INTEGER NOT NULL DEFAULT 0,
  node_types TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "WorkflowRun_sanity_chk" CHECK (
    char_length(id) <= 100
    AND node_count >= 0 AND ai_calls >= 0 AND error_count >= 0
    AND duration_ms >= 0 AND duration_ms <= 3600000
    AND cardinality(node_types) <= 30 AND coalesce(array_ndims(node_types), 1) = 1
    AND char_length(array_to_string(node_types, ',')) <= 1000
  )
);
-- migrate:break
CREATE INDEX IF NOT EXISTS "WorkflowRun_user_id_created_at_idx" ON "WorkflowRun"(user_id, created_at DESC);
-- migrate:break
-- Deleting a workflow sets workflow_id to NULL on its runs: this index finds them without reading the whole table.
CREATE INDEX IF NOT EXISTS "WorkflowRun_workflow_id_idx" ON "WorkflowRun"(workflow_id) WHERE workflow_id IS NOT NULL;
-- migrate:break
CREATE TABLE IF NOT EXISTS "WorkflowShare" (
  token TEXT PRIMARY KEY CHECK (char_length(token) BETWEEN 32 AND 128),
  workflow_id TEXT NOT NULL REFERENCES "BranchingTree"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ NULL,
  view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0)
);
-- migrate:break
-- At most ONE active (not revoked) link per workflow. Revoked links stay as history.
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowShare_one_active_idx" ON "WorkflowShare"(workflow_id) WHERE revoked_at IS NULL;
-- migrate:break
-- Deleting a workflow removes ALL its links, revoked ones too: the partial index above cannot find those.
CREATE INDEX IF NOT EXISTS "WorkflowShare_workflow_id_idx" ON "WorkflowShare"(workflow_id);
-- migrate:break
CREATE INDEX IF NOT EXISTS "WorkflowShare_user_id_idx" ON "WorkflowShare"(user_id);
-- migrate:break
-- Guard 1: a version, run or share must belong to the owner of its workflow. Without it, a bug that forgets the owner
-- check could attach a version or a public link to SOMEONE ELSE's workflow. One primary-key lookup per insert.
-- (A workflow's owner never changes: 0011 row guard.)
CREATE OR REPLACE FUNCTION bedrock_workflow_owner_check() RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.workflow_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "BranchingTree" WHERE id = NEW.workflow_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'WORKFLOW_NOT_OWNED: workflow % does not exist or belongs to another account', NEW.workflow_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END $$;
-- migrate:break
DROP TRIGGER IF EXISTS "WorkflowVersion_owner_check" ON "WorkflowVersion";
-- migrate:break
CREATE TRIGGER "WorkflowVersion_owner_check" BEFORE INSERT OR UPDATE OF workflow_id, user_id ON "WorkflowVersion"
  FOR EACH ROW EXECUTE FUNCTION bedrock_workflow_owner_check();
-- migrate:break
DROP TRIGGER IF EXISTS "WorkflowRun_owner_check" ON "WorkflowRun";
-- migrate:break
CREATE TRIGGER "WorkflowRun_owner_check" BEFORE INSERT ON "WorkflowRun"
  FOR EACH ROW EXECUTE FUNCTION bedrock_workflow_owner_check();
-- migrate:break
DROP TRIGGER IF EXISTS "WorkflowShare_owner_check" ON "WorkflowShare";
-- migrate:break
CREATE TRIGGER "WorkflowShare_owner_check" BEFORE INSERT OR UPDATE OF workflow_id, user_id ON "WorkflowShare"
  FOR EACH ROW EXECUTE FUNCTION bedrock_workflow_owner_check();
-- migrate:break
-- Guard 2: at most N run records per account per rolling 24 hours (same design as 0015 "Trace_daily_cap").
-- Runs are reported by the browser, so without a cap one account could fill the table. 2,000 a day is far above real
-- use. Soft cap: two inserts at the same instant may both pass at 1,999. The count stops at the cap and uses
-- "WorkflowRun_user_id_created_at_idx", so each insert stays cheap. The API should answer 429 on DAILY_RUN_LIMIT.
CREATE OR REPLACE FUNCTION bedrock_enforce_run_daily_cap() RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
DECLARE
  v_cap integer := TG_ARGV[0]::integer;
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM (
    SELECT 1 FROM "WorkflowRun"
    WHERE user_id = NEW.user_id AND created_at > now() - interval '24 hours'
    LIMIT v_cap
  ) recent;
  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'DAILY_RUN_LIMIT: at most % run records per account per 24 hours', v_cap
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
-- migrate:break
DROP TRIGGER IF EXISTS "WorkflowRun_daily_cap" ON "WorkflowRun";
-- migrate:break
CREATE TRIGGER "WorkflowRun_daily_cap" BEFORE INSERT ON "WorkflowRun"
  FOR EACH ROW EXECUTE FUNCTION bedrock_enforce_run_daily_cap(2000);
-- migrate:break
-- delete_user_data(): exactly the 0019 function, plus the three new tables in the list of tables it knows.
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
    -- "WorkflowVersion", "WorkflowRun", "WorkflowShare" (0021) are removed with the account (ON DELETE CASCADE).
    FOR r IN
      SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f' AND c.confrelid = '"User"'::regclass AND array_length(c.conkey, 1) = 1
        AND c.conrelid::regclass::text NOT IN ('"Prompt"', '"BranchingTree"', '"Trace"', '"SecurityLog"', '"PaymentRecord"',
                                             '"WorkflowVersion"', '"WorkflowRun"', '"WorkflowShare"')
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
