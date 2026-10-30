-- 0007_user_email_ci_unique: one account per email address, ignoring upper/lower case
-- ("Bob@x.com" and "bob@x.com" are the same person). "User_email_key" (0001) only blocks exact duplicates.
-- Why it matters: api/_lib/auth.ts links a sign-in to an existing account by email (verified emails only, CHG-0014).
-- Two rows that differ only in case make that lookup ambiguous.
-- Existing data: nothing is changed or deleted. The first statement STOPS the migration with an error if case-insensitive
-- duplicates already exist; then nothing is created and Atharva decides what to do with them.
-- The index is built CONCURRENTLY (no blocking). If the build is interrupted, run the .down file, then run this again.
-- migrate:break
DO $$
DECLARE v_dupes integer;
BEGIN
  SELECT count(*) INTO v_dupes FROM (
    SELECT lower(email) FROM "User" GROUP BY lower(email) HAVING count(*) > 1
  ) d;
  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'DUPLICATE_EMAILS: % email address(es) exist more than once ignoring case. Nothing was changed.', v_dupes;
  END IF;
END $$;
-- migrate:break
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "User_email_lower_key" ON "User"(lower(email));
