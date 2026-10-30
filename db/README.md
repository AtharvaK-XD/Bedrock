# Database migrations (Neon Postgres)

Plain SQL files, applied in order by `db/migrate.mjs`. Each `NNNN_name.up.sql` has a matching `.down.sql`.
Statements inside a file are separated by a line `-- migrate:break`.

## Run (dev branch only)
```
# DATABASE_URL_DEV must point at a Neon DEV branch. The runner never reads DATABASE_URL.
node db/migrate.mjs status
node db/migrate.mjs up --yes      # apply everything pending
node db/migrate.mjs down --yes    # undo the most recent migration
DATABASE_URL_DEV=... npx vitest run tests/db.migrations.test.ts
```
The runner prints the database host before doing anything, so you can confirm it is the dev branch.

## What each migration does to a database that already has data
| Migration | Effect on existing rows |
|---|---|
| 0001_baseline | Nothing. `CREATE ... IF NOT EXISTS`; documents the current tables. Compare with the live schema before trusting it. |
| 0002_indexes | Nothing. Adds indexes (built `CONCURRENTLY`, no blocking). Down drops only those indexes. |
| 0003_limits_and_checks | Nothing is rewritten or rejected. CHECKs are `NOT VALID` (apply to new/changed rows only); row-cap triggers apply to new inserts. Down removes them. |
| 0004_quota_and_retention | Adds table `QuotaEvent`, functions `reserve_quota()` and `purge_old_logs()`. Existing tables are untouched. Down drops them. |

## Rollout order for production (human decision, after testing on a dev branch)
0001 -> 0002 -> 0003 -> 0004, then deploy the API changes that call `reserve_quota`. Down is the reverse order.
