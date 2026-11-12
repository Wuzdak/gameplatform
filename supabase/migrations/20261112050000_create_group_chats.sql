-- VEXORA group chats and group messages
create table if not exists public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_group_members (
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.chat_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists chat_groups_created_by_idx
  on public.chat_groups(created_by, created_at desc);
create index if not exists chat_group_members_user_idx
  on public.chat_group_members(user_id, joined_at desc);
create index if not exists chat_group_messages_group_idx
  on public.chat_group_messages(group_id, created_at desc);

create or replace function public.is_chat_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.chat_group_members m
    where m.group_id = p_group_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_chat_group(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.chat_group_members m
    where m.group_id = p_group_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_chat_group_member(uuid) from public, anon;
revoke all on function public.can_manage_chat_group(uuid) from public, anon;
grant execute on function public.is_chat_group_member(uuid) to authenticated;
grant execute on function public.can_manage_chat_group(uuid) to authenticated;

alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.chat_group_messages enable row level security;

drop policy if exists "Members can view their groups" on public.chat_groups;
create policy "Members can view their groups"
  on public.chat_groups for select to authenticated
  using (public.is_chat_group_member(id));

drop policy if exists "Authenticated users can create groups" on public.chat_groups;
create policy "Authenticated users can create groups"
  on public.chat_groups for insert to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "Group managers can update groups" on public.chat_groups;
create policy "Group managers can update groups"
  on public.chat_groups for update to authenticated
  using (public.can_manage_chat_group(id))
  with check (public.can_manage_chat_group(id));

drop policy if exists "Group owners can delete groups" on public.chat_groups;
create policy "Group owners can delete groups"
  on public.chat_groups for delete to authenticated
  using (created_by = auth.uid());

drop policy if exists "Members can view group membership" on public.chat_group_members;
create policy "Members can view group membership"
  on public.chat_group_members for select to authenticated
  using (public.is_chat_group_member(group_id));

drop policy if exists "Users can join groups they create" on public.chat_group_members;
create policy "Users can join groups they create"
  on public.chat_group_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.chat_groups g
      where g.id = group_id and g.created_by = auth.uid()
    )
  );

drop policy if exists "Managers can add group members" on public.chat_group_members;
create policy "Managers can add group members"
  on public.chat_group_members for insert to authenticated
  with check (public.can_manage_chat_group(group_id));

drop policy if exists "Users can leave groups" on public.chat_group_members;
create policy "Users can leave groups"
  on public.chat_group_members for delete to authenticated
  using (user_id = auth.uid() or public.can_manage_chat_group(group_id));

drop policy if exists "Members can read group messages" on public.chat_group_messages;
create policy "Members can read group messages"
  on public.chat_group_messages for select to authenticated
  using (public.is_chat_group_member(group_id));

drop policy if exists "Members can send group messages" on public.chat_group_messages;
create policy "Members can send group messages"
  on public.chat_group_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_chat_group_member(group_id)
  );

grant select, insert, update, delete on public.chat_groups to authenticated;
grant select, insert, delete on public.chat_group_members to authenticated;
grant select, insert on public.chat_group_messages to authenticated;

do $
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_group_messages'
  ) then
    alter publication supabase_realtime add table public.chat_group_messages;
  end if;
end;
$;
