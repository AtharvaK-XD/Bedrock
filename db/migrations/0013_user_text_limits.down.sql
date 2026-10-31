-- 0013 down: removes the "User" text limits. Data is not touched.
-- migrate:break
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_text_size_chk";
