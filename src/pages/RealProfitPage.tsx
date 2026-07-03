import { useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { SummaryCards } from "../components/SummaryCards";
import { useFinance } from "../contexts/FinanceContext";
import { buildPeriodSummary, getCostSummary } from "../utils/calculations";
import { getFortnightRange, getMonthRange, monthKey, todayISO } from "../utils/dates";
import { currency } from "../utils/format";

export const RealProfitPage = () => {
  const { carriers, entries, fixedCosts } = useFinance();
  const [mode, setMode] = useState<"fortnight" | "month">("fortnight");
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [fortnight, setFortnight] = useState<"first" | "second">("first");

  const range = useMemo(() => (mode === "fortnight" ? getFortnightRange(month, fortnight) : getMonthRange(month)), [mode, month, fortnight]);
  const summary = useMemo(() => buildPeriodSummary(entries, carriers, range.start, range.end, range.label), [carriers, entries, range]);
  const costs = useMemo(
    () => getCostSummary(fixedCosts, summary, month, mode === "fortnight" ? fortnight : undefined),
    [fixedCosts, summary, month, mode, fortnight]
  );
  const realProfit = summary.totals.difference - costs.total;

  return (
    <>
      <PageHeader
        title="Lucro Real"
        subtitle="Lucro bruto menos custos fixos e LogManager."
        actions={
          <>
            <select value={mode} onChange={(event) => setMode(event.target.value as "fortnight" | "month")}>
              <option value="fortnight">Quinzenal</option>
              <option value="month">Mensal</option>
            </select>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value || monthKey(todayISO()))} />
            {mode === "fortnight" && (
              <select value={fortnight} onChange={(event) => setFortnight(event.target.value as "first" | "second")}>
                <option value="first">1a quinzena</option>
                <option value="second">2a quinzena</option>
              </select>
            )}
          </>
        }
      />
      <SummaryCards
        cards={[
          { label: "Receita total", value: currency(summary.totals.totalRevenue), tone: "red" },
          { label: "Receita parceria", value: currency(summary.totals.partnerRevenue) },
          { label: "Diferenca / Lucro bruto", value: currency(summary.totals.difference), tone: "dark" },
          { label: "Custos fixos", value: currency(costs.fixedCosts) },
          { label: "Custo LogManager", value: currency(costs.logManager) },
          { label: "Total de custos", value: currency(costs.total), tone: "dark" },
          { label: "Lucro real final", value: currency(realProfit), tone: "red" }
        ]}
      />
    </>
  );
};
