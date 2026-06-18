-- Chat document storage (PDF, DOC, etc.) — run in Supabase SQL Editor
-- Cloudinary free accounts block PDF delivery; Supabase Storage serves these files.

insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-attachments', 'chat-attachments', true, 52428800)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "chat_attachments_public_read" on storage.objects;
create policy "chat_attachments_public_read"
on storage.objects for select
to public
using (bucket_id = 'chat-attachments');

drop policy if exists "chat_attachments_auth_upload" on storage.objects;
create policy "chat_attachments_auth_upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'chat-attachments');

drop policy if exists "chat_attachments_auth_update" on storage.objects;
create policy "chat_attachments_auth_update"
on storage.objects for update
to authenticated
using (bucket_id = 'chat-attachments');

drop policy if exists "chat_attachments_auth_delete" on storage.objects;
create policy "chat_attachments_auth_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'chat-attachments');
