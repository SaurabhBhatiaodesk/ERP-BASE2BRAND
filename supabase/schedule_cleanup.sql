-- supabase/schedule_cleanup.sql

-- Enable pg_net if not already enabled (required to make HTTP requests from Postgres)
CREATE EXTENSION IF NOT EXISTS pg_net;
-- Enable pg_cron if not already enabled (required for scheduling)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the Edge Function to run every day at Midnight (00:00)
SELECT cron.schedule(
  'cleanup-screenshots-midnight', -- Unique name for the cron job
  '0 0 * * *', -- Cron syntax for 12:00 AM every day
  $$
    SELECT net.http_post(
      url:='https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/cleanup-screenshots',
      headers:='{"Authorization": "Bearer <YOUR_ANON_KEY>"}'::jsonb
    );
  $$
);

-- Note: Replace <YOUR_PROJECT_REF> and <YOUR_ANON_KEY> with your actual Supabase project details.
