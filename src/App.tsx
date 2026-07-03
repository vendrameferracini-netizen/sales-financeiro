import { ReactNode, useState } from "react";
import { Layout, PageKey } from "./components/Layout";
import { DailyEntryPage } from "./pages/DailyEntryPage";
import { CarriersPage } from "./pages/CarriersPage";
import { CostsPage } from "./pages/CostsPage";
import { RealProfitPage } from "./pages/RealProfitPage";
import { FortnightlyPage, MonthlyPage, WeeklyPage } from "./pages/SummaryPages";

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
  return (
    <Layout activePage={activePage} setActivePage={setActivePage}>
      {pages[activePage]}
    </Layout>
  );
};
