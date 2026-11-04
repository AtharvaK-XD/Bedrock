-- 0018 down: removes the onboarding columns and their size check.
-- WARNING: this deletes the birth dates and referral answers that users saved. Nothing else is touched.
-- migrate:break
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_onboarding_size_chk";
-- migrate:break
ALTER TABLE "User" DROP COLUMN IF EXISTS referral_source;
-- migrate:break
ALTER TABLE "User" DROP COLUMN IF EXISTS birth_date;
