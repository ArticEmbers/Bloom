-- Bloom profile/social features migration
-- Run this once in Supabase SQL Editor.

alter table public.profiles
  add column if not exists avatar_decoration text not null default 'none',
  add column if not exists profile_effect text not null default 'none',
  add column if not exists spotify_show boolean not null default true,
  add column if not exists spotify_is_playing boolean not null default false,
  add column if not exists spotify_track_name text,
  add column if not exists spotify_artists text,
  add column if not exists spotify_album_name text,
  add column if not exists spotify_album_image text,
  add column if not exists spotify_track_url text,
  add column if not exists spotify_progress_ms bigint not null default 0,
  add column if not exists spotify_duration_ms bigint not null default 0;

create table if not exists public.global_badges (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text not null default '',
  icon text not null default '✦',
  priority integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.profile_global_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.global_badges(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table if not exists public.bloom_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into public.global_badges (name, description, icon, priority)
values
  ('Owner', 'Bloom owner and global administrator.', '👑', 100),
  ('Early Supporter', 'Supported Bloom during its early days.', '💖', 90)
on conflict (name) do update set description = excluded.description, icon = excluded.icon, priority = excluded.priority;

alter table public.global_badges enable row level security;
alter table public.profile_global_badges enable row level security;
alter table public.bloom_admins enable row level security;

drop policy if exists "global badges are readable" on public.global_badges;
create policy "global badges are readable" on public.global_badges for select using (true);

drop policy if exists "profile badges are readable" on public.profile_global_badges;
create policy "profile badges are readable" on public.profile_global_badges for select using (true);

drop policy if exists "admins are private" on public.bloom_admins;
create policy "admins are private" on public.bloom_admins for select using (auth.uid() = user_id);

drop function if exists public.grant_global_badge(uuid, text);
create or replace function public.grant_global_badge(p_user_id uuid, p_badge_name text)
returns public.profile_global_badges
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.profile_global_badges;
  badge public.global_badges;
begin
  if not exists (select 1 from public.bloom_admins where user_id = auth.uid()) then
    raise exception 'Only Bloom owners can grant global badges.' using errcode = '42501';
  end if;

  select * into badge from public.global_badges where name = p_badge_name;
  if badge.id is null then
    raise exception 'Unknown badge.' using errcode = '22023';
  end if;

  insert into public.profile_global_badges(user_id, badge_id, granted_by)
  values (p_user_id, badge.id, auth.uid())
  on conflict (user_id, badge_id) do update set granted_by = auth.uid(), granted_at = now()
  returning * into result;
  return result;
end;
$$;

drop function if exists public.revoke_global_badge(uuid, text);
create or replace function public.revoke_global_badge(p_user_id uuid, p_badge_name text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare badge_id uuid;
begin
  if not exists (select 1 from public.bloom_admins where user_id = auth.uid()) then
    raise exception 'Only Bloom owners can revoke global badges.' using errcode = '42501';
  end if;
  select id into badge_id from public.global_badges where name = p_badge_name;
  if badge_id is null then return false; end if;
  delete from public.profile_global_badges pgb using public.global_badges gb where pgb.user_id = p_user_id and pgb.badge_id = gb.id and gb.name = p_badge_name;
  return found;
end;
$$;

-- IMPORTANT: replace YOUR_SUPABASE_USER_UUID with your actual Supabase user UUID.
-- insert into public.bloom_admins(user_id) values ('YOUR_SUPABASE_USER_UUID') on conflict do nothing;
-- insert into public.profile_global_badges(user_id, badge_id)
-- select 'YOUR_SUPABASE_USER_UUID', id from public.global_badges where name = 'Owner'
-- on conflict do nothing;
-- insert into public.profile_global_badges(user_id, badge_id)
-- select 'YOUR_SUPABASE_USER_UUID', id from public.global_badges where name = 'Early Supporter'
-- on conflict do nothing;

-- Additional built-in global badges
insert into public.global_badges (name, description, icon, priority)
values
  ('Developer', 'Built and maintained Bloom.', '🛠️', 80),
  ('Contributor', 'Contributed code, design, or infrastructure to Bloom.', '💻', 70),
  ('Founding Member', 'One of the first members of the Bloom community.', '🌱', 65),
  ('Bug Hunter', 'Helped find and report issues in Bloom.', '🐞', 60),
  ('Artist', 'Shared artwork or visual work with the Bloom community.', '🎨', 55),
  ('VIP', 'A special global Bloom supporter.', '💎', 50),
  ('Community Helper', 'Helped other members and kept the community welcoming.', '🛡️', 45),
  ('Friend of Bloom', 'A special friend of the Bloom project.', '🌸', 40)
on conflict (name) do update set description=excluded.description, icon=excluded.icon, priority=excluded.priority;
