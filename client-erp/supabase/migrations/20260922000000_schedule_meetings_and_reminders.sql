-- Run this in your Supabase SQL Editor (CLIENT-ERP project)
-- Lets clients/admins actually schedule a meeting (previously select-only), and
-- adds a pg_cron job that reminds a client 10 minutes before their meeting starts.

create extension if not exists pg_cron;

alter table public.meetings add column if not exists reminder_sent boolean not null default false;

drop policy if exists meetings_insert on public.meetings;
create policy meetings_insert on public.meetings
  for insert to authenticated
  with check (project_in_scope(project_id));

-- Runs every minute; picks up meetings starting in the next 0-10 minutes (today,
-- UTC wall-clock — meeting_date/start_time have no timezone column yet) that
-- haven't been reminded, notifies every client contact in that project's org,
-- and flips reminder_sent so it never re-fires for the same meeting.
create or replace function public.send_meeting_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  meeting record;
  recipient record;
begin
  for meeting in
    select m.id, m.title, m.start_time, p.organization_id
    from meetings m
    join projects p on p.id = m.project_id
    where m.reminder_sent = false
      and m.start_time is not null
      and m.meeting_date = (now() at time zone 'utc')::date
      and (m.meeting_date + m.start_time)::timestamp > (now() at time zone 'utc')
      and (m.meeting_date + m.start_time)::timestamp <= (now() at time zone 'utc') + interval '10 minutes'
  loop
    for recipient in
      select id from people where organization_id = meeting.organization_id and kind = 'client'
    loop
      insert into notifications (recipient_id, title, description, notification_type, related_type, related_id)
      values (
        recipient.id,
        'Meeting starting soon',
        meeting.title || ' starts at ' || to_char(meeting.start_time, 'HH12:MI AM') || '.',
        'meeting',
        'meeting',
        meeting.id
      );
    end loop;

    update meetings set reminder_sent = true where id = meeting.id;
  end loop;
end;
$$;

select cron.schedule('send-meeting-reminders', '* * * * *', $$select public.send_meeting_reminders();$$);

notify pgrst, 'reload schema';
