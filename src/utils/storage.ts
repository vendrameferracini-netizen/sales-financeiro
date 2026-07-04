import { defaultCarriers } from "../data/carriers";
import { APP_ID, COMPANY_ID } from "../data/app";
import { Carrier, DailyCarrierInput, DailyEntry, FixedCost } from "../types";
import { requireSupabase } from "./supabase";

type DbRow = Record<string, unknown>;

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

const text = (row: DbRow, keys: string[], fallback = "") => {
  const value = keys.map((key) => row[key]).find((item) => item !== undefined && item !== null && String(item).trim() !== "");
  return value === undefined || value === null ? fallback : String(value);
};

const num = (row: DbRow, keys: string[], fallback = 0) => {
  const value = keys.map((key) => row[key]).find((item) => item !== undefined && item !== null);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (row: DbRow, keys: string[], fallback = true) => {
  const value = keys.map((key) => row[key]).find((item) => item !== undefined && item !== null);
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return !["false", "0", "inativo", "inactive"].includes(value.toLowerCase());
  return fallback;
};

const salesCompany = { id: COMPANY_ID };

const companyMatches = (row: DbRow, company: DbRow) => {
  if (row.company_id !== undefined) return String(row.company_id) === String(company.id);
  if (row.id_da_empresa !== undefined) return String(row.id_da_empresa) === String(company.id);
  if (row.app_id !== undefined) return String(row.app_id) === APP_ID;
  return true;
};

const rowCompanyPayload = () => ({
  company_id: COMPANY_ID
});

const carrierToRow = (carrier: Carrier) => ({
  ...rowCompanyPayload(),
  id: carrier.id,
  name: carrier.name,
  ml: Number(carrier.rates.ml) || 0,
  shopee: Number(carrier.rates.shopee) || 0,
  avulso: Number(carrier.rates.avulso) || 0,
  active: carrier.active ?? true,
  updated_at: new Date().toISOString()
});

const rowToCarrier = (row: DbRow): Carrier => ({
  id: text(row, ["id"], makeId()),
  name: text(row, ["name", "nome", "carrier_name", "transportadora"], "Sem nome"),
  rates: {
    ml: num(row, ["ml", "valor_ml", "mercado_livre", "value_ml", "rate_ml"]),
    shopee: num(row, ["shopee", "valor_shopee", "value_shopee", "rate_shopee"]),
    avulso: num(row, ["avulso", "valor_avulso", "value_avulso", "rate_avulso"])
  },
  active: bool(row, ["active", "ativo", "status"], true)
});

const fixedCostToRow = (cost: FixedCost) => ({
  ...rowCompanyPayload(),
  id: cost.id,
  description: cost.description,
  category: cost.category,
  amount: Number(cost.amount) || 0,
  fortnight: cost.fortnight,
  month: cost.month,
  updated_at: new Date().toISOString()
});

const rowToFixedCost = (row: DbRow): FixedCost => ({
  id: text(row, ["id"], makeId()),
  description: text(row, ["description", "descricao", "name", "nome"], "Custo"),
  category: text(row, ["category", "categoria"], "Geral"),
  amount: num(row, ["amount", "valor", "value", "total"]),
  fortnight: text(row, ["fortnight", "quinzena"], "first") === "second" || text(row, ["fortnight", "quinzena"]) === "2" ? "second" : "first",
  month: text(row, ["month", "mes", "competencia"], new Date().toISOString().slice(0, 7))
});

const packageInputFromRow = (row: DbRow): DailyCarrierInput => ({
  ml: num(row, ["ml", "mercado_livre", "ml_count", "quantidade_ml"]),
  shopee: num(row, ["shopee", "shopee_count", "quantidade_shopee"]),
  avulso: num(row, ["avulso", "avulso_count", "quantidade_avulso"])
});

const packageRow = (dailyEntryId: string, carrierId: string, input: DailyCarrierInput) => ({
  ...rowCompanyPayload(),
  id: makeId(),
  daily_entry_id: dailyEntryId,
  carrier_id: carrierId,
  ml: Number(input.ml) || 0,
  shopee: Number(input.shopee) || 0,
  avulso: Number(input.avulso) || 0,
  updated_at: new Date().toISOString()
});

const seedMissingDefaultCarriers = async (company: DbRow, carriers: Carrier[]) => {
  const existingIds = new Set(carriers.map((carrier) => carrier.id));
  const missing = defaultCarriers.filter((carrier) => !existingIds.has(carrier.id));
  if (!missing.length) return;

  console.log("Salvando no Supabase", { table: "carriers", action: "seed", count: missing.length });
  const { error } = await requireSupabase().from("carriers").insert(missing.map((carrier) => carrierToRow(carrier)));
  if (error) logError("Erro ao criar transportadoras iniciais no Supabase", error);
};

const loadCarriers = async (company: DbRow) => {
  const { data, error } = await requireSupabase().from("carriers").select("*");
  if (error) logError("Erro ao carregar transportadoras do Supabase", error);
  const rows = ((data || []) as DbRow[]).filter((row) => companyMatches(row, company));
  const carriers = sortCarriersByName(rows.map(rowToCarrier));
  await seedMissingDefaultCarriers(company, carriers);
  if (carriers.length >= defaultCarriers.length) return carriers;

  const refreshed = await requireSupabase().from("carriers").select("*");
  if (refreshed.error) logError("Erro ao recarregar transportadoras do Supabase", refreshed.error);
  return sortCarriersByName(((refreshed.data || []) as DbRow[]).filter((row) => companyMatches(row, company)).map(rowToCarrier));
};

const loadEntries = async (company: DbRow) => {
  const [dailyResult, packageResult] = await Promise.all([
    requireSupabase().from("daily_entries").select("*"),
    requireSupabase().from("package_entries").select("*")
  ]);

  if (dailyResult.error) logError("Erro ao carregar lancamentos diarios do Supabase", dailyResult.error);
  if (packageResult.error) logError("Erro ao carregar pacotes diarios do Supabase", packageResult.error);

  const dailyRows = ((dailyResult.data || []) as DbRow[]).filter((row) => companyMatches(row, company));
  const packageRows = ((packageResult.data || []) as DbRow[]).filter((row) => companyMatches(row, company));

  return Object.fromEntries(
    dailyRows.map((dailyRow) => {
      const dailyId = text(dailyRow, ["id"]);
      const date = text(dailyRow, ["date", "data", "entry_date"]);
      const legacyCarriers = (dailyRow.carriers || {}) as Record<string, DailyCarrierInput>;
      const packages = packageRows.filter((row) => text(row, ["daily_entry_id", "entry_id", "daily_id"]) === dailyId);
      const carriers = packages.reduce<Record<string, DailyCarrierInput>>((acc, row) => {
        const carrierId = text(row, ["carrier_id", "transportadora_id"]);
        if (carrierId) acc[carrierId] = packageInputFromRow(row);
        return acc;
      }, legacyCarriers);

      return [date, { date, carriers } satisfies DailyEntry];
    })
  );
};

const loadFixedCosts = async (company: DbRow) => {
  const [fixedResult, costsResult] = await Promise.all([
    requireSupabase().from("fixed_costs").select("*"),
    requireSupabase().from("costs").select("*")
  ]);

  if (fixedResult.error) logError("Erro ao carregar custos fixos do Supabase", fixedResult.error);
  if (costsResult.error) logError("Erro ao carregar custos do Supabase", costsResult.error);

  const rows = [...((fixedResult.data || []) as DbRow[]), ...((costsResult.data || []) as DbRow[])];
  const seen = new Set<string>();
  return rows
    .filter((row) => companyMatches(row, company))
    .map(rowToFixedCost)
    .filter((cost) => {
      if (seen.has(cost.id)) return false;
      seen.add(cost.id);
      return true;
    });
};

export const loadFinanceData = async (): Promise<FinanceSnapshot> => {
  try {
    const company = salesCompany;
    const [carriers, entries, fixedCosts] = await Promise.all([loadCarriers(company), loadEntries(company), loadFixedCosts(company)]);

    console.log("Dados carregados do Supabase", {
      schema: "companies/carriers/daily_entries/package_entries/fixed_costs/costs",
      company_id: COMPANY_ID,
      carriers: carriers.length,
      entries: Object.keys(entries).length,
      fixedCosts: fixedCosts.length
    });

    return { carriers, entries, fixedCosts };
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

  console.log("Salvando no Supabase", { table: "carriers", id: completeCarrier.id });
  const { error } = await requireSupabase().from("carriers").upsert(carrierToRow(completeCarrier));
  if (error) logError("Erro ao salvar transportadora no Supabase", error);
  return completeCarrier;
};

export const saveDailyEntry = async (entry: DailyEntry) => {
  const company = salesCompany;
  const dailyPayload = {
    ...rowCompanyPayload(),
    date: entry.date,
    updated_at: new Date().toISOString()
  };

  console.log("Salvando no Supabase", { table: "daily_entries", date: entry.date });
  const existingResult = await requireSupabase().from("daily_entries").select("*");
  if (existingResult.error) logError("Erro ao verificar lancamento diario no Supabase", existingResult.error);
  const existing = ((existingResult.data || []) as DbRow[]).find((row) => companyMatches(row, company) && text(row, ["date", "data", "entry_date"]) === entry.date);

  const dailyResult = existing?.id
    ? await requireSupabase().from("daily_entries").update(dailyPayload).eq("id", text(existing, ["id"])).select("*").maybeSingle()
    : await requireSupabase().from("daily_entries").insert({ id: makeId(), ...dailyPayload }).select("*").maybeSingle();

  if (dailyResult.error) logError("Erro ao salvar lancamento diario no Supabase", dailyResult.error);
  const dailyId = text((dailyResult.data || existing || {}) as DbRow, ["id"]);
  if (!dailyId) throw new Error("Nao foi possivel identificar o lancamento diario salvo.");

  const deleteResult = await requireSupabase().from("package_entries").delete().eq("daily_entry_id", dailyId);
  if (deleteResult.error) logError("Erro ao limpar pacotes antigos no Supabase", deleteResult.error);

  const rows = Object.entries(entry.carriers || {})
    .filter(([, input]) => (Number(input.ml) || 0) + (Number(input.shopee) || 0) + (Number(input.avulso) || 0) > 0)
    .map(([carrierId, input]) => packageRow(dailyId, carrierId, input));

  if (!rows.length) return;
  const insertResult = await requireSupabase().from("package_entries").insert(rows);
  if (insertResult.error) logError("Erro ao salvar pacotes diarios no Supabase", insertResult.error);
};

export const saveFixedCost = async (cost: Omit<FixedCost, "id"> | FixedCost) => {
  const completeCost: FixedCost = {
    ...cost,
    id: "id" in cost && cost.id ? cost.id : makeId()
  };

  console.log("Salvando no Supabase", { table: "fixed_costs", id: completeCost.id });
  const { error } = await requireSupabase().from("fixed_costs").upsert(fixedCostToRow(completeCost));
  if (error) logError("Erro ao salvar custo fixo no Supabase", error);
  return completeCost;
};

export const deleteFixedCost = async (id: string) => {
  console.log("Salvando no Supabase", { table: "fixed_costs", action: "delete", id });
  const { error } = await requireSupabase().from("fixed_costs").delete().eq("id", id);
  if (error) logError("Erro ao remover custo fixo no Supabase", error);
};
