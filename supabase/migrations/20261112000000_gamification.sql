-- VEXORA Gamification: XP, levels and achievements
-- Safe to run more than once.

create table if not exists public.player_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  messages_sent integer not null default 0 check (messages_sent >= 0),
  friends_count integer not null default 0 check (friends_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.achievements (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null default '🏆',
  xp_reward integer not null default 0 check (xp_reward >= 0),
  sort_order integer not null default 0
);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (user_id, achievement_id)
);

create index if not exists user_achievements_user_earned_idx
  on public.user_achievements(user_id, earned_at desc);

alter table public.player_stats enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

drop policy if exists "Users can read own player stats" on public.player_stats;
create policy "Users can read own player stats"
  on public.player_stats for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Anyone can read achievements" on public.achievements;
create policy "Anyone can read achievements"
  on public.achievements for select to authenticated
  using (true);

drop policy if exists "Users can read own earned achievements" on public.user_achievements;
create policy "Users can read own earned achievements"
  on public.user_achievements for select to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.player_stats from anon, authenticated;
revoke insert, update, delete on public.achievements from anon, authenticated;
revoke insert, update, delete on public.user_achievements from anon, authenticated;
grant select on public.player_stats, public.achievements, public.user_achievements to authenticated;

insert into public.achievements (id, title, description, icon, xp_reward, sort_order)
values
  ('first_message', 'Первое сообщение', 'Отправь своё первое личное сообщение.', '✉️', 0, 1),
  ('messages_10', 'На связи', 'Отправь 10 личных сообщений.', '💬', 0, 2),
  ('first_friend', 'Новые знакомства', 'Добавь первого друга.', '🤝', 0, 3),
  ('friends_5', 'Своя команда', 'Стань друзьями с пятью игроками.', '👥', 0, 4),
  ('xp_100', 'Первый уровень', 'Набери 100 опыта.', '⭐', 0, 5),
  ('xp_500', 'Ветеран VEXORA', 'Набери 500 опыта.', '🏆', 0, 6),
  ('developer_approved', 'Создатель миров', 'Получи одобрение заявки разработчика.', '🎮', 0, 7)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  sort_order = excluded.sort_order;

create or replace function public.check_player_achievements(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stats public.player_stats%rowtype;
begin
  select * into v_stats from public.player_stats where user_id = p_user_id;
  if not found then return; end if;

  if v_stats.messages_sent >= 1 then
    insert into public.user_achievements(user_id, achievement_id)
    values (p_user_id, 'first_message') on conflict do nothing;
  end if;

  if v_stats.messages_sent >= 10 then
    insert into public.user_achievements(user_id, achievement_id)
    values (p_user_id, 'messages_10') on conflict do nothing;
  end if;

  if v_stats.friends_count >= 1 then
    insert into public.user_achievements(user_id, achievement_id)
    values (p_user_id, 'first_friend') on conflict do nothing;
  end if;

  if v_stats.friends_count >= 5 then
    insert into public.user_achievements(user_id, achievement_id)
    values (p_user_id, 'friends_5') on conflict do nothing;
  end if;

  if v_stats.xp >= 100 then
    insert into public.user_achievements(user_id, achievement_id)
    values (p_user_id, 'xp_100') on conflict do nothing;
  end if;

  if v_stats.xp >= 500 then
    insert into public.user_achievements(user_id, achievement_id)
    values (p_user_id, 'xp_500') on conflict do nothing;
  end if;
end;
$$;

create or replace function public.award_player_xp(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_xp integer;
begin
  if p_user_id is null or p_amount <= 0 then return; end if;

  insert into public.player_stats(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.player_stats
  set xp = xp + p_amount,
      level = ((xp + p_amount) / 100) + 1,
      updated_at = now()
  where user_id = p_user_id
  returning xp into v_xp;

  perform public.check_player_achievements(p_user_id);
end;
$$;

create or replace function public.on_gamification_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today_count integer;
begin
  insert into public.player_stats(user_id)
  values (new.sender_id)
  on conflict (user_id) do nothing;

  update public.player_stats
  set messages_sent = messages_sent + 1,
      updated_at = now()
  where user_id = new.sender_id;

  select count(*) into v_today_count
  from public.messages
  where sender_id = new.sender_id
    and created_at >= date_trunc('day', now());

  -- XP is limited to the first 10 messages per day to discourage spam.
  if v_today_count <= 10 then
    perform public.award_player_xp(new.sender_id, 5);
  else
    perform public.check_player_achievements(new.sender_id);
  end if;

  return new;
end;
$$;

create or replace function public.on_gamification_friend_accepted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'accepted' and old.status is distinct from new.status then
    insert into public.player_stats(user_id)
    values (new.sender_id), (new.receiver_id)
    on conflict (user_id) do nothing;

    update public.player_stats
    set friends_count = friends_count + 1,
        updated_at = now()
    where user_id in (new.sender_id, new.receiver_id);

    perform public.award_player_xp(new.sender_id, 25);
    perform public.award_player_xp(new.receiver_id, 25);
    perform public.check_player_achievements(new.sender_id);
    perform public.check_player_achievements(new.receiver_id);
  end if;
  return new;
end;
$$;

create or replace function public.on_gamification_developer_approved()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'approved' and old.status is distinct from new.status then
    perform public.award_player_xp(new.user_id, 100);
    insert into public.user_achievements(user_id, achievement_id)
    values (new.user_id, 'developer_approved')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_gamification_message on public.messages;
create trigger on_gamification_message
after insert on public.messages
for each row execute function public.on_gamification_message();

drop trigger if exists on_gamification_friend_accepted on public.friend_requests;
create trigger on_gamification_friend_accepted
after update on public.friend_requests
for each row execute function public.on_gamification_friend_accepted();

drop trigger if exists on_gamification_developer_approved on public.developer_applications;
create trigger on_gamification_developer_approved
after update on public.developer_applications
for each row execute function public.on_gamification_developer_approved();

revoke all on function public.check_player_achievements(uuid) from public, anon, authenticated;
revoke all on function public.award_player_xp(uuid, integer) from public, anon, authenticated;
revoke all on function public.on_gamification_message() from public, anon, authenticated;
revoke all on function public.on_gamification_friend_accepted() from public, anon, authenticated;
revoke all on function public.on_gamification_developer_approved() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'player_stats'
    ) then
      alter publication supabase_realtime add table public.player_stats;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_achievements'
    ) then
      alter publication supabase_realtime add table public.user_achievements;
    end if;
  end if;
end $$;
