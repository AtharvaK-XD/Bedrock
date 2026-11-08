# Production database rollout: copy-paste steps (Atharva runs these; no agent runs anything on production)

Before you start:
- Everything below has passed on the dev branch: `node db/migrate.mjs status` shows 0 pending, 35/35 tests pass, and
  `node db/check-app-role.mjs` says "every check passed". Do not continue if any of that is missing.
- This round of `db/` (CHG-0027: column-level "User" rights in `roles.sql`, `check-app-role.mjs`) is merged into
  `main`. Run everything from `C:\Users\ATHARVA\Desktop\Bedrock` on an up-to-date `main` (it has `node_modules`).
- About 30-45 minutes. Users can keep using the site: every step is additive, and indexes build without blocking.
- Rehearsed on 2026-11-02 on `dev-db-test`, a fresh copy of production (CHG-0047): before = 0 of 17 migrations
  applied, no table except `QuotaEvent` missing, 12 accounts, no duplicates, no row over any limit. `up --to 0004`
  took 13 s, the rest (0005-0017) 21 s; 35/35 Neon tests and `check-app-role.mjs` passed afterwards.
- NEVER run `tests/db.migrations.test.ts`, `db/flood-test.mjs` or `db/anonymize-dev.mjs` against production. The tests
  write and delete their own test rows and run the log cleanup; they are for the dev branch only.

## Backend and migrations: which order, what switches on when
The backend on `main` is safe with or without these migrations: every new feature checks for its database part and
falls back (VERIFIED in the code on 2026-11-02, `api/_lib/security.ts`, `api/traces/index.ts`,
`api/_lib/accountDeletion.ts`). So the order is free; recommended: **snapshot -> migrations -> deploy the backend**, so
each feature works the moment it is live.
| Migration | What turns on in the app | Before it is applied, the app... |
|---|---|---|
| 0001-0002 | faster lists, usage counts, cleanup (indexes) | works, slower |
| 0003 | size limits + 2,000 prompts / 500 workflows per account (API answers 400/409) | has no database limits |
| 0004 | race-proof usage limits (`reserve_quota`), daily log cleanup (`purge_old_logs`) | counts usage the old way (parallel requests can overshoot); the cron reports "apply 0004 first" |
| 0005 | log line size limit (the API already cuts lines to fit) | accepts any size |
| 0006 | only the app may run the usage/cleanup functions | anyone with a database login could |
| 0007, 0009 | one account per email / username, ignoring case | allows `Bob@x` and `bob@x` |
| 0008 | the 3 usage-limit loopholes closed | loopholes open |
| 0010 | dashboard totals over ALL runs (`trace_totals`) | shows totals of the last 100 runs |
| 0011-0013 | row guards (no owner change, no log edits, no TRUNCATE), safe functions, profile size limits | none of these walls |
| 0014 | "delete my account" and the Clerk `user.deleted` webhook (`delete_user_data`) | both answer 503 `ACCOUNT_DELETION_NOT_READY` (nothing deleted) |
| 0015 | max 5,000 usage records per account per 24 h (`POST /api/traces` answers 429) | no cap |
| 0016 | old rows checked against the size rules | old rows unchecked |
| 0017 | fast paging of the prompts / workflows lists (0.24 ms per page on the production copy) | paging works, but reads the whole library |
| 0018 | the onboarding answers (birth date, referral source) are saved | the profile route works without them; a save that carries them answers 503 `ONBOARDING_FIELDS_NOT_READY` |
| 0019 | "delete my account" works for people who ever opened checkout; paid orders are kept without the link to the person | such accounts answer 409 `ACCOUNT_DELETION_NEEDS_SUPPORT` and nothing is deleted |
| 0018 | the sign-up wizard's birth date and "how did you hear about us" answers (new, optional "User" columns) | the profile still loads, those two answers are simply not stored (a save that carries them answers 503 `ONBOARDING_FIELDS_NOT_READY`) |

## Step 0: safety net (must be done first)
1. Neon console -> your project -> Branches -> create a branch **from production, at "now"**, named
   `pre-migrations-2026-11-<day>`. This is your instant snapshot.
2. Neon console -> project settings: note the point-in-time restore window (history retention). Write it down.
3. Do not continue until the new branch is listed.

## Step 1: point the tools at production for THIS window only
Open a **new** PowerShell window. Copy the production **owner** connection string (Neon console -> production branch ->
Connect -> role `neondb_owner`, pooled) to the clipboard, then:
```powershell
cd C:\Users\ATHARVA\Desktop\Bedrock
$env:DATABASE_URL_DEV = Get-Clipboard      # only this window; the value is not saved in your command history
Set-Clipboard -Value ' '                   # clear the clipboard
node db/migrate.mjs status
```
Check the first line `Target database host: ...`: it must be the **production** host, NOT
`ep-soft-tooth-b86b7rci-pooler...` (that is the dev branch `dev-db-test` since CHG-0045). Write the host down; below it is `<prod-host>`.
(`status` only reads; `--host` is not needed for it, adding it does nothing.)

## Step 2: read-only check
```powershell
node db/check-schema.mjs
```
Stop and send the Database session the output (it contains counts only, no user data) if any of these is not true:
`0 difference(s) found` (or only differences already explained), `dup_emails_ci: 0`, `dup_usernames_ci: 0`,
`users_over_0013_limits: 0`, no line with `INVALID`. Note `connected as role:`.

## Step 3: apply the migrations in three stages
After each command, the check in the right column must hold before you run the next one.
| Command | Check |
|---|---|
| `node db/migrate.mjs up --yes --host <prod-host> --to 0004` | Site: sign in, generate one prompt. `status`: 0001-0004 applied. |
| `node db/migrate.mjs up --yes --host <prod-host> --to 0010` | Site: generate, save + edit + delete a prompt, change your username, dashboard loads. |
| `node db/migrate.mjs up --yes --host <prod-host>` | Same checks again, plus: the dashboard lists load. `check-schema`: `row guards ... 12 of 12`, `0 difference(s)`. This stage also applies 0014-0017 (account erasure function, daily usage cap, validation of old size rules, paging indexes). |
The tool waits at most 5 s for a database lock and retries, so it will not freeze the live site; if it says it gave up,
run the same command again a little later. If it says another run holds the lock, see `db/RUNBOOK.md` section 5.
If a step stops with `DUPLICATE_EMAILS`, `DUPLICATE_USERNAMES`, `USER_TEXT_TOO_LONG` or `OLD_ROWS_BREAK_RULE`: nothing was changed by that
migration; stop and tell the Database session. If anything else breaks, undo the newest migration:
`node db/migrate.mjs down --yes --host <prod-host>` (repeat per migration, newest first). Data is never deleted by a
`down`. Worst case: restore from the Step 0 branch (`db/RUNBOOK.md` section 2).

## Step 4: create the app role on production
Neon console -> **production** branch -> SQL Editor (as `neondb_owner`). Use a NEW password, not the dev one:
32+ random letters and digits only (no symbols, so it needs no escaping in a URL), from your password manager.
```sql
CREATE ROLE bedrock_app WITH LOGIN PASSWORD '<new 32+ letters and digits>';
```
Do not create it on the console's Roles page (those roles get `neon_superuser` powers; the next step would refuse).

## Step 5: give it its rights
```powershell
node db/migrate.mjs roles --yes --host <prod-host>
```
Good = 17 lines `OK` and `done: every check passed`. Running it again is safe.
Optional, safe (every check is rolled back, nothing is kept): log in as the app role and prove it end to end.
Use the real login below (not the owner + `SET ROLE` way used on dev, which needs an extra `GRANT` you do not want on
production):
```powershell
$env:DATABASE_URL_APP_DEV = Get-Clipboard   # the bedrock_app string from step 6, copied first
node db/check-app-role.mjs                  # good = "every check passed", incl. the role time limits line
Remove-Item Env:DATABASE_URL_APP_DEV
```

## Step 6: switch Vercel to the app role
The new connection string is your current production `DATABASE_URL` with ONLY the user and password changed:
```
postgresql://bedrock_app:<password>@<same pooled host as today>/<same database name as today>?sslmode=require&channel_binding=require
```
- Keep the host exactly as in today's `DATABASE_URL` (the one with `-pooler` in it) and the same database name.
- Keep the same `?...` options as today's string (Neon's own strings use `sslmode=require&channel_binding=require`).
- A letters-and-digits password needs no escaping.

Order:
1. Vercel -> Project -> Settings -> Environment Variables -> **Preview**: set `DATABASE_URL` to the new string ->
   redeploy a preview -> on the preview URL: sign in, generate, save/edit/delete a prompt and a workflow, profile save,
   dashboard. All must work.
2. Same for **Production** -> redeploy -> same checks on the live site.
   The backend must be a version that reads "User" by column name (`main` since CHG-0023): with `bedrock_app`,
   `SELECT * FROM "User"` is refused on purpose (password hashes are hidden). An older deployment would fall back to
   token data at sign-in.
3. The API also falls back to `NEON_DATABASE_URL` and `DATABASE_URL_UNPOOLED` (api/_lib/db.ts). If either exists in
   Vercel with the owner password, delete it (or, if Neon's Vercel integration manages it, change the integration to
   the `bedrock_app` role). Same for `PGPASSWORD` / `POSTGRES_*` variables if present. Otherwise the owner key is
   still sitting in Vercel.

Rollback: put the old `DATABASE_URL` value back in Vercel and redeploy (keep it in your password manager until the
new one has run for a week). The rights do no harm if unused.

## Step 7: lock the old key and clean up
1. Neon console -> production branch -> Roles -> `neondb_owner` -> reset password (the old one was in Vercel).
   Store the new one only in your password manager. Releases use it from a one-off PowerShell window as in Step 1.
2. Close the PowerShell window from Step 1 (that drops `$env:DATABASE_URL_DEV`'s production value).
3. Tell the Database session: the outputs of Steps 2, 3 and 5 (they contain no secrets or user data).
4. Keep the `pre-migrations-...` branch for at least a week, then delete it.
