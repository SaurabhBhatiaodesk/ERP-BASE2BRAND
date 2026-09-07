-- =============================================================================
-- BASE2BRAND ERP — Feed (company social posts, tagging, likes, comments)
-- =============================================================================
-- Run this in your Supabase SQL Editor (or `supabase db query --linked -f
-- supabase/feed.sql`). Safe to re-run.
--
-- Visibility is enforced in the app (src/lib/database.ts's
-- isFeedPostVisible), not by RLS — same pattern as every other table in this
-- schema (RLS stays open to anon/authenticated; access control happens in
-- application code). A post with no tagged users/departments is visible to
-- everyone; a tagged post is visible ONLY to the tagged users/department
-- members (and its author) — not even HR/CEO/Superadmin get an override.
-- =============================================================================

create table if not exists public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  author_id text not null,
  author_name text not null,
  author_avatar_url text,
  title text not null,
  body text not null default '',
  attachment_urls text[] not null default '{}',
  tagged_user_ids text[] not null default '{}',
  tagged_departments text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feed_post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  employee_id text not null,
  created_at timestamptz not null default now(),
  unique (post_id, employee_id)
);

create table if not exists public.feed_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  -- Flattened one level deep: replying to a reply still points at the
  -- top-level comment (enforced in application code), so the UI only ever
  -- renders comment -> [replies], never comment -> reply -> reply.
  parent_comment_id uuid references public.feed_comments(id) on delete cascade,
  author_id text not null,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.feed_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.feed_comments(id) on delete cascade,
  employee_id text not null,
  created_at timestamptz not null default now(),
  unique (comment_id, employee_id)
);

create index if not exists feed_posts_created_idx on public.feed_posts (created_at desc);
create index if not exists feed_post_likes_post_idx on public.feed_post_likes (post_id);
create index if not exists feed_comments_post_idx on public.feed_comments (post_id);
create index if not exists feed_comment_likes_comment_idx on public.feed_comment_likes (comment_id);

-- ── Grants + RLS — open to anon/authenticated, matching every other table ──
grant select, insert, update, delete on public.feed_posts to anon, authenticated;
grant select, insert, update, delete on public.feed_post_likes to anon, authenticated;
grant select, insert, update, delete on public.feed_comments to anon, authenticated;
grant select, insert, update, delete on public.feed_comment_likes to anon, authenticated;

alter table public.feed_posts enable row level security;
alter table public.feed_post_likes enable row level security;
alter table public.feed_comments enable row level security;
alter table public.feed_comment_likes enable row level security;

drop policy if exists "feed_posts_all_access" on public.feed_posts;
create policy "feed_posts_all_access" on public.feed_posts for all to anon, authenticated using (true) with check (true);

drop policy if exists "feed_post_likes_all_access" on public.feed_post_likes;
create policy "feed_post_likes_all_access" on public.feed_post_likes for all to anon, authenticated using (true) with check (true);

drop policy if exists "feed_comments_all_access" on public.feed_comments;
create policy "feed_comments_all_access" on public.feed_comments for all to anon, authenticated using (true) with check (true);

drop policy if exists "feed_comment_likes_all_access" on public.feed_comment_likes;
create policy "feed_comment_likes_all_access" on public.feed_comment_likes for all to anon, authenticated using (true) with check (true);

alter table public.feed_posts replica identity full;
alter table public.feed_post_likes replica identity full;
alter table public.feed_comments replica identity full;
alter table public.feed_comment_likes replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.feed_posts;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.feed_post_likes;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.feed_comments;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.feed_comment_likes;
exception
  when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
