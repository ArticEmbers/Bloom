-- BLOOM SECURITY HARDENING
-- Review and run this migration in Supabase SQL Editor after making a backup.
-- It replaces RLS policies on Bloom-owned tables with membership/role-aware rules.

create or replace function public.bloom_is_member(p_server_id bigint)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.server_members sm
    where sm.server_id = p_server_id and sm.user_id = auth.uid()
  ) or exists (
    select 1 from public.servers s
    where s.id = p_server_id and s.owner_id = auth.uid()
  );
$$;

create or replace function public.bloom_can(p_server_id bigint, p_permission text)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.servers s where s.id = p_server_id and s.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.server_members sm
    join public.member_roles mr on mr.server_id = sm.server_id and mr.user_id = sm.user_id
    join public.roles r on r.id = mr.role_id and r.server_id = sm.server_id
    where sm.server_id = p_server_id and sm.user_id = auth.uid()
      and coalesce((r.permissions ->> 'administrator')::boolean, false)
  )
  or exists (
    select 1
    from public.server_members sm
    join public.member_roles mr on mr.server_id = sm.server_id and mr.user_id = sm.user_id
    join public.roles r on r.id = mr.role_id and r.server_id = sm.server_id
    where sm.server_id = p_server_id and sm.user_id = auth.uid()
      and coalesce((r.permissions ->> p_permission)::boolean, false)
  );
$$;

do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies where schemaname='public' and tablename in ('server_members','channels','messages','message_reactions','roles','member_roles','direct_messages') loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.server_members enable row level security;
create policy "Bloom members can view memberships" on public.server_members for select to authenticated using (public.bloom_is_member(server_id));
create policy "Bloom users can join themselves" on public.server_members for insert to authenticated with check (user_id = auth.uid() and public.bloom_is_member(server_id));
create policy "Bloom managers can manage memberships" on public.server_members for delete to authenticated using (public.bloom_can(server_id,'manage_members') or exists(select 1 from public.servers s where s.id=server_id and s.owner_id=auth.uid()));

alter table public.channels enable row level security;
create policy "Bloom members can view channels" on public.channels for select to authenticated using (public.bloom_is_member(server_id));
create policy "Bloom managers can create channels" on public.channels for insert to authenticated with check (public.bloom_can(server_id,'manage_channels'));
create policy "Bloom managers can update channels" on public.channels for update to authenticated using (public.bloom_can(server_id,'manage_channels')) with check (public.bloom_can(server_id,'manage_channels'));
create policy "Bloom managers can delete channels" on public.channels for delete to authenticated using (public.bloom_can(server_id,'manage_channels'));

alter table public.messages enable row level security;
create policy "Bloom members can view messages" on public.messages for select to authenticated using (public.bloom_is_member((select c.server_id from public.channels c where c.id=channel_id)));
create policy "Bloom members can send messages" on public.messages for insert to authenticated with check (user_id=auth.uid() and public.bloom_can((select c.server_id from public.channels c where c.id=channel_id),'send_messages'));
create policy "Bloom users can edit own messages" on public.messages for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "Bloom users can delete messages" on public.messages for delete to authenticated using (user_id=auth.uid() or public.bloom_can((select c.server_id from public.channels c where c.id=channel_id),'delete_messages'));

alter table public.message_reactions enable row level security;
create policy "Bloom members can view reactions" on public.message_reactions for select to authenticated using (
  (message_id is not null and public.bloom_is_member((select c.server_id from public.channels c join public.messages m on m.channel_id=c.id where m.id=message_id)))
  or (direct_message_id is not null and (select dm.sender_id=auth.uid() or dm.recipient_id=auth.uid() from public.direct_messages dm where dm.id=direct_message_id))
);
create policy "Bloom users can add reactions" on public.message_reactions for insert to authenticated with check (user_id=auth.uid());
create policy "Bloom users can remove own reactions" on public.message_reactions for delete to authenticated using (user_id=auth.uid());

alter table public.roles enable row level security;
create policy "Bloom members can view roles" on public.roles for select to authenticated using (public.bloom_is_member(server_id));
create policy "Bloom managers can create roles" on public.roles for insert to authenticated with check (public.bloom_can(server_id,'manage_roles'));
create policy "Bloom managers can update roles" on public.roles for update to authenticated using (public.bloom_can(server_id,'manage_roles')) with check (public.bloom_can(server_id,'manage_roles'));
create policy "Bloom managers can delete roles" on public.roles for delete to authenticated using (public.bloom_can(server_id,'manage_roles'));

alter table public.member_roles enable row level security;
create policy "Bloom members can view member roles" on public.member_roles for select to authenticated using (public.bloom_is_member(server_id));
create policy "Bloom managers can assign member roles" on public.member_roles for insert to authenticated with check (public.bloom_can(server_id,'manage_roles'));
create policy "Bloom managers can remove member roles" on public.member_roles for delete to authenticated using (public.bloom_can(server_id,'manage_roles'));

alter table public.direct_messages enable row level security;
create policy "Bloom users can view their DMs" on public.direct_messages for select to authenticated using (sender_id=auth.uid() or recipient_id=auth.uid());
create policy "Bloom users can send DMs" on public.direct_messages for insert to authenticated with check (sender_id=auth.uid());
create policy "Bloom users can edit own DMs" on public.direct_messages for update to authenticated using (sender_id=auth.uid()) with check (sender_id=auth.uid());
create policy "Bloom users can delete own DMs" on public.direct_messages for delete to authenticated using (sender_id=auth.uid());

-- NOTE: storage policies should also be tightened to authenticated users and
-- server/member paths. Keep them project-specific because bucket/path names
-- can vary between Bloom deployments.
