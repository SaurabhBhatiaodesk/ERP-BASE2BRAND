-- "Assigned by X" on Projects & Work tasks — track who created the task,
-- separate from who it's assigned to, so a task can be raised by one person
-- and worked by another. See addProjectTask()/mapProjectTaskRowToAppTask() in
-- database.ts and the Assignee field in CRMTasksViews.tsx's New Task form.
alter table public.project_tasks
  add column if not exists created_by text references public.employee_profiles(id) on delete set null;
