# Database migrations (Neon Postgres)

Plain SQL files, applied in order by `db/migrate.mjs`. Each `NNNN_name.up.sql` has a matching `.down.sql`.
Statements inside a file are separated by a line `-- migrate:break`.

## Tools (all read only `DATABASE_URL_DEV`, a Neon DEV branch; they print the host, never the password)
Anything that writes needs `--yes` **and** `--host <the exact host it printed>` (see `db/target.mjs`), so a wrong
value left in `DATABASE_URL_DEV` cannot be written to by a habit-typed `--yes`.
```
node db/migrate.mjs status
node db/migrate.mjs up    --yes --host <host> [--to NNNN]  # apply pending migrations (optionally only up to NNNN)
node db/migrate.mjs down  --yes --host <host> [--all]      # undo the newest migration (or all of them)
node db/migrate.mjs roles --yes --host <host>              # run db/roles.sql (rights for the bedrock_app role)
node db/check-schema.mjs                                   # read-only: live schema vs migrations, roles, counts only
node db/explain.mjs                                        # read-only: query plans for the SQL the API runs
node db/flood-test.mjs --yes --host <host>                 # dev only: 1,000,000-row log flood, timed purge
npx vitest run tests/db.migrations.test.ts                 # skipped unless DATABASE_URL_DEV is set
```
What to do when something goes wrong: `db/RUNBOOK.md`. Roles: `db/ROLES.md` + `db/roles.sql`.

## What each migration does to a database that already has data
| Migration | Effect on existing rows |
|---|---|
| 0001_baseline | Nothing. `CREATE ... IF NOT EXISTS`; documents the tables. Check it with `check-schema.mjs`. |
| 0002_indexes | Nothing. Adds indexes (built `CONCURRENTLY`, no blocking). Down drops only those indexes. |
| 0003_limits_and_checks | Nothing is rewritten or rejected. CHECKs are `NOT VALID` (new/changed rows only); row-cap triggers apply to new inserts. |
| 0004_quota_and_retention | Adds table `QuotaEvent`, functions `reserve_quota()` and `purge_old_logs()`. Existing tables untouched. |
| 0005_securitylog_limits | `NOT VALID` size CHECK on `SecurityLog` (new rows only). |
| 0006_function_grants | Removes the default "any role may run it" right on the two functions. **Precondition below.** |
| 0007_user_email_ci_unique | Refuses to run (changes nothing) if two accounts share an email ignoring case; otherwise adds a unique index. |
| 0008_reserve_quota_hardening | Replaces `reserve_quota()` (same name/inputs/answer): missing IP = 'unknown', no free "yes" for someone else's id, long values cut, limit <= 0 = "no". |
| 0009_user_username_ci_unique | Refuses to run (changes nothing) if two accounts share a username ignoring case; otherwise adds a unique index (empty usernames allowed). |
| 0010_trace_totals | Adds read-only function `trace_totals(user_id)` for correct dashboard totals. |
| 0011_row_guards | Nothing changed. From now on: a prompt/workflow can't move to another owner, a user id can't change, traces / quota rows / logs can't be edited (only added or deleted), `TRUNCATE` refused on 6 tables. Blocked change = error `ROW_IMMUTABLE` / `TRUNCATE_BLOCKED` (42501). |
| 0012_function_hardening | Nothing changed. Functions use a fixed `search_path`; `reserve_quota()` / `purge_old_logs()` give up after 5 s waiting for a lock. |
| 0013_user_text_limits | Refuses to run (changes nothing) if an account has a field over the new limit; otherwise adds a size CHECK on "User" text fields and validates it. |

## Limits: database vs API (on purpose the database is looser)
The API refuses first with a clear message; the database limit is a safety net for bugs or direct writes.
| Item | API (api/_lib/dataHttp.ts) | Database |
|---|---|---|
| Workflows per user | 200 | 500 (0003) |
| Prompts per user | 2,000 | 2,000 (0003) |
| Prompt content | 50,000 chars | 200,000 chars (0003) |
| Workflow nodes + edges | 500,000 chars combined | 1,000,000 chars each (0003) |
| Ids | 100 chars | 100 chars (0003) |
| Profile name / username / bio | 100 / 50 / 1,000 | 1,000 / 100 / 5,000 (0013) |
| Location, organization / links | 100 / 300 each | 500 / 2,000 each (0013) |
Tightening the database to the API numbers needs Atharva's OK.

## Rules for future migrations
- A new table needs its rights added to `db/roles.sql` in the same change (bedrock_app gets nothing by default).
- `CREATE OR REPLACE FUNCTION` on `reserve_quota`, `purge_old_logs`, `trace_totals` or `bedrock_enforce_row_cap`
  drops the 0012 settings: repeat `SET search_path = public, pg_temp` (and `lock_timeout`) in the new definition.
- If a feature ever needs to change a guarded field (0011), change the guard in a migration on purpose; never drop it.

## Production rollout (Atharva runs it; NOT run by any agent)
Before anything: all steps below must already have passed on a Neon dev branch (`up`, tests, `down --all`, `up`).
`<host>` = the host the tool prints; it must be the production host only during this rollout.

| Step | Do | Check | Rollback |
|---|---|---|---|
| 0 | Neon console: create a branch/snapshot of production named `pre-migrations-<date>`; confirm point-in-time restore is on and note its window. | Branch visible in console. | n/a |
| 1 | Point `DATABASE_URL_DEV` at **production** for this session only, run `node db/check-schema.mjs`. | 0 differences, or every difference understood. Stop if not. Note `connected as role`, `users_over_0013_limits`. | n/a (read-only) |
| 2 | `node db/migrate.mjs up --yes --host <host> --to 0002` | `status` shows 0001, 0002 applied; `check-schema` shows no INVALID index. | `down --yes --host <host>` (drops 0002 indexes) |
| 3 | `up ... --to 0004`, then deploy the API (`reserve_quota` / cron need 0004). | `/api/health` ok; `SELECT count(*) FROM "QuotaEvent"` rises by 1 per generation. | Redeploy previous API, then `down` twice. The API falls back to the old counting if 0004 is missing. |
| 4 | `up ... --to 0005` | A normal sign-in still writes `SecurityLog` rows. | `down` |
| 5 | Only if `check-schema` shows the app connects with the same role that runs migrations (or after step 8): `up ... --to 0006` | One generation works (no 503). | `down` |
| 6 | `up ... --to 0007` (stops by itself if duplicate emails exist). | `check-schema`: unique index on lower(email) = yes. | `down` |
| 6b | `up ... --to 0010` (0009 stops by itself if duplicate usernames exist). Then deploy the API change that uses `trace_totals()` (if Backend made it). | A generation still works; profile username change works; a taken username gives 409; dashboard totals load. | `down` per step, newest first |
| 7 | `up ... --to 0013` (0013 stops by itself if an account is over a limit). | Save + edit + delete a prompt and a workflow; profile save; one generation; `check-schema`: row guards 12 of 12. | `down` per step, newest first (nothing to undo in data) |
| 8 | Roles (recommended, `db/ROLES.md`): create `bedrock_app` with plain SQL, `node db/migrate.mjs roles --yes --host <host>` (every line OK), set Vercel `DATABASE_URL` (Preview first) to the `bedrock_app` string, redeploy, repeat the step 7 checks. Then Production. | All step 7 checks pass on the preview first. `check-schema` with the app string: `connected as role: bedrock_app`. | Put the old `DATABASE_URL` back in Vercel and redeploy (rights do no harm if unused). |
| 9 | Remove `DATABASE_URL_DEV`'s production value from the session. | | |

When to run `VALIDATE CONSTRAINT` (makes the NOT VALID checks of 0003/0005 also cover old rows): only after a
read-only count shows 0 old rows break them, e.g. `security_logs_over_limit: 0` in `check-schema.mjs`, and similar
counts for Prompt / BranchingTree / Trace. Then, one at a time (takes a light lock, reads the whole table):
`ALTER TABLE "Prompt" VALIDATE CONSTRAINT "Prompt_size_chk";` (same for `BranchingTree_size_chk`,
`Trace_sanity_chk`, `SecurityLog_size_chk`). Not required for launch. Note: while a NOT VALID check exists, an
UPDATE of an old row that breaks it fails; for `SecurityLog` that includes the automatic `user_id -> NULL` when a
user is deleted. Nothing in the API deletes users today, and the 90-day cleanup removes old log rows over time.
(0013 avoids this trap by refusing up front and validating right away.)
