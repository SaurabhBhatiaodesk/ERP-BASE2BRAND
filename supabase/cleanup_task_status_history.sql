-- Retention: keep task_status_history for DONE tasks forever.
-- Delete closed history (1+ month old) only for tasks that are NOT done.
-- Never deletes open rows (exited_at IS NULL).
--
-- ONE-TIME:  run db_one_time_cleanup.sql
-- AUTO:     run db_retention_cleanup.sql

-- ─── 1. PREVIEW: kitni rows delete hongi ───────────────────────────────────
SELECT COUNT(*) AS rows_to_delete
FROM task_status_history tsh
JOIN project_tasks pt ON pt.id = tsh.task_id
WHERE pt.status IS DISTINCT FROM 'done'
  AND tsh.exited_at IS NOT NULL
  AND tsh.exited_at < NOW() - INTERVAL '1 month';

-- Breakdown by task status
SELECT pt.status, COUNT(*) AS rows_to_delete
FROM task_status_history tsh
JOIN project_tasks pt ON pt.id = tsh.task_id
WHERE pt.status IS DISTINCT FROM 'done'
  AND tsh.exited_at IS NOT NULL
  AND tsh.exited_at < NOW() - INTERVAL '1 month'
GROUP BY pt.status
ORDER BY rows_to_delete DESC;

-- ─── 2. ONE-TIME CLEANUP ───────────────────────────────────────────────────
-- DELETE FROM task_status_history tsh
-- USING project_tasks pt
-- WHERE tsh.task_id = pt.id
--   AND pt.status IS DISTINCT FROM 'done'
--   AND tsh.exited_at IS NOT NULL
--   AND tsh.exited_at < NOW() - INTERVAL '1 month';

-- ─── 3. MONTHLY AUTO-CLEANUP (pg_cron — run after enabling pg_cron) ────────
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- SELECT cron.unschedule('cleanup-task-status-history-monthly')
-- WHERE EXISTS (
--   SELECT 1 FROM cron.job WHERE jobname = 'cleanup-task-status-history-monthly'
-- );
--
-- SELECT cron.schedule(
--   'cleanup-task-status-history-monthly',
--   '0 3 1 * *',  -- 1st of every month at 3:00 AM
--   $$
--     DELETE FROM task_status_history tsh
--     USING project_tasks pt
--     WHERE tsh.task_id = pt.id
--       AND pt.status IS DISTINCT FROM 'done'
--       AND tsh.exited_at IS NOT NULL
--       AND tsh.exited_at < NOW() - INTERVAL '1 month';
--   $$
-- );

-- ─── 4. VERIFY after cleanup ───────────────────────────────────────────────
-- SELECT relname AS table_name, n_live_tup AS row_count
-- FROM pg_stat_user_tables
-- WHERE relname = 'task_status_history';
