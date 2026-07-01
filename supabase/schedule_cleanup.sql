-- supabase/schedule_cleanup.sql
-- Deletes employee screenshots older than 3 days (DB + Cloudinary).
-- Deploy the edge function first: supabase functions deploy cleanup-screenshots
-- Set secrets: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

-- Enable pg_net if not already enabled (required to make HTTP requests from Postgres)
CREATE EXTENSION IF NOT EXISTS pg_net;
-- Enable pg_cron if not already enabled (required for scheduling)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the Edge Function to run every day at Midnight (00:00)
SELECT cron.schedule(
  'cleanup-screenshots-midnight',
  '0 0 * * *',
  $$
    SELECT net.http_post(
      url:='https://eoltlbmiqyjvbqcifsls.supabase.co/functions/v1/cleanup-screenshots',
      headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvbHRsYm1pcXlqdmJxY2lmc2xzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwMjkxNSwiZXhwIjoyMDk1ODc4OTE1fQ.BtpnwsGUeX4b6fSjM-UXDs9lZa9-YOgPiEFyoU96PNk"}'::jsonb
    );
  $$
);

-- Note: Replace <YOUR_PROJECT_REF> and <YOUR_SERVICE_ROLE_KEY> with your Supabase project details.
