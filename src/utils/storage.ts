import { defaultCarriers } from "../data/carriers";
import { Carrier, DailyEntry, FixedCost } from "../types";
import { requireSupabase } from "./supabase";

const LEGACY_ENTRIES_KEY = "financeiro-salles:entries";
const LEGACY_COSTS_KEY = "financeiro-salles:fixed-costs";
const LEGACY_CARRIERS_KEY = "financeiro-salles:carriers";

const CACHE_KEY = "financeiro-salles:supabase-cache";
const QUEUE_KEY = "financeiro-salles:sync-queue";
const MIGRATION_KEY = "financeiro-salles:supabase-migrated";

type FinanceSnapshot = {
  carriers: Carrier[];
  entries: Record<string, DailyEntry>;
  fixedCosts: FixedCost[];
};

type QueueOperation =
  | { type: "upsert-carrier"; carrier: Carrier }
  | { type: "upsert-entry"; entry: DailyEntry }
  | { type: "upsert-cost"; cost: FixedCost }
  | { type: "delete-cost"; id: string };

const emptySnapshot: FinanceSnapshot = {
  carriers: [],
  entries: {},
  fixedCosts: []
};

export const sortCarriersByName = (carriers: Carrier[] = []) =>
  [...(carriers || [])].sort((first, second) => first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" }));

const makeId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));

const readCache = () => readJson<FinanceSnapshot>(CACHE_KEY, emptySnapshot);

const writeCache = (snapshot: FinanceSnapshot) =>
  writeJson(CACHE_KEY, {
    carriers: sortCarriersByName(snapshot.carriers),
    entries: snapshot.entries || {},
    fixedCosts: snapshot.fixedCosts || []
  });

const readQueue = () => readJson<QueueOperation[]>(QUEUE_KEY, []);
const writeQueue = (operations: QueueOperation[]) => writeJson(QUEUE_KEY, operations);
const queueOperation = (operation: QueueOperation) => writeQueue([...readQueue(), operation]);

const legacySnapshot = (): FinanceSnapshot => ({
  carriers: readJson<Carrier[] | null>(LEGACY_CARRIERS_KEY, null) || [],
  entries: readJson<Record<string, DailyEntry>>(LEGACY_ENTRIES_KEY, {}),
  fixedCosts: readJson<FixedCost[]>(LEGACY_COSTS_KEY, [])
});

const carrierRow = (carrier: Carrier) => ({
  id: carrier.id,
  name: carrier.name,
  ml: Number(carrier.rates.ml) || 0,
  shopee: Number(carrier.rates.shopee) || 0,
  avulso: Number(carrier.rates.avulso) || 0,
  active: carrier.active ?? true,
  updated_at: new Date().toISOString()
});

const entryRow = (entry: DailyEntry) => ({
  date: entry.date,
  carriers: entry.carriers || {},
  updated_at: new Date().toISOString()
});

const fixedCostRow = (cost: FixedCost) => ({
  id: cost.id,
  description: cost.description,
  category: cost.category,
  amount: Number(cost.amount) || 0,
  fortnight: cost.fortnight,
  month: cost.month,
  updated_at: new Date().toISOString()
});

const upsertCarrierOnline = async (carrier: Carrier) => {
  const { error } = await requireSupabase().from("carriers").upsert(carrierRow(carrier));
  if (error) throw error;
};

const upsertEntryOnline = async (entry: DailyEntry) => {
  const { error } = await requireSupabase().from("daily_entries").upsert(entryRow(entry));
  if (error) throw error;
};

const upsertFixedCostOnline = async (cost: FixedCost) => {
  const { error } = await requireSupabase().from("fixed_costs").upsert(fixedCostRow(cost));
  if (error) throw error;
};

const deleteFixedCostOnline = async (id: string) => {
  const { error } = await requireSupabase().from("fixed_costs").delete().eq("id", id);
  if (error) throw error;
};

export const syncPendingOperations = async () => {
  const operations = readQueue();
  if (!operations.length) return;

  const remaining: QueueOperation[] = [];
  for (const operation of operations) {
    try {
      if (operation.type === "upsert-carrier") await upsertCarrierOnline(operation.carrier);
      if (operation.type === "upsert-entry") await upsertEntryOnline(operation.entry);
      if (operation.type === "upsert-cost") await upsertFixedCostOnline(operation.cost);
      if (operation.type === "delete-cost") await deleteFixedCostOnline(operation.id);
    } catch {
      remaining.push(operation);
    }
  }
  writeQueue(remaining);
};

const migrateLegacyData = async () => {
  if (localStorage.getItem(MIGRATION_KEY) === "true") return;

  const legacy = legacySnapshot();
  const carriersToMigrate = legacy.carriers.length ? legacy.carriers : [];
  const entriesToMigrate = Object.values(legacy.entries || {});
  const costsToMigrate = legacy.fixedCosts || [];

  await Promise.all(carriersToMigrate.map(upsertCarrierOnline));
  await Promise.all(entriesToMigrate.map(upsertEntryOnline));
  await Promise.all(costsToMigrate.map(upsertFixedCostOnline));

  localStorage.setItem(MIGRATION_KEY, "true");
};

const seedDefaultCarriersIfEmpty = async () => {
  const { count, error } = await requireSupabase().from("carriers").select("id", { count: "exact", head: true });
  if (error) throw error;
  if ((count || 0) > 0) return;
  await Promise.all(defaultCarriers.map(upsertCarrierOnline));
};

export const loadFinanceData = async (): Promise<FinanceSnapshot> => {
  const cached = readCache();

  try {
    await migrateLegacyData();
    await seedDefaultCarriersIfEmpty();
    await syncPendingOperations();

    const [carriersResult, entriesResult, costsResult] = await Promise.all([
      requireSupabase().from("carriers").select("*").order("name", { ascending: true }),
      requireSupabase().from("daily_entries").select("*"),
      requireSupabase().from("fixed_costs").select("*").order("month", { ascending: true })
    ]);

    if (carriersResult.error) throw carriersResult.error;
    if (entriesResult.error) throw entriesResult.error;
    if (costsResult.error) throw costsResult.error;

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

    writeCache(snapshot);
    return snapshot;
  } catch {
    if (cached.carriers.length || Object.keys(cached.entries).length || cached.fixedCosts.length) return cached;
    return {
      carriers: sortCarriersByName(defaultCarriers),
      entries: {},
      fixedCosts: []
    };
  }
};

export const saveCarrier = async (carrier: Omit<Carrier, "id"> | Carrier) => {
  const completeCarrier: Carrier = {
    ...carrier,
    id: "id" in carrier && carrier.id ? carrier.id : makeId()
  };
  try {
    await upsertCarrierOnline(completeCarrier);
  } catch {
    queueOperation({ type: "upsert-carrier", carrier: completeCarrier });
  }
  return completeCarrier;
};

export const saveDailyEntry = async (entry: DailyEntry) => {
  try {
    await upsertEntryOnline(entry);
  } catch {
    queueOperation({ type: "upsert-entry", entry });
  }
};

export const saveFixedCost = async (cost: Omit<FixedCost, "id"> | FixedCost) => {
  const completeCost: FixedCost = {
    ...cost,
    id: "id" in cost && cost.id ? cost.id : makeId()
  };
  try {
    await upsertFixedCostOnline(completeCost);
  } catch {
    queueOperation({ type: "upsert-cost", cost: completeCost });
  }
  return completeCost;
};

export const deleteFixedCost = async (id: string) => {
  try {
    await deleteFixedCostOnline(id);
  } catch {
    queueOperation({ type: "delete-cost", id });
  }
};

export const cacheFinanceData = writeCache;
