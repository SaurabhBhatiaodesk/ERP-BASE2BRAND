-- Screenshot cleanup cron only (legacy file).
-- Prefer: supabase/db_retention_cleanup.sql (all retention jobs in one place).

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('cleanup-screenshots-midnight')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-screenshots-midnight');

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
