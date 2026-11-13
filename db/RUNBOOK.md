# Database runbook: what to do when something goes wrong

Plain steps for Atharva. Agents never run these against production. Neon console wording may differ slightly
(written from Neon's documented features, not checked click by click).

## 1. A database connection string leaked (log, screenshot, chat, repo, compromised Vercel env)
1. Neon console -> Roles -> reset the password of the role in that string (`bedrock_app` or the owner role).
   The old string stops working immediately.
2. Vercel -> Settings -> Environment Variables: put the new string in `DATABASE_URL` (Preview and Production), redeploy.
   The site is down for database calls between step 1 and the redeploy (a few minutes).
3. Check what the leaked string could do: run `node db/check-schema.mjs` and read `connected as role`. If it was
   `bedrock_app`, nobody could drop tables, change the schema or edit logs; check recent rows in "SecurityLog".
   If it was the owner role, also do step 2 of section 2 (compare with a restore point).
4. If the string was in a git commit, it stays in history: treat it as leaked even after deleting the file.

## 2. Data was deleted or broken (a bad migration, a bug, a mistake)
1. Stop writes if it is still happening: in Vercel, redeploy the previous good deployment.
2. Neon console -> Branches -> create a branch from production **as of a time before the problem**
   (point-in-time restore). This copies the past state; production is not touched.
3. Point `DATABASE_URL_DEV` at that branch and compare (`check-schema.mjs`, counts) to find what was lost.
   The restored branch holds REAL user data: treat its connection string like the production one (never paste it in chat),
   do not mark it as dev, and delete the branch when you are done.
4. Either restore production from that point in the Neon console (everything after that time is lost), or copy the
   missing rows back. Decide with the Database session; never guess.
   **Payments are live: a full restore also erases every payment made after the restore point** (the customer was
   charged by Razorpay, but the order row and the paid plan disappear). Before restoring production:
   a. Create a Neon branch of production as it is NOW (the "after" copy). If Neon offers to keep a backup of the
      current state during the restore, keep it too.
   b. After the restore, compare "PaymentRecord" in the "after" copy with production: every row with
      `status = 'captured'` and `updated_at` after the restore point must be copied back, and its account's
      `subscription_tier`, `plan` and `plan_expires_at` set again (ask the Database session for the exact statements;
      never re-run the payment by hand in Razorpay).
   c. Cross-check Razorpay dashboard -> Payments for the same time range: every captured payment must have its row.
   d. Accounts created after the restore point are also gone: their owners must sign in again (Clerk keeps them);
      their saved prompts and workflows from that window are only in the "after" copy.
   Restoring only the broken table's rows (copy back) avoids all of this: prefer it when the damage is limited.
5. Find the cause before redeploying the API.

### 2b. Recovery drill (do it ONCE before launch, then every 3 months). Takes about 20 minutes, changes nothing in production.
Goal: prove that a restore works and learn how long it takes, BEFORE you need it.
1. Neon console -> project settings: write down the restore window ("history retention"). Launch needs 7 days or more.
   If it is shorter, upgrade the plan or change the setting first. (NOT known from the code: only the console shows it.)
2. Pick a time 10 minutes ago. Create a branch `drill-<date>` from production at that time. Note how long Neon took: ______
3. In a NEW PowerShell window: set `$env:DATABASE_URL_DEV` to the drill branch's owner string (Get-Clipboard, as in
   `db/PRODUCTION.md` step 1), then run, and write the results down:
   - `node db/migrate.mjs status`  -> every migration the live site has is `applied`, none `CHECK`.
   - `node db/check-schema.mjs`    -> `0 difference(s) found`; note `users`, `traces`, `security_logs`.
   - `node db/stats.mjs`           -> no errors. (Counts should be close to production's at that moment.)
   - `node db/readiness.mjs`       -> `READY`, or only the items you already know about (one screen, read only).
4. Compare the three counts with production (`stats.mjs` there, read only). A small difference is normal (writes since the chosen time).
5. DELETE the drill branch (it contains real user data) and close the PowerShell window.
6. Fill in: window ______ days; branch created in ______ s; counts matched: yes / no; date ______; done by ______.
   If any step failed, stop and tell the Database session before launch.

## 3. Every AI request fails with "busy / quota unavailable" (HTTP 503)
The API refuses AI calls when `reserve_quota()` errors (it fails closed, on purpose).
- Right after migration 0006 or a role switch: the app role lost the right to run the function. Fix: run
  `node db/migrate.mjs roles --yes --host <host>` (gives `bedrock_app` the right), or undo 0006
  (`node db/migrate.mjs down --yes --host <host>` when 0006 is the newest).
- `lock timeout` in the Vercel logs: something holds a lock for > 5 s (0012). Look for a long manual query or a
  stuck migration and stop it; the requests recover by themselves.
- `function reserve_quota does not exist`: the API falls back to the older counting by itself; apply 0004.

## 4. The database grows fast (log flood, attack)
1. `node db/check-schema.mjs` -> `security_logs`, `traces` counts.
2. Run the cleanup by hand as often as needed: `SELECT * FROM purge_old_logs();` (5,000 old rows per call; it only
   removes rows past their keep time: quota rows > 1 day, quota log lines > 1 day, other logs and traces > 90 days).
3. If new rows are the problem (not old ones), the fix is in the API / rate limits: tell the Backend session.

## 5. Error messages from the database and what they mean
| Message / code | Meaning | Who fixes |
|---|---|---|
| `ROW_LIMIT_EXCEEDED` (23514) | user hit 2,000 prompts / 500 workflows (0003) | expected; API answers 409 |
| `Prompt_size_chk`, `BranchingTree_size_chk`, `Trace_sanity_chk`, `SecurityLog_size_chk`, `User_text_size_chk` (23514) | a value is over the database limit | API should have refused first: Backend |
| `ROW_IMMUTABLE` (42501) | something tried to change an owner, a user id, a trace, a quota row or a log (0011) | a bug or an attack: find the query in the Vercel logs |
| `TRUNCATE_BLOCKED` (42501) | someone tried to empty a table (0011) | use DELETE; never drop the trigger to "make it work" |
| `permission denied for ...` (42501) | `bedrock_app` lacks a right | add the line to `db/roles.sql` on purpose, then run it |
| `User_email_lower_key` / `User_username_lower_key` (23505) | email / username already used, ignoring case | expected; API answers 409 for usernames |
| `DUPLICATE_EMAILS`, `DUPLICATE_USERNAMES`, `USER_TEXT_TOO_LONG`, `OLD_ROWS_BREAK_RULE` | a migration refused because existing data breaks its rule; nothing was changed | decide what to do with those rows, then run it again |
| `DAILY_TRACE_LIMIT` (23514) | an account wrote 5,000 usage records in 24 hours (0015) | expected for abuse; the API should answer 429 |
| `OTHER_RECORDS` (23001) | `delete_user_data` found records in a table it does not know that depend on the account; nothing deleted | human decision (section 6) |
| `PAYMENT_RECORDS_UNLINKED` | `down` of 0019 refused: paid orders that no longer belong to an account exist (kept on purpose) | do not delete them; leave 0019 applied |
| `WORKFLOW_NOT_OWNED` (23503) | a version, run or share link was written for a workflow that does not exist or belongs to another account (0021) | a bug or an attack: the API should have checked first (Backend); answer 404 |
| `DAILY_RUN_LIMIT` (23514) | an account wrote 2,000 run records in 24 hours (0021) | expected for abuse; the API should answer 429 |
| `WorkflowVersion_size_chk`, `WorkflowRun_sanity_chk` (23514) | a version or run record breaks a size / number rule (0021) | API should have refused first: Backend |
| `BRANCHING_V2_HAS_DATA` | `down` of 0021 refused: saved versions, run records or share links exist | roll back the code instead (section 8) |
| `Another migration run holds the lock` | a `migrate.mjs` run is active or crashed less than 30 minutes ago | wait, or `DELETE FROM schema_migrations_lock;` if sure no run is active |
| `was edited after it was applied` | a migration file changed after it ran (checksum) | restore the file; put the change in a NEW migration |

## 6. Someone asks to delete their account (right to erasure)
1. The API calls `SELECT * FROM delete_user_data('<account id>')` (0014). By hand on production: the owner connection, same statement.
2. It removes the account, prompts, workflows, usage records, usage-limit rows and idempotency keys in one step and returns the counts.
3. Security log rows stay, WITHOUT the account id, until the 90-day cleanup. Their text can still contain the id: say so in the privacy policy.
4. Orders (migration 0019): the account's UNPAID orders are deleted; PAID orders are KEPT with the link to the person removed
   (order id, payment id, amount, dates stay: tax and audit rules usually require it; confirm the period with your accountant).
   Razorpay's dashboard also keeps the account id in the order notes: that is outside this database; mention it in the privacy policy.
5. If it stops with `OTHER_RECORDS`, another table (outside this plan) still holds records for that account; nothing was deleted. Decide with Atharva what happens to those records, then run it again.
6. Deleting the person in Clerk is separate (Clerk dashboard or API).

## 7. Regular checks
- Before each release that changes the database: Neon snapshot branch `pre-<release>-<date>` (README step 0).
- Once a week and before launch: `node db/stats.mjs` on production. Exit code 1 + a plain-words warning when the daily cleanup is behind, the log table is growing too fast, the database is large, or an account is near a cap.
- Once a month: create a branch from production as of yesterday and run `node db/check-schema.mjs` on it. That proves
  the restore works and shows the table counts. Delete the branch afterwards.
- After any change to Vercel env vars: `node db/check-schema.mjs` with the app's string shows `connected as role: bedrock_app`.

## 8. Branching v2 (migration 0021): apply to production, check, roll back
What it adds: three new tables (versions, run records, share links). Nothing existing changes. Takes seconds.
**Order: the database first, then the Backend deploy.** Without the tables the new routes answer 503
`FEATURE_NOT_READY` and every old route keeps working, so the database step is safe to do early.
Only Atharva runs this on production (agents never do). Use a NEW PowerShell window with the production owner string
in `DATABASE_URL_DEV` for this window only (the tools read only that name); close the window afterwards.

1. Look first (read only): `node db/migrate.mjs status`. Expected: everything `applied` except `0021_branching_v2   PENDING`.
2. Apply: `node db/migrate.mjs up --yes --host <production host>`. Expected: `applying 0021_branching_v2 ...` then done.
   If it prints `IMPORTANT: role bedrock_app exists`, step 3 is required (else it is still recommended).
3. Rights for the app role: `node db/migrate.mjs roles --yes --host <production host>`. Every line must end `ok`
   (20 lines; the last three are the new tables). Without this, an app using `bedrock_app` gets
   `permission denied` on the new tables (503 `FEATURE_NOT_READY`; nothing else breaks).
4. Check: `node db/check-schema.mjs`. Expected last line: `0 difference(s) found.` Before step 2 it lists the 23 missing
   0021 items (3 tables, 6 foreign keys, 3 primary keys, 7 indexes, 4 triggers): that list is the to-do, not an error.
5. Optional: `node db/readiness.mjs` (one screen, read only).
6. Tell the Backend session / Gemini "0021 applied, roles re-run, 0 differences" and only then deploy the Backend.
7. Daily cleanup: the Backend cron must also run the `runs_purge` statement (`db/PAGING.md`) so run records older
   than 90 days are removed. Check the cron log the next day.

**Roll back.** First choice: roll back the CODE in Vercel (Deployments -> previous one -> Promote). The tables are
harmless when nothing uses them; leave them.
Only if the tables themselves must go:
1. Deploy code that does not use them first.
2. `node db/migrate.mjs down --yes --host <host>` undoes ONLY the newest migration (0021 if it is the newest). It
   REFUSES with `BRANCHING_V2_HAS_DATA` while any version, run record or share link exists: those are people's saved
   versions and history, and deleting them switches off every share link. Emptying the tables is a destructive step
   that needs Atharva's explicit approval and a Neon branch/snapshot taken just before.
3. After `down`, run `node db/migrate.mjs roles --yes --host <host>` again (the tool reminds you). Then
   `node db/check-schema.mjs` lists the 0021 items as missing: expected after a rollback, not a new problem.
