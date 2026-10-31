-- 0013_user_text_limits: size limits on the "User" text fields that the API writes, as a safety net.
-- The API refuses first with a clear message (api/_lib/dataHttp.ts DATA_LIMITS); these database limits are about
-- 5 times looser so a normal profile save can never hit them:
--   field          API    database
--   name           100  1,000        (also set at first sign-in from the Clerk name; kept extra loose)
--   username        50    100
--   bio          1,000  5,000
--   location       100    500
--   organization   100    500
--   github / huggingface / website  300  2,000 each
--   email           -     320        (written at first sign-in from Clerk)
-- plan, role and subscription_tier are left without limits on purpose (other work still changes their values).
-- Existing data: nothing is changed or deleted. The first statement STOPS the migration if any existing row is over a
-- limit (then nothing is added and Atharva decides). Otherwise the check is added and validated, so it covers every row.
-- Why not leave it NOT VALID like 0003/0005: a NOT VALID check still applies when an old row is UPDATED, so one old
-- over-long row could make every later update of that user fail. Refusing up front avoids that trap.
-- migrate:break
DO $$
DECLARE v_over integer;
BEGIN
  SELECT count(*) INTO v_over FROM "User"
  WHERE char_length(name) > 1000 OR char_length(email) > 320
     OR char_length(coalesce(username, '')) > 100 OR char_length(coalesce(bio, '')) > 5000
     OR char_length(coalesce(location, '')) > 500 OR char_length(coalesce(organization, '')) > 500
     OR char_length(coalesce(github, '')) > 2000 OR char_length(coalesce(huggingface, '')) > 2000
     OR char_length(coalesce(website, '')) > 2000;
  IF v_over > 0 THEN
    RAISE EXCEPTION 'USER_TEXT_TOO_LONG: % existing account(s) have a field over the new limit. Nothing was changed.', v_over;
  END IF;
END $$;
-- migrate:break
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_text_size_chk') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_text_size_chk" CHECK (
      char_length(name) <= 1000 AND char_length(email) <= 320
      AND (username IS NULL OR char_length(username) <= 100)
      AND (bio IS NULL OR char_length(bio) <= 5000)
      AND (location IS NULL OR char_length(location) <= 500)
      AND (organization IS NULL OR char_length(organization) <= 500)
      AND (github IS NULL OR char_length(github) <= 2000)
      AND (huggingface IS NULL OR char_length(huggingface) <= 2000)
      AND (website IS NULL OR char_length(website) <= 2000)
    ) NOT VALID;
  END IF;
END $$;
-- migrate:break
-- Reads the table once with a light lock (normal reads and writes keep working). Safe to run again.
ALTER TABLE "User" VALIDATE CONSTRAINT "User_text_size_chk";
