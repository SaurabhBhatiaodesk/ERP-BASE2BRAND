-- Verify DB cleanup + cron is working
-- Run in: https://supabase.com/dashboard/project/jgbkpbafgwxlkudwqvdb/sql/new

-- 1) Cron jobs scheduled?
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'cleanup-%'
ORDER BY jobname;

-- 2) Current table sizes (should stay low over time)
SELECT relname AS table_name, n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE relname IN (
  'task_status_history',
  'employee_screenshots',
  'clock_session_segments',
  'notifications'
)
ORDER BY n_live_tup DESC;

-- 3) Screenshots older than 3 days (edge function should delete these)
SELECT COUNT(*) AS screenshots_older_than_3_days
FROM employee_screenshots
WHERE captured_at < NOW() - INTERVAL '3 days';

-- 4) Non-done task history older than 1 month (monthly cron deletes)
SELECT COUNT(*) AS non_done_history_older_than_1_month
FROM task_status_history tsh
JOIN project_tasks pt ON pt.id = tsh.task_id
WHERE pt.status IS DISTINCT FROM 'done'
  AND tsh.exited_at IS NOT NULL
  AND tsh.exited_at < NOW() - INTERVAL '1 month';

-- 5) Recent cron HTTP calls (screenshot edge fn) — if pg_net logs available
SELECT id, status_code, created
FROM net._http_response
ORDER BY created DESC
LIMIT 10;
