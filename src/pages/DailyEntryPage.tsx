import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { ResponsiveTable } from "../components/ResponsiveTable";
import { SummaryCards } from "../components/SummaryCards";
import { useFinance } from "../contexts/FinanceContext";
import { Carrier, DailyCarrierInput } from "../types";
import { addDays, formatDate, todayISO } from "../utils/dates";
import { blankCarrierInput, buildDailyFullValueReport, getCarrierDailyValue, getPackageTotal, normalizeCarrierInput } from "../utils/calculations";
import { currency } from "../utils/format";

const buildBlankDraft = (carriers: Carrier[]) =>
  carriers.reduce<Record<string, DailyCarrierInput>>((acc, carrier) => {
    acc[carrier.id] = blankCarrierInput();
    return acc;
  }, {});

export const DailyEntryPage = () => {
  const { carriers, getEntry, saveEntry } = useFinance();
  const activeCarriers = useMemo(() => carriers.filter((carrier) => carrier.active), [carriers]);
  const [date, setDate] = useState(todayISO());
  const [draft, setDraft] = useState<Record<string, DailyCarrierInput>>(() => buildBlankDraft(activeCarriers));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const entry = getEntry(date);
    const next = buildBlankDraft(activeCarriers);
    activeCarriers.forEach((carrier) => {
      next[carrier.id] = normalizeCarrierInput(entry?.carriers?.[carrier.id]);
    });
    setDraft(next);
    setSaved(false);
  }, [activeCarriers, date, getEntry]);

  const dailyReport = useMemo(() => {
    const savedInputs = getEntry(date)?.carriers || {};
    return buildDailyFullValueReport({ ...savedInputs, ...draft }, carriers);
  }, [carriers, date, draft, getEntry]);

  const updateField = (carrierId: string, field: keyof DailyCarrierInput, value: string) => {
    const parsed = Math.max(0, Number.parseInt(value || "0", 10) || 0);
    setDraft((current) => ({
      ...current,
      [carrierId]: {
        ...blankCarrierInput(),
        ...current[carrierId],
        [field]: parsed
      }
    }));
    setSaved(false);
  };

  return (
    <>
      <PageHeader
        title="Lancamento Diario"
        subtitle="Controle pacotes por data, transportadora e canal."
        actions={
          <div className="date-toolbar">
            <button className="icon-button" onClick={() => setDate(addDays(date, -1))} aria-label="Dia anterior">
              <ChevronLeft size={20} />
            </button>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value || todayISO())} />
            <button className="icon-button" onClick={() => setDate(addDays(date, 1))} aria-label="Proximo dia">
              <ChevronRight size={20} />
            </button>
          </div>
        }
      />

      <SummaryCards
        cards={[
          { label: "Data", value: formatDate(date) },
          { label: "ML do dia", value: String(dailyReport.totals.ml) },
          { label: "Shopee do dia", value: String(dailyReport.totals.shopee) },
          { label: "Avulso do dia", value: String(dailyReport.totals.avulso) },
          { label: "Total de pacotes", value: String(dailyReport.totals.totalPackages), tone: "dark" },
          { label: "Valor ML", value: currency(dailyReport.totals.valueMl) },
          { label: "Valor Shopee", value: currency(dailyReport.totals.valueShopee) },
          { label: "Valor Avulso", value: currency(dailyReport.totals.valueAvulso) },
          { label: "Valor total", value: currency(dailyReport.totals.totalValue), tone: "red" }
        ]}
      />

      <ResponsiveTable
        columns={["Transportadora", "ML", "Shopee", "Avulso", "Total de pacotes", "Valor total"]}
        rows={dailyReport.rows.map((row) => [row.carrierName, row.ml, row.shopee, row.avulso, row.totalPackages, currency(row.totalValue)])}
        footer={[
          "Totais",
          dailyReport.totals.ml,
          dailyReport.totals.shopee,
          dailyReport.totals.avulso,
          dailyReport.totals.totalPackages,
          currency(dailyReport.totals.totalValue)
        ]}
      />

      <section className="daily-grid">
        {activeCarriers.map((carrier) => {
          const input = normalizeCarrierInput(draft[carrier.id]);
          const total = getPackageTotal(input);
          const value = getCarrierDailyValue(carriers, carrier.id, input);
          return (
            <article className={`daily-card ${total > 0 ? "filled" : ""}`} key={carrier.id}>
              <div className="daily-title">
                <div>
                  <h2>{carrier.name}</h2>
                  <span>{total > 0 ? "Preenchido" : "Vazio"}</span>
                </div>
                <strong>{currency(value)}</strong>
              </div>
              <div className="input-grid">
                <label>
                  ML
                  <input type="number" min="0" inputMode="numeric" value={input.ml || ""} onChange={(event) => updateField(carrier.id, "ml", event.target.value)} />
                </label>
                <label>
                  Shopee
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={input.shopee || ""}
                    onChange={(event) => updateField(carrier.id, "shopee", event.target.value)}
                  />
                </label>
                <label>
                  Avulso
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={input.avulso || ""}
                    onChange={(event) => updateField(carrier.id, "avulso", event.target.value)}
                  />
                </label>
              </div>
              <div className="daily-footer">
                <span>Total</span>
                <strong>{total} pacotes</strong>
              </div>
            </article>
          );
        })}
      </section>

      <div className="save-bar">
        <button
          className="primary-button"
          onClick={() => {
            saveEntry(date, draft);
            setSaved(true);
          }}
        >
          <Save size={20} />
          Salvar Dados
        </button>
        {saved && <span>Dados salvos para {formatDate(date)}.</span>}
      </div>
    </>
  );
};
