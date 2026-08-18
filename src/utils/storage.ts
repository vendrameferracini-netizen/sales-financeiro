import { APP_ID, COMPANY_ID } from "../data/app";
import { Carrier, DailyCarrierInput, DailyEntry, FixedCost, SaveDebugStep } from "../types";
import { normalizeEntryDate } from "./dates";
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
  status?: number;
  statusText?: string;
};

const SAVE_DIAGNOSTIC_TIMEOUT_MS = 15000;

const errorDetails = (error: unknown) => error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };

const serializableError = (error: unknown) => {
  if (error instanceof SaveDiagnosticTimeoutError) {
    return {
      name: error.name,
      message: error.message,
      stage: error.stage,
      table: error.table,
      operation: error.operation,
      payload: error.payload,
      elapsedMs: error.elapsedMs,
      timeoutMs: error.timeoutMs
    };
  }
  if (error instanceof SupabaseOperationError) {
    return { message: error.message, table: error.table, operation: error.operation, payload: error.payload, details: error.details };
  }
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  return error;
};

const getSupabaseErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const details = errorDetails(error);
    const parts = [
      details.code ? `code: ${String(details.code)}` : "",
      details.message ? `message: ${String(details.message)}` : "",
      details.details ? `details: ${String(details.details)}` : "",
      details.hint ? `hint: ${String(details.hint)}` : ""
    ].filter(Boolean);
    if (parts.length) return parts.join(" | ");
  }
  return fallback;
};

const errorTextContent = (error: unknown) => {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) return JSON.stringify(error);
  return "";
};

const isMissingColumnError = (error: unknown, column: string) => {
  const content = errorTextContent(error).toLowerCase();
  return content.includes(column.toLowerCase()) && (content.includes("column") || content.includes("schema cache") || content.includes("could not find"));
};

const isForeignKeyError = (error: unknown) => {
  const content = errorTextContent(error).toLowerCase();
  return content.includes("23503") || content.includes("foreign key") || content.includes("violates foreign key constraint");
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

class SaveDiagnosticTimeoutError extends Error {
  constructor(
    public stage: string,
    public table: string,
    public operation: string,
    public payload: unknown,
    public elapsedMs: number,
    public timeoutMs: number
  ) {
    super(`Timeout em ${stage}: ${table}.${operation} nao retornou em ${timeoutMs}ms.`);
    this.name = "SaveDiagnosticTimeoutError";
  }
}

export const formatErrorForScreen = (error: unknown) => {
  if (error instanceof SaveDiagnosticTimeoutError) {
    return [
      "Timeout no salvamento:",
      `etapa: ${error.stage}`,
      `table: ${error.table}`,
      `operation: ${error.operation}`,
      `elapsedMs: ${error.elapsedMs}`,
      `timeoutMs: ${error.timeoutMs}`,
      `payload: ${JSON.stringify(error.payload, null, 2)}`
    ].join("\n");
  }
  if (error instanceof SupabaseOperationError) {
    const details = errorDetails(error.details);
    return [
      `Erro ao salvar ${error.table}:`,
      `operation: ${error.operation}`,
      details.code ? `code: ${String(details.code)}` : "",
      details.message ? `message: ${String(details.message)}` : error.message,
      details.details ? `details: ${String(details.details)}` : "",
      details.hint ? `hint: ${String(details.hint)}` : "",
      `payload: ${JSON.stringify(error.payload, null, 2)}`
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (error instanceof Error) return error.message;
  return String(error || "Erro desconhecido ao salvar.");
};

export const sortCarriersByName = (carriers: Carrier[] = []) =>
  [...(carriers || [])].sort((first, second) => first.name.localeCompare(second.name, "pt-BR", { sensitivity: "base" }));

const makeId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

const logSupabaseError = (table: string, operation: string, payload: unknown, error: unknown) => {
  console.error({ table, operation, payload, error });
};

const logNamedSupabaseError = (label: string, error: unknown) => {
  const details = errorDetails(error);
  console.error(label, {
    code: details.code,
    message: details.message,
    details: details.details,
    hint: details.hint,
    error
  });
};

const logSupabaseSuccess = <T,>(table: string, operation: string, payload: unknown, data: T | null) => {
  const rowCount = Array.isArray(data) ? data.length : data ? 1 : 0;
  console.log("Resposta do Supabase", { table, operation, payload, rowCount, data });
};

const runSupabase = async <T,>(
  table: string,
  operation: string,
  payload: unknown,
  request: () => PromiseLike<SupabaseResult<T>>,
  options: { throwOnError?: boolean } = {}
) => {
  try {
    const result = await request();
    console.log("STATUS_SUPABASE", {
      table,
      operation,
      payload,
      status: result.status,
      statusText: result.statusText
    });
    if (result.error) {
      logSupabaseError(table, operation, payload, result.error);
      if (table === "daily_entries") logNamedSupabaseError("ERRO_DAILY_ENTRIES", result.error);
      if (table === "package_entries") logNamedSupabaseError("ERRO_PACKAGE_ENTRIES", result.error);
      if (options.throwOnError) throw new SupabaseOperationError(table, operation, payload, result.error);
    } else {
      logSupabaseSuccess(table, operation, payload, result.data);
      if (table === "daily_entries" && ["insert", "update"].includes(operation)) console.log("SALVOU_DAILY_ENTRIES", { payload, data: result.data });
      if (table === "package_entries" && ["insert", "update"].includes(operation)) console.log("SALVOU_PACKAGE_ENTRIES", { payload, data: result.data });
    }
    return result;
  } catch (error) {
    logSupabaseError(table, operation, payload, error);
    if (table === "daily_entries") logNamedSupabaseError("ERRO_DAILY_ENTRIES", error);
    if (table === "package_entries") logNamedSupabaseError("ERRO_PACKAGE_ENTRIES", error);
    if (options.throwOnError) throw new SupabaseOperationError(table, operation, payload, error);
    return { data: null, error } as SupabaseResult<T>;
  }
};

const runSaveDiagnosticStep = async <T,>(
  emit: (step: SaveDebugStep) => void,
  meta: {
    beforeStage: string;
    afterStage: string;
    table: string;
    operation: string;
    payload: unknown;
    date?: string;
    id?: string;
  },
  request: () => Promise<SupabaseResult<T>>
) => {
  const startedAt = Date.now();
  emit({
    stage: meta.beforeStage,
    table: meta.table,
    operation: meta.operation,
    date: meta.date,
    id: meta.id,
    payload: meta.payload,
    timeoutMs: SAVE_DIAGNOSTIC_TIMEOUT_MS
  });

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new SaveDiagnosticTimeoutError(
          meta.beforeStage,
          meta.table,
          meta.operation,
          meta.payload,
          Date.now() - startedAt,
          SAVE_DIAGNOSTIC_TIMEOUT_MS
        )
      );
    }, SAVE_DIAGNOSTIC_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([request(), timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    emit({
      stage: meta.afterStage,
      table: meta.table,
      operation: meta.operation,
      date: meta.date,
      id: meta.id,
      payload: meta.payload,
      status: result.status,
      statusText: result.statusText,
      data: result.data,
      error: result.error ? serializableError(result.error) : undefined,
      elapsedMs: Date.now() - startedAt,
      timeoutMs: SAVE_DIAGNOSTIC_TIMEOUT_MS
    });
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    emit({
      stage: `${meta.afterStage} - ERRO`,
      table: meta.table,
      operation: meta.operation,
      date: meta.date,
      id: meta.id,
      payload: meta.payload,
      error: serializableError(error),
      elapsedMs: Date.now() - startedAt,
      timeoutMs: SAVE_DIAGNOSTIC_TIMEOUT_MS
    });
    throw error;
  }
};

const runTimedDiagnosticStep = async <T,>(
  emit: (step: SaveDebugStep) => void,
  meta: {
    beforeStage: string;
    afterStage: string;
    table: string;
    operation: string;
    payload: unknown;
    date?: string;
    id?: string;
  },
  request: () => Promise<T>
) => {
  const startedAt = Date.now();
  emit({
    stage: meta.beforeStage,
    table: meta.table,
    operation: meta.operation,
    date: meta.date,
    id: meta.id,
    payload: meta.payload,
    timeoutMs: SAVE_DIAGNOSTIC_TIMEOUT_MS
  });

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new SaveDiagnosticTimeoutError(
          meta.beforeStage,
          meta.table,
          meta.operation,
          meta.payload,
          Date.now() - startedAt,
          SAVE_DIAGNOSTIC_TIMEOUT_MS
        )
      );
    }, SAVE_DIAGNOSTIC_TIMEOUT_MS);
  });

  try {
    const data = await Promise.race([request(), timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    emit({
      stage: meta.afterStage,
      table: meta.table,
      operation: meta.operation,
      date: meta.date,
      id: meta.id,
      payload: meta.payload,
      data,
      elapsedMs: Date.now() - startedAt,
      timeoutMs: SAVE_DIAGNOSTIC_TIMEOUT_MS
    });
    return data;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    emit({
      stage: `${meta.afterStage} - ERRO`,
      table: meta.table,
      operation: meta.operation,
      date: meta.date,
      id: meta.id,
      payload: meta.payload,
      error: serializableError(error),
      elapsedMs: Date.now() - startedAt,
      timeoutMs: SAVE_DIAGNOSTIC_TIMEOUT_MS
    });
    throw error;
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

const rowTimestamp = (row: DbRow) => {
  const value = text(row, ["updated_at", "created_at", "criado_em"]);
  const time = value ? Date.parse(value) : 0;
  return Number.isFinite(time) ? time : 0;
};

const rowTime = (row: DbRow, keys: string[]) => {
  const value = text(row, keys);
  const time = value ? Date.parse(value) : 0;
  return Number.isFinite(time) ? time : 0;
};

const activePackageSort = (first: DbRow, second: DbRow) => {
  const updatedDiff = rowTime(first, ["updated_at"]) - rowTime(second, ["updated_at"]);
  if (updatedDiff !== 0) return updatedDiff;
  return rowTime(first, ["created_at", "criado_em"]) - rowTime(second, ["created_at", "criado_em"]);
};

const latestPackageForCarrier = (rows: DbRow[], carrierId: string) => {
  const matches = rows
    .filter((row) => text(row, ["carrier_id", "transportadora_id"]) === carrierId)
    .sort(activePackageSort);
  return matches[matches.length - 1];
};

const rowDate = (row: DbRow) => normalizeEntryDate(text(row, ["date", "data", "entry_date"]));

const bool = (row: DbRow, keys: string[], fallback = true) => {
  const value = keys.map((key) => row[key]).find((item) => item !== undefined && item !== null);
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return !["false", "0", "inativo", "inactive"].includes(value.toLowerCase());
  return fallback;
};

const salesCompany = { id: COMPANY_ID };

const companyMatches = (row: DbRow, company: DbRow) => {
  const appValue = row.app_id;
  const hasAppColumn = Object.prototype.hasOwnProperty.call(row, "app_id");
  const appMatches = hasAppColumn && String(appValue || "") === APP_ID;
  const companyValue = row.company_id !== undefined ? row.company_id : row.id_da_empresa;
  const companyMatchesValue = companyValue === undefined || String(companyValue) === String(company.id);
  return appMatches && companyMatchesValue;
};

const rowCompanyPayload = () => ({
  app_id: APP_ID,
  company_id: COMPANY_ID
});

const allCarrierColumnPayload = (carrier: Carrier) => ({
  id: carrier.id,
  app_id: APP_ID,
  company_id: COMPANY_ID,
  id_da_empresa: COMPANY_ID,
  name: carrier.name,
  nome: carrier.name,
  carrier_name: carrier.name,
  ml: Number(carrier.rates.ml) || 0,
  valor_ml: Number(carrier.rates.ml) || 0,
  mercado_livre: Number(carrier.rates.ml) || 0,
  value_ml: Number(carrier.rates.ml) || 0,
  rate_ml: Number(carrier.rates.ml) || 0,
  ml_rate: Number(carrier.rates.ml) || 0,
  price_ml: Number(carrier.rates.ml) || 0,
  shopee: Number(carrier.rates.shopee) || 0,
  valor_shopee: Number(carrier.rates.shopee) || 0,
  value_shopee: Number(carrier.rates.shopee) || 0,
  rate_shopee: Number(carrier.rates.shopee) || 0,
  shopee_rate: Number(carrier.rates.shopee) || 0,
  price_shopee: Number(carrier.rates.shopee) || 0,
  avulso: Number(carrier.rates.avulso) || 0,
  valor_avulso: Number(carrier.rates.avulso) || 0,
  value_avulso: Number(carrier.rates.avulso) || 0,
  rate_avulso: Number(carrier.rates.avulso) || 0,
  avulso_rate: Number(carrier.rates.avulso) || 0,
  price_avulso: Number(carrier.rates.avulso) || 0,
  active: carrier.active ?? true,
  status: carrier.active === false ? "inativo" : "ativo",
  updated_at: new Date().toISOString()
});

const carrierToFullRow = (carrier: Carrier) => ({
  company_id: COMPANY_ID,
  id: carrier.id,
  name: carrier.name,
  ml: Number(carrier.rates.ml) || 0,
  shopee: Number(carrier.rates.shopee) || 0,
  avulso: Number(carrier.rates.avulso) || 0,
  active: carrier.active ?? true,
  updated_at: new Date().toISOString()
});

const carrierToScopedFullRow = (carrier: Carrier) => ({
  ...carrierToFullRow(carrier),
  app_id: APP_ID
});

const rowToCarrier = (row: DbRow): Carrier => {
  const name = text(row, ["name", "nome", "carrier_name"], "Sem nome");
  return {
    id: text(row, ["id", "carrier_id"], makeId()),
    name,
    rates: {
      ml: num(row, ["ml", "valor_ml", "mercado_livre", "value_ml", "rate_ml", "ml_rate", "price_ml"]),
      shopee: num(row, ["shopee", "valor_shopee", "value_shopee", "rate_shopee", "shopee_rate", "price_shopee"]),
      avulso: num(row, ["avulso", "valor_avulso", "value_avulso", "rate_avulso", "avulso_rate", "price_avulso"])
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

const packageDebugPayload = (row: ReturnType<typeof packageRow>, carriers: Carrier[] = []) => ({
  ...row,
  carrier_name: carriers.find((carrier) => carrier.id === row.carrier_id)?.name || "Transportadora nao encontrada"
});

const selectRowsByCompany = (table: string) => requireSupabase().from(table).select("*").eq("company_id", COMPANY_ID).eq("app_id", APP_ID);

const selectDailyEntryByDate = (date: string) =>
  requireSupabase().from("daily_entries").select("*").eq("company_id", COMPANY_ID).eq("app_id", APP_ID).eq("date", normalizeEntryDate(date));

const selectPackageEntriesByDailyId = (dailyEntryId: string) =>
  requireSupabase().from("package_entries").select("*").eq("company_id", COMPANY_ID).eq("app_id", APP_ID).eq("daily_entry_id", dailyEntryId);

const selectConfirmedPackageEntry = (dailyEntryId: string, carrierId: string) =>
  requireSupabase()
    .from("package_entries")
    .select("*")
    .eq("company_id", COMPANY_ID)
    .eq("app_id", APP_ID)
    .eq("daily_entry_id", dailyEntryId)
    .eq("carrier_id", carrierId);

const debugReadEntryDate = async (date: string, phase: string) => {
  const normalizedDate = normalizeEntryDate(date);
  const dailyResult = await runSupabase<DbRow[]>(
    "daily_entries",
    `debug_${phase}_by_exact_date`,
    { app_id: APP_ID, company_id: COMPANY_ID, input_date: date, normalized_date: normalizedDate },
    () => selectDailyEntryByDate(normalizedDate)
  );
  const dailyRows = ((dailyResult.data || []) as DbRow[]).filter((row) => companyMatches(row, salesCompany));
  const dailyIds = dailyRows.map((row) => text(row, ["id"])).filter(Boolean);
  const packageResults = await Promise.all(
    dailyIds.map((dailyEntryId) =>
      runSupabase<DbRow[]>(
        "package_entries",
        `debug_${phase}_by_daily_entry_id`,
        { app_id: APP_ID, company_id: COMPANY_ID, date, daily_entry_id: dailyEntryId },
        () => selectPackageEntriesByDailyId(dailyEntryId)
      )
    )
  );
  const packageRows = packageResults.flatMap((result) => ((result.data || []) as DbRow[]).filter((row) => companyMatches(row, salesCompany)));

  console.log("Diagnostico persistencia lancamento diario", {
    phase,
    input_date: date,
    normalized_date: normalizedDate,
    app_id: APP_ID,
    company_id: COMPANY_ID,
    daily_entries_count: dailyRows.length,
    package_entries_count: packageRows.length,
    daily_entries: dailyRows,
    package_entries: packageRows
  });
};

const filterPayloadByColumns = (payload: DbRow, columns: string[]) =>
  Object.fromEntries(Object.entries(payload).filter(([key]) => columns.includes(key) && payload[key] !== undefined));

const carrierPayloadForColumns = (carrier: Carrier, columns: string[]) => {
  if (columns.length === 0) return carrierToScopedFullRow(carrier);

  const payload = filterPayloadByColumns(allCarrierColumnPayload(carrier), columns);
  delete payload.ativo;
  if (!("name" in payload) && !("nome" in payload) && !("carrier_name" in payload)) payload.name = carrier.name;
  if (!("app_id" in payload)) payload.app_id = APP_ID;
  if (!("company_id" in payload) && !("id_da_empresa" in payload)) payload.company_id = COMPANY_ID;
  if (columns.length === 0 && !("id" in payload)) payload.id = carrier.id;
  return payload;
};

const getCarrierColumns = async () => {
  const result = await runSupabase<DbRow[]>("carriers", "select_schema_for_save", { app_id: APP_ID, company_id: COMPANY_ID }, () =>
    selectRowsByCompany("carriers").limit(1)
  );
  const first = (result.data || [])[0];
  return first ? Object.keys(first) : [];
};

const loadCarriers = async (company: DbRow) => {
  const { data } = await runSupabase<DbRow[]>("carriers", "select", { app_id: APP_ID, company_id: COMPANY_ID }, () => selectRowsByCompany("carriers"));
  if ((data || [])[0]) console.log("Dados carregados do Supabase", { table: "carriers", operation: "schema_detected", columns: Object.keys((data || [])[0] as DbRow) });
  const rows = ((data || []) as DbRow[]).filter((row) => companyMatches(row, company));
  return sortCarriersByName(rows.map(rowToCarrier));
};

export const reloadCarriers = async () => loadCarriers(salesCompany);

const buildEntryFromRows = (date: string, dailyRows: DbRow[], packageRows: DbRow[]): DailyEntry | null => {
  const normalizedDate = normalizeEntryDate(date);
  const matchingDailyRows = dailyRows
    .filter((row) => rowDate(row) === normalizedDate)
    .sort((first, second) => rowTimestamp(first) - rowTimestamp(second));

  if (!matchingDailyRows.length) return null;

  const dailyIds = new Set(matchingDailyRows.map((dailyRow) => text(dailyRow, ["id"])).filter(Boolean));
  const carriers = matchingDailyRows.reduce<Record<string, DailyCarrierInput>>((acc, dailyRow) => {
    const legacyCarriers = (dailyRow.carriers || {}) as Record<string, DailyCarrierInput>;
    Object.entries(legacyCarriers).forEach(([carrierId, input]) => {
      acc[carrierId] = packageInputFromRow(input as unknown as DbRow);
    });

    return acc;
  }, {});

  packageRows
    .filter((row) => dailyIds.has(text(row, ["daily_entry_id", "entry_id", "daily_id"])))
    .sort(activePackageSort)
    .forEach((row) => {
      const carrierId = text(row, ["carrier_id", "transportadora_id"]);
      if (carrierId) carriers[carrierId] = packageInputFromRow(row);
    });

  return { date: normalizedDate, carriers };
};

const loadEntries = async (company: DbRow) => {
  const [dailyResult, packageResult] = await Promise.all([
    runSupabase<DbRow[]>("daily_entries", "select", { app_id: APP_ID, company_id: COMPANY_ID }, () => selectRowsByCompany("daily_entries")),
    runSupabase<DbRow[]>("package_entries", "select", { app_id: APP_ID, company_id: COMPANY_ID }, () => selectRowsByCompany("package_entries"))
  ]);

  if (dailyResult.error || packageResult.error) return {};

  const dailyRows = ((dailyResult.data || []) as DbRow[]).filter((row) => companyMatches(row, company));
  const packageRows = ((packageResult.data || []) as DbRow[]).filter((row) => companyMatches(row, company));
  const dates = [...new Set(dailyRows.map(rowDate).filter(Boolean))].sort();

  return dates.reduce<Record<string, DailyEntry>>((acc, date) => {
    const entry = buildEntryFromRows(date, dailyRows, packageRows);
    if (entry) acc[date] = entry;
    return acc;
  }, {});
};

const loadEntryByDate = async (date: string): Promise<DailyEntry | null> => {
  const normalizedDate = normalizeEntryDate(date);
  const dailyResult = await runSupabase<DbRow[]>(
    "daily_entries",
    "select_after_save",
    { app_id: APP_ID, company_id: COMPANY_ID, input_date: date, normalized_date: normalizedDate },
    () => selectDailyEntryByDate(normalizedDate),
    { throwOnError: true }
  );
  const dailyRows = ((dailyResult.data || []) as DbRow[]).filter((row) => companyMatches(row, salesCompany));

  if (!dailyRows.length) {
    console.log("Dados carregados do Supabase", { table: "daily_entries", operation: "select_after_save", input_date: date, normalized_date: normalizedDate, records: 0 });
    return null;
  }

  const packageResults = await Promise.all(
    dailyRows.map((dailyRow) => {
      const dailyId = text(dailyRow, ["id"]);
      return runSupabase<DbRow[]>(
        "package_entries",
        "select_after_save",
        { app_id: APP_ID, company_id: COMPANY_ID, daily_entry_id: dailyId, normalized_date: normalizedDate },
        () => selectPackageEntriesByDailyId(dailyId),
        { throwOnError: true }
      );
    })
  );
  const packageRows = packageResults.flatMap((result) => ((result.data || []) as DbRow[]).filter((row) => companyMatches(row, salesCompany)));

  console.log("Dados carregados do Supabase", {
    table: "package_entries",
    operation: "select_after_save",
    input_date: date,
    normalized_date: normalizedDate,
    daily_entry_ids: dailyRows.map((row) => text(row, ["id"])),
    records: packageRows.length
  });

  return buildEntryFromRows(normalizedDate, dailyRows, packageRows);
};

export const reloadEntryByDate = async (date: string) => loadEntryByDate(date);

const loadFixedCosts = async (company: DbRow) => {
  const [fixedResult, costsResult] = await Promise.all([
    runSupabase<DbRow[]>("fixed_costs", "select", { app_id: APP_ID, company_id: COMPANY_ID }, () => selectRowsByCompany("fixed_costs")),
    runSupabase<DbRow[]>("costs", "select", { app_id: APP_ID, company_id: COMPANY_ID }, () => selectRowsByCompany("costs"))
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
    runSupabase<DbRow[]>("companies", "select_audit", { id: COMPANY_ID }, () => requireSupabase().from("companies").select("*").eq("id", COMPANY_ID)),
    runSupabase<DbRow[]>("profiles", "select_audit", { app_id: APP_ID, company_id: COMPANY_ID }, () => selectRowsByCompany("profiles"))
  ]);
};

export const loadFinanceData = async (): Promise<FinanceSnapshot> => {
  try {
    const company = salesCompany;
    const carriers = await loadCarriers(company);
    const [entries, fixedCosts] = await Promise.all([loadEntries(company), loadFixedCosts(company), auditSupportingTables()]);

    console.log("Dados carregados do Supabase", {
      schema: "companies/carriers/daily_entries/package_entries/fixed_costs/costs",
      company_id: COMPANY_ID,
      app_id: APP_ID,
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
  const carrierId = "id" in carrier && carrier.id ? carrier.id : "";
  const isUpdate = Boolean(carrierId);
  const completeCarrier: Carrier = {
    ...carrier,
    id: carrierId || makeId()
  };

  console.log("Salvando no Supabase", { table: "carriers", id: completeCarrier.id, app_id: APP_ID, company_id: COMPANY_ID });
  const columns = await getCarrierColumns();
  const schemaPayload = carrierPayloadForColumns(completeCarrier, columns);
  console.log("Payload enviado ao Supabase", { table: "carriers", operation: isUpdate ? "update" : "insert", payload: schemaPayload });
  const operation = isUpdate ? "update" : "insert";
  let result = isUpdate
    ? await runSupabase<DbRow>(
        "carriers",
        "update",
        schemaPayload,
        () =>
          requireSupabase()
            .from("carriers")
            .update(schemaPayload)
            .eq("id", completeCarrier.id)
            .eq("company_id", COMPANY_ID)
            .eq("app_id", APP_ID)
            .select("*")
            .maybeSingle()
      )
    : await runSupabase<DbRow>(
        "carriers",
        "insert",
        schemaPayload,
        () => requireSupabase().from("carriers").insert(schemaPayload).select("*").maybeSingle()
      );

  if (result.error) {
    throw new SupabaseOperationError("carriers", operation, schemaPayload, result.error);
  }

  if (!result.data) throw new SupabaseOperationError("carriers", operation, schemaPayload, "Supabase nao retornou a transportadora salva.");
  return rowToCarrier(result.data);
};

export const deleteCarrier = async (id: string) => {
  console.log("Salvando no Supabase", { table: "carriers", action: "delete", id, company_id: COMPANY_ID });
  const result = await runSupabase(
    "carriers",
    "delete",
    { id, app_id: APP_ID, company_id: COMPANY_ID },
    () => requireSupabase().from("carriers").delete().eq("id", id).eq("company_id", COMPANY_ID).eq("app_id", APP_ID)
  );
  if (result.error) {
    if (isForeignKeyError(result.error)) {
      throw new Error("Nao foi possivel excluir esta transportadora porque existem lancamentos vinculados. Desative a transportadora para manter o historico.");
    }
    throw new SupabaseOperationError("carriers", "delete", { id, company_id: COMPANY_ID }, result.error);
  }
  return !result.error;
};

export const saveDailyEntry = async (entry: DailyEntry, carriers: Carrier[] = [], onDebugStep?: (step: SaveDebugStep) => void) => {
  const company = salesCompany;
  const emit = (step: SaveDebugStep) => onDebugStep?.(step);
  const normalizedDate = normalizeEntryDate(entry.date);
  const normalizedEntry: DailyEntry = { ...entry, date: normalizedDate };
  const dailyPayload = {
    ...rowCompanyPayload(),
    date: normalizedDate,
    updated_at: new Date().toISOString()
  };

  emit({
    stage: "ETAPA 1 - INICIO_SAVE",
    operation: "saveDailyEntry",
    table: "daily_entries/package_entries",
    date: normalizedDate,
    payload: {
      input_date: entry.date,
      normalized_date: normalizedDate,
      app_id: APP_ID,
      company_id: COMPANY_ID,
      carriers: Object.fromEntries(
        Object.entries(normalizedEntry.carriers || {}).filter(
          ([, input]) => (Number(input.ml) || 0) + (Number(input.shopee) || 0) + (Number(input.avulso) || 0) > 0
        )
      )
    }
  });
  emit({
    stage: "ETAPA 1.0 - APOS_EMIT_INICIO_SAVE",
    operation: "saveDailyEntry",
    table: "daily_entries/package_entries",
    date: normalizedDate,
    payload: { input_date: entry.date, normalized_date: normalizedDate, app_id: APP_ID, company_id: COMPANY_ID }
  });
  emit({
    stage: "ETAPA 1.0.1 - ANTES_LOG_DAILY",
    operation: "console.log",
    table: "daily_entries",
    date: normalizedDate,
    payload: dailyPayload
  });
  console.log("TENTANDO_SALVAR_DAILY_ENTRIES", { table: "daily_entries", operation: "save", payload: dailyPayload });
  emit({
    stage: "ETAPA 1.0.2 - DEPOIS_LOG_DAILY",
    operation: "console.log",
    table: "daily_entries",
    date: normalizedDate,
    payload: dailyPayload
  });
  const existingDailyPayload = { app_id: APP_ID, company_id: COMPANY_ID, input_date: entry.date, normalized_date: normalizedDate };
  emit({
    stage: "ETAPA 1.0.3 - PAYLOAD_BUSCA_DAILY_PRONTO",
    operation: "montar_payload",
    table: "daily_entries",
    date: normalizedDate,
    payload: existingDailyPayload
  });
  emit({
    stage: "ETAPA 1.0.4 - ANTES_WRAPPER_BUSCAR_DAILY",
    operation: "runSaveDiagnosticStep",
    table: "daily_entries",
    date: normalizedDate,
    payload: existingDailyPayload
  });
  const existingResult = await runSaveDiagnosticStep<DbRow[]>(
    emit,
    {
      beforeStage: "ETAPA 1.1 - ANTES_BUSCAR_DAILY",
      afterStage: "ETAPA 1.2 - DEPOIS_BUSCAR_DAILY",
      table: "daily_entries",
      operation: "select_before_save",
      date: normalizedDate,
      payload: existingDailyPayload
    },
    () =>
      runSupabase<DbRow[]>(
        "daily_entries",
        "select_before_save",
        existingDailyPayload,
        () => selectDailyEntryByDate(normalizedDate),
        { throwOnError: true }
      )
  );
  const existing = ((existingResult.data || []) as DbRow[])
    .filter((row) => companyMatches(row, company) && rowDate(row) === normalizedDate)
    .sort((first, second) => rowTimestamp(second) - rowTimestamp(first))[0];

  const dailyOperation = existing?.id ? "update" : "insert";
  const dailyOperationPayload = existing?.id ? { id: text(existing, ["id"]), ...dailyPayload } : { id: "generated", ...dailyPayload };
  let dailyResult: SupabaseResult<DbRow>;
  try {
    dailyResult = existing?.id
      ? await runSaveDiagnosticStep<DbRow>(
          emit,
          {
            beforeStage: "ETAPA 2 - ANTES_SALVAR_DAILY",
            afterStage: "ETAPA 2.1 - DEPOIS_SALVAR_DAILY",
            table: "daily_entries",
            operation: "update",
            date: normalizedDate,
            id: text(existing, ["id"]),
            payload: dailyOperationPayload
          },
          () =>
            runSupabase<DbRow>(
              "daily_entries",
              "update",
              dailyOperationPayload,
              () =>
                requireSupabase()
                  .from("daily_entries")
                  .update(dailyPayload)
                  .eq("id", text(existing, ["id"]))
                  .eq("company_id", COMPANY_ID)
                  .eq("app_id", APP_ID)
                  .select("*")
                  .maybeSingle(),
              { throwOnError: true }
            )
        )
      : await runSaveDiagnosticStep<DbRow>(
          emit,
          {
            beforeStage: "ETAPA 2 - ANTES_SALVAR_DAILY",
            afterStage: "ETAPA 2.1 - DEPOIS_SALVAR_DAILY",
            table: "daily_entries",
            operation: "insert",
            date: normalizedDate,
            payload: dailyOperationPayload
          },
          () =>
            runSupabase<DbRow>(
              "daily_entries",
              "insert",
              dailyOperationPayload,
              () => requireSupabase().from("daily_entries").insert({ id: makeId(), ...dailyPayload }).select("*").maybeSingle(),
              { throwOnError: true }
            )
        );
  } catch (error) {
    emit({ stage: "ETAPA 2.1 - DEPOIS_SALVAR_DAILY - ERRO", table: "daily_entries", operation: dailyOperation, date: normalizedDate, payload: dailyOperationPayload, error: serializableError(error) });
    throw error;
  }

  const dailyId = text((dailyResult.data || existing || {}) as DbRow, ["id"]);
  if (!dailyId) throw new Error("Nao foi possivel identificar o lancamento diario salvo.");

  const rows = Object.entries(entry.carriers || {}).map(([carrierId, input]) => packageRow(dailyId, carrierId, input));

  console.log("TENTANDO_SALVAR_PACKAGE_ENTRIES", {
    table: "package_entries",
    operation: "replace_for_daily_entry",
    input_date: entry.date,
    normalized_date: normalizedDate,
    daily_entry_id: dailyId,
    records: rows.length,
    payload: rows.map((row) => packageDebugPayload(row, carriers))
  });

  const existingPackagesPayload = { daily_entry_id: dailyId, app_id: APP_ID, company_id: COMPANY_ID, date: entry.date, normalized_date: normalizedDate };
  const existingPackagesResult = await runSaveDiagnosticStep<DbRow[]>(
    emit,
    {
      beforeStage: "ETAPA 3 - ANTES_BUSCAR_PACKAGE",
      afterStage: "ETAPA 3.1 - DEPOIS_BUSCAR_PACKAGE",
      table: "package_entries",
      operation: "select_before_replace",
      date: normalizedDate,
      id: dailyId,
      payload: existingPackagesPayload
    },
    () =>
      runSupabase<DbRow[]>(
        "package_entries",
        "select_before_replace",
        existingPackagesPayload,
        () => selectPackageEntriesByDailyId(dailyId),
        { throwOnError: true }
      )
  );
  const existingPackages = ((existingPackagesResult.data || []) as DbRow[]).filter((row) => companyMatches(row, company));

  for (const row of rows) {
    const existingPackage = latestPackageForCarrier(existingPackages, String(row.carrier_id));
    const packagePayload = {
      ...rowCompanyPayload(),
      daily_entry_id: dailyId,
      carrier_id: row.carrier_id,
      ml: row.ml,
      shopee: row.shopee,
      avulso: row.avulso,
      updated_at: row.updated_at
    };

    if (existingPackage?.id) {
      const packageOperationPayload = { id: text(existingPackage, ["id"]), date: normalizedDate, ...packagePayload };
      try {
        await runSaveDiagnosticStep(
          emit,
          {
            beforeStage: "ETAPA 4 - ANTES_PATCH_PACKAGE",
            afterStage: "ETAPA 4.1 - DEPOIS_PATCH_PACKAGE",
            table: "package_entries",
            operation: "update",
            date: normalizedDate,
            id: text(existingPackage, ["id"]),
            payload: packageOperationPayload
          },
          () =>
            runSupabase(
              "package_entries",
              "update",
              packageOperationPayload,
              () =>
                requireSupabase()
                  .from("package_entries")
                  .update(packagePayload)
                  .eq("id", text(existingPackage, ["id"]))
                  .eq("company_id", COMPANY_ID)
                  .eq("app_id", APP_ID)
                  .select("*"),
              { throwOnError: true }
            )
        );
      } catch (error) {
        emit({ stage: "ETAPA 4.1 - DEPOIS_PATCH_PACKAGE - ERRO", table: "package_entries", operation: "update", date: normalizedDate, id: text(existingPackage, ["id"]), payload: packageOperationPayload, error: serializableError(error) });
        throw error;
      }
    } else {
      const packageOperationPayload = { date: normalizedDate, ...packageDebugPayload(row, carriers) };
      try {
        await runSaveDiagnosticStep(
          emit,
          {
            beforeStage: "ETAPA 4 - ANTES_PATCH_PACKAGE",
            afterStage: "ETAPA 4.1 - DEPOIS_PATCH_PACKAGE",
            table: "package_entries",
            operation: "insert",
            date: normalizedDate,
            id: String(row.carrier_id),
            payload: packageOperationPayload
          },
          () =>
            runSupabase(
              "package_entries",
              "insert",
              packageOperationPayload,
              () => requireSupabase().from("package_entries").insert(row).select("*"),
              { throwOnError: true }
            )
        );
      } catch (error) {
        emit({ stage: "ETAPA 4.1 - DEPOIS_PATCH_PACKAGE - ERRO", table: "package_entries", operation: "insert", date: normalizedDate, id: String(row.carrier_id), payload: packageOperationPayload, error: serializableError(error) });
        throw error;
      }
    }

    const confirmationPayload = { input_date: entry.date, normalized_date: normalizedDate, daily_entry_id: dailyId, carrier_id: row.carrier_id, app_id: APP_ID, company_id: COMPANY_ID };
    const confirmedResult = await runSaveDiagnosticStep<DbRow[]>(
      emit,
      {
        beforeStage: "ETAPA 5 - ANTES_CONFIRMACAO",
        afterStage: "ETAPA 5.1 - DEPOIS_CONFIRMACAO",
        table: "package_entries",
        operation: "confirm_by_daily_entry_and_carrier",
        date: normalizedDate,
        id: String(row.carrier_id),
        payload: confirmationPayload
      },
      () =>
        runSupabase<DbRow[]>(
          "package_entries",
          "confirm_by_daily_entry_and_carrier",
          confirmationPayload,
          () => selectConfirmedPackageEntry(dailyId, String(row.carrier_id)),
          { throwOnError: true }
        )
    );
    const confirmedRow = latestPackageForCarrier((confirmedResult.data || []) as DbRow[], String(row.carrier_id));
    const confirmedMatches =
      confirmedRow &&
      num(confirmedRow, ["ml", "mercado_livre", "ml_count", "quantidade_ml"]) === Number(row.ml) &&
      num(confirmedRow, ["shopee", "shopee_count", "quantidade_shopee"]) === Number(row.shopee) &&
      num(confirmedRow, ["avulso", "avulso_count", "quantidade_avulso"]) === Number(row.avulso);
    if (!confirmedMatches) {
      throw new Error(
        `Erro: o Supabase nao confirmou a persistencia do lancamento. Data: ${entry.date}. Transportadora: ${
          packageDebugPayload(row, carriers).carrier_name
        }.`
      );
    }
    emit({
      stage: "ETAPA 5.2 - CONFIRMACAO_REGISTROS",
      operation: "select",
      table: "package_entries",
      date: normalizedDate,
      id: String(row.carrier_id),
      payload: { input_date: entry.date, normalized_date: normalizedDate, daily_entry_id: dailyId, carrier_id: row.carrier_id, app_id: APP_ID, company_id: COMPANY_ID },
      status: confirmedResult.status,
      statusText: confirmedResult.statusText,
      data: confirmedResult.data,
      records: ((confirmedResult.data || []) as DbRow[]).map((item) => ({
        id: text(item, ["id"]),
        date: normalizedDate,
        carrier_id: text(item, ["carrier_id", "transportadora_id"]),
        carrier_name: packageDebugPayload(row, carriers).carrier_name,
        ml: num(item, ["ml", "mercado_livre", "ml_count", "quantidade_ml"]),
        shopee: num(item, ["shopee", "shopee_count", "quantidade_shopee"]),
        avulso: num(item, ["avulso", "avulso_count", "quantidade_avulso"]),
        app_id: text(item, ["app_id"]),
        company_id: text(item, ["company_id", "id_da_empresa"])
      }))
    });
  }

  emit({
    stage: "ETAPA 5.3 - DELETE_STALE_NAO_EXECUTADO",
    operation: "preservar_historico",
    table: "package_entries",
    date: normalizedDate,
    id: dailyId,
    payload: {
      motivo: "O salvamento atual nao apaga package_entries antigos nem duplicidades historicas.",
      app_id: APP_ID,
      company_id: COMPANY_ID,
      daily_entry_id: dailyId
    }
  });

  const freshEntry = await runTimedDiagnosticStep(
    emit,
    {
      beforeStage: "ETAPA 5.5 - ANTES_RECARREGAR_DIA",
      afterStage: "ETAPA 5.6 - DEPOIS_RECARREGAR_DIA",
      table: "daily_entries/package_entries",
      operation: "loadEntryByDate",
      date: normalizedDate,
      id: dailyId,
      payload: { input_date: entry.date, normalized_date: normalizedDate, daily_entry_id: dailyId, app_id: APP_ID, company_id: COMPANY_ID }
    },
    () => loadEntryByDate(normalizedDate)
  );
  if (!freshEntry) throw new Error(`Lancamento de ${normalizedDate} nao foi encontrado no Supabase apos salvar.`);
  const expectedRows = rows;
  const confirmedRows = expectedRows.filter((row) => {
    const confirmedInput = freshEntry.carriers[String(row.carrier_id)];
    return (
      confirmedInput &&
      Number(confirmedInput.ml) === Number(row.ml) &&
      Number(confirmedInput.shopee) === Number(row.shopee) &&
      Number(confirmedInput.avulso) === Number(row.avulso)
    );
  });
  console.log("CONFIRMACAO_NO_SUPABASE", {
    input_date: entry.date,
    normalized_date: normalizedDate,
    app_id: APP_ID,
    company_id: COMPANY_ID,
    expected_package_entries: expectedRows.length,
    confirmed_package_entries: confirmedRows.length,
    freshEntry
  });
  if (confirmedRows.length !== expectedRows.length) {
    throw new Error(`Supabase nao confirmou todos os pacotes do lancamento de ${normalizedDate}. Esperado: ${expectedRows.length}. Confirmado: ${confirmedRows.length}.`);
  }
  emit({
    stage: "ETAPA 6 - SAVE_CONCLUIDO",
    operation: "saveDailyEntry",
    table: "daily_entries/package_entries",
    date: normalizedDate,
    id: dailyId,
    payload: { input_date: entry.date, normalized_date: normalizedDate, app_id: APP_ID, company_id: COMPANY_ID },
    data: freshEntry
  });
  return freshEntry;
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
  await runSupabase(
    "fixed_costs",
    "delete",
    { id, app_id: APP_ID, company_id: COMPANY_ID },
    () => requireSupabase().from("fixed_costs").delete().eq("id", id).eq("company_id", COMPANY_ID).eq("app_id", APP_ID),
    { throwOnError: true }
  );
};
