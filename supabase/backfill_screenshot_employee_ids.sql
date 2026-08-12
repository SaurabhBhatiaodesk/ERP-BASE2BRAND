-- Link screenshot rows missing employee_id to employee_profiles by name (case-insensitive).
-- Run once in Supabase SQL Editor if screenshots exist but Shift Tracker shows none.

UPDATE employee_screenshots es
SET employee_id = ep.id
FROM employee_profiles ep
WHERE es.employee_id IS NULL
  AND lower(trim(es.employee_name)) = lower(trim(ep.name));

-- Verify
SELECT
  count(*) FILTER (WHERE employee_id IS NULL) AS rows_missing_employee_id,
  count(*) AS total_screenshots
FROM employee_screenshots;
