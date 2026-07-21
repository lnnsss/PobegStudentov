import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';

const TELEGRAM_FUNCTION_NAME = 'telegram-auth';
const DEV_INIT_DATA = import.meta.env.VITE_TELEGRAM_DEV_INIT_DATA || '';

function normalizeProfile(row) {
  if (!row) return null;

  return {
    telegramId: row.telegram_id ? String(row.telegram_id) : '',
    nickname: String(row.nickname || '').trim(),
    telegram: String(row.telegram || row.telegram_username || '').trim().replace(/^@+/, ''),
    firstName: String(row.telegram_first_name || '').trim(),
    photoUrl: String(row.telegram_photo_url || '').trim(),
  };
}

function normalizeTelegramUser(user) {
  if (!user) return null;

  return {
    id: user.id ? String(user.id) : '',
    username: String(user.username || '').trim().replace(/^@+/, ''),
    firstName: String(user.first_name || '').trim(),
    lastName: String(user.last_name || '').trim(),
    photoUrl: String(user.photo_url || '').trim(),
  };
}

export function getTelegramWebApp() {
  return window.Telegram?.WebApp || null;
}

export function getTelegramInitData() {
  const webApp = getTelegramWebApp();
  return webApp?.initData || DEV_INIT_DATA;
}

export function getTelegramUser() {
  return normalizeTelegramUser(getTelegramWebApp()?.initDataUnsafe?.user || null);
}

async function invokeTelegramAuth(body) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Авторизация пока не настроена.');

  const { data, error } = await supabase.functions.invoke(TELEGRAM_FUNCTION_NAME, { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

function normalizeSession(data) {
  const telegramUser = normalizeTelegramUser(data?.telegramUser || data?.telegram_user);
  const profile = normalizeProfile(data?.profile);
  const telegramId = String(data?.telegramId || data?.telegram_id || telegramUser?.id || profile?.telegramId || '');

  if (!telegramId) throw new Error('Telegram не вернул идентификатор пользователя.');

  return {
    telegramId,
    telegramUser: telegramUser || {
      id: telegramId,
      username: profile?.telegram || '',
      firstName: profile?.firstName || '',
      lastName: '',
      photoUrl: profile?.photoUrl || '',
    },
    profile,
  };
}

export async function authenticateWithTelegram() {
  const initData = getTelegramInitData();
  const webApp = getTelegramWebApp();

  if (!initData) {
    throw new Error(webApp ? 'Telegram не передал данные входа.' : 'Откройте игру через Telegram.');
  }

  webApp?.ready?.();
  webApp?.expand?.();

  const data = await invokeTelegramAuth({ action: 'authenticate', initData });
  return normalizeSession(data);
}

export async function saveProfile({ nickname, telegram }) {
  const initData = getTelegramInitData();
  if (!initData) throw new Error('Откройте игру через Telegram.');

  const data = await invokeTelegramAuth({
    action: 'save-profile',
    initData,
    nickname,
    telegram,
  });

  return normalizeProfile(data?.profile);
}

export async function submitTelegramScore({ score, stars }) {
  const initData = getTelegramInitData();
  if (!initData) throw new Error('Откройте игру через Telegram.');

  const data = await invokeTelegramAuth({
    action: 'submit-score',
    initData,
    score,
    stars,
  });

  return data?.record || null;
}

export async function isNicknameAvailable(nickname, currentNickname = '') {
  const cleanNickname = String(nickname || '').trim();
  const cleanCurrent = String(currentNickname || '').trim();

  if (!cleanNickname) return false;
  if (cleanCurrent && cleanNickname.toLocaleLowerCase() === cleanCurrent.toLocaleLowerCase()) return true;

  return true;
}
