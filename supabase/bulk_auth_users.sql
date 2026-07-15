-- =============================================================================
-- BASE2BRAND ERP — Bulk auth users from employee_profiles
-- =============================================================================
-- Har employee jiska valid email hai → auth.users mein account + password 12345678
-- Pehle se auth user hai → sirf password reset ho jayega
--
-- RUN: Supabase Dashboard → SQL Editor → paste → Run
-- NOTE: "Confirm email" OFF rakho (Authentication → Providers → Email)
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ── 1) Existing auth users: password → 12345678 + email confirmed ─────────────
update auth.users u
set
  encrypted_password = extensions.crypt('12345678', extensions.gen_salt('bf')),
  email_confirmed_at = coalesce(u.email_confirmed_at, timezone('utc', now())),
  updated_at = timezone('utc', now())
from public.employee_profiles ep
where lower(trim(u.email)) = lower(trim(ep.email))
  and ep.email is not null
  and trim(ep.email) <> ''
  and ep.email <> '—'
  and ep.email like '%@%';

-- ── 2) Missing auth users: create new rows ────────────────────────────────────
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  lower(trim(ep.email)),
  extensions.crypt('12345678', extensions.gen_salt('bf')),
  timezone('utc', now()),
  timezone('utc', now()),
  timezone('utc', now()),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object(
    'full_name', ep.name,
    'role', coalesce(nullif(trim(ep.app_role), ''), 'employee'),
    'app_role', coalesce(nullif(trim(ep.app_role), ''), 'employee'),
    'department', ep.dept,
    'designation', ep.role
  ),
  timezone('utc', now()),
  timezone('utc', now()),
  '',
  '',
  '',
  ''
from public.employee_profiles ep
where ep.email is not null
  and trim(ep.email) <> ''
  and ep.email <> '—'
  and ep.email like '%@%'
  and not exists (
    select 1
    from auth.users u
    where lower(u.email) = lower(trim(ep.email))
  );

-- ── 3) Email identities (required for login) ─────────────────────────────────
insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  timezone('utc', now()),
  timezone('utc', now()),
  timezone('utc', now())
from auth.users u
where exists (
  select 1
  from public.employee_profiles ep
  where lower(trim(ep.email)) = lower(u.email)
    and ep.email is not null
    and trim(ep.email) <> ''
    and ep.email <> '—'
    and ep.email like '%@%'
)
and not exists (
  select 1
  from auth.identities i
  where i.user_id = u.id
    and i.provider = 'email'
);

-- ── 4) Verify ─────────────────────────────────────────────────────────────────
select
  ep.name,
  ep.email,
  ep.app_role,
  case
    when u.id is not null then 'auth OK — password: 12345678'
    else 'MISSING — invalid email in profile?'
  end as auth_status
from public.employee_profiles ep
left join auth.users u on lower(trim(ep.email)) = lower(u.email)
where ep.email is not null
  and trim(ep.email) <> ''
  and ep.email <> '—'
order by ep.name;
