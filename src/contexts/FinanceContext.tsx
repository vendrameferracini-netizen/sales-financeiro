import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Carrier, DailyCarrierInput, DailyEntry, FixedCost } from "../types";
import { deleteCarrier, deleteFixedCost, loadFinanceData, reloadCarriers, saveCarrier, saveDailyEntry, saveFixedCost, sortCarriersByName } from "../utils/storage";

type FinanceContextValue = {
  carriers: Carrier[];
  entries: Record<string, DailyEntry>;
  fixedCosts: FixedCost[];
  loading: boolean;
  error: string;
  getEntry: (date: string) => DailyEntry | undefined;
  saveEntry: (date: string, carriers: Record<string, DailyCarrierInput>) => void;
  addCarrier: (carrier: Omit<Carrier, "id">) => Promise<void>;
  updateCarrier: (carrier: Carrier) => Promise<void>;
  removeCarrier: (id: string) => Promise<void>;
  addFixedCost: (cost: Omit<FixedCost, "id">) => void;
  removeFixedCost: (id: string) => void;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

const errorText = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) return String((error as { message?: unknown }).message);
  return "Erro ao comunicar com o Supabase. Veja o console para tabela, operacao e erro completo.";
};

export const FinanceProvider = ({ children }: { children: ReactNode }) => {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [entries, setEntries] = useState<Record<string, DailyEntry>>({});
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadFinanceData()
      .then((snapshot) => {
        if (!active) return;
        setCarriers(sortCarriersByName(snapshot.carriers));
        setEntries(snapshot.entries);
        setFixedCosts(snapshot.fixedCosts);
        setError("");
      })
      .catch((loadError) => {
        if (!active) return;
        console.error("Erro completo ao carregar dados do Supabase", loadError);
        setError(errorText(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<FinanceContextValue>(
    () => ({
      carriers,
      entries,
      fixedCosts,
      loading,
      error,
      getEntry: (date) => entries[date],
      saveEntry: (date, carrierInputs) => {
        const nextEntry = {
          date,
          carriers: {
            ...(entries[date]?.carriers || {}),
            ...carrierInputs
          }
        };
        saveDailyEntry(nextEntry)
          .then(() => {
            setEntries((current) => ({
              ...current,
              [date]: nextEntry
            }));
            setError("");
          })
          .catch((saveError) => {
            console.error("Erro completo ao salvar lancamento no Supabase", saveError);
            setError(errorText(saveError));
          });
      },
      addCarrier: (carrier) => {
        return saveCarrier(carrier)
          .then(() => reloadCarriers())
          .then((freshCarriers) => {
            setCarriers(sortCarriersByName(freshCarriers));
            setError("");
          })
          .catch((saveError) => {
            console.error("Erro completo ao salvar transportadora no Supabase", saveError);
            setError(errorText(saveError));
            throw saveError;
          });
      },
      updateCarrier: (carrier) => {
        return saveCarrier(carrier)
          .then(() => reloadCarriers())
          .then((freshCarriers) => {
            setCarriers(sortCarriersByName(freshCarriers));
            setError("");
          })
          .catch((saveError) => {
            console.error("Erro completo ao atualizar transportadora no Supabase", saveError);
            setError(errorText(saveError));
            throw saveError;
          });
      },
      removeCarrier: (id) => {
        return deleteCarrier(id)
          .then(() => {
            setCarriers((current) => sortCarriersByName(current.filter((carrier) => carrier.id !== id)));
            setError("");
          })
          .catch((deleteError) => {
            console.error({ table: "carriers", operation: "delete", payload: { id }, error: deleteError });
            setError(errorText(deleteError));
            throw deleteError;
          });
      },
      addFixedCost: (cost) => {
        saveFixedCost(cost)
          .then((savedCost) => {
            setFixedCosts((current) => [...current, savedCost]);
            setError("");
          })
          .catch((saveError) => {
            console.error("Erro completo ao salvar custo no Supabase", saveError);
            setError(errorText(saveError));
          });
      },
      removeFixedCost: (id) => {
        deleteFixedCost(id)
          .then(() => {
            setFixedCosts((current) => current.filter((cost) => cost.id !== id));
            setError("");
          })
          .catch((saveError) => {
            console.error("Erro completo ao remover custo no Supabase", saveError);
            setError(errorText(saveError));
          });
      }
    }),
    [carriers, entries, fixedCosts, loading, error]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) throw new Error("useFinance deve ser usado dentro de FinanceProvider");
  return context;
};
