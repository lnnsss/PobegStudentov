import { createClient } from '@supabase/supabase-js';

const fallbackSupabaseUrl = 'https://uqwbfujabjfuqojnzxyb.supabase.co';
const fallbackSupabaseKey = 'sb_publishable_Blz5svthSK-efYh1Rmv-ng_Lu1qVE5i';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || fallbackSupabaseKey;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;
