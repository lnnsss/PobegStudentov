import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';

function normalizeProfile(row) {
  if (!row) return null;

  return {
    userId: row.user_id,
    nickname: String(row.nickname || '').trim(),
    telegram: String(row.telegram || '').trim(),
    email: String(row.email || '').trim(),
  };
}

export async function getCurrentSession() {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.warn('Supabase session fetch failed.', error.message);
    return null;
  }

  return data.session || null;
}

export function onAuthStateChange(callback) {
  if (!isSupabaseConfigured || !supabase) return () => {};

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session || null, event);
  });

  return () => data.subscription.unsubscribe();
}

export async function signInWithGoogle() {
  if (!isSupabaseConfigured || !supabase) throw new Error('Авторизация пока не настроена.');

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) throw error;
}

export async function signUpWithEmail(email, password) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Авторизация пока не настроена.');

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });

  if (error) throw error;
  return data.session || null;
}

export async function signInWithEmail(email, password) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Авторизация пока не настроена.');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session || null;
}

export async function signOut() {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function fetchProfile() {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase.from('player_profiles').select('user_id, nickname, telegram, email').maybeSingle();
  if (error) {
    console.warn('Profile fetch failed.', error.message);
    return null;
  }

  return normalizeProfile(data);
}

export async function isNicknameAvailable(nickname, currentNickname = '') {
  const cleanNickname = String(nickname || '').trim();
  const cleanCurrent = String(currentNickname || '').trim();

  if (!cleanNickname) return false;
  if (cleanCurrent && cleanNickname.toLocaleLowerCase() === cleanCurrent.toLocaleLowerCase()) return true;

  return true;
}

export async function saveProfile({ nickname, telegram }) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Авторизация пока не настроена.');

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error('Сначала войдите в аккаунт.');

  const cleanTelegram = String(telegram || '')
    .trim()
    .replace(/^@+/, '')
    .slice(0, 32);

  const { data, error } = await supabase
    .from('player_profiles')
    .upsert(
      {
        user_id: user.id,
        email: user.email || '',
        nickname,
        telegram: cleanTelegram,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('user_id, nickname, telegram, email')
    .single();

  if (error) throw error;
  return normalizeProfile(data);
}
