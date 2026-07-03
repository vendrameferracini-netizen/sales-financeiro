import { Plus, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { ResponsiveTable } from "../components/ResponsiveTable";
import { SummaryCards } from "../components/SummaryCards";
import { useFinance } from "../contexts/FinanceContext";
import { getCostSummary, buildPeriodSummary } from "../utils/calculations";
import { getFortnightRange, monthKey, todayISO } from "../utils/dates";
import { currency, parseMoney } from "../utils/format";

export const CostsPage = () => {
  const { carriers, entries, fixedCosts, addFixedCost, removeFixedCost } = useFinance();
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [fortnight, setFortnight] = useState<"first" | "second">("first");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");

  const range = useMemo(() => getFortnightRange(month, fortnight), [month, fortnight]);
  const summary = useMemo(() => buildPeriodSummary(entries, carriers, range.start, range.end, range.label), [carriers, entries, range]);
  const costs = useMemo(() => getCostSummary(fixedCosts, summary, month, fortnight), [fixedCosts, summary, month, fortnight]);
  const visibleCosts = fixedCosts.filter((cost) => cost.month === month && cost.fortnight === fortnight);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!description.trim()) return;
    addFixedCost({
      description: description.trim(),
      category: category.trim() || "Geral",
      amount: parseMoney(amount),
      month,
      fortnight
    });
    setDescription("");
    setCategory("");
    setAmount("");
  };

  return (
    <>
      <PageHeader
        title="Custos Fixos"
        subtitle="Custos manuais e LogManager por pacote."
        actions={
          <>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value || monthKey(todayISO()))} />
            <select value={fortnight} onChange={(event) => setFortnight(event.target.value as "first" | "second")}>
              <option value="first">1a quinzena</option>
              <option value="second">2a quinzena</option>
            </select>
          </>
        }
      />
      <SummaryCards
        cards={[
          { label: "Custos fixos", value: currency(costs.fixedCosts) },
          { label: "LogManager", value: currency(costs.logManager), tone: "red" },
          { label: "Custo total da quinzena", value: currency(costs.total), tone: "dark" }
        ]}
      />

      <section className="form-panel">
        <h2>Adicionar custo</h2>
        <form className="cost-form" onSubmit={submit}>
          <label>
            Descricao
            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Aluguel, combustivel" />
          </label>
          <label>
            Categoria
            <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Operacional" />
          </label>
          <label>
            Valor
            <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" />
          </label>
          <button className="primary-button" type="submit">
            <Plus size={20} />
            Adicionar
          </button>
        </form>
      </section>

      <ResponsiveTable
        columns={["Descricao", "Categoria", "Valor", "Quinzena", "Acao"]}
        rows={visibleCosts.map((cost) => [
          cost.description,
          cost.category,
          currency(cost.amount),
          cost.fortnight === "first" ? "1a" : "2a",
          <button className="icon-button danger" onClick={() => removeFixedCost(cost.id)} aria-label="Remover custo">
            <Trash2 size={18} />
          </button>
        ])}
      />
    </>
  );
};
