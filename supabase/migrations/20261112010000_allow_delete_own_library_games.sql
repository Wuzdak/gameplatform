-- Allow authenticated users to remove only their own library entries.
-- The matching SELECT policy must also allow users to see their own rows.
alter table public.user_library enable row level security;

drop policy if exists "Users can delete own library entries"
  on public.user_library;

create policy "Users can delete own library entries"
  on public.user_library
  for delete
  to authenticated
  using (auth.uid() = user_id);
