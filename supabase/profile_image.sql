-- Profile photos (Cloudinary URLs)
-- Run in Supabase SQL Editor

alter table public.employee_profiles
  add column if not exists profile_image_url text;

-- Live sync header/chat avatars when a profile photo is saved
alter table public.employee_profiles replica identity full;

do $$ begin
  alter publication supabase_realtime add table public.employee_profiles;
exception when duplicate_object then null;
end $$;
