import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';

const PLAYER_NAME_KEY = 'pobeg-studentov-player-name';
const LEADERBOARD_KEY = 'pobeg-studentov-leaderboard';

function normalizeRecord(record) {
  return {
    name: String(record.name || record.player_name || '').trim(),
    score: Math.max(0, Math.floor(Number(record.score) || 0)),
    stars: Math.max(0, Math.floor(Number(record.stars) || 0)),
  };
}

function sortRecords(records) {
  return records
    .map(normalizeRecord)
    .filter((record) => record.name)
    .sort((a, b) => b.score - a.score || b.stars - a.stars || a.name.localeCompare(b.name));
}

export function readPlayerName() {
  return localStorage.getItem(PLAYER_NAME_KEY) || '';
}

export function writePlayerName(name) {
  localStorage.setItem(PLAYER_NAME_KEY, name);
}

export function readLocalLeaderboard() {
  try {
    const records = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]');
    return sortRecords(Array.isArray(records) ? records : []);
  } catch {
    return [];
  }
}

function writeLocalLeaderboard(records) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(sortRecords(records)));
}

export function upsertLocalLeaderboardRecord(name, score, stars = 0) {
  if (!name) return readLocalLeaderboard();

  const records = readLocalLeaderboard();
  const existing = records.find((record) => record.name === name);
  const nextScore = Math.max(0, Math.floor(score));
  const nextStars = Math.max(0, Math.floor(stars));

  if (existing) {
    existing.score = Math.max(existing.score || 0, nextScore);
    existing.stars = Math.max(existing.stars || 0, nextStars);
  } else {
    records.push({ name, score: nextScore, stars: nextStars });
  }

  const sorted = sortRecords(records);
  writeLocalLeaderboard(sorted);
  return sorted;
}

export async function fetchLeaderboard() {
  if (!isSupabaseConfigured || !supabase) return readLocalLeaderboard();

  const { data, error } = await supabase
    .from('leaderboard_scores')
    .select('player_name, score, stars')
    .order('score', { ascending: false })
    .order('stars', { ascending: false });

  if (error) {
    console.warn('Supabase leaderboard fetch failed, using local records.', error.message);
    return readLocalLeaderboard();
  }

  return sortRecords(data || []);
}

export async function upsertLeaderboardRecord(name, score, stars = 0) {
  const localRecords = upsertLocalLeaderboardRecord(name, score, stars);

  if (!isSupabaseConfigured || !supabase || !name) return localRecords;

  const normalized = normalizeRecord({ name, score, stars });
  const { error } = await supabase.from('leaderboard_scores').upsert(
    {
      player_name: normalized.name,
      score: normalized.score,
      stars: normalized.stars,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'player_name' },
  );

  if (error) {
    console.warn('Supabase leaderboard upsert failed, keeping local record.', error.message);
    return localRecords;
  }

  return fetchLeaderboard();
}
