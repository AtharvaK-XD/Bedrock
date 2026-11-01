-- 0016 down: nothing to undo. A validated check cannot be turned back into "NOT VALID", and leaving it validated is
-- harmless (it only means old rows were also confirmed to follow the rule). Removing the checks themselves is the
-- job of 0003/0005 down. Data is not touched.
-- migrate:break
SELECT 1;
