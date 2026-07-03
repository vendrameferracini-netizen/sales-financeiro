import { FormEvent, useState } from "react";
import { DollarSign, KeyRound, LogIn } from "lucide-react";
import { changePassword, login } from "../utils/auth";

export const LoginPage = ({ onLogin }: { onLogin: () => void }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const clearMessages = () => {
    setMessage("");
    setError("");
  };

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    clearMessages();
    setSubmitting(true);

    try {
      if (!(await login(username, password))) {
        setError("Login ou senha incorretos.");
        return;
      }

      onLogin();
    } catch (loginError) {
      console.error("Erro completo no login Supabase", loginError);
      setError(loginError instanceof Error ? loginError.message : "Erro ao acessar o Supabase.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitPasswordChange = async (event: FormEvent) => {
    event.preventDefault();
    clearMessages();
    setSubmitting(true);

    try {
      const result = await changePassword(currentPassword, newPassword, confirmPassword);
      if (!result.success) {
        setError(result.message);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
      setMessage(result.message);
    } catch (changeError) {
      console.error("Erro completo ao trocar senha no Supabase", changeError);
      setError(changeError instanceof Error ? changeError.message : "Erro ao salvar senha no Supabase.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="login-brand">
          <div className="brand-mark">
            <DollarSign size={28} />
          </div>
          <div>
            <strong>FINANCEIRO</strong>
            <span>SALLES</span>
          </div>
        </div>

        <div className="login-copy">
          <p className="eyebrow">ACESSO RESTRITO</p>
          <h1>Entrar no sistema</h1>
          <span>Controle financeiro operacional protegido por login sincronizado.</span>
        </div>

        {!showPasswordForm ? (
          <form className="login-form" onSubmit={submitLogin}>
            <label>
              Login
              <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label>
              Senha
              <input
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && <p className="auth-message error">{error}</p>}
            {message && <p className="auth-message success">{message}</p>}
            <button className="primary-button" type="submit" disabled={submitting}>
              <LogIn size={20} />
              {submitting ? "Entrando..." : "Entrar"}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                clearMessages();
                setShowPasswordForm(true);
              }}
            >
              <KeyRound size={18} />
              Trocar senha
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={submitPasswordChange}>
            <label>
              Senha atual
              <input
                autoComplete="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label>
              Nova senha
              <input
                autoComplete="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label>
              Confirmar nova senha
              <input
                autoComplete="new-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            {error && <p className="auth-message error">{error}</p>}
            <button className="primary-button" type="submit" disabled={submitting}>
              <KeyRound size={20} />
              {submitting ? "Salvando..." : "Salvar senha"}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                clearMessages();
                setShowPasswordForm(false);
              }}
            >
              Voltar ao login
            </button>
          </form>
        )}
      </section>
    </main>
  );
};
