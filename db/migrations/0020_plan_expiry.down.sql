-- 0020 down: removes the plan end date. Paid plans then last forever again (the behaviour before 0020).
-- WARNING: deploy code that does not read plan_expires_at first, or sign-in falls back to the free plan for everyone.
-- migrate:break
ALTER TABLE "User" DROP COLUMN IF EXISTS plan_expires_at;
