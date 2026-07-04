import { createClient } from "@supabase/supabase-js";

const normalizeEnv = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const normalizeUrl = (value: unknown) => normalizeEnv(value).replace(/\/+$/, "");

const supabaseUrl = normalizeUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = normalizeEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);
const isValidSupabaseUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl);

export const isSupabaseConfigured = Boolean(isValidSupabaseUrl && supabaseAnonKey);

export const supabaseConfigError = !supabaseUrl
  ? "VITE_SUPABASE_URL nao foi definida no build."
  : !isValidSupabaseUrl
    ? "VITE_SUPABASE_URL invalida. Use o formato https://seu-projeto.supabase.co."
    : !supabaseAnonKey
      ? "VITE_SUPABASE_ANON_KEY nao foi definida no build."
      : "";

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          "Content-Type": "application/json"
        }
      }
    })
  : null;

export const requireSupabase = () => {
  if (!supabase) throw new Error(`Supabase nao configurado. ${supabaseConfigError}`);
  return supabase;
};
