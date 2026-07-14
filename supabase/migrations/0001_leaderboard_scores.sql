create table if not exists public.leaderboard_scores (
  id uuid primary key default gen_random_uuid(),
  player_name text not null unique,
  score integer not null default 0 check (score >= 0),
  stars integer not null default 0 check (stars >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leaderboard_scores_score_idx
  on public.leaderboard_scores (score desc, stars desc, updated_at asc);

alter table public.leaderboard_scores enable row level security;

drop policy if exists "Anyone can read leaderboard" on public.leaderboard_scores;
create policy "Anyone can read leaderboard"
  on public.leaderboard_scores
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can submit leaderboard score" on public.leaderboard_scores;
create policy "Anyone can submit leaderboard score"
  on public.leaderboard_scores
  for insert
  to anon, authenticated
  with check (char_length(player_name) between 1 and 16 and score >= 0 and stars >= 0);

drop policy if exists "Anyone can improve leaderboard score" on public.leaderboard_scores;
create policy "Anyone can improve leaderboard score"
  on public.leaderboard_scores
  for update
  to anon, authenticated
  using (char_length(player_name) between 1 and 16)
  with check (char_length(player_name) between 1 and 16 and score >= 0 and stars >= 0);

drop function if exists public.submit_leaderboard_score(text, integer, integer);

create function public.submit_leaderboard_score(
  input_player_name text,
  input_score integer,
  input_stars integer default 0
)
returns table(saved_player_name text, saved_score integer, saved_stars integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  clean_name text := btrim(input_player_name);
  clean_score integer := greatest(0, coalesce(input_score, 0));
  clean_stars integer := greatest(0, coalesce(input_stars, 0));
begin
  if char_length(clean_name) < 1 or char_length(clean_name) > 16 then
    raise exception 'invalid_player_name';
  end if;

  insert into public.leaderboard_scores as scores (player_name, score, stars, updated_at)
  values (clean_name, clean_score, clean_stars, now())
  on conflict on constraint leaderboard_scores_player_name_key do update
    set
      score = greatest(scores.score, excluded.score),
      stars = greatest(scores.stars, excluded.stars),
      updated_at = case
        when excluded.score > scores.score or excluded.stars > scores.stars then now()
        else scores.updated_at
      end;

  return query
    select scores.player_name, scores.score, scores.stars
    from public.leaderboard_scores as scores
    where lower(scores.player_name) = lower(clean_name);
end;
$$;

revoke all on function public.submit_leaderboard_score(text, integer, integer) from public;
grant execute on function public.submit_leaderboard_score(text, integer, integer) to anon, authenticated;
