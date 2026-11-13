# Database roles: least privilege for the app

Status: ready to use, NOT applied anywhere. Creating the role and switching Vercel are human steps.
The rights themselves are in `db/roles.sql` and are applied with `node db/migrate.mjs roles --yes --host <host>`.

## Why (simple words)
Today the app most likely connects with the Neon owner role, the "master key" that can drop tables, read every
column and change the schema. NOT VERIFIED: `node db/check-schema.mjs` prints `connected as role: ...`.
If the app's connection string leaks (a log, a screenshot, a compromised Vercel env), whoever has it can do
everything that role can. With the limited `bedrock_app` role they **cannot** drop or empty tables, change the
schema, remove the limits, checks and row guards (0003/0005/0011/0013), replace the quota function, delete accounts,
edit usage history and logs, read `password_hash`, or change an account's email, password hash, verified flag or role. Checked on PGlite: every one of those is refused for `bedrock_app`, and every query
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
It refuses if the role is missing or too powerful, takes away any rights the role already had (also an older version
of these rights, and column rights), gives the list below, sets time limits (any app query > 20 s, lock wait > 5 s,
open transaction idle > 30 s is stopped), and prints 17 OK/FAIL lines. Safe to run again.

Then prove it: `node db/check-app-role.mjs` runs the API's real queries as `bedrock_app` (8 flows) and 18 dangerous
actions, each inside a transaction that is always rolled back (nothing is kept). With only `DATABASE_URL_DEV` it uses
`SET LOCAL ROLE bedrock_app` (if the owner may not switch yet it prints one `GRANT ... WITH INHERIT FALSE, SET TRUE`
line, or runs it with `--yes --host <host>`); with `DATABASE_URL_APP_DEV` set to the bedrock_app string it logs in as
the role itself and also checks that the time limits apply.

| Table / function | bedrock_app may | Why (api/**, checked 2026-10-31) |
|---|---|---|
| "User" | SELECT every column except `password_hash`; INSERT the 12 sign-in columns; UPDATE only name, username, bio, location, organization, github, huggingface, website, birth_date, referral_source, plan, subscription_tier, updated_at | sign-in lookup + first-login insert (auth.ts, column list since CHG-0023), profile read/update, plan change. `SELECT *` on "User" fails. |
| "Prompt", "BranchingTree" | SELECT, INSERT, UPDATE, DELETE | list, count, owner-checked update, insert, delete |
| "Trace", "SecurityLog", "QuotaEvent" | SELECT, INSERT, DELETE | add, count, refund, "clear my traces", cleanup; never edit |
| "IdempotencyKey" | SELECT, DELETE | cleanup of expired keys |
| reserve_quota, purge_old_logs, trace_totals, delete_user_data | EXECUTE | usage limit, cleanup, dashboard totals, account erasure (PUBLIC loses this right). `delete_user_data` is `SECURITY DEFINER`: it is the ONLY way the app can erase an account (no DELETE right on "User"). The API must check who may erase which account (the signed-in user for their own id, or a verified Clerk webhook): the function trusts the id it is given. |
| everything else | nothing | no DELETE on "User", no TRUNCATE, no CREATE, nothing on `schema_migrations`; email, password_hash, email_verified, mfa_enabled, role cannot be changed |
Tables not in this list get no access. A table added for a later feature needs its line in `roles.sql` before Vercel
uses `bedrock_app` for that feature.

## Step 3 (human): switch Vercel (exact steps: `db/PRODUCTION.md` step 6)
Build the `bedrock_app` connection string from the current pooled `DATABASE_URL` by replacing only the user name and
password. Set it as `DATABASE_URL` in Vercel **Preview** first, redeploy, test (README step 7 checks), then
**Production**. Keep the owner string only on your PC for releases.
Rollback: put the old connection string back in Vercel and redeploy (the rights do no harm if unused).
After the switch, change the owner role's password in the Neon console (the old one was in Vercel for months).

## password_hash is hidden (done in roles.sql since CHG-0027)
`api/_lib/auth.ts` reads an explicit column list since CHG-0023 (OPEN-0030 closed), so `roles.sql` grants SELECT on
every "User" column except `password_hash`. The sign-in insert still writes it (constant `clerk_oauth_external`).
Any future query on "User" must name its columns; `SELECT *` fails with 42501 for `bedrock_app`.

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

## Branching v2 tables (migration 0021, CHG-0137)
`db/roles.sql` gives `bedrock_app`:
| Table | Rights | Why not more |
|---|---|---|
| `"WorkflowVersion"` | SELECT, INSERT, DELETE | a saved version is never edited; DELETE only keeps the newest 20 |
| `"WorkflowRun"` | SELECT, INSERT, DELETE | a run record is never edited; DELETE is the 90-day cleanup |
| `"WorkflowShare"` | SELECT, INSERT, UPDATE of `revoked_at` and `view_count` only | a link cannot be moved to another workflow or account, its token cannot change, and the app never deletes a link (it goes with the workflow or the account) |

These grants are inside a block that runs only when the tables exist, so `roles.sql` still runs cleanly on a
database without 0021 (a half-applied rights run would leave the app without rights, because every run first revokes
everything). Run `node db/migrate.mjs roles --yes --host <host>` again right after applying 0021.
The final check now has 20 lines; the last three are these tables (they show `ok` when the table does not exist yet).

## What the role's time limits are (and are not)
`statement_timeout = 20s`, `lock_timeout = 5s`, `idle_in_transaction_session_timeout = 30s` (set on the role by
`roles.sql`) stop a runaway query or a stuck transaction from the APP. They are not a security wall: Postgres lets every
role change its own session settings (`SET statement_timeout = 0`, even `ALTER ROLE bedrock_app RESET ...`), so
someone holding a leaked `bedrock_app` string could lift them for their own connection. What a leaked key can NOT do is
proven in `tests/db/roles.local.test.ts`: read `pg_authid` or `password_hash`, create or change roles, grant itself
rights, drop / alter / truncate tables, delete accounts or payment records directly. A leaked key is still an
emergency: `db/RUNBOOK.md` section 1.
