-- Run this in your Supabase SQL Editor (CLIENT-ERP project)
-- Row Level Security. Unlike the parent ERP (an internal staff tool that enforces
-- authorization client-side with wide-open RLS), this project serves external client
-- organizations, so isolation between one client's data and another's is enforced here,
-- in the database, not just in the frontend.

create or replace function current_person_id()
returns uuid
language sql
stable
as $$
  select id from people where auth_user_id = auth.uid()
$$;

create or replace function current_org_id()
returns uuid
language sql
stable
as $$
  select organization_id from people where auth_user_id = auth.uid()
$$;

create or replace function project_in_scope(p_project_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from projects pr
    where pr.id = p_project_id
      and pr.organization_id = current_org_id()
  )
$$;

-- organizations: a client can only see their own organization row.
alter table organizations enable row level security;
drop policy if exists organizations_select on organizations;
create policy organizations_select on organizations
  for select to authenticated
  using (id = current_org_id());

-- people: the agency staff directory (kind = 'team') is visible to any authenticated
-- client (needed everywhere as assignee/author display data); client rows are only
-- visible within their own organization. Writes are service-role only (no policy).
alter table people enable row level security;
drop policy if exists people_select on people;
create policy people_select on people
  for select to authenticated
  using (kind = 'team' or organization_id = current_org_id());

alter table client_settings enable row level security;
drop policy if exists client_settings_all on client_settings;
create policy client_settings_all on client_settings
  for all to authenticated
  using (person_id = current_person_id())
  with check (person_id = current_person_id());

alter table projects enable row level security;
drop policy if exists projects_select on projects;
create policy projects_select on projects
  for select to authenticated
  using (organization_id = current_org_id());

alter table project_team_members enable row level security;
drop policy if exists project_team_members_select on project_team_members;
create policy project_team_members_select on project_team_members
  for select to authenticated
  using (project_in_scope(project_id));

alter table milestones enable row level security;
drop policy if exists milestones_select on milestones;
create policy milestones_select on milestones
  for select to authenticated
  using (project_in_scope(project_id));

alter table sprints enable row level security;
drop policy if exists sprints_select on sprints;
create policy sprints_select on sprints
  for select to authenticated
  using (project_in_scope(project_id));

alter table tasks enable row level security;
drop policy if exists tasks_select on tasks;
create policy tasks_select on tasks
  for select to authenticated
  using (project_in_scope(project_id));
drop policy if exists tasks_write on tasks;
create policy tasks_write on tasks
  for update to authenticated
  using (project_in_scope(project_id))
  with check (project_in_scope(project_id));

alter table activity_log enable row level security;
drop policy if exists activity_log_select on activity_log;
create policy activity_log_select on activity_log
  for select to authenticated
  using (project_in_scope(project_id));

alter table deliverables enable row level security;
drop policy if exists deliverables_select on deliverables;
create policy deliverables_select on deliverables
  for select to authenticated
  using (project_in_scope(project_id));
drop policy if exists deliverables_write on deliverables;
create policy deliverables_write on deliverables
  for update to authenticated
  using (project_in_scope(project_id))
  with check (project_in_scope(project_id));

alter table deliverable_versions enable row level security;
drop policy if exists deliverable_versions_select on deliverable_versions;
create policy deliverable_versions_select on deliverable_versions
  for select to authenticated
  using (
    exists (
      select 1 from deliverables d
      where d.id = deliverable_versions.deliverable_id
        and project_in_scope(d.project_id)
    )
  );

alter table deliverable_comments enable row level security;
drop policy if exists deliverable_comments_select on deliverable_comments;
create policy deliverable_comments_select on deliverable_comments
  for select to authenticated
  using (
    exists (
      select 1 from deliverables d
      where d.id = deliverable_comments.deliverable_id
        and project_in_scope(d.project_id)
    )
  );
drop policy if exists deliverable_comments_insert on deliverable_comments;
create policy deliverable_comments_insert on deliverable_comments
  for insert to authenticated
  with check (
    exists (
      select 1 from deliverables d
      where d.id = deliverable_comments.deliverable_id
        and project_in_scope(d.project_id)
    )
  );

alter table contracts enable row level security;
drop policy if exists contracts_select on contracts;
create policy contracts_select on contracts
  for select to authenticated
  using (project_in_scope(project_id));

alter table contract_hour_categories enable row level security;
drop policy if exists contract_hour_categories_select on contract_hour_categories;
create policy contract_hour_categories_select on contract_hour_categories
  for select to authenticated
  using (
    exists (
      select 1 from contracts c
      where c.id = contract_hour_categories.contract_id
        and project_in_scope(c.project_id)
    )
  );

alter table invoices enable row level security;
drop policy if exists invoices_select on invoices;
create policy invoices_select on invoices
  for select to authenticated
  using (project_in_scope(project_id));

alter table documents enable row level security;
drop policy if exists documents_select on documents;
create policy documents_select on documents
  for select to authenticated
  using (project_in_scope(project_id));

alter table meetings enable row level security;
drop policy if exists meetings_select on meetings;
create policy meetings_select on meetings
  for select to authenticated
  using (project_in_scope(project_id));

alter table meeting_attendees enable row level security;
drop policy if exists meeting_attendees_select on meeting_attendees;
create policy meeting_attendees_select on meeting_attendees
  for select to authenticated
  using (
    exists (
      select 1 from meetings m
      where m.id = meeting_attendees.meeting_id
        and project_in_scope(m.project_id)
    )
  );

alter table change_requests enable row level security;
drop policy if exists change_requests_select on change_requests;
create policy change_requests_select on change_requests
  for select to authenticated
  using (project_in_scope(project_id));
drop policy if exists change_requests_insert on change_requests;
create policy change_requests_insert on change_requests
  for insert to authenticated
  with check (project_in_scope(project_id));

alter table support_tickets enable row level security;
drop policy if exists support_tickets_select on support_tickets;
create policy support_tickets_select on support_tickets
  for select to authenticated
  using (project_in_scope(project_id));
drop policy if exists support_tickets_insert on support_tickets;
create policy support_tickets_insert on support_tickets
  for insert to authenticated
  with check (project_in_scope(project_id));

alter table notifications enable row level security;
drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications
  for select to authenticated
  using (recipient_id = current_person_id());
drop policy if exists notifications_update on notifications;
create policy notifications_update on notifications
  for update to authenticated
  using (recipient_id = current_person_id())
  with check (recipient_id = current_person_id());

alter table ai_executive_summaries enable row level security;
drop policy if exists ai_executive_summaries_select on ai_executive_summaries;
create policy ai_executive_summaries_select on ai_executive_summaries
  for select to authenticated
  using (project_in_scope(project_id));

alter table ai_conversations enable row level security;
drop policy if exists ai_conversations_all on ai_conversations;
create policy ai_conversations_all on ai_conversations
  for all to authenticated
  using (person_id = current_person_id())
  with check (person_id = current_person_id());

alter table ai_messages enable row level security;
drop policy if exists ai_messages_all on ai_messages;
create policy ai_messages_all on ai_messages
  for all to authenticated
  using (
    exists (
      select 1 from ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.person_id = current_person_id()
    )
  )
  with check (
    exists (
      select 1 from ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.person_id = current_person_id()
    )
  );
