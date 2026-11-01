-- 0014 down: removes delete_user_data(). Data is not touched.
-- migrate:break
DROP FUNCTION IF EXISTS delete_user_data(text);
