import { requireSupabase } from "./supabase";

const USERNAME = "salesfinanceiro";
const DEFAULT_PASSWORD = "Sales123";

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

const defaultAuth = async (): Promise<AuthConfig> => ({
  username: USERNAME,
  passwordHash: await hashPassword(DEFAULT_PASSWORD)
});

const saveAuthConfigOnline = async (config: AuthConfig) => {
  console.log("Salvando no Supabase", { table: "app_settings", key: "auth" });
  const { error } = await requireSupabase()
    .from("app_settings")
    .upsert({ key: "auth", value: config, updated_at: new Date().toISOString() });
  if (error) {
    console.error("Erro completo ao salvar login/senha no Supabase", error);
    throw error;
  }
};

const loadAuthConfigOnline = async () => {
  const { data, error } = await requireSupabase().from("app_settings").select("value").eq("key", "auth").maybeSingle();
  if (error) {
    console.error("Erro completo ao carregar login/senha do Supabase", error);
    throw error;
  }

  if (data?.value) {
    console.log("Dados carregados do Supabase", { table: "app_settings", key: "auth" });
    return data.value as AuthConfig;
  }

  const config = await defaultAuth();
  await saveAuthConfigOnline(config);
  console.log("Dados carregados do Supabase", { table: "app_settings", key: "auth", seeded: true });
  return config;
};

export const login = async (username: string, password: string) => {
  const config = await loadAuthConfigOnline();
  return username.trim() === config.username && (await hashPassword(password)) === config.passwordHash;
};

export const changePassword = async (currentPassword: string, newPassword: string, confirmPassword: string) => {
  const config = await loadAuthConfigOnline();
  if ((await hashPassword(currentPassword)) !== config.passwordHash) return { success: false, message: "Senha atual incorreta." };
  if (!newPassword.trim()) return { success: false, message: "Informe uma nova senha." };
  if (newPassword !== confirmPassword) return { success: false, message: "A confirmacao da senha nao confere." };

  await saveAuthConfigOnline({
    username: USERNAME,
    passwordHash: await hashPassword(newPassword)
  });

  return { success: true, message: "Senha alterada com sucesso." };
};
