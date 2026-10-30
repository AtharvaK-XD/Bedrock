-- 0010 DOWN: removes the totals function. No row data is touched.
-- migrate:break
DROP FUNCTION IF EXISTS trace_totals(text);
