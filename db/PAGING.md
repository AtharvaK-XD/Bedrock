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
