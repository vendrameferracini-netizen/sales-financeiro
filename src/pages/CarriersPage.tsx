import { Edit3, Plus, Save, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { ResponsiveTable } from "../components/ResponsiveTable";
import { SummaryCards } from "../components/SummaryCards";
import { useFinance } from "../contexts/FinanceContext";
import { Carrier } from "../types";
import { currency, parseMoney } from "../utils/format";

type CarrierForm = {
  id?: string;
  name: string;
  ml: string;
  shopee: string;
  avulso: string;
  active: boolean;
};

const blankForm: CarrierForm = {
  name: "",
  ml: "",
  shopee: "",
  avulso: "",
  active: true
};

const carrierToForm = (carrier: Carrier): CarrierForm => ({
  id: carrier.id,
  name: carrier.name,
  ml: String(carrier.rates.ml).replace(".", ","),
  shopee: String(carrier.rates.shopee).replace(".", ","),
  avulso: String(carrier.rates.avulso).replace(".", ","),
  active: carrier.active
});

export const CarriersPage = () => {
  const { carriers, addCarrier, updateCarrier } = useFinance();
  const [form, setForm] = useState<CarrierForm>(blankForm);

  useEffect(() => {
    if (!form.id) return;
    const current = carriers.find((carrier) => carrier.id === form.id);
    if (!current) setForm(blankForm);
  }, [carriers, form.id]);

  const editing = Boolean(form.id);

  const reset = () => setForm(blankForm);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) return;

    const carrierPayload = {
      name,
      rates: {
        ml: parseMoney(form.ml),
        shopee: parseMoney(form.shopee),
        avulso: parseMoney(form.avulso)
      },
      active: form.active
    };

    if (form.id) {
      updateCarrier({ id: form.id, ...carrierPayload });
    } else {
      addCarrier(carrierPayload);
    }
    reset();
  };

  return (
    <>
      <PageHeader title="Transportadoras" subtitle="Cadastre, edite valores e controle o status operacional." />

      <SummaryCards
        cards={[
          { label: "Transportadoras", value: String(carriers.length), tone: "dark" },
          { label: "Ativas", value: String(carriers.filter((carrier) => carrier.active).length), tone: "red" },
          { label: "Inativas", value: String(carriers.filter((carrier) => !carrier.active).length) }
        ]}
      />

      <section className="form-panel">
        <h2>{editing ? "Editar transportadora" : "Nova transportadora"}</h2>
        <form className="carrier-form" onSubmit={submit}>
          <label>
            Nome da transportadora
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Valor ML
            <input inputMode="decimal" value={form.ml} onChange={(event) => setForm((current) => ({ ...current, ml: event.target.value }))} />
          </label>
          <label>
            Valor Shopee
            <input inputMode="decimal" value={form.shopee} onChange={(event) => setForm((current) => ({ ...current, shopee: event.target.value }))} />
          </label>
          <label>
            Valor Avulso
            <input inputMode="decimal" value={form.avulso} onChange={(event) => setForm((current) => ({ ...current, avulso: event.target.value }))} />
          </label>
          <label className="toggle-label">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
            Ativa
          </label>
          <div className="form-actions">
            <button className="primary-button" type="submit">
              {editing ? <Save size={20} /> : <Plus size={20} />}
              {editing ? "Salvar" : "Cadastrar"}
            </button>
            {editing && (
              <button className="secondary-button" type="button" onClick={reset}>
                <X size={18} />
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <ResponsiveTable
        columns={["Transportadora", "ML", "Shopee", "Avulso", "Status", "Acao"]}
        rows={carriers.map((carrier) => [
          carrier.name,
          currency(carrier.rates.ml),
          currency(carrier.rates.shopee),
          currency(carrier.rates.avulso),
          carrier.active ? "Ativa" : "Inativa",
          <button className="secondary-button compact" onClick={() => setForm(carrierToForm(carrier))}>
            <Edit3 size={18} />
            Editar
          </button>
        ])}
      />
    </>
  );
};
