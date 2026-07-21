import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.109.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_INIT_DATA_AGE_SECONDS = 60 * 60 * 24;

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function sanitizeNickname(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}_ -]/gu, '')
    .slice(0, 16);
}

function sanitizeTelegram(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/[^\w]/g, '')
    .slice(0, 32);
}

function normalizeTelegramUser(user: TelegramUser) {
  return {
    id: String(user.id),
    username: sanitizeTelegram(user.username || ''),
    firstName: String(user.first_name || '').trim(),
    lastName: String(user.last_name || '').trim(),
    photoUrl: String(user.photo_url || '').trim(),
  };
}

function normalizeProfile(profile: Record<string, unknown> | null) {
  if (!profile) return null;

  return {
    telegram_id: profile.telegram_id ? String(profile.telegram_id) : '',
    nickname: String(profile.nickname || '').trim(),
    telegram: sanitizeTelegram(profile.telegram || profile.telegram_username || ''),
    telegram_username: sanitizeTelegram(profile.telegram_username || ''),
    telegram_first_name: String(profile.telegram_first_name || '').trim(),
    telegram_photo_url: String(profile.telegram_photo_url || '').trim(),
  };
}

async function hmacSha256(key: string | Uint8Array, value: string) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value)));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return result === 0;
}

async function verifyTelegramInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash') || '';
  params.delete('hash');

  if (!hash) throw new Error('telegram_hash_missing');

  const authDate = Number(params.get('auth_date') || 0);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!authDate || nowSeconds - authDate > MAX_INIT_DATA_AGE_SECONDS) {
    throw new Error('telegram_init_data_expired');
  }

  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = await hmacSha256('WebAppData', botToken);
  const calculatedHash = toHex(await hmacSha256(secretKey, dataCheckString));
  if (!timingSafeEqual(calculatedHash, hash)) throw new Error('telegram_signature_invalid');

  const userJson = params.get('user');
  if (!userJson) throw new Error('telegram_user_missing');

  const user = JSON.parse(userJson) as TelegramUser;
  if (!user.id) throw new Error('telegram_user_missing');

  return user;
}

async function getProfile(supabase: ReturnType<typeof createClient>, user: TelegramUser) {
  const telegramUser = normalizeTelegramUser(user);
  const { data: profile, error: profileError } = await supabase
    .from('player_profiles')
    .select('telegram_id, nickname, telegram, telegram_username, telegram_first_name, telegram_photo_url')
    .eq('telegram_id', user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  if (profile) {
    const { data, error } = await supabase
      .from('player_profiles')
      .update({
        telegram_username: telegramUser.username,
        telegram_first_name: telegramUser.firstName,
        telegram_photo_url: telegramUser.photoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('telegram_id', user.id)
      .select('telegram_id, nickname, telegram, telegram_username, telegram_first_name, telegram_photo_url')
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('player_profiles')
    .insert({
      telegram_id: user.id,
      telegram: telegramUser.username,
      telegram_username: telegramUser.username,
      telegram_first_name: telegramUser.firstName,
      telegram_photo_url: telegramUser.photoUrl,
      updated_at: new Date().toISOString(),
    })
    .select('telegram_id, nickname, telegram, telegram_username, telegram_first_name, telegram_photo_url')
    .single();

  if (error) throw error;
  return data;
}

async function saveProfile(
  supabase: ReturnType<typeof createClient>,
  user: TelegramUser,
  nicknameInput: unknown,
  telegramInput: unknown,
) {
  const nickname = sanitizeNickname(nicknameInput);
  if (nickname.length < 1) throw new Error('invalid_nickname');

  const telegramUser = normalizeTelegramUser(user);
  const telegram = sanitizeTelegram(telegramInput || telegramUser.username);

  const { data, error } = await supabase
    .from('player_profiles')
    .upsert(
      {
        telegram_id: user.id,
        nickname,
        telegram,
        telegram_username: telegramUser.username,
        telegram_first_name: telegramUser.firstName,
        telegram_photo_url: telegramUser.photoUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'telegram_id' },
    )
    .select('telegram_id, nickname, telegram, telegram_username, telegram_first_name, telegram_photo_url')
    .single();

  if (error) throw error;
  return data;
}

async function submitScore(supabase: ReturnType<typeof createClient>, user: TelegramUser, scoreInput: unknown, starsInput: unknown) {
  const score = Math.max(0, Math.floor(Number(scoreInput) || 0));
  const stars = Math.max(0, Math.floor(Number(starsInput) || 0));

  const { data: profile, error: profileError } = await supabase
    .from('player_profiles')
    .select('nickname')
    .eq('telegram_id', user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile?.nickname) throw new Error('profile_required');

  const { data: existing, error: existingError } = await supabase
    .from('leaderboard_scores')
    .select('id, score, stars')
    .eq('telegram_id', user.id)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const nextScore = Math.max(Number(existing.score) || 0, score);
    const nextStars = Math.max(Number(existing.stars) || 0, stars);
    const scoreChanged = nextScore !== Number(existing.score) || nextStars !== Number(existing.stars);
    const updates: Record<string, unknown> = {
      player_name: profile.nickname,
      score: nextScore,
      stars: nextStars,
    };
    if (scoreChanged) updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('leaderboard_scores')
      .update(updates)
      .eq('id', existing.id)
      .select('player_name, score, stars')
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('leaderboard_scores')
    .insert({
      telegram_id: user.id,
      player_name: profile.nickname,
      score,
      stars,
      updated_at: new Date().toISOString(),
    })
    .select('player_name, score, stars')
    .single();

  if (error) throw error;
  return data;
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!botToken) throw new Error('telegram_bot_token_missing');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('supabase_service_config_missing');

    const body = await request.json();
    const action = String(body.action || 'authenticate');
    const initData = String(body.initData || '');
    if (!initData) throw new Error('telegram_init_data_missing');

    const user = await verifyTelegramInitData(initData, botToken);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    const telegramUser = normalizeTelegramUser(user);

    if (action === 'authenticate') {
      const profile = await getProfile(supabase, user);
      return jsonResponse({
        telegram_id: String(user.id),
        telegramUser,
        profile: normalizeProfile(profile),
      });
    }

    if (action === 'save-profile') {
      const profile = await saveProfile(supabase, user, body.nickname, body.telegram);
      return jsonResponse({
        telegram_id: String(user.id),
        telegramUser,
        profile: normalizeProfile(profile),
      });
    }

    if (action === 'submit-score') {
      const record = await submitScore(supabase, user, body.score, body.stars);
      return jsonResponse({ record });
    }

    return jsonResponse({ error: 'unknown_action' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'telegram_auth_failed';
    const status = message.includes('duplicate') || message.includes('unique') ? 409 : 401;
    return jsonResponse({ error: message }, status);
  }
});
