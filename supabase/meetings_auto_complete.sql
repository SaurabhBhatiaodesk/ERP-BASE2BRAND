-- Auto-complete stale meetings (pg_cron) — project: jgbkpbafgwxlkudwqvdb
-- A meeting whose end time has passed and that nobody marked completed/cancelled
-- is flipped to 'completed' automatically. Run AFTER: meetings.sql
--
-- `date`/`start_time`/`end_time` are stored as plain wall-clock values with no
-- timezone conversion anywhere in the app (MeetingView.tsx does `new Date(`${date}T${time}`)`,
-- interpreted in the browser's local zone). The DB session runs in UTC, so `now()`
-- is converted to Asia/Kolkata wall-clock time here to match. Adjust the zone
-- below if your organizers are not on IST.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─── Unschedule old job (safe re-run) ─────────────────────────────────────
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('meetings-auto-complete-15min');

-- ─── Flip overdue 'scheduled' meetings to 'completed' every 15 minutes ────
SELECT cron.schedule(
  'meetings-auto-complete-15min',
  '*/15 * * * *',
  $$
    UPDATE public.meetings
    SET status = 'completed', updated_at = now()
    WHERE status = 'scheduled'
      AND (date + end_time) < (now() AT TIME ZONE 'Asia/Kolkata');
  $$
);

-- One-time backfill for meetings already overdue before this job existed
UPDATE public.meetings
SET status = 'completed', updated_at = now()
WHERE status = 'scheduled'
  AND (date + end_time) < (now() AT TIME ZONE 'Asia/Kolkata');

-- List scheduled jobs
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;
