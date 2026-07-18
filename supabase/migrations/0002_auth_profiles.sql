create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 16),
  telegram text not null default '' check (char_length(telegram) <= 32),
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists player_profiles_nickname_lower_key
  on public.player_profiles (lower(nickname));

alter table public.player_profiles enable row level security;

drop policy if exists "Players can read own profile" on public.player_profiles;
create policy "Players can read own profile"
  on public.player_profiles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Players can create own profile" on public.player_profiles;
create policy "Players can create own profile"
  on public.player_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Players can update own profile" on public.player_profiles;
create policy "Players can update own profile"
  on public.player_profiles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.leaderboard_scores
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create unique index if not exists leaderboard_scores_user_id_key
  on public.leaderboard_scores (user_id)
  where user_id is not null;

drop policy if exists "Anyone can submit leaderboard score" on public.leaderboard_scores;
drop policy if exists "Anyone can improve leaderboard score" on public.leaderboard_scores;

drop policy if exists "Players can submit own leaderboard score" on public.leaderboard_scores;
create policy "Players can submit own leaderboard score"
  on public.leaderboard_scores
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id and char_length(player_name) between 1 and 16 and score >= 0 and stars >= 0);

drop policy if exists "Players can improve own leaderboard score" on public.leaderboard_scores;
create policy "Players can improve own leaderboard score"
  on public.leaderboard_scores
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and char_length(player_name) between 1 and 16 and score >= 0 and stars >= 0);

drop function if exists public.submit_leaderboard_score(text, integer, integer);
drop function if exists public.submit_leaderboard_score(integer, integer);

create function public.submit_leaderboard_score(
  input_score integer,
  input_stars integer default 0
)
returns table(saved_player_name text, saved_score integer, saved_stars integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  clean_score integer := greatest(0, coalesce(input_score, 0));
  clean_stars integer := greatest(0, coalesce(input_stars, 0));
  clean_name text;
begin
  if current_user_id is null then
    raise exception 'auth_required';
  end if;

  select nickname
    into clean_name
    from public.player_profiles
    where user_id = current_user_id;

  if clean_name is null then
    raise exception 'profile_required';
  end if;

  insert into public.leaderboard_scores as scores (user_id, player_name, score, stars, updated_at)
  values (current_user_id, clean_name, clean_score, clean_stars, now())
  on conflict (user_id) where user_id is not null do update
    set
      player_name = excluded.player_name,
      score = greatest(scores.score, excluded.score),
      stars = greatest(scores.stars, excluded.stars),
      updated_at = case
        when excluded.score > scores.score or excluded.stars > scores.stars or excluded.player_name <> scores.player_name then now()
        else scores.updated_at
      end;

  return query
    select scores.player_name, scores.score, scores.stars
    from public.leaderboard_scores as scores
    where scores.user_id = current_user_id;
end;
$$;

revoke all on function public.submit_leaderboard_score(integer, integer) from public;
grant execute on function public.submit_leaderboard_score(integer, integer) to authenticated;
