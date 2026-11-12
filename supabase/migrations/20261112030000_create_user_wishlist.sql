create table if not exists public.user_wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid not null references public.games(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_wishlist_user_game_unique unique (user_id, game_id)
);

create index if not exists user_wishlist_user_created_idx
  on public.user_wishlist (user_id, created_at desc);

alter table public.user_wishlist enable row level security;

drop policy if exists "Users can view own wishlist" on public.user_wishlist;
create policy "Users can view own wishlist"
  on public.user_wishlist
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can add to own wishlist" on public.user_wishlist;
create policy "Users can add to own wishlist"
  on public.user_wishlist
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own wishlist entries" on public.user_wishlist;
create policy "Users can delete own wishlist entries"
  on public.user_wishlist
  for delete
  to authenticated
  using (auth.uid() = user_id);
