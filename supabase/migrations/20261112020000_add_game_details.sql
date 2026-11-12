alter table public.games
  add column if not exists developer text,
  add column if not exists publisher text,
  add column if not exists release_date date,
  add column if not exists trailer_url text;

comment on column public.games.developer is
  'Developer studio or person responsible for the game';

comment on column public.games.publisher is
  'Publisher of the game';

comment on column public.games.release_date is
  'Original release date of the game';

comment on column public.games.trailer_url is
  'YouTube or Vimeo trailer URL';
