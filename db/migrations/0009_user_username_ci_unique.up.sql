-- 0009_user_username_ci_unique: no two accounts may share a username, ignoring upper/lower case
-- ("Bob" = "bob"). Empty (NULL) usernames stay allowed for everyone. Approved by Atharva 2026-10-31.
-- Effect on the API: a taken username now raises Postgres 23505, which api/user/profile.ts already turns into
-- 409 PROFILE_VALUE_TAKEN (CHG-0008). Before this index that 409 could never happen.
-- Existing data: nothing is changed or deleted. The first statement STOPS the migration with an error if
-- case-insensitive duplicates already exist; then nothing is created and Atharva decides.
-- Built CONCURRENTLY (no blocking). If the build is interrupted, run the .down file, then run this again.
-- migrate:break
DO $$
DECLARE v_dupes integer;
BEGIN
  SELECT count(*) INTO v_dupes FROM (
    SELECT lower(username) FROM "User" WHERE username IS NOT NULL GROUP BY lower(username) HAVING count(*) > 1
  ) d;
  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'DUPLICATE_USERNAMES: % username(s) are used by more than one account ignoring case. Nothing was changed.', v_dupes;
  END IF;
END $$;
-- migrate:break
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "User_username_lower_key" ON "User"(lower(username)) WHERE username IS NOT NULL;
