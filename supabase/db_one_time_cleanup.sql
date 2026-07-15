-- ONE-TIME cleanup — run once in Supabase SQL Editor, then verify row counts.
-- Done tasks history is KEPT. Recent active task timing is safe (open rows kept).

-- 1) Non-done task history older than 1 month (closed rows only)
DELETE FROM task_status_history tsh
USING project_tasks pt
WHERE tsh.task_id = pt.id
  AND pt.status IS DISTINCT FROM 'done'
  AND tsh.exited_at IS NOT NULL
  AND tsh.exited_at < NOW() - INTERVAL '1 month';

-- 2) Old notifications (30+ days)
DELETE FROM notifications
WHERE created_at < NOW() - INTERVAL '30 days';

-- 3) Old clock segments (90+ days)
DELETE FROM clock_session_segments
WHERE started_at < NOW() - INTERVAL '90 days';

-- 4) Old screenshot rows in DB (7+ days) — images may remain on Cloudinary until edge fn runs
DELETE FROM employee_screenshots
WHERE captured_at < NOW() - INTERVAL '7 days';

-- Verify
SELECT relname AS table_name, n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE relname IN (
  'task_status_history',
  'employee_screenshots',
  'clock_session_segments',
  'notifications'
)
ORDER BY n_live_tup DESC;
