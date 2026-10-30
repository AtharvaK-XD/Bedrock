# Database migrations (Neon Postgres)

Plain SQL files, applied in order by `db/migrate.mjs`. Each `NNNN_name.up.sql` has a matching `.down.sql`.
Statements inside a file are separated by a line `-- migrate:break`.

## Tools (all read only `DATABASE_URL_DEV`, a Neon DEV branch; they print the host, never the password)
```
node db/migrate.mjs status
node db/migrate.mjs up --yes [--to NNNN]   # apply pending migrations (optionally only up to NNNN)
node db/migrate.mjs down --yes [--all]     # undo the newest migration (or all of them)
node db/check-schema.mjs                   # read-only: live schema vs migrations, grants, counts only
node db/explain.mjs                        # read-only: query plans for the SQL the API runs
node db/flood-test.mjs --yes               # dev only: 1,000,000-row log flood, timed purge
npx vitest run tests/db.migrations.test.ts # skipped unless DATABASE_URL_DEV is set
```

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

## Limits: database vs API (on purpose the database is looser)
The API refuses first with a clear message; the database limit is a safety net for bugs or direct writes.
| Item | API (api/_lib/dataHttp.ts) | Database (0003) |
|---|---|---|
| Workflows per user | 200 | 500 |
| Prompts per user | 2,000 | 2,000 |
| Prompt content | 50,000 chars | 200,000 chars |
| Workflow nodes + edges | 500,000 chars combined | 1,000,000 chars each |
| Ids | 100 chars | 100 chars |
Tightening the database to the API numbers needs Atharva's OK.

## Production rollout (Atharva runs it; NOT run by any agent)
Before anything: all steps below must already have passed on a Neon dev branch (`up`, tests, `down --all`, `up`).

| Step | Do | Check | Rollback |
|---|---|---|---|
| 0 | Neon console: create a branch/snapshot of production named `pre-migrations-<date>`; confirm point-in-time restore is on. | Branch visible in console. | n/a |
| 1 | Point `DATABASE_URL_DEV` at **production** for this session only, run `node db/check-schema.mjs`. | 0 differences, or every difference understood. Stop if not. | n/a (read-only) |
| 2 | `node db/migrate.mjs up --yes --to 0002` | `status` shows 0001, 0002 applied; `check-schema` shows no INVALID index. | `down --yes` (drops 0002 indexes) |
| 3 | `up --yes --to 0004`, then deploy the API (`reserve_quota` / cron need 0004). | `/api/health` ok; `SELECT count(*) FROM "QuotaEvent"` rises by 1 per generation. | Redeploy previous API, then `down --yes` twice. The API falls back to the old counting if 0004 is missing. |
| 4 | `up --yes --to 0005` | A normal sign-in still writes `SecurityLog` rows. | `down --yes` |
| 5 | Only if `check-schema` shows the app connects with the same role that runs migrations (or after `db/ROLES.md` grants): `up --yes --to 0006` | One generation works (no 503). | `down --yes` |
| 6 | `up --yes --to 0007` (stops by itself if duplicate emails exist). | `check-schema`: unique index on lower(email) = yes. | `down --yes` |
| 6b | `up --yes --to 0010` (0009 stops by itself if duplicate usernames exist). Then deploy the API change that uses `trace_totals()` (if Backend made it). | A generation still works; profile username change works; a taken username gives 409; dashboard totals load. | `down --yes` per step, newest first |
| 7 | Remove `DATABASE_URL_DEV`'s production value from the session. | | |

When to run `VALIDATE CONSTRAINT` (makes the NOT VALID checks also cover old rows): only after a read-only count
shows 0 old rows break them, e.g. `security_logs_over_limit: 0` in `check-schema.mjs`, and similar counts for
Prompt / BranchingTree / Trace. Then, one at a time (takes a light lock, reads the whole table):
`ALTER TABLE "Prompt" VALIDATE CONSTRAINT "Prompt_size_chk";` (same for `BranchingTree_size_chk`,
`Trace_sanity_chk`, `SecurityLog_size_chk`). Not required for launch.
