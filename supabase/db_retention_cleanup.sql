-- Automatic DB retention (pg_cron) — project: jgbkpbafgwxlkudwqvdb
-- Run AFTER: db_one_time_cleanup.sql (optional) + deploy cleanup-screenshots edge function
--
-- Replace YOUR_SERVICE_ROLE_KEY if you rotate keys (Dashboard → Settings → API).

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─── Unschedule old jobs (safe re-run) ───────────────────────────────────
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'cleanup-screenshots-midnight',
  'cleanup-task-status-history-monthly',
  'cleanup-notifications-weekly',
  'cleanup-clock-segments-monthly',
  'cleanup-screenshots-db-fallback-weekly'
);

-- ─── 1. Screenshots: edge function daily (DB + Cloudinary, 3-day retention) ─
SELECT cron.schedule(
  'cleanup-screenshots-midnight',
  '0 0 * * *',
  $$
    SELECT net.http_post(
      url:='https://jgbkpbafgwxlkudwqvdb.supabase.co/functions/v1/cleanup-screenshots',
      headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnYmtwYmFmZ3d4bGt1ZHdxdmRiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA5MzUyMSwiZXhwIjoyMDk5NjY5NTIxfQ.XWE8t-dLsduSYh6aeHaSyQp_9i5j9p345qAIF7_8uHs"}'::jsonb
    );
  $$
);

-- ─── 2. Task history: keep DONE forever; purge non-done closed rows 1+ month old ─
SELECT cron.schedule(
  'cleanup-task-status-history-monthly',
  '0 3 1 * *',
  $$
    DELETE FROM task_status_history tsh
    USING project_tasks pt
    WHERE tsh.task_id = pt.id
      AND pt.status IS DISTINCT FROM 'done'
      AND tsh.exited_at IS NOT NULL
      AND tsh.exited_at < NOW() - INTERVAL '1 month';
  $$
);

-- ─── 3. Notifications: 30+ days ───────────────────────────────────────────
SELECT cron.schedule(
  'cleanup-notifications-weekly',
  '0 4 * * 0',
  $$
    DELETE FROM notifications
    WHERE created_at < NOW() - INTERVAL '30 days';
  $$
);

-- ─── 4. Clock segments: 90+ days ──────────────────────────────────────────
SELECT cron.schedule(
  'cleanup-clock-segments-monthly',
  '0 5 1 * *',
  $$
    DELETE FROM clock_session_segments
    WHERE started_at < NOW() - INTERVAL '90 days';
  $$
);

-- ─── 5. Screenshot DB fallback (if edge fn missed) — 7+ days ───────────────
SELECT cron.schedule(
  'cleanup-screenshots-db-fallback-weekly',
  '0 6 * * 0',
  $$
    DELETE FROM employee_screenshots
    WHERE captured_at < NOW() - INTERVAL '7 days';
  $$
);

-- List scheduled jobs
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;
