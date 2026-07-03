import { requireSupabase } from "./supabase";

const USERNAME = "salesfinanceiro";
const DEFAULT_PASSWORD = "Sales123";
const AUTH_KEY = "financeiro-salles:auth";
const PENDING_AUTH_KEY = "financeiro-salles:pending-auth";
const SESSION_KEY = "financeiro-salles:logged-in";
const LEGACY_PASSWORD_KEY = "financeiro-salles:password";

type AuthConfig = {
  username: string;
  passwordHash: string;
};

const hashPassword = async (password: string) => {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const readCachedAuth = () => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthConfig) : null;
  } catch {
    return null;
  }
};

const cacheAuth = (config: AuthConfig) => localStorage.setItem(AUTH_KEY, JSON.stringify(config));
const queueAuthSync = (config: AuthConfig) => localStorage.setItem(PENDING_AUTH_KEY, JSON.stringify(config));

const defaultAuth = async (): Promise<AuthConfig> => ({
  username: USERNAME,
  passwordHash: await hashPassword(DEFAULT_PASSWORD)
});

const saveAuthConfigOnline = async (config: AuthConfig) => {
  const { error } = await requireSupabase()
    .from("app_settings")
    .upsert({ key: "auth", value: config, updated_at: new Date().toISOString() });
  if (error) throw error;
  cacheAuth(config);
};

const loadAuthConfigOnline = async () => {
  const pending = localStorage.getItem(PENDING_AUTH_KEY);
  if (pending) {
    await saveAuthConfigOnline(JSON.parse(pending) as AuthConfig);
    localStorage.removeItem(PENDING_AUTH_KEY);
  }

  const { data, error } = await requireSupabase().from("app_settings").select("value").eq("key", "auth").maybeSingle();
  if (error) throw error;
  if (data?.value) {
    const config = data.value as AuthConfig;
    cacheAuth(config);
    return config;
  }

  const config = await defaultAuth();
  await saveAuthConfigOnline(config);
  return config;
};

const migrateLegacyPassword = async () => {
  const legacyPassword = localStorage.getItem(LEGACY_PASSWORD_KEY);
  if (!legacyPassword) return;
  const config = {
    username: USERNAME,
    passwordHash: await hashPassword(legacyPassword)
  };
  await saveAuthConfigOnline(config);
  localStorage.removeItem(LEGACY_PASSWORD_KEY);
};

const getAuthConfig = async () => {
  try {
    await migrateLegacyPassword();
    return await loadAuthConfigOnline();
  } catch {
    const cached = readCachedAuth();
    if (cached) return cached;
    return defaultAuth();
  }
};

export const isLoggedIn = () => localStorage.getItem(SESSION_KEY) === "true";

export const login = async (username: string, password: string) => {
  const config = await getAuthConfig();
  const valid = username.trim() === config.username && (await hashPassword(password)) === config.passwordHash;
  if (valid) localStorage.setItem(SESSION_KEY, "true");
  return valid;
};

export const logout = () => localStorage.removeItem(SESSION_KEY);

export const changePassword = async (currentPassword: string, newPassword: string, confirmPassword: string) => {
  const config = await getAuthConfig();
  if ((await hashPassword(currentPassword)) !== config.passwordHash) return { success: false, message: "Senha atual incorreta." };
  if (!newPassword.trim()) return { success: false, message: "Informe uma nova senha." };
  if (newPassword !== confirmPassword) return { success: false, message: "A confirmacao da senha nao confere." };

  const nextConfig = {
    username: USERNAME,
    passwordHash: await hashPassword(newPassword)
  };

  try {
    await saveAuthConfigOnline(nextConfig);
    return { success: true, message: "Senha alterada com sucesso." };
  } catch {
    cacheAuth(nextConfig);
    queueAuthSync(nextConfig);
    return { success: true, message: "Senha alterada no cache. Sera sincronizada quando a conexao voltar." };
  }
};
