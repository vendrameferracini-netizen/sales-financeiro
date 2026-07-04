import bcrypt from "bcryptjs";
import { APP_ID } from "../data/app";
import { requireSupabase } from "./supabase";

const DEFAULT_LOGIN = "salesfinanceiro";

type ProfileRow = Record<string, unknown>;

const text = (row: ProfileRow, keys: string[], fallback = "") => {
  const value = keys.map((key) => row[key]).find((item) => item !== undefined && item !== null && String(item).trim() !== "");
  return value === undefined || value === null ? fallback : String(value);
};

const getLoginValue = (row: ProfileRow) => text(row, ["login", "username", "usuario", "email"]);
const getPasswordHash = (row: ProfileRow) => text(row, ["senha_hash", "password_hash", "passwordHash", "senha"]);

const profileMatchesApp = (row: ProfileRow) => {
  if (row.app_id !== undefined) return String(row.app_id) === APP_ID;
  if (row.company_app_id !== undefined) return String(row.company_app_id) === APP_ID;
  return true;
};

const loadLoginConfig = async (login: string) => {
  const loginDigitado = login.trim();
  console.log("Consultando Supabase", { table: "profiles", app_id: APP_ID, login: loginDigitado, action: "select_login" });

  const { data, error } = await requireSupabase().from("profiles").select("*");

  if (error) {
    console.error("Erro completo ao carregar login do Supabase", error);
    throw error;
  }

  const profile = ((data || []) as ProfileRow[]).find(
    (row) => profileMatchesApp(row) && getLoginValue(row).toLowerCase() === loginDigitado.toLowerCase()
  );

  if (!profile) {
    console.error("Erro completo ao carregar login do Supabase", { app_id: APP_ID, login: loginDigitado, message: "Login nao encontrado em profiles." });
    return null;
  }

  console.log("Dados carregados do Supabase", { table: "profiles", app_id: APP_ID, login: loginDigitado });
  return profile;
};

export const login = async (username: string, password: string) => {
  const config = await loadLoginConfig(username);
  if (!config) return false;
  const passwordHash = getPasswordHash(config);
  if (!passwordHash) return false;
  return bcrypt.compare(password, passwordHash);
};

export const changePassword = async (currentPassword: string, newPassword: string, confirmPassword: string) => {
  const config = await loadLoginConfig(DEFAULT_LOGIN);
  const currentHash = config ? getPasswordHash(config) : "";
  if (!config || !currentHash || !(await bcrypt.compare(currentPassword, currentHash))) return { success: false, message: "Senha atual incorreta." };
  if (!newPassword.trim()) return { success: false, message: "Informe uma nova senha." };
  if (newPassword !== confirmPassword) return { success: false, message: "A confirmacao da senha nao confere." };

  const senha_hash = await bcrypt.hash(newPassword, 10);
  const passwordColumn = config.senha_hash !== undefined ? "senha_hash" : "password_hash";
  console.log("Salvando no Supabase", { table: "profiles", app_id: APP_ID, login: DEFAULT_LOGIN, column: passwordColumn });

  const { error } = await requireSupabase()
    .from("profiles")
    .update({ [passwordColumn]: senha_hash })
    .eq("id", String(config.id));

  if (error) {
    console.error("Erro completo ao atualizar senha no Supabase", error);
    throw error;
  }

  return { success: true, message: "Senha alterada com sucesso." };
};
