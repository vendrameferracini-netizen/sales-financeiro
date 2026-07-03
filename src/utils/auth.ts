const USERNAME = "salesfinanceiro";
const DEFAULT_PASSWORD = "Sales123";
const PASSWORD_KEY = "financeiro-salles:password";
const SESSION_KEY = "financeiro-salles:logged-in";

export const getStoredPassword = () => localStorage.getItem(PASSWORD_KEY) || DEFAULT_PASSWORD;

export const isLoggedIn = () => localStorage.getItem(SESSION_KEY) === "true";

export const login = (username: string, password: string) => {
  const valid = username.trim() === USERNAME && password === getStoredPassword();
  if (valid) localStorage.setItem(SESSION_KEY, "true");
  return valid;
};

export const logout = () => localStorage.removeItem(SESSION_KEY);

export const changePassword = (currentPassword: string, newPassword: string, confirmPassword: string) => {
  if (currentPassword !== getStoredPassword()) return { success: false, message: "Senha atual incorreta." };
  if (!newPassword.trim()) return { success: false, message: "Informe uma nova senha." };
  if (newPassword !== confirmPassword) return { success: false, message: "A confirmacao da senha nao confere." };

  localStorage.setItem(PASSWORD_KEY, newPassword);
  return { success: true, message: "Senha alterada com sucesso." };
};
