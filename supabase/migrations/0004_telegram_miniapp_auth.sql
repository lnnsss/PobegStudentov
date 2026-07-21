alter table public.player_profiles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists telegram_id bigint,
  add column if not exists telegram_username text not null default '',
  add column if not exists telegram_first_name text not null default '',
  add column if not exists telegram_photo_url text not null default '';

update public.player_profiles
  set id = gen_random_uuid()
  where id is null;

update public.player_profiles
  set nickname = left(coalesce(nullif(telegram_username, ''), nullif(telegram, ''), 'player' || telegram_id), 16)
  where telegram_id is not null
    and nullif(btrim(coalesce(nickname, '')), '') is null;

do $$
begin
  if exists (
    select 1
      from pg_constraint
      where conname = 'player_profiles_pkey'
        and conrelid = 'public.player_profiles'::regclass
  ) then
    alter table public.player_profiles drop constraint player_profiles_pkey;
  end if;
end $$;

alter table public.player_profiles
  alter column id set not null,
  alter column nickname set not null,
  alter column user_id drop not null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
      where conname = 'player_profiles_pkey'
        and conrelid = 'public.player_profiles'::regclass
  ) then
    alter table public.player_profiles add constraint player_profiles_pkey primary key (id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
      where conname = 'player_profiles_telegram_id_key'
        and conrelid = 'public.player_profiles'::regclass
  ) then
    alter table public.player_profiles add constraint player_profiles_telegram_id_key unique (telegram_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
      where conname = 'player_profiles_identity_check'
        and conrelid = 'public.player_profiles'::regclass
  ) then
    alter table public.player_profiles
      add constraint player_profiles_identity_check check (user_id is not null or telegram_id is not null);
  end if;
end $$;

alter table public.leaderboard_scores
  add column if not exists telegram_id bigint;

drop function if exists public.submit_leaderboard_score(text, integer, integer);
drop function if exists public.submit_leaderboard_score(integer, integer);

drop policy if exists "Players can submit own leaderboard score" on public.leaderboard_scores;
drop policy if exists "Players can improve own leaderboard score" on public.leaderboard_scores;
drop policy if exists "Anyone can submit leaderboard score" on public.leaderboard_scores;
drop policy if exists "Anyone can improve leaderboard score" on public.leaderboard_scores;

alter table public.leaderboard_scores
  drop constraint if exists leaderboard_scores_player_name_key;

create index if not exists leaderboard_scores_player_name_lower_idx
  on public.leaderboard_scores (lower(player_name));

do $$
begin
  if not exists (
    select 1
      from pg_constraint
      where conname = 'leaderboard_scores_telegram_id_key'
        and conrelid = 'public.leaderboard_scores'::regclass
  ) then
    alter table public.leaderboard_scores add constraint leaderboard_scores_telegram_id_key unique (telegram_id);
  end if;
end $$;
