# Paging the saved prompts and workflows lists (request to Backend + Frontend)

## The problem
`GET /api/prompts` and `GET /api/workflows` run `SELECT * ... ORDER BY updated_at DESC` with no limit
(`api/prompts/index.ts`, `api/workflows/index.ts`). The limits allow 2,000 prompts x 50,000 characters and 200
workflows x 500,000 characters per user, so one heavy user's list can be tens of megabytes. Vercel functions cannot
send a response of about 4.5 MB or more (NOT VERIFIED against the current Vercel documentation: check before relying
on the exact number), so that user's whole library fails to load.

## The fix (database half is done: index in migration 0017; this is the exact SQL)
The list returns small rows only: no full prompt text, no workflow nodes/edges. The full item is fetched when the user
opens it. Pages continue after the last row seen ("keyset paging"), so a page costs the same however large the
library is and nothing is skipped or repeated while the user adds or edits items.

These blocks are the single source of truth: `tests/db/paging.local.test.ts` runs exactly these statements.
Parameters are positional (`$1` ...); with the Neon tagged template use `${value}` in the same places.

```sql
-- name: prompts_first_page
-- $1 user id, $2 page size + 1 (the extra row only tells you "there is a next page"; do not send it)
SELECT id, title, snippet, tags, target_type, created_at, updated_at,
       to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS.US') AS cursor_ts
FROM "Prompt"
WHERE user_id = $1
ORDER BY updated_at DESC, id DESC
LIMIT $2
```

```sql
-- name: prompts_next_page
-- $1 user id, $2 cursor_ts of the LAST row sent, $3 id of the LAST row sent, $4 page size + 1
SELECT id, title, snippet, tags, target_type, created_at, updated_at,
       to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS.US') AS cursor_ts
FROM "Prompt"
WHERE user_id = $1 AND (updated_at, id) < ($2::timestamp, $3::text)
ORDER BY updated_at DESC, id DESC
LIMIT $4
```

```sql
-- name: prompt_one
-- $1 prompt id, $2 user id (always both: never load another user's item)
SELECT * FROM "Prompt" WHERE id = $1 AND user_id = $2
```

```sql
-- name: workflows_first_page
-- $1 user id, $2 page size + 1. size_chars lets the screen show "large workflow" without loading it.
SELECT id, title, created_at, updated_at, char_length(nodes) + char_length(edges) AS size_chars,
       to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS.US') AS cursor_ts
FROM "BranchingTree"
WHERE user_id = $1
ORDER BY updated_at DESC, id DESC
LIMIT $2
```

```sql
-- name: workflows_next_page
-- $1 user id, $2 cursor_ts of the LAST row sent, $3 id of the LAST row sent, $4 page size + 1
SELECT id, title, created_at, updated_at, char_length(nodes) + char_length(edges) AS size_chars,
       to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS.US') AS cursor_ts
FROM "BranchingTree"
WHERE user_id = $1 AND (updated_at, id) < ($2::timestamp, $3::text)
ORDER BY updated_at DESC, id DESC
LIMIT $4
```

```sql
-- name: workflow_one
-- $1 workflow id, $2 user id
SELECT * FROM "BranchingTree" WHERE id = $1 AND user_id = $2
```

## How the API should use it
1. Page size 50 (recommended; at most 100). Run the query with `LIMIT pageSize + 1`.
2. If 51 rows come back: send the first 50 and `nextCursor = base64url(JSON.stringify({ t: row50.cursor_ts, id: row50.id }))`.
   Otherwise `nextCursor = null`.
3. The client sends the cursor back as `?cursor=...`. The API decodes it, checks `t` matches
   `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$` and `id` is a string of at most 100 characters (the values are
   passed as parameters, so a bad cursor cannot inject SQL, but an invalid timestamp would be a 500: answer 400).
4. Use `cursor_ts` (text) as the cursor, not a JavaScript Date: it keeps microseconds and avoids time-zone shifts.
5. Keep today's response shape per item where the screens need it; the list no longer includes `fullContent`,
   `nodes`, `edges`. Frontend loads them with `prompt_one` / `workflow_one` when an item is opened.
   Cache-friendly: the list can also return `updatedAt` so the client can skip re-fetching unchanged items.

## Measured (in-memory Postgres, 2,300 prompts for one user + 6,000 for others)
See `tests/db/paging.local.test.ts`: every page reads the 0017 index with no sort step, all 2,300 rows are returned
exactly once even when 500 of them share the same `updated_at`. Real Neon timing: NOT RUN (dev branch login fails,
OPEN-0039).

---

# Branching v2 queries (migration 0021): for Backend to copy

Same rule as above: `tests/db/branchingV2.local.test.ts` runs exactly these blocks, so what is written here is tested.
Every query names the owner (`user_id`) as well as the item. The database also refuses a version, run or share whose
workflow belongs to another account (error 23503, text `WORKFLOW_NOT_OWNED`), but the API must still check first and
answer 404. If a table is missing (0021 not applied, or roles not re-run) Postgres answers `42P01` (missing table) or
`42501` (permission denied): answer 503 `{ code: 'FEATURE_NOT_READY' }`.

## Versions (`?action=versions`, `?action=restore`, and on every save)

```sql
-- name: version_insert
-- $1 new version id (server-made, at most 100 chars), $2 workflow id, $3 user id, $4 title, $5 nodes, $6 edges,
-- $7 node count. Takes the next number for this workflow and returns it.
-- Two saves of the same workflow at the same instant can pick the same number: the second one then fails with
-- 23505 (unique violation on "WorkflowVersion_workflow_id_version_key"). Retry the same statement up to 3 times;
-- it reads the new MAX each time. Never number versions in JavaScript.
INSERT INTO "WorkflowVersion"(id, workflow_id, user_id, version, title, nodes, edges, node_count)
SELECT $1, $2, $3, COALESCE(MAX(version), 0) + 1, $4, $5, $6, $7
FROM "WorkflowVersion"
WHERE workflow_id = $2
RETURNING version
```

```sql
-- name: versions_prune
-- $1 workflow id, $2 user id. Keeps the newest 20 versions. Run right after version_insert.
DELETE FROM "WorkflowVersion"
WHERE workflow_id = $1 AND user_id = $2
  AND version <= (SELECT MAX(version) - 20 FROM "WorkflowVersion" WHERE workflow_id = $1)
```

```sql
-- name: versions_list
-- $1 workflow id, $2 user id. Small rows only (no nodes/edges).
SELECT version, title, created_at, node_count
FROM "WorkflowVersion"
WHERE workflow_id = $1 AND user_id = $2
ORDER BY version DESC
LIMIT 20
```

```sql
-- name: version_one
-- $1 workflow id, $2 user id, $3 version number. For restore: save the CURRENT workflow with version_insert first,
-- then write these nodes/edges/title into "BranchingTree" with the existing owner-checked update.
SELECT version, title, nodes, edges, node_count, created_at
FROM "WorkflowVersion"
WHERE workflow_id = $1 AND user_id = $2 AND version = $3
```

## Runs (`?action=runs`, `?action=stats`, daily cleanup)

```sql
-- name: run_insert
-- $1 run id (server-made), $2 user id, $3 workflow id or NULL (unsaved workflow), $4 status
-- ('success' | 'partial' | 'error' | 'cancelled'), $5 node count, $6 AI calls, $7 duration ms (0 to 3,600,000),
-- $8 error count, $9 node types as a JS array of strings (at most 30, joined length at most 1,000; the Neon driver
-- sends a JS array as a Postgres array). Counts, types, status and duration only: never prompt text or outputs.
-- Refused with 23514 when a rule is broken: DAILY_RUN_LIMIT in the message (more than 2,000 records in 24 hours)
-- -> answer 429; anything else (a bad number) -> answer 400.
INSERT INTO "WorkflowRun"(id, user_id, workflow_id, status, node_count, ai_calls, duration_ms, error_count, node_types)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[])
```

```sql
-- name: run_stats
-- $1 user id, $2 the moment "now" (pass NULL: the database clock is used; tests pass a fixed time).
-- Days are counted in India time (Asia/Kolkata): a run at 23:59 IST and one at 00:01 IST are on two different days.
-- streak_days = consecutive days with at least one run, ending today; if there is no run yet today the streak
-- still counts up to yesterday (it is only broken when a whole day is missed).
-- Counts cover the run records the database keeps (90 days, see runs_purge): totals are "in the last 90 days".
WITH runs AS (
  SELECT status, created_at, node_types, (created_at AT TIME ZONE 'Asia/Kolkata')::date AS day
  FROM "WorkflowRun"
  WHERE user_id = $1
),
today AS (
  SELECT (COALESCE($2::timestamptz, now()) AT TIME ZONE 'Asia/Kolkata')::date AS d
),
islands AS (
  SELECT day, day - (row_number() OVER (ORDER BY day))::int AS grp
  FROM (SELECT DISTINCT day FROM runs) d
),
last_island AS (
  SELECT max(day) AS last_day, count(*)::int AS len
  FROM islands
  GROUP BY grp
  ORDER BY max(day) DESC
  LIMIT 1
)
SELECT
  (SELECT count(*)::int FROM runs) AS total_runs,
  (SELECT count(*)::int FROM runs WHERE status = 'success') AS success_runs,
  (SELECT count(*)::int FROM runs, today WHERE runs.day = today.d) AS runs_today,
  COALESCE((SELECT len FROM last_island, today WHERE last_island.last_day >= today.d - 1), 0) AS streak_days,
  (SELECT COALESCE(array_agg(DISTINCT t ORDER BY t), '{}'::text[]) FROM runs, unnest(node_types) AS t) AS node_types_used,
  (SELECT min(created_at) FROM runs) AS first_run_at
```

```sql
-- name: runs_purge
-- No parameters. Deletes run records older than 90 days, 5,000 at a time: call it from the daily cleanup cron in a
-- loop until it deletes fewer than 5,000 rows (same pattern as purge_old_logs).
DELETE FROM "WorkflowRun"
WHERE id IN (SELECT id FROM "WorkflowRun" WHERE created_at < now() - interval '90 days' LIMIT 5000)
```

## Share links (`?action=share`, `?action=shared`)

```sql
-- name: share_create
-- $1 new token (server-made: crypto.randomBytes(32).toString('base64url') gives 43 characters; allowed 32 to 128),
-- $2 workflow id, $3 user id. Returns the token: the new one, or the link that is already active for this workflow
-- (one active link per workflow). If it returns NO row (two clicks at the very same instant), run it once more.
WITH created AS (
  INSERT INTO "WorkflowShare"(token, workflow_id, user_id)
  VALUES ($1, $2, $3)
  ON CONFLICT (workflow_id) WHERE revoked_at IS NULL DO NOTHING
  RETURNING token, created_at
)
SELECT token, created_at FROM created
UNION ALL
SELECT token, created_at FROM "WorkflowShare"
WHERE workflow_id = $2 AND user_id = $3 AND revoked_at IS NULL
LIMIT 1
```

```sql
-- name: share_revoke
-- $1 workflow id, $2 user id. Turns the active link off (the row stays as history). 0 rows = there was no link.
UPDATE "WorkflowShare" SET revoked_at = now()
WHERE workflow_id = $1 AND user_id = $2 AND revoked_at IS NULL
RETURNING token
```

```sql
-- name: shared_open
-- $1 token (from the public URL; check it is 32 to 128 characters of [A-Za-z0-9_-] before querying, else 404).
-- Counts one view and returns the workflow in one statement. No row = unknown or revoked link: answer 404 (the same
-- answer for both, so nobody can tell which tokens once existed). Strip outputs, results and data values in the API.
WITH opened AS (
  UPDATE "WorkflowShare" SET view_count = view_count + 1
  WHERE token = $1 AND revoked_at IS NULL
  RETURNING workflow_id, user_id, created_at
)
SELECT b.title, b.nodes, b.edges, opened.created_at AS shared_at
FROM opened
JOIN "BranchingTree" b ON b.id = opened.workflow_id AND b.user_id = opened.user_id
```

Notes for Backend:
- A share link shows the workflow as it is NOW (not frozen at share time); deleting the workflow or the account
  removes its links.
- Restore = `version_insert` of the current state, then the update, then `versions_prune`. Wrap them in one
  `sql.transaction([...])` so a failure leaves no half-restore.
- Error codes: 23503 + `WORKFLOW_NOT_OWNED` -> 404; 23514 + `DAILY_RUN_LIMIT` -> 429; other 23514 -> 400;
  23505 on version_insert -> retry; 42P01 / 42501 -> 503 FEATURE_NOT_READY.
