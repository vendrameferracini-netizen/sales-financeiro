import { Download, FileSpreadsheet } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { ResponsiveTable } from "../components/ResponsiveTable";
import { SummaryCards } from "../components/SummaryCards";
import { useFinance } from "../contexts/FinanceContext";
import { formatDate, getFortnightRange, getMonthRange, getWeekRange, monthKey, todayISO } from "../utils/dates";
import { buildDashboardReport } from "../utils/dashboardReport";
import { exportDashboardExcel, exportDashboardPdf } from "../utils/dashboardExport";
import { currency } from "../utils/format";

const quickRange = (type: "today" | "week" | "fortnight" | "month") => {
  const today = todayISO();
  if (type === "today") return { start: today, end: today };
  if (type === "week") return getWeekRange(today);
  if (type === "month") return getMonthRange(monthKey(today));

  const day = Number(today.slice(8, 10));
  return getFortnightRange(monthKey(today), day <= 15 ? "first" : "second");
};

const DashboardChannelChart = ({ report }: { report: ReturnType<typeof buildDashboardReport> }) => {
  const maxValue = Math.max(1, ...report.rows.flatMap((row) => [row.ml, row.shopee, row.avulso]));

  return (
    <section className="dashboard-chart-panel">
      <div>
        <span className="eyebrow">Grafico</span>
        <h2>Canais por dia</h2>
      </div>
      <div className="dashboard-bars" role="img" aria-label="Grafico de barras por canal">
        {report.rows.length ? (
          report.rows.map((row) => (
            <div className="dashboard-bar-group" key={row.date}>
              <div className="dashboard-bar-stack">
                <span className="bar-ml" title={`ML: ${row.ml}`} style={{ height: row.ml > 0 ? `${Math.max(3, (row.ml / maxValue) * 100)}%` : 0 }} />
                <span className="bar-shopee" title={`Shopee: ${row.shopee}`} style={{ height: row.shopee > 0 ? `${Math.max(3, (row.shopee / maxValue) * 100)}%` : 0 }} />
                <span className="bar-avulso" title={`Avulso: ${row.avulso}`} style={{ height: row.avulso > 0 ? `${Math.max(3, (row.avulso / maxValue) * 100)}%` : 0 }} />
              </div>
              <small>{formatDate(row.date).slice(0, 5)}</small>
            </div>
          ))
        ) : (
          <p className="empty-chart">Nenhum dado encontrado.</p>
        )}
      </div>
      <div className="dashboard-legend">
        <span>
          <i className="bar-ml" /> Mercado Livre
        </span>
        <span>
          <i className="bar-shopee" /> Shopee
        </span>
        <span>
          <i className="bar-avulso" /> Avulso
        </span>
      </div>
    </section>
  );
};

export const DashboardPage = () => {
  const { carriers, entries } = useFinance();
  const initialRange = quickRange("month");
  const [start, setStart] = useState(initialRange.start);
  const [end, setEnd] = useState(initialRange.end);

  const report = useMemo(() => buildDashboardReport(entries, carriers, start, end), [carriers, end, entries, start]);

  const applyQuickRange = (type: "today" | "week" | "fortnight" | "month") => {
    const range = quickRange(type);
    setStart(range.start);
    setEnd(range.end);
  };

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Periodo: ${report.periodLabel}`}
        actions={
          <>
            <input type="date" value={start} onChange={(event) => setStart(event.target.value || todayISO())} />
            <input type="date" value={end} onChange={(event) => setEnd(event.target.value || todayISO())} />
            <button className="secondary-button" type="button" onClick={() => applyQuickRange("today")}>
              Hoje
            </button>
            <button className="secondary-button" type="button" onClick={() => applyQuickRange("week")}>
              Semana
            </button>
            <button className="secondary-button" type="button" onClick={() => applyQuickRange("fortnight")}>
              Quinzena
            </button>
            <button className="secondary-button" type="button" onClick={() => applyQuickRange("month")}>
              Mes
            </button>
            <button className="secondary-button" type="button" onClick={() => exportDashboardPdf(report)}>
              <Download size={18} />
              Exportar PDF
            </button>
            <button className="secondary-button" type="button" onClick={() => exportDashboardExcel(report)}>
              <FileSpreadsheet size={18} />
              Exportar Excel
            </button>
          </>
        }
      />

      <SummaryCards
        cards={[
          { label: "Total Mercado Livre", value: String(report.totals.ml) },
          { label: "Total Shopee", value: String(report.totals.shopee) },
          { label: "Total Avulso", value: String(report.totals.avulso) },
          { label: "Total Geral de Pacotes", value: String(report.totals.totalPackages), tone: "dark" },
          { label: "Valor Total Recebido", value: currency(report.totals.totalValue), tone: "red" }
        ]}
      />

      <DashboardChannelChart report={report} />

      <ResponsiveTable
        columns={["Data", "Mercado Livre", "Shopee", "Avulso", "Total de Pacotes"]}
        rows={report.rows.map((row) => [formatDate(row.date), row.ml, row.shopee, row.avulso, row.totalPackages])}
        footer={["Totais", report.totals.ml, report.totals.shopee, report.totals.avulso, report.totals.totalPackages]}
      />
    </>
  );
};
