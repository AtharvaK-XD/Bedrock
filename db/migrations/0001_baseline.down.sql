-- 0001_baseline DOWN: intentionally does nothing.
-- The baseline only describes tables that already existed (and hold user data); dropping them is destructive
-- and needs Atharva's explicit approval. To wipe a throwaway DEV branch, delete the Neon branch instead.
-- migrate:break
SELECT 1;
