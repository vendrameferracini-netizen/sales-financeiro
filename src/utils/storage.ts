import { defaultCarriers } from "../data/carriers";
import { Carrier, DailyEntry, FixedCost } from "../types";

const ENTRIES_KEY = "financeiro-salles:entries";
const COSTS_KEY = "financeiro-salles:fixed-costs";
const CARRIERS_KEY = "financeiro-salles:carriers";

export const sortCarriersByName = (carriers: Carrier[] = []) =>
  [...(carriers || [])].sort((first, second) =>
    first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" })
  );

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const loadEntries = () => readJson<Record<string, DailyEntry>>(ENTRIES_KEY, {});
export const saveEntries = (entries: Record<string, DailyEntry>) => localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries || {}));

export const loadFixedCosts = () => readJson<FixedCost[]>(COSTS_KEY, []);
export const saveFixedCosts = (costs: FixedCost[]) => localStorage.setItem(COSTS_KEY, JSON.stringify(costs || []));

export const loadCarriers = () => {
  const saved = readJson<Carrier[] | null>(CARRIERS_KEY, null);
  if (!saved?.length) return sortCarriersByName(defaultCarriers);
  return sortCarriersByName(
    saved.map((carrier) => ({
      ...carrier,
      active: carrier.active ?? true,
      rates: {
        ml: Number(carrier.rates?.ml) || 0,
        shopee: Number(carrier.rates?.shopee) || 0,
        avulso: Number(carrier.rates?.avulso) || 0
      }
    }))
  );
};

export const saveCarriers = (carriers: Carrier[]) => localStorage.setItem(CARRIERS_KEY, JSON.stringify(sortCarriersByName(carriers)));
