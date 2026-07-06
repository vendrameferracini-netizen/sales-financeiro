import { Download, FileDown, FileSpreadsheet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ChannelChart, EvolutionChart } from "../components/Charts";
import { PageHeader } from "../components/PageHeader";
import { ResponsiveTable } from "../components/ResponsiveTable";
import { SummaryCards } from "../components/SummaryCards";
import { useFinance } from "../contexts/FinanceContext";
import { monthKey, getFortnightRange, getMonthRange, getWeekRange, monthLabel, todayISO } from "../utils/dates";
import { buildDailyEvolution, buildDailyFullValueReport, buildPeriodSummary } from "../utils/calculations";
import { currency } from "../utils/format";
import { buildCarrierTransportReport, CarrierReportFormat, CarrierReportType } from "../utils/carrierReport";
import { exportGeneralExcel, exportSelectedCarrierExcel } from "../utils/excel";
import { exportGeneralPdf, exportSelectedCarrierPdf } from "../utils/pdf";

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
    <button className="secondary-button" onClick={() => exportGeneralExcel(summary, type)}>
      <FileSpreadsheet size={18} />
      Exportar Excel
    </button>
  </>
);

const CarrierExportPanel = ({
  entries,
  carriers,
  range
}: {
  entries: ReturnType<typeof useFinance>["entries"];
  carriers: ReturnType<typeof useFinance>["carriers"];
  range: { start: string; end: string; label: string };
}) => {
  const [periodMode, setPeriodMode] = useState<"current" | "custom">("current");
  const [start, setStart] = useState(range.start);
  const [end, setEnd] = useState(range.end);
  const [carrierId, setCarrierId] = useState("");
  const [reportType, setReportType] = useState<CarrierReportType>("summary");
  const [format, setFormat] = useState<CarrierReportFormat>("pdf");

  useEffect(() => {
    if (periodMode === "current") {
      setStart(range.start);
      setEnd(range.end);
    }
  }, [periodMode, range.end, range.start]);

  const exportReport = () => {
    if (!carrierId) {
      alert("Selecione uma transportadora para exportar.");
      return;
    }
    if (start > end) {
      alert("A data inicial nao pode ser maior que a data final.");
      return;
    }

    const carrier = carriers.find((item) => item.id === carrierId);
    if (!carrier) {
      alert("Transportadora nao encontrada.");
      return;
    }

    const report = buildCarrierTransportReport(entries, carrier, start, end);
    if (report.totals.totalPackages <= 0) {
      alert("Nenhum lancamento encontrado para esta transportadora no periodo.");
      return;
    }

    if (format === "pdf") exportSelectedCarrierPdf(report, reportType);
    else exportSelectedCarrierExcel(report, reportType);
  };

  return (
    <section className="carrier-export-panel">
      <div>
        <span className="eyebrow">Fechamento por transportadora</span>
        <h2>Exportacao para envio</h2>
      </div>
      <div className="carrier-export-grid">
        <label>
          Periodo
          <select value={periodMode} onChange={(event) => setPeriodMode(event.target.value as "current" | "custom")}>
            <option value="current">Periodo atual da aba</option>
            <option value="custom">Personalizado</option>
          </select>
        </label>
        <label>
          Data inicial
          <input
            type="date"
            value={start}
            onChange={(event) => {
              setPeriodMode("custom");
              setStart(event.target.value || range.start);
            }}
          />
        </label>
        <label>
          Data final
          <input
            type="date"
            value={end}
            onChange={(event) => {
              setPeriodMode("custom");
              setEnd(event.target.value || range.end);
            }}
          />
        </label>
        <label>
          Transportadora
          <select value={carrierId} onChange={(event) => setCarrierId(event.target.value)}>
            <option value="">Selecione</option>
            {carriers.map((carrier) => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo de relatorio
          <select value={reportType} onChange={(event) => setReportType(event.target.value as CarrierReportType)}>
            <option value="summary">Resumido</option>
            <option value="daily">Detalhado por dia</option>
          </select>
        </label>
        <label>
          Formato
          <select value={format} onChange={(event) => setFormat(event.target.value as CarrierReportFormat)}>
            <option value="pdf">PDF</option>
            <option value="excel">Excel</option>
          </select>
        </label>
      </div>
      <button className="primary-button carrier-export-button" type="button" onClick={exportReport}>
        <FileDown size={18} />
        Exportar transportadora
      </button>
    </section>
  );
};

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
      <CarrierExportPanel entries={entries} carriers={carriers} range={range} />
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
      <CarrierExportPanel entries={entries} carriers={carriers} range={range} />
      <SummaryTable summary={summary} />
    </>
  );
};

export const MonthlyPage = () => {
  const { carriers, entries } = useFinance();
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [dashboardDate, setDashboardDate] = useState(todayISO());
  const range = useMemo(() => getMonthRange(month), [month]);
  const summary = useMemo(() => buildPeriodSummary(entries, carriers, range.start, range.end, range.label), [carriers, entries, range]);
  const evolution = useMemo(() => buildDailyEvolution(entries, carriers, range.start, range.end), [carriers, entries, range]);
  const dailyReport = useMemo(() => buildDailyFullValueReport(entries[dashboardDate]?.carriers || {}, carriers), [carriers, dashboardDate, entries]);
  return (
    <>
      <PageHeader
        title="Dashboard Mensal"
        subtitle={`${monthLabel(month)} | Dia ${dashboardDate.split("-").reverse().join("/")}`}
        actions={
          <>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value || monthKey(todayISO()))} />
            <input
              type="date"
              value={dashboardDate}
              onChange={(event) => {
                const nextDate = event.target.value || todayISO();
                setDashboardDate(nextDate);
                setMonth(monthKey(nextDate));
              }}
            />
            <PdfActions summary={summary} type="Mensal" />
          </>
        }
      />
      <SummaryCards
        cards={[
          { label: "ML do dia", value: String(dailyReport.totals.ml) },
          { label: "Shopee do dia", value: String(dailyReport.totals.shopee) },
          { label: "Avulso do dia", value: String(dailyReport.totals.avulso) },
          { label: "Pacotes do dia", value: String(dailyReport.totals.totalPackages), tone: "dark" },
          { label: "Valor ML do dia", value: currency(dailyReport.totals.valueMl) },
          { label: "Valor Shopee do dia", value: currency(dailyReport.totals.valueShopee) },
          { label: "Valor Avulso do dia", value: currency(dailyReport.totals.valueAvulso) },
          { label: "Valor total do dia", value: currency(dailyReport.totals.totalValue), tone: "red" }
        ]}
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
      <CarrierExportPanel entries={entries} carriers={carriers} range={range} />
      <SummaryTable summary={summary} />
    </>
  );
};
