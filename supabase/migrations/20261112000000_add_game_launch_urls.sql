-- VEXORA: links used to open browser-based games.
-- Run this migration in the Supabase SQL Editor before using the launch buttons.

alter table if exists public.games
  add column if not exists launch_url text;

alter table if exists public.user_library
  add column if not exists launch_url text;

comment on column public.games.launch_url is
  'HTTPS URL of the browser game or its official play page';

comment on column public.user_library.launch_url is
  'Snapshot of the game launch URL when the game was added to the library';
