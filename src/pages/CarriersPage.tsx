import { Edit3, Plus, Save, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
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
  const { carriers, addCarrier, updateCarrier, removeCarrier } = useFinance();
  const [form, setForm] = useState<CarrierForm>(blankForm);
  const [message, setMessage] = useState("");
  const formPanelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!form.id) return;
    const current = carriers.find((carrier) => carrier.id === form.id);
    if (!current) setForm(blankForm);
  }, [carriers, form.id]);

  const editing = Boolean(form.id);

  const reset = () => setForm(blankForm);

  const handleEdit = (carrier: Carrier) => {
    setForm(carrierToForm(carrier));
    setMessage("");
    requestAnimationFrame(() => formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const handleDelete = async (carrier: Carrier) => {
    if (!window.confirm("Tem certeza que deseja excluir esta transportadora?")) return;
    setMessage("");
    try {
      await removeCarrier(carrier.id);
      if (form.id === carrier.id) reset();
      setMessage("Transportadora excluida com sucesso.");
    } catch (error) {
      console.error({ table: "carriers", operation: "delete", payload: { id: carrier.id }, error });
      setMessage("Erro ao excluir transportadora. Veja a mensagem Supabase no topo da tela.");
    }
  };

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
      setMessage("Transportadora atualizada com sucesso.");
    } else {
      addCarrier(carrierPayload);
      setMessage("Transportadora cadastrada com sucesso.");
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

      <section className="form-panel" ref={formPanelRef}>
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
              <button className="secondary-button" type="button" onClick={() => {
                reset();
                setMessage("");
              }}>
                <X size={18} />
                Cancelar
              </button>
            )}
          </div>
        </form>
        {message && (
          <p className="feedback-message" role="status" aria-live="polite">
            {message}
          </p>
        )}
      </section>

      <ResponsiveTable
        columns={["Transportadora", "ML", "Shopee", "Avulso", "Status", "Acao"]}
        rows={carriers.map((carrier) => [
          carrier.name,
          currency(carrier.rates.ml),
          currency(carrier.rates.shopee),
          currency(carrier.rates.avulso),
          carrier.active ? "Ativa" : "Inativa",
          <div className="table-actions">
            <button className="secondary-button compact" type="button" onClick={() => handleEdit(carrier)}>
              <Edit3 size={18} />
              Editar
            </button>
            <button className="secondary-button compact danger" type="button" onClick={() => handleDelete(carrier)}>
              <Trash2 size={18} />
              Excluir
            </button>
          </div>
        ])}
      />
    </>
  );
};
