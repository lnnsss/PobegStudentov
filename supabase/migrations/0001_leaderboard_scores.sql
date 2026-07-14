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
