# Database roles: least-privilege proposal (NOT applied)

Status: proposal only. Creating roles and changing which role Vercel connects with is a human step (Neon console +
Vercel env). Nothing here has been run.

## Why (simple words)
Today the app most likely connects with the Neon owner role, the same "master key" that can drop tables,
read every column and change the schema. NOT VERIFIED: `node db/check-schema.mjs` prints `connected as role: ...`
for the dev branch; run it once with the production connection role in mind.
If the app's connection string leaks (a log, a screenshot, a compromised Vercel env), whoever has it can do
everything that role can. With a limited app role they can still read and write app rows, but they **cannot**
drop or empty tables, change the schema, remove the limits and checks (0003/0005), switch off the quota function,
or read `password_hash`. That turns "the whole database is gone" into "some rows could be read or changed".

## Two roles
| Role | Used by | Can do |
|---|---|---|
| `bedrock_migrate` | `db/migrate.mjs` only (from your PC, during a release) | Owns all tables and functions; runs migrations. Never put this one in Vercel. |
| `bedrock_app` | Vercel (`DATABASE_URL`) | Only the reads/writes the API makes (list below) + run the two functions. |

## Step 1 (human): create the roles in the Neon console
Neon console -> project -> Roles -> add `bedrock_migrate` and `bedrock_app` (Neon generates the passwords).
Do not paste passwords in chat or commit them.

## Step 2: hand ownership to bedrock_migrate (run as the current owner, on a DEV branch first)
```sql
ALTER TABLE "User" OWNER TO bedrock_migrate;
ALTER TABLE "Prompt" OWNER TO bedrock_migrate;
ALTER TABLE "BranchingTree" OWNER TO bedrock_migrate;
ALTER TABLE "Trace" OWNER TO bedrock_migrate;
ALTER TABLE "SecurityLog" OWNER TO bedrock_migrate;
ALTER TABLE "QuotaEvent" OWNER TO bedrock_migrate;
ALTER TABLE "IdempotencyKey" OWNER TO bedrock_migrate;
ALTER TABLE schema_migrations OWNER TO bedrock_migrate;
ALTER FUNCTION reserve_quota(text, text, text, text, text, integer, interval) OWNER TO bedrock_migrate;
ALTER FUNCTION purge_old_logs(integer) OWNER TO bedrock_migrate;
ALTER FUNCTION bedrock_enforce_row_cap() OWNER TO bedrock_migrate;
ALTER FUNCTION trace_totals(text) OWNER TO bedrock_migrate;
-- Tables not listed (billing) keep the access they have today; decide them together with that work.
```

## Step 3: grants for bedrock_app (exactly what the API runs; checked against api/** on 2026-10-31)
```sql
GRANT USAGE ON SCHEMA public TO bedrock_app;

-- "User": sign-in lookup + first-login insert (api/_lib/auth.ts), profile read/update (api/user/profile.ts)
GRANT SELECT, INSERT, UPDATE ON "User" TO bedrock_app;
-- prompts / workflows: list, count, owner-checked update, insert, delete
GRANT SELECT, INSERT, UPDATE, DELETE ON "Prompt", "BranchingTree" TO bedrock_app;
-- traces: list, insert, "clear my traces", and the 90-day purge
GRANT SELECT, INSERT, DELETE ON "Trace" TO bedrock_app;
-- logs: insert, old-path quota count + refund, purge
GRANT SELECT, INSERT, DELETE ON "SecurityLog" TO bedrock_app;
-- quota: reserve_quota() reads and writes it, releaseQuota deletes, purge deletes
GRANT SELECT, INSERT, DELETE ON "QuotaEvent" TO bedrock_app;
-- purge of expired keys
GRANT SELECT, DELETE ON "IdempotencyKey" TO bedrock_app;

GRANT EXECUTE ON FUNCTION reserve_quota(text, text, text, text, text, integer, interval) TO bedrock_app;
GRANT EXECUTE ON FUNCTION purge_old_logs(integer) TO bedrock_app;
GRANT EXECUTE ON FUNCTION trace_totals(text) TO bedrock_app;
-- (migration 0006 removes the default PUBLIC execute right on the first two; these lines give it back to the app only)
-- Optional, together with this step: REVOKE EXECUTE ON FUNCTION trace_totals(text) FROM PUBLIC;
```
Not granted on purpose: `DELETE` on "User", `TRUNCATE`, `REFERENCES`, `TRIGGER`, `CREATE` on the schema, anything on
`schema_migrations`.

## Step 4 (optional, later): hide password_hash from the app
```sql
REVOKE SELECT ON "User" FROM bedrock_app;
GRANT SELECT (id, email, name, username, avatar_url, avatar_initials, plan, role, bio, location, organization,
  github, huggingface, website, joined_date, email_verified, mfa_enabled, subscription_tier, created_at, updated_at)
  ON "User" TO bedrock_app;
```
**Risk:** `api/_lib/auth.ts` runs `SELECT * FROM "User" ...` on every signed-in request. With this revoke, that query
fails with "permission denied", the code falls back to token data, and users would lose their saved plan/tier from
the database. So this step is only safe **after** Security changes that `SELECT *` to an explicit column list
(REQUEST in HANDOFF). Billing code also reads/updates "User" columns not listed here; check it before applying.
Nothing in the API reads `password_hash` (Clerk handles sign-in; the column holds the constant `clerk_oauth_external`
for Clerk users).

## Step 5 (human): switch Vercel
Set `DATABASE_URL` (Preview first, then Production) to the `bedrock_app` connection string. Keep the
`bedrock_migrate` string only on your PC as `DATABASE_URL_DEV` / a release-time variable.
Rollback: put the old connection string back in Vercel and redeploy (grants do no harm if unused).

## Row-Level Security (RLS): evaluation only, not implemented
RLS would make Postgres itself refuse rows that belong to another user, as a second wall behind the API's
`WHERE user_id = ...` checks.

- **Possible?** Technically yes. The Neon HTTP driver runs each `sql\`...\`` call as its own transaction, but
  `sql.transaction([...])` can send `SELECT set_config('app.user_id', $1, true)` and the real query together, so a
  policy like `USING (user_id = current_setting('app.user_id', true))` would work.
- **Why not now:** every one of ~25 queries in `api/**` would have to be rewritten into that pair. One forgotten
  query either fails for real users (if policies deny) or silently skips protection (if the app role is the table
  owner, which bypasses RLS unless `FORCE ROW LEVEL SECURITY` is set). `reserve_quota()` and `purge_old_logs()` work
  across users and would need `SECURITY DEFINER` and careful review. This is a big, risky change three weeks before
  launch, for protection the API already gives (owner checks are tested in `api/ai/__tests__/dataRoutes.test.ts` and
  `tests/db.migrations.test.ts`).
- **Recommendation:** do the two roles above first (bigger safety win, no code change). Revisit RLS after launch,
  starting with "Prompt" and "BranchingTree" behind one shared helper that always sends the `set_config` pair.
