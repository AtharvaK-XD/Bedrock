-- 0018_onboarding_fields: two optional "User" columns for the first-time onboarding wizard (CHG-0063, OPEN-0066).
--   birth_date       text, nullable. The API accepts only a real calendar date written YYYY-MM-DD (api/_lib/dataHttp.ts).
--   referral_source  text, nullable. "How did you hear about Bedrock?" (a short label such as "youtube", or the
--                    user's own words when they chose "Other"). The API limit is 100 characters.
-- Both are personal data the user typed in: they are erased with the account (delete_user_data removes the whole
-- "User" row, 0014) and are scrubbed from dev copies (db/lib/anonymize.mjs).
-- Existing data: nothing is changed. Every existing account gets NULL in both columns. Adding a column without a
-- default only changes the table definition (no rewrite, no long lock).
-- Safety net, same idea as 0013: the API refuses first with a clear message; the database limits are about 5 times
-- looser (birth_date 30 -> 150, referral_source 100 -> 500). No existing row can break the check (both columns are
-- new and NULL), so it is added NOT VALID and validated in the next step.
-- Rights: bedrock_app needs SELECT and UPDATE on the two columns. That is in db/roles.sql; run
-- `node db/migrate.mjs roles --yes --host <host>` again after this migration when the app role is in use (OPEN-0037).
-- migrate:break
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS birth_date text;
-- migrate:break
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS referral_source text;
-- migrate:break
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_onboarding_size_chk') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_onboarding_size_chk" CHECK (
      (birth_date IS NULL OR char_length(birth_date) <= 150)
      AND (referral_source IS NULL OR char_length(referral_source) <= 500)
    ) NOT VALID;
  END IF;
END $$;
-- migrate:break
-- Reads the table once with a light lock (normal reads and writes keep working). Safe to run again.
ALTER TABLE "User" VALIDATE CONSTRAINT "User_onboarding_size_chk";
