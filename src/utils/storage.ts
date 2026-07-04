import { defaultCarriers } from "../data/carriers";
import { APP_ID } from "../data/app";
import { Carrier, DailyEntry, FixedCost } from "../types";
import { requireSupabase } from "./supabase";

type FinanceSnapshot = {
  carriers: Carrier[];
  entries: Record<string, DailyEntry>;
  fixedCosts: FixedCost[];
};

export const sortCarriersByName = (carriers: Carrier[] = []) =>
  [...(carriers || [])].sort((first, second) => first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" }));

const makeId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const logError = (message: string, error: unknown) => {
  console.error(message, error);
  throw error;
};

const carrierRow = (carrier: Carrier) => ({
  app_id: APP_ID,
  id: carrier.id,
  name: carrier.name,
  ml: Number(carrier.rates.ml) || 0,
  shopee: Number(carrier.rates.shopee) || 0,
  avulso: Number(carrier.rates.avulso) || 0,
  active: carrier.active ?? true,
  updated_at: new Date().toISOString()
});

const entryRow = (entry: DailyEntry) => ({
  app_id: APP_ID,
  date: entry.date,
  carriers: entry.carriers || {},
  updated_at: new Date().toISOString()
});

const fixedCostRow = (cost: FixedCost) => ({
  app_id: APP_ID,
  id: cost.id,
  description: cost.description,
  category: cost.category,
  amount: Number(cost.amount) || 0,
  fortnight: cost.fortnight,
  month: cost.month,
  updated_at: new Date().toISOString()
});

const upsertCarrierOnline = async (carrier: Carrier) => {
  console.log("Salvando no Supabase", { table: "carriers", app_id: APP_ID, id: carrier.id });
  const { error } = await requireSupabase().from("carriers").upsert(carrierRow(carrier), { onConflict: "app_id,id" });
  if (error) logError("Erro ao salvar transportadora no Supabase", error);
};

const upsertEntryOnline = async (entry: DailyEntry) => {
  console.log("Salvando no Supabase", { table: "daily_entries", app_id: APP_ID, date: entry.date });
  const { error } = await requireSupabase().from("daily_entries").upsert(entryRow(entry), { onConflict: "app_id,date" });
  if (error) logError("Erro ao salvar lancamento diario no Supabase", error);
};

const upsertFixedCostOnline = async (cost: FixedCost) => {
  console.log("Salvando no Supabase", { table: "fixed_costs", app_id: APP_ID, id: cost.id });
  const { error } = await requireSupabase().from("fixed_costs").upsert(fixedCostRow(cost), { onConflict: "app_id,id" });
  if (error) logError("Erro ao salvar custo fixo no Supabase", error);
};

export const deleteFixedCost = async (id: string) => {
  console.log("Salvando no Supabase", { table: "fixed_costs", action: "delete", app_id: APP_ID, id });
  const { error } = await requireSupabase().from("fixed_costs").delete().eq("app_id", APP_ID).eq("id", id);
  if (error) logError("Erro ao remover custo fixo no Supabase", error);
};

const seedMissingDefaultCarriers = async () => {
  const { data, error } = await requireSupabase().from("carriers").select("id").eq("app_id", APP_ID);
  if (error) logError("Erro ao verificar transportadoras no Supabase", error);
  const existingIds = new Set((data || []).map((row) => row.id));
  const missingCarriers = defaultCarriers.filter((carrier) => !existingIds.has(carrier.id));
  if (!missingCarriers.length) return;
  await Promise.all(missingCarriers.map(upsertCarrierOnline));
};

export const loadFinanceData = async (): Promise<FinanceSnapshot> => {
  try {
    await seedMissingDefaultCarriers();

    const [carriersResult, entriesResult, costsResult] = await Promise.all([
      requireSupabase().from("carriers").select("*").eq("app_id", APP_ID).order("name", { ascending: true }),
      requireSupabase().from("daily_entries").select("*").eq("app_id", APP_ID),
      requireSupabase().from("fixed_costs").select("*").eq("app_id", APP_ID).order("month", { ascending: true })
    ]);

    if (carriersResult.error) logError("Erro ao carregar transportadoras do Supabase", carriersResult.error);
    if (entriesResult.error) logError("Erro ao carregar lancamentos do Supabase", entriesResult.error);
    if (costsResult.error) logError("Erro ao carregar custos do Supabase", costsResult.error);

    const snapshot: FinanceSnapshot = {
      carriers: sortCarriersByName(
        (carriersResult.data || []).map((row) => ({
          id: row.id,
          name: row.name,
          rates: {
            ml: Number(row.ml) || 0,
            shopee: Number(row.shopee) || 0,
            avulso: Number(row.avulso) || 0
          },
          active: row.active ?? true
        }))
      ),
      entries: Object.fromEntries(
        (entriesResult.data || []).map((row) => [
          row.date,
          {
            date: row.date,
            carriers: row.carriers || {}
          }
        ])
      ),
      fixedCosts: (costsResult.data || []).map((row) => ({
        id: row.id,
        description: row.description,
        category: row.category,
        amount: Number(row.amount) || 0,
        fortnight: row.fortnight,
        month: row.month
      }))
    };

    console.log("Dados carregados do Supabase", {
      app_id: APP_ID,
      carriers: snapshot.carriers.length,
      entries: Object.keys(snapshot.entries).length,
      fixedCosts: snapshot.fixedCosts.length
    });

    return snapshot;
  } catch (error) {
    console.error("Erro completo ao carregar dados do Supabase", error);
    throw error;
  }
};

export const saveCarrier = async (carrier: Omit<Carrier, "id"> | Carrier) => {
  const completeCarrier: Carrier = {
    ...carrier,
    id: "id" in carrier && carrier.id ? carrier.id : makeId()
  };
  await upsertCarrierOnline(completeCarrier);
  return completeCarrier;
};

export const saveDailyEntry = async (entry: DailyEntry) => {
  await upsertEntryOnline(entry);
};

export const saveFixedCost = async (cost: Omit<FixedCost, "id"> | FixedCost) => {
  const completeCost: FixedCost = {
    ...cost,
    id: "id" in cost && cost.id ? cost.id : makeId()
  };
  await upsertFixedCostOnline(completeCost);
  return completeCost;
};
