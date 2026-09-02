-- BLOOM — SERVER INVITE / MEMBERSHIP SYSTEM
-- Run once in Supabase SQL Editor.
-- This migration makes server visibility membership-based and adds a random invite code.

create extension if not exists pgcrypto;

alter table public.servers
  add column if not exists invite_code text;

update public.servers
set invite_code = upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10))
where invite_code is null or btrim(invite_code) = '';

create unique index if not exists servers_invite_code_uidx
  on public.servers (invite_code);

alter table public.servers
  alter column invite_code set default upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10));

alter table public.servers
  alter column invite_code set not null;

-- Replace server policies so the sidebar cannot expose every Space to every account.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'servers'
  loop
    execute format(
      'drop policy if exists %I on public.servers',
      policy_row.policyname
    );
  end loop;
end $$;

alter table public.servers enable row level security;

create policy "Bloom users can view Spaces they belong to"
on public.servers
for select
to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1
    from public.server_members sm
    where sm.server_id = public.servers.id
      and sm.user_id = auth.uid()
  )
);

create policy "Bloom users can create their own Spaces"
on public.servers
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Bloom owners can update their Spaces"
on public.servers
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Bloom owners can delete their Spaces"
on public.servers
for delete
to authenticated
using (owner_id = auth.uid());

-- Join a Space securely by code. The function performs the membership insert
-- server-side so the invite code is never used as a client-side authorization shortcut.
create or replace function public.join_server_by_invite_code(p_code text)
returns setof public.servers
language plpgsql
security definer
set search_path = public
as $$
declare
  found_server public.servers%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to join a Space.';
  end if;

  select *
  into found_server
  from public.servers
  where upper(invite_code) = upper(btrim(p_code))
  limit 1;

  if not found then
    raise exception 'That Space code is invalid.';
  end if;

  insert into public.server_members (server_id, user_id)
  values (found_server.id, auth.uid())
  on conflict (server_id, user_id) do nothing;

  return next found_server;
end;
$$;

grant execute on function public.join_server_by_invite_code(text) to authenticated;

-- Owner-only code regeneration.
create or replace function public.regenerate_server_invite_code(p_server_id bigint)
returns setof public.servers
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_server public.servers%rowtype;
  new_code text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if not exists (
    select 1
    from public.servers
    where id = p_server_id
      and owner_id = auth.uid()
  ) then
    raise exception 'Only the Space owner can regenerate its code.';
  end if;

  loop
    new_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10));
    begin
      update public.servers
      set invite_code = new_code
      where id = p_server_id
      returning * into updated_server;
      exit;
    exception
      when unique_violation then
        -- Extremely unlikely collision; simply try another random code.
    end;
  end loop;

  return next updated_server;
end;
$$;

grant execute on function public.regenerate_server_invite_code(bigint) to authenticated;
