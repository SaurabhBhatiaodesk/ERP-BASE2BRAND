-- Notify a Team Lead when a task has sat in "Ready for QA" for 30+ minutes
-- (pg_cron) — project: jgbkpbafgwxlkudwqvdb
--
-- When an employee moves a task from In Progress -> Ready for QA
-- (project_tasks.status = 'ready-for-testing'), nobody is told to go review
-- it. This job runs every 5 minutes and, for any task that has been sitting
-- in that status for at least 30 minutes with no reminder sent yet, notifies:
--   - the task assignee's manager, if that manager is a Team Lead, else
--   - every employee with the Team Leader role (app_role = 'teamlead')
--
-- IMPORTANT: this uses project_tasks.ready_for_qa_since, NOT status_entered_at.
-- status_entered_at (and the open task_status_history row) gets reset every
-- time the assignee takes a break/meeting/lunch and resumes (see
-- pauseEmployeeTaskTimers/resumeEmployeeTaskTimers in database.ts, which
-- deliberately pause stage-duration tracking during attendance gaps) — using
-- it here caused the same task to re-qualify and re-notify after every
-- clock-out/in cycle, flooding Team Leads with duplicate reminders.
-- ready_for_qa_since is set once by updateProjectTask() on a genuine status
-- transition into 'ready-for-testing' and cleared on any transition out of
-- it, so it is stable across attendance pause/resume.
--
-- Run AFTER: project_tasks (task_status_tracking.sql), employee_profiles,
-- notifications, and the `ready_for_qa_since` column (added by this file's
-- own migration below).

CREATE EXTENSION IF NOT EXISTS pg_cron;

ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS ready_for_qa_since timestamptz;

-- ─── Unschedule old job (safe re-run) ─────────────────────────────────────
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('task-ready-for-qa-reminder-5min');

-- ─── Notify Team Lead(s) about tasks stuck in Ready for QA ────────────────
SELECT cron.schedule(
  'task-ready-for-qa-reminder-5min',
  '*/5 * * * *',
  $$
    INSERT INTO public.notifications (recipient_id, sender_id, title, message, type, reference_id)
    SELECT
      recipient.id,
      pt.assignee_id,
      'Task ready for QA review',
      trim(emp.name) || ' moved "' || pt.title || '" to Ready for QA 30+ minutes ago. Please review it.',
      'task_ready_for_review',
      pt.id
    FROM public.project_tasks pt
    JOIN public.employee_profiles emp ON emp.id = pt.assignee_id
    JOIN LATERAL (
      -- the assignee's specific manager, only if that manager is a Team Lead
      SELECT mgr.id FROM public.employee_profiles mgr
      WHERE trim(mgr.name) = trim(emp.manager) AND mgr.app_role = 'teamlead'
      UNION ALL
      -- fallback: every Team Lead, only when no specific TL manager was found above
      SELECT tl.id FROM public.employee_profiles tl
      WHERE tl.app_role = 'teamlead'
        AND NOT EXISTS (
          SELECT 1 FROM public.employee_profiles mgr2
          WHERE trim(mgr2.name) = trim(emp.manager) AND mgr2.app_role = 'teamlead'
        )
    ) recipient ON true
    WHERE pt.status = 'ready-for-testing'
      AND pt.assignee_id IS NOT NULL
      AND pt.ready_for_qa_since IS NOT NULL
      AND pt.ready_for_qa_since <= now() - interval '30 minutes'
      -- skip if already notified for this specific stay in Ready for QA
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.reference_id = pt.id
          AND n.type = 'task_ready_for_review'
          AND n.created_at >= pt.ready_for_qa_since
      );
  $$
);

-- List scheduled jobs
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;
