import bcrypt from "bcryptjs";
import { APP_ID } from "../data/app";
import { requireSupabase } from "./supabase";

const DEFAULT_LOGIN = "salesfinanceiro";

type LoginConfig = {
  id: string;
  app_id: string;
  login: string;
  senha_hash: string;
  criado_em: string;
};

const loadLoginConfig = async (login: string) => {
  const loginDigitado = login.trim();
  console.log("Consultando Supabase", { table: "app_login", app_id: APP_ID, login: loginDigitado, action: "select_login" });
  const { data, error } = await requireSupabase()
    .from("app_login")
    .select("id, login, senha_hash, criado_em, app_id")
    .eq("app_id", APP_ID)
    .eq("login", loginDigitado)
    .maybeSingle();

  if (error) {
    console.error("Erro completo ao carregar login do Supabase", error);
    throw error;
  }

  if (!data) {
    console.error("Erro completo ao carregar login do Supabase", { app_id: APP_ID, login: loginDigitado, message: "Login nao encontrado em app_login." });
    return null;
  }

  console.log("Dados carregados do Supabase", { table: "app_login", app_id: APP_ID, login: loginDigitado });
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
  console.log("Salvando no Supabase", { table: "app_login", app_id: APP_ID, login: DEFAULT_LOGIN });
  const { error } = await requireSupabase()
    .from("app_login")
    .update({ senha_hash })
    .eq("app_id", APP_ID)
    .eq("login", DEFAULT_LOGIN);

  if (error) {
    console.error("Erro completo ao atualizar senha no Supabase", error);
    throw error;
  }

  return { success: true, message: "Senha alterada com sucesso." };
};
