import bcrypt from "bcryptjs";
import { APP_ID } from "../data/app";
import { requireSupabase } from "./supabase";

const DEFAULT_LOGIN = "salesfinanceiro";

type LoginConfig = {
  id: string;
  login: string;
  senha_hash: string;
  app_id: string;
};

const getSupabaseErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) return String((error as { message?: unknown }).message);
  return fallback;
};

const logSupabaseError = (table: string, operation: string, payload: unknown, error: unknown) => {
  console.error({ table, operation, payload, error });
};

const loadLoginConfig = async (login: string) => {
  const loginDigitado = login.trim();
  const payload = { app_id: APP_ID, login: loginDigitado };
  console.log("Consultando Supabase", { table: "app_login", operation: "select_login", payload });

  try {
    const { data, error } = await requireSupabase()
      .from("app_login")
      .select("id, login, senha_hash, app_id")
      .eq("app_id", APP_ID)
      .eq("login", loginDigitado)
      .maybeSingle();

    if (error) {
      logSupabaseError("app_login", "select_login", payload, error);
      throw new Error(getSupabaseErrorMessage(error, "Erro ao carregar login no Supabase."));
    }

    if (!data) {
      const notFound = { message: "Login nao encontrado em app_login." };
      logSupabaseError("app_login", "select_login", payload, notFound);
      return null;
    }

    console.log("Dados carregados do Supabase", { table: "app_login", operation: "select_login", payload });
    return data as LoginConfig;
  } catch (error) {
    logSupabaseError("app_login", "select_login", payload, error);
    throw error;
  }
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
  const payload = { app_id: APP_ID, login: DEFAULT_LOGIN, senha_hash };
  console.log("Salvando no Supabase", { table: "app_login", operation: "update_password", payload: { ...payload, senha_hash: "[bcrypt]" } });

  try {
    const { error } = await requireSupabase()
      .from("app_login")
      .update({ senha_hash })
      .eq("app_id", APP_ID)
      .eq("login", DEFAULT_LOGIN);

    if (error) {
      logSupabaseError("app_login", "update_password", { ...payload, senha_hash: "[bcrypt]" }, error);
      throw new Error(getSupabaseErrorMessage(error, "Erro ao atualizar senha no Supabase."));
    }
  } catch (error) {
    logSupabaseError("app_login", "update_password", { ...payload, senha_hash: "[bcrypt]" }, error);
    throw error;
  }

  return { success: true, message: "Senha alterada com sucesso." };
};
