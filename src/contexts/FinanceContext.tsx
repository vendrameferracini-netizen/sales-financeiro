import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Carrier, DailyCarrierInput, DailyEntry, FixedCost } from "../types";
import { loadCarriers, loadEntries, loadFixedCosts, saveCarriers, saveEntries, saveFixedCosts, sortCarriersByName } from "../utils/storage";

type FinanceContextValue = {
  carriers: Carrier[];
  entries: Record<string, DailyEntry>;
  fixedCosts: FixedCost[];
  getEntry: (date: string) => DailyEntry | undefined;
  saveEntry: (date: string, carriers: Record<string, DailyCarrierInput>) => void;
  addCarrier: (carrier: Omit<Carrier, "id">) => void;
  updateCarrier: (carrier: Carrier) => void;
  addFixedCost: (cost: Omit<FixedCost, "id">) => void;
  removeFixedCost: (id: string) => void;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

export const FinanceProvider = ({ children }: { children: ReactNode }) => {
  const [carriers, setCarriers] = useState<Carrier[]>(() => sortCarriersByName(loadCarriers()));
  const [entries, setEntries] = useState<Record<string, DailyEntry>>(() => loadEntries());
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>(() => loadFixedCosts());

  useEffect(() => {
    saveCarriers(carriers);
  }, [carriers]);

  useEffect(() => {
    saveEntries(entries);
  }, [entries]);

  useEffect(() => {
    saveFixedCosts(fixedCosts);
  }, [fixedCosts]);

  const value = useMemo<FinanceContextValue>(
    () => ({
      carriers,
      entries,
      fixedCosts,
      getEntry: (date) => entries[date],
      saveEntry: (date, carrierInputs) => {
        setEntries((current) => ({
          ...current,
          [date]: {
            date,
            carriers: {
              ...(current[date]?.carriers || {}),
              ...carrierInputs
            }
          }
        }));
      },
      addCarrier: (carrier) => {
        setCarriers((current) =>
          sortCarriersByName([
            ...current,
            {
              ...carrier,
              id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
            }
          ])
        );
      },
      updateCarrier: (carrier) => {
        setCarriers((current) => sortCarriersByName(current.map((item) => (item.id === carrier.id ? carrier : item))));
      },
      addFixedCost: (cost) => {
        setFixedCosts((current) => [
          ...current,
          {
            ...cost,
            id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
          }
        ]);
      },
      removeFixedCost: (id) => setFixedCosts((current) => current.filter((cost) => cost.id !== id))
    }),
    [carriers, entries, fixedCosts]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) throw new Error("useFinance deve ser usado dentro de FinanceProvider");
  return context;
};
