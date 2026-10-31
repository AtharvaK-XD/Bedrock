# Database roles: least privilege for the app

Status: ready to use, NOT applied anywhere. Creating the role and switching Vercel are human steps.
The rights themselves are in `db/roles.sql` and are applied with `node db/migrate.mjs roles --yes --host <host>`.

## Why (simple words)
Today the app most likely connects with the Neon owner role, the "master key" that can drop tables, read every
column and change the schema. NOT VERIFIED: `node db/check-schema.mjs` prints `connected as role: ...`.
If the app's connection string leaks (a log, a screenshot, a compromised Vercel env), whoever has it can do
everything that role can. With the limited `bedrock_app` role they **cannot** drop or empty tables, change the
schema, remove the limits, checks and row guards (0003/0005/0011/0013), replace the quota function, delete accounts,
or edit usage history and logs. Checked on PGlite: every one of those is refused for `bedrock_app`, and every query
the API runs still works (`db/README.md`, CHG entry for 0011-0013).

## Two roles, simplest version
| Role | Used by | Can do |
|---|---|---|
| the existing owner role (e.g. `neondb_owner`) | `db/migrate.mjs` from your PC during a release, and nothing else | Owns everything; runs migrations. Its connection string must NOT stay in Vercel after the switch. |
| `bedrock_app` (new) | Vercel `DATABASE_URL` | Only the reads/writes the API makes, plus running the three functions. |
No ownership transfer is needed: the tables stay owned by the current owner role.

## Step 1 (human): create `bedrock_app` with plain SQL, NOT in the Neon console Roles page
Roles made in the Neon console (or Neon API/CLI) are added to `neon_superuser`, which can create roles and databases.
Neon documents that roles made with SQL are not (ASSUMED from Neon's docs, not tested; `roles.sql` checks it anyway
and stops with `ROLE_HAS_MEMBERSHIPS` / `ROLE_TOO_POWERFUL` if the role has extra powers).
On the dev branch first, in the Neon SQL editor (connected as the owner role):
```sql
CREATE ROLE bedrock_app WITH LOGIN PASSWORD '<a new long random password from your password manager>';
```
Use a 32+ character random password. Never paste it in chat, never commit it. If `psql` is installed you can instead run
`CREATE ROLE bedrock_app LOGIN;` and then `\password bedrock_app`, which keeps the password out of the SQL history.

## Step 2: give it exactly the rights it needs
```
node db/migrate.mjs roles --yes --host <host>
```
It refuses if the role is missing or too powerful, takes away any rights the role already had, gives the list below,
sets time limits (any app query > 20 s, lock wait > 5 s, open transaction idle > 30 s is stopped), and prints one
OK/FAIL line per expected right. Safe to run again.

| Table / function | bedrock_app may | Why (api/**, checked 2026-10-31) |
|---|---|---|
| "User" | SELECT, INSERT, UPDATE | sign-in lookup + first-login insert (auth.ts), profile read/update |
| "Prompt", "BranchingTree" | SELECT, INSERT, UPDATE, DELETE | list, count, owner-checked update, insert, delete |
| "Trace", "SecurityLog", "QuotaEvent" | SELECT, INSERT, DELETE | add, count, refund, "clear my traces", cleanup; never edit |
| "IdempotencyKey" | SELECT, DELETE | cleanup of expired keys |
| reserve_quota, purge_old_logs, trace_totals | EXECUTE | usage limit, cleanup, dashboard totals (PUBLIC loses this right) |
| everything else | nothing | no DELETE on "User", no TRUNCATE, no CREATE, nothing on `schema_migrations` |
Tables not in this list get no access. A table added for a later feature needs its line in `roles.sql` before Vercel
uses `bedrock_app` for that feature.

## Step 3 (human): switch Vercel
Build the `bedrock_app` connection string from the current pooled `DATABASE_URL` by replacing only the user name and
password. Set it as `DATABASE_URL` in Vercel **Preview** first, redeploy, test (README step 7 checks), then
**Production**. Keep the owner string only on your PC for releases.
Rollback: put the old connection string back in Vercel and redeploy (the rights do no harm if unused).
After the switch, change the owner role's password in the Neon console (the old one was in Vercel for months).

## Step 4 (optional, later): hide password_hash from the app
Only after `api/_lib/auth.ts` stops using `SELECT * FROM "User"` (OPEN-0030): run the commented block at the end of
`db/roles.sql`. Before that, the revoke would make every signed-in request fall back to token data.
Nothing in the API reads `password_hash` (Clerk handles sign-in; the column holds `clerk_oauth_external` for Clerk users).

## Row-Level Security (RLS): evaluation only, not implemented
RLS would make Postgres itself refuse rows that belong to another user, as a second wall behind the API's
`WHERE user_id = ...` checks.

- **Possible?** Technically yes. The Neon HTTP driver runs each `sql\`...\`` call as its own transaction, but
  `sql.transaction([...])` can send `SELECT set_config('app.user_id', $1, true)` and the real query together, so a
  policy like `USING (user_id = current_setting('app.user_id', true))` would work.
- **Why not now:** every one of ~25 queries in `api/**` would have to be rewritten into that pair. One forgotten
  query either fails for real users (if policies deny) or silently skips protection. `reserve_quota()` and
  `purge_old_logs()` work across users and would need `SECURITY DEFINER` and careful review. This is a big, risky
  change right before launch. Meanwhile 0011 already stops rows from changing owner, and `bedrock_app` cannot remove
  that guard.
- **Recommendation:** roles first (above). Revisit RLS after launch, starting with "Prompt" and "BranchingTree"
  behind one shared helper that always sends the `set_config` pair.
