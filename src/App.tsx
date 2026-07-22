import { ReactNode, useState } from "react";
import { Layout, PageKey } from "./components/Layout";
import { FinanceProvider, useFinance } from "./contexts/FinanceContext";
import { DailyEntryPage } from "./pages/DailyEntryPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CarriersPage } from "./pages/CarriersPage";
import { CostsPage } from "./pages/CostsPage";
import { LoginPage } from "./pages/LoginPage";
import { RealProfitPage } from "./pages/RealProfitPage";
import { FortnightlyPage, MonthlyPage, WeeklyPage } from "./pages/SummaryPages";
import { isSupabaseConfigured, supabaseConfigError } from "./utils/supabase";

const pages: Record<PageKey, ReactNode> = {
  dashboard: <DashboardPage />,
  daily: <DailyEntryPage />,
  weekly: <WeeklyPage />,
  fortnightly: <FortnightlyPage />,
  monthly: <MonthlyPage />,
  costs: <CostsPage />,
  profit: <RealProfitPage />,
  carriers: <CarriersPage />
};

const AuthenticatedApp = ({
  activePage,
  setActivePage,
  onLogout
}: {
  activePage: PageKey;
  setActivePage: (page: PageKey) => void;
  onLogout: () => void;
}) => {
  const { error, loading } = useFinance();

  return (
    <Layout activePage={activePage} setActivePage={setActivePage} onLogout={onLogout}>
      {error && <p className="auth-message error supabase-error">Erro Supabase: {error}</p>}
      {loading ? <p className="loading-message">Carregando dados do Supabase...</p> : pages[activePage]}
    </Layout>
  );
};

export const App = () => {
  const [activePage, setActivePage] = useState<PageKey>("daily");
  const [authenticated, setAuthenticated] = useState(false);

  if (!isSupabaseConfigured) {
    return (
      <main className="login-screen">
        <section className="login-panel">
          <p className="eyebrow">SUPABASE NAO CONFIGURADO</p>
          <h1>Configure o banco de dados</h1>
          <p className="auth-message error">
            {supabaseConfigError || "Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel."} Sem essas variaveis, o app nao salva nem carrega dados online.
          </p>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    return <LoginPage onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <FinanceProvider>
      <AuthenticatedApp
        activePage={activePage}
        setActivePage={setActivePage}
        onLogout={() => {
          setActivePage("daily");
          setAuthenticated(false);
        }}
      />
    </FinanceProvider>
  );
};
