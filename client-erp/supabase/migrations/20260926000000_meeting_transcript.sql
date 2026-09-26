-- Stores the raw transcript text from transcribe-meeting-recording (OpenAI
-- Whisper). ai_summary/decisions (already existing columns) get filled in
-- from the same transcript at the same time.
alter table public.meetings
  add column if not exists transcript text;

-- meetings had no UPDATE policy at all — needed so the meeting-recording
-- flow can write recording_url/ai_summary/decisions/transcript back, scoped
-- the same way meetings_select already is (anyone who can see the project
-- can update its meeting's recording/summary — not sensitive access-control
-- data, just meeting content).
drop policy if exists "meetings_update" on public.meetings;
create policy "meetings_update" on public.meetings
  for update to authenticated
  using (project_in_scope(project_id))
  with check (project_in_scope(project_id));
