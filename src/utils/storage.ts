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

type SupabaseResult<T> = {
  data: T | null;
  error: unknown;
};

const errorDetails = (error: unknown) => error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };

const getSupabaseErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) return String((error as { message?: unknown }).message);
  return fallback;
};

class SupabaseOperationError extends Error {
  constructor(
    public table: string,
    public operation: string,
    public payload: unknown,
    public details: unknown
  ) {
    super(getSupabaseErrorMessage(errorDetails(details), `Erro Supabase em ${table}.${operation}`));
  }
}

export const sortCarriersByName = (carriers: Carrier[] = []) =>
  [...(carriers || [])].sort((first, second) => first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" }));

const makeId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const logSupabaseError = (table: string, operation: string, payload: unknown, error: unknown) => {
  console.error({ table, operation, payload, error });
};

const runSupabase = async <T,>(
  table: string,
  operation: string,
  payload: unknown,
  request: () => Promise<SupabaseResult<T>>,
  options: { throwOnError?: boolean } = {}
) => {
  try {
    const result = await request();
    if (result.error) {
      logSupabaseError(table, operation, payload, result.error);
      if (options.throwOnError) throw new SupabaseOperationError(table, operation, payload, result.error);
    }
    return result;
  } catch (error) {
    logSupabaseError(table, operation, payload, error);
    if (options.throwOnError) throw new SupabaseOperationError(table, operation, payload, error);
    return { data: null, error } as SupabaseResult<T>;
  }
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
const normalizeName = (name: string) => name.trim().toLowerCase();
const defaultCarrierByName = new Map(defaultCarriers.map((carrier) => [normalizeName(carrier.name), carrier]));

const companyMatches = (row: DbRow, company: DbRow) => {
  if (row.company_id !== undefined) return String(row.company_id) === String(company.id);
  if (row.id_da_empresa !== undefined) return String(row.id_da_empresa) === String(company.id);
  if (row.app_id !== undefined) return String(row.app_id) === APP_ID;
  return true;
};

const rowCompanyPayload = () => ({
  company_id: COMPANY_ID
});

const carrierToFullRow = (carrier: Carrier) => ({
  ...rowCompanyPayload(),
  id: carrier.id,
  name: carrier.name,
  ml: Number(carrier.rates.ml) || 0,
  shopee: Number(carrier.rates.shopee) || 0,
  avulso: Number(carrier.rates.avulso) || 0,
  active: carrier.active ?? true,
  updated_at: new Date().toISOString()
});

const carrierToMinimalRow = (carrier: Carrier) => ({
  company_id: COMPANY_ID,
  name: carrier.name
});

const carrierToUuidSeedRow = (carrier: Carrier) => ({
  ...carrierToMinimalRow(carrier),
  id: makeId()
});

const rowToCarrier = (row: DbRow): Carrier => {
  const name = text(row, ["name", "nome", "carrier_name"], "Sem nome");
  const defaults = defaultCarrierByName.get(normalizeName(name));
  return {
    id: text(row, ["id", "carrier_id"], defaults?.id || makeId()),
    name,
    rates: {
      ml: num(row, ["ml", "valor_ml", "mercado_livre", "value_ml", "rate_ml", "ml_rate", "price_ml"], defaults?.rates.ml || 0),
      shopee: num(row, ["shopee", "valor_shopee", "value_shopee", "rate_shopee", "shopee_rate", "price_shopee"], defaults?.rates.shopee || 0),
      avulso: num(row, ["avulso", "valor_avulso", "value_avulso", "rate_avulso", "avulso_rate", "price_avulso"], defaults?.rates.avulso || 0)
    },
    active: bool(row, ["active", "ativo", "status"], true)
  };
};

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
  const existingNames = new Set(carriers.map((carrier) => normalizeName(carrier.name)));
  const missing = defaultCarriers.filter((carrier) => !existingIds.has(carrier.id) && !existingNames.has(normalizeName(carrier.name)));
  if (!missing.length) return;

  console.log("Salvando no Supabase", { table: "carriers", action: "seed", count: missing.length });
  const minimalPayload = missing.map(carrierToMinimalRow);
  const minimalResult = await runSupabase("carriers", "seed_minimal", minimalPayload, () => requireSupabase().from("carriers").insert(minimalPayload));
  if (!minimalResult.error) return;

  const uuidPayload = missing.map(carrierToUuidSeedRow);
  const uuidResult = await runSupabase("carriers", "seed_uuid_minimal", uuidPayload, () => requireSupabase().from("carriers").insert(uuidPayload));
  if (!uuidResult.error) return;

  const fullPayload = missing.map(carrierToFullRow);
  await runSupabase("carriers", "seed_full", fullPayload, () => requireSupabase().from("carriers").insert(fullPayload));
};

const loadCarriers = async (company: DbRow) => {
  const { data } = await runSupabase<DbRow[]>("carriers", "select", { company_id: COMPANY_ID }, () => requireSupabase().from("carriers").select("*"));
  if ((data || [])[0]) console.log("Dados carregados do Supabase", { table: "carriers", operation: "schema_detected", columns: Object.keys((data || [])[0] as DbRow) });
  const rows = ((data || []) as DbRow[]).filter((row) => companyMatches(row, company));
  const carriers = sortCarriersByName(rows.map(rowToCarrier));
  await seedMissingDefaultCarriers(company, carriers);
  if (carriers.length >= defaultCarriers.length) return carriers;

  const refreshed = await runSupabase<DbRow[]>("carriers", "select_after_seed", { company_id: COMPANY_ID }, () => requireSupabase().from("carriers").select("*"));
  if (refreshed.error) return carriers.length ? carriers : sortCarriersByName(defaultCarriers);
  const refreshedCarriers = sortCarriersByName(((refreshed.data || []) as DbRow[]).filter((row) => companyMatches(row, company)).map(rowToCarrier));
  return refreshedCarriers.length ? refreshedCarriers : sortCarriersByName(defaultCarriers);
};

const loadEntries = async (company: DbRow) => {
  const [dailyResult, packageResult] = await Promise.all([
    runSupabase<DbRow[]>("daily_entries", "select", { company_id: COMPANY_ID }, () => requireSupabase().from("daily_entries").select("*")),
    runSupabase<DbRow[]>("package_entries", "select", { company_id: COMPANY_ID }, () => requireSupabase().from("package_entries").select("*"))
  ]);

  if (dailyResult.error || packageResult.error) return {};

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
    runSupabase<DbRow[]>("fixed_costs", "select", { company_id: COMPANY_ID }, () => requireSupabase().from("fixed_costs").select("*")),
    runSupabase<DbRow[]>("costs", "select", { company_id: COMPANY_ID }, () => requireSupabase().from("costs").select("*"))
  ]);

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

const auditSupportingTables = async () => {
  await Promise.all([
    runSupabase<DbRow[]>("companies", "select_audit", { company_id: COMPANY_ID }, () => requireSupabase().from("companies").select("*")),
    runSupabase<DbRow[]>("profiles", "select_audit", { company_id: COMPANY_ID }, () => requireSupabase().from("profiles").select("*"))
  ]);
};

export const loadFinanceData = async (): Promise<FinanceSnapshot> => {
  try {
    const company = salesCompany;
    const [carriers, entries, fixedCosts] = await Promise.all([loadCarriers(company), loadEntries(company), loadFixedCosts(company), auditSupportingTables()]);

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
  const fullPayload = carrierToFullRow(completeCarrier);
  const result = await runSupabase("carriers", "upsert_full", fullPayload, () => requireSupabase().from("carriers").upsert(fullPayload));
  if (result.error) {
    const minimalPayload = carrierToMinimalRow(completeCarrier);
    await runSupabase("carriers", "upsert_minimal", minimalPayload, () => requireSupabase().from("carriers").upsert(minimalPayload), { throwOnError: true });
  }
  return completeCarrier;
};

export const deleteCarrier = async (id: string) => {
  console.log("Salvando no Supabase", { table: "carriers", action: "delete", id, company_id: COMPANY_ID });
  const result = await runSupabase(
    "carriers",
    "delete",
    { id, company_id: COMPANY_ID },
    () => requireSupabase().from("carriers").delete().eq("id", id).eq("company_id", COMPANY_ID),
    { throwOnError: true }
  );
  return !result.error;
};

export const saveDailyEntry = async (entry: DailyEntry) => {
  const company = salesCompany;
  const dailyPayload = {
    ...rowCompanyPayload(),
    date: entry.date,
    updated_at: new Date().toISOString()
  };

  console.log("Salvando no Supabase", { table: "daily_entries", date: entry.date });
  const existingResult = await runSupabase<DbRow[]>("daily_entries", "select_before_save", { company_id: COMPANY_ID, date: entry.date }, () =>
    requireSupabase().from("daily_entries").select("*")
  );
  if (existingResult.error) return;
  const existing = ((existingResult.data || []) as DbRow[]).find((row) => companyMatches(row, company) && text(row, ["date", "data", "entry_date"]) === entry.date);

  const dailyResult = existing?.id
    ? await runSupabase<DbRow>("daily_entries", "update", { id: text(existing, ["id"]), ...dailyPayload }, () =>
        requireSupabase().from("daily_entries").update(dailyPayload).eq("id", text(existing, ["id"])).select("*").maybeSingle()
      )
    : await runSupabase<DbRow>("daily_entries", "insert", { id: "generated", ...dailyPayload }, () =>
        requireSupabase().from("daily_entries").insert({ id: makeId(), ...dailyPayload }).select("*").maybeSingle()
      );

  if (dailyResult.error) return;
  const dailyId = text((dailyResult.data || existing || {}) as DbRow, ["id"]);
  if (!dailyId) throw new Error("Nao foi possivel identificar o lancamento diario salvo.");

  const deleteResult = await runSupabase("package_entries", "delete_by_daily_entry_id", { daily_entry_id: dailyId }, () =>
    requireSupabase().from("package_entries").delete().eq("daily_entry_id", dailyId)
  );
  if (deleteResult.error) return;

  const rows = Object.entries(entry.carriers || {})
    .filter(([, input]) => (Number(input.ml) || 0) + (Number(input.shopee) || 0) + (Number(input.avulso) || 0) > 0)
    .map(([carrierId, input]) => packageRow(dailyId, carrierId, input));

  if (!rows.length) return;
  await runSupabase("package_entries", "insert", rows, () => requireSupabase().from("package_entries").insert(rows));
};

export const saveFixedCost = async (cost: Omit<FixedCost, "id"> | FixedCost) => {
  const completeCost: FixedCost = {
    ...cost,
    id: "id" in cost && cost.id ? cost.id : makeId()
  };

  console.log("Salvando no Supabase", { table: "fixed_costs", id: completeCost.id });
  const payload = fixedCostToRow(completeCost);
  await runSupabase("fixed_costs", "upsert", payload, () => requireSupabase().from("fixed_costs").upsert(payload), { throwOnError: true });
  return completeCost;
};

export const deleteFixedCost = async (id: string) => {
  console.log("Salvando no Supabase", { table: "fixed_costs", action: "delete", id });
  await runSupabase("fixed_costs", "delete", { id }, () => requireSupabase().from("fixed_costs").delete().eq("id", id), { throwOnError: true });
};
