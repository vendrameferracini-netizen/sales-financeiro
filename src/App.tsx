import { ReactNode, useState } from "react";
import { Layout, PageKey } from "./components/Layout";
import { FinanceProvider } from "./contexts/FinanceContext";
import { DailyEntryPage } from "./pages/DailyEntryPage";
import { CarriersPage } from "./pages/CarriersPage";
import { CostsPage } from "./pages/CostsPage";
import { LoginPage } from "./pages/LoginPage";
import { RealProfitPage } from "./pages/RealProfitPage";
import { FortnightlyPage, MonthlyPage, WeeklyPage } from "./pages/SummaryPages";
import { isLoggedIn, logout } from "./utils/auth";

const pages: Record<PageKey, ReactNode> = {
  daily: <DailyEntryPage />,
  weekly: <WeeklyPage />,
  fortnightly: <FortnightlyPage />,
  monthly: <MonthlyPage />,
  costs: <CostsPage />,
  profit: <RealProfitPage />,
  carriers: <CarriersPage />
};

export const App = () => {
  const [activePage, setActivePage] = useState<PageKey>("daily");
  const [authenticated, setAuthenticated] = useState(() => isLoggedIn());

  if (!authenticated) {
    return <LoginPage onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <FinanceProvider>
      <Layout
        activePage={activePage}
        setActivePage={setActivePage}
        onLogout={() => {
          logout();
          setActivePage("daily");
          setAuthenticated(false);
        }}
      >
        {pages[activePage]}
      </Layout>
    </FinanceProvider>
  );
};
