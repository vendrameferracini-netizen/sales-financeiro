import { Download, FileDown, FileSpreadsheet } from "lucide-react";
import { useMemo, useState } from "react";
import { ChannelChart, EvolutionChart } from "../components/Charts";
import { PageHeader } from "../components/PageHeader";
import { ResponsiveTable } from "../components/ResponsiveTable";
import { SummaryCards } from "../components/SummaryCards";
import { useFinance } from "../contexts/FinanceContext";
import { monthKey, getFortnightRange, getMonthRange, getWeekRange, monthLabel, todayISO } from "../utils/dates";
import { buildDailyEvolution, buildPeriodSummary } from "../utils/calculations";
import { currency } from "../utils/format";
import { exportGeneralExcel } from "../utils/excel";
import { exportCarrierPdfs, exportGeneralPdf } from "../utils/pdf";

const summaryRows = (summary: ReturnType<typeof buildPeriodSummary>) =>
  summary.rows
    .filter((row) => row.totalPackages > 0)
    .map((row) => [
      row.carrierName,
      row.ml,
      row.shopee,
      row.avulso,
      row.totalPackages,
      currency(row.totalRevenue),
      currency(row.partnerRevenue),
      currency(row.difference)
    ]);

const SummaryTable = ({ summary }: { summary: ReturnType<typeof buildPeriodSummary> }) => (
  <ResponsiveTable
    columns={["Transportadora", "ML", "Shopee", "Avulso", "Total", "Receita", "Parceria", "Diferenca"]}
    rows={summaryRows(summary)}
    footer={[
      "Totais",
      summary.totals.ml,
      summary.totals.shopee,
      summary.totals.avulso,
      summary.totals.totalPackages,
      currency(summary.totals.totalRevenue),
      currency(summary.totals.partnerRevenue),
      currency(summary.totals.difference)
    ]}
  />
);

const PdfActions = ({ summary, type }: { summary: ReturnType<typeof buildPeriodSummary>; type: string }) => (
  <>
    <button className="secondary-button" onClick={() => exportGeneralPdf(summary, type)}>
      <Download size={18} />
      Exportar PDF Geral
    </button>
    <button className="secondary-button" onClick={() => exportCarrierPdfs(summary, type)}>
      <FileDown size={18} />
      Exportar PDF por Transportadora
    </button>
    <button className="secondary-button" onClick={() => exportGeneralExcel(summary, type)}>
      <FileSpreadsheet size={18} />
      Exportar Excel
    </button>
  </>
);

export const WeeklyPage = () => {
  const { carriers, entries } = useFinance();
  const [date, setDate] = useState(todayISO());
  const range = useMemo(() => getWeekRange(date), [date]);
  const summary = useMemo(() => buildPeriodSummary(entries, carriers, range.start, range.end, range.label), [carriers, entries, range]);
  return (
    <>
      <PageHeader
        title="Resumo Semanal"
        subtitle={`Periodo da semana: ${range.label}`}
        actions={
          <>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value || todayISO())} />
            <PdfActions summary={summary} type="Semanal" />
          </>
        }
      />
      <SummaryCards
        cards={[
          { label: "Pacotes", value: String(summary.totals.totalPackages) },
          { label: "Receita total", value: currency(summary.totals.totalRevenue), tone: "red" },
          { label: "Receita parceria", value: currency(summary.totals.partnerRevenue) },
          { label: "Diferenca", value: currency(summary.totals.difference), tone: "dark" }
        ]}
      />
      <SummaryTable summary={summary} />
    </>
  );
};

export const FortnightlyPage = () => {
  const { carriers, entries } = useFinance();
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [fortnight, setFortnight] = useState<"first" | "second">("first");
  const range = useMemo(() => getFortnightRange(month, fortnight), [month, fortnight]);
  const summary = useMemo(() => buildPeriodSummary(entries, carriers, range.start, range.end, range.label), [carriers, entries, range]);
  return (
    <>
      <PageHeader
        title="Resumo Quinzenal"
        subtitle="Soma todos os pacotes lancados no periodo."
        actions={
          <>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value || monthKey(todayISO()))} />
            <select value={fortnight} onChange={(event) => setFortnight(event.target.value as "first" | "second")}>
              <option value="first">1a quinzena</option>
              <option value="second">2a quinzena</option>
            </select>
            <PdfActions summary={summary} type="Quinzenal" />
          </>
        }
      />
      <SummaryCards
        cards={[
          { label: "ML", value: String(summary.totals.ml) },
          { label: "Shopee", value: String(summary.totals.shopee) },
          { label: "Avulso", value: String(summary.totals.avulso) },
          { label: "Total geral", value: String(summary.totals.totalPackages), tone: "dark" },
          { label: "Receita total", value: currency(summary.totals.totalRevenue), tone: "red" },
          { label: "Receita parceria", value: currency(summary.totals.partnerRevenue) },
          { label: "Diferenca", value: currency(summary.totals.difference), tone: "dark" }
        ]}
      />
      <SummaryTable summary={summary} />
    </>
  );
};

export const MonthlyPage = () => {
  const { carriers, entries } = useFinance();
  const [month, setMonth] = useState(monthKey(todayISO()));
  const range = useMemo(() => getMonthRange(month), [month]);
  const summary = useMemo(() => buildPeriodSummary(entries, carriers, range.start, range.end, range.label), [carriers, entries, range]);
  const evolution = useMemo(() => buildDailyEvolution(entries, carriers, range.start, range.end), [carriers, entries, range]);
  return (
    <>
      <PageHeader
        title="Dashboard Mensal"
        subtitle={monthLabel(month)}
        actions={
          <>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value || monthKey(todayISO()))} />
            <PdfActions summary={summary} type="Mensal" />
          </>
        }
      />
      <SummaryCards
        cards={[
          { label: "Total de pacotes", value: String(summary.totals.totalPackages), tone: "dark" },
          { label: "Receita total", value: currency(summary.totals.totalRevenue), tone: "red" },
          { label: "Receita parceria", value: currency(summary.totals.partnerRevenue) },
          { label: "Diferenca total", value: currency(summary.totals.difference), tone: "dark" }
        ]}
      />
      <div className="chart-grid">
        <EvolutionChart data={evolution} />
        <ChannelChart summary={summary} />
      </div>
      <SummaryTable summary={summary} />
    </>
  );
};
