-- Run this to add the fcm_token column to employee_profiles
alter table public.employee_profiles 
add column if not exists fcm_token text;
