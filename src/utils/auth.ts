import bcrypt from "bcryptjs";
import { requireSupabase } from "./supabase";

const DEFAULT_LOGIN = "salesfinanceiro";

type LoginConfig = {
  id: string;
  login: string;
  senha_hash: string;
  criado_em: string;
};

const loadLoginConfig = async (login: string) => {
  const normalizedLogin = login.trim();
  const { data, error } = await requireSupabase()
    .from("app_login")
    .select("id, login, senha_hash, criado_em")
    .eq("login", normalizedLogin)
    .maybeSingle();

  if (error) {
    console.error("Erro completo ao carregar login do Supabase", error);
    throw error;
  }

  if (!data) {
    console.error("Erro completo ao carregar login do Supabase", { login: normalizedLogin, message: "Login nao encontrado em app_login." });
    return null;
  }

  console.log("Dados carregados do Supabase", { table: "app_login", login: normalizedLogin });
  return data as LoginConfig;
};

export const login = async (username: string, password: string) => {
  const config = await loadLoginConfig(username);
  if (!config) return false;
  return bcrypt.compare(password, config.senha_hash);
};

export const changePassword = async (currentPassword: string, newPassword: string, confirmPassword: string) => {
  const config = await loadLoginConfig(DEFAULT_LOGIN);
  if (!config || !(await bcrypt.compare(currentPassword, config.senha_hash))) return { success: false, message: "Senha atual incorreta." };
  if (!newPassword.trim()) return { success: false, message: "Informe uma nova senha." };
  if (newPassword !== confirmPassword) return { success: false, message: "A confirmacao da senha nao confere." };

  const senha_hash = await bcrypt.hash(newPassword, 10);
  console.log("Salvando no Supabase", { table: "app_login", login: DEFAULT_LOGIN });
  const { error } = await requireSupabase()
    .from("app_login")
    .update({ senha_hash })
    .eq("login", DEFAULT_LOGIN);

  if (error) {
    console.error("Erro completo ao atualizar senha no Supabase", error);
    throw error;
  }

  return { success: true, message: "Senha alterada com sucesso." };
};
