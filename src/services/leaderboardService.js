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
  const recordsByName = new Map();

  records
    .map(normalizeRecord)
    .filter((record) => record.name)
    .forEach((record) => {
      const key = record.name.toLocaleLowerCase();
      const existing = recordsByName.get(key);
      if (!existing || record.score > existing.score || (record.score === existing.score && record.stars > existing.stars)) {
        recordsByName.set(key, record);
      }
    });

  return Array.from(recordsByName.values()).sort(
    (a, b) => b.score - a.score || b.stars - a.stars || a.name.localeCompare(b.name),
  );
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

  return sortRecords([...(data || []), ...readLocalLeaderboard()]);
}

export async function isPlayerNameAvailable(name, currentName = '') {
  const cleanName = String(name || '').trim();
  const cleanCurrentName = String(currentName || '').trim();

  if (!cleanName) return false;
  if (cleanCurrentName && cleanName.toLocaleLowerCase() === cleanCurrentName.toLocaleLowerCase()) return true;

  if (!isSupabaseConfigured || !supabase) {
    return !readLocalLeaderboard().some((record) => record.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase());
  }

  const { data, error } = await supabase
    .from('leaderboard_scores')
    .select('player_name')
    .ilike('player_name', cleanName)
    .limit(1);

  if (error) {
    console.warn('Supabase nickname check failed, checking local records.', error.message);
    return !readLocalLeaderboard().some((record) => record.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase());
  }

  return !data?.length;
}

export async function upsertLeaderboardRecord(name, score, stars = 0) {
  const localRecords = upsertLocalLeaderboardRecord(name, score, stars);

  if (!isSupabaseConfigured || !supabase || !name) return localRecords;

  const normalized = normalizeRecord({ name, score, stars });
  const { error } = await supabase.rpc('submit_leaderboard_score', {
    input_player_name: normalized.name,
    input_score: normalized.score,
    input_stars: normalized.stars,
  });

  if (error) {
    console.warn('Supabase leaderboard RPC failed, trying direct upsert.', error.message);
    const { error: upsertError } = await supabase.from('leaderboard_scores').upsert(
      {
        player_name: normalized.name,
        score: normalized.score,
        stars: normalized.stars,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'player_name' },
    );

    if (upsertError) {
      console.warn('Supabase leaderboard upsert failed, keeping local record.', upsertError.message);
      return localRecords;
    }
  }

  return fetchLeaderboard();
}
