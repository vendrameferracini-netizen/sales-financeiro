import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Carrier, DailyCarrierInput, DailyEntry, FixedCost } from "../types";
import { cacheFinanceData, deleteFixedCost, loadFinanceData, saveCarrier, saveDailyEntry, saveFixedCost, sortCarriersByName, syncPendingOperations } from "../utils/storage";

type FinanceContextValue = {
  carriers: Carrier[];
  entries: Record<string, DailyEntry>;
  fixedCosts: FixedCost[];
  loading: boolean;
  getEntry: (date: string) => DailyEntry | undefined;
  saveEntry: (date: string, carriers: Record<string, DailyCarrierInput>) => void;
  addCarrier: (carrier: Omit<Carrier, "id">) => void;
  updateCarrier: (carrier: Carrier) => void;
  addFixedCost: (cost: Omit<FixedCost, "id">) => void;
  removeFixedCost: (id: string) => void;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

export const FinanceProvider = ({ children }: { children: ReactNode }) => {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [entries, setEntries] = useState<Record<string, DailyEntry>>({});
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [loading, setLoading] = useState(true);

  const persistCache = useCallback((nextCarriers: Carrier[], nextEntries: Record<string, DailyEntry>, nextFixedCosts: FixedCost[]) => {
    cacheFinanceData({
      carriers: nextCarriers,
      entries: nextEntries,
      fixedCosts: nextFixedCosts
    });
  }, []);

  useEffect(() => {
    let active = true;
    loadFinanceData()
      .then((snapshot) => {
        if (!active) return;
        setCarriers(sortCarriersByName(snapshot.carriers));
        setEntries(snapshot.entries);
        setFixedCosts(snapshot.fixedCosts);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      syncPendingOperations().catch(() => undefined);
    };
    window.addEventListener("online", sync);
    sync();
    return () => window.removeEventListener("online", sync);
  }, []);

  const value = useMemo<FinanceContextValue>(
    () => ({
      carriers,
      entries,
      fixedCosts,
      loading,
      getEntry: (date) => entries[date],
      saveEntry: (date, carrierInputs) => {
        setEntries((current) => {
          const nextEntry = {
            date,
            carriers: {
              ...(current[date]?.carriers || {}),
              ...carrierInputs
            }
          };
          const nextEntries = {
            ...current,
            [date]: nextEntry
          };
          persistCache(carriers, nextEntries, fixedCosts);
          saveDailyEntry(nextEntry).catch(() => undefined);
          return nextEntries;
        });
      },
      addCarrier: (carrier) => {
        saveCarrier(carrier)
          .then((savedCarrier) => {
            setCarriers((current) => {
              const nextCarriers = sortCarriersByName([...current, savedCarrier]);
              persistCache(nextCarriers, entries, fixedCosts);
              return nextCarriers;
            });
          })
          .catch(() => undefined);
      },
      updateCarrier: (carrier) => {
        setCarriers((current) => {
          const nextCarriers = sortCarriersByName(current.map((item) => (item.id === carrier.id ? carrier : item)));
          persistCache(nextCarriers, entries, fixedCosts);
          return nextCarriers;
        });
        saveCarrier(carrier).catch(() => undefined);
      },
      addFixedCost: (cost) => {
        saveFixedCost(cost)
          .then((savedCost) => {
            setFixedCosts((current) => {
              const nextFixedCosts = [...current, savedCost];
              persistCache(carriers, entries, nextFixedCosts);
              return nextFixedCosts;
            });
          })
          .catch(() => undefined);
      },
      removeFixedCost: (id) => {
        setFixedCosts((current) => {
          const nextFixedCosts = current.filter((cost) => cost.id !== id);
          persistCache(carriers, entries, nextFixedCosts);
          return nextFixedCosts;
        });
        deleteFixedCost(id).catch(() => undefined);
      }
    }),
    [carriers, entries, fixedCosts, loading, persistCache]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) throw new Error("useFinance deve ser usado dentro de FinanceProvider");
  return context;
};
