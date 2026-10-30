-- 0010_trace_totals: correct per-user dashboard totals over ALL of a user's traces (the API currently adds up only
-- the last 100 rows). Read-only function; served by "Trace_user_id_created_at_idx" (0002). Approved 2026-10-31.
-- Field names match the GET /api/traces response (api/traces/index.ts). A run counts as OK when status is 'OK'
-- (written by the client) or 'success' (written by server AI routes).
-- Existing data: none changed.
-- Use: SELECT * FROM trace_totals($1)  -> exactly one row, also for a user with no traces.
-- migrate:break
CREATE OR REPLACE FUNCTION trace_totals(p_user_id text)
RETURNS TABLE(
  total_inferences integer, total_tokens bigint, avg_latency integer, p99_latency integer,
  reliability numeric, active_models text[]
) LANGUAGE sql STABLE AS $$
  SELECT
    count(*)::int,
    coalesce(sum(tokens_used), 0)::bigint,
    coalesce(round(avg(latency_ms)), 0)::int,
    coalesce(percentile_disc(0.99) WITHIN GROUP (ORDER BY latency_ms), 0)::int,
    CASE WHEN count(*) = 0 THEN 100::numeric
         ELSE round(100.0 * count(*) FILTER (WHERE status IN ('OK', 'success')) / count(*), 1) END,
    coalesce(array_agg(DISTINCT model_target) FILTER (WHERE model_target IS NOT NULL), ARRAY[]::text[])
  FROM "Trace" WHERE user_id = p_user_id
$$;
