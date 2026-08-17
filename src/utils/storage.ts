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

const errorDetails = (error: unknown) => error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };

const serializableError = (error: unknown) => {
  if (error instanceof DiagnosticTimeoutError) {
    return {
      name: error.name,
      message: error.message,
      table: error.table,
      operation: error.operation,
      payload: error.payload,
      elapsedMs: error.elapsedMs
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

class DiagnosticTimeoutError extends Error {
  name = "DiagnosticTimeoutError";

  constructor(
    public table: string,
    public operation: string,
    public payload: unknown,
    public elapsedMs: number
  ) {
    super(`TIMEOUT em ${table}.${operation} apos ${elapsedMs}ms`);
  }
}

export const formatErrorForScreen = (error: unknown) => {
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

const DEBUG_TIMEOUT_MS = 15000;

const debugTimestamp = () => new Date().toISOString();

const debugStatusForError = (error: unknown) => (error instanceof DiagnosticTimeoutError ? "timeout" : "error");

const runDiagnosticSupabase = async <T,>(
  stage: SaveDebugStep["stage"],
  beforeLabel: string,
  afterLabel: string,
  table: string,
  operation: string,
  payload: unknown,
  request: () => Promise<SupabaseResult<T>>,
  emit?: (step: SaveDebugStep) => void
) => {
  const startedAt = Date.now();
  emit?.({
    stage,
    status: "running",
    label: beforeLabel,
    table,
    operation,
    payload,
    timestamp: debugTimestamp()
  });

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new DiagnosticTimeoutError(table, operation, payload, Date.now() - startedAt)), DEBUG_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([request(), timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    const status = result.error ? "error" : "success";
    emit?.({
      stage,
      status,
      label: afterLabel,
      table,
      operation,
      payload,
      httpStatus: result.status,
      statusText: result.statusText,
      data: result.data,
      error: result.error ? serializableError(result.error) : undefined,
      elapsedMs: Date.now() - startedAt,
      timestamp: debugTimestamp()
    });
    if (result.error) throw new SupabaseOperationError(table, operation, payload, result.error);
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    emit?.({
      stage,
      status: debugStatusForError(error),
      label: error instanceof DiagnosticTimeoutError ? "TIMEOUT" : afterLabel,
      table,
      operation,
      payload,
      error: serializableError(error),
      elapsedMs: Date.now() - startedAt,
      timestamp: debugTimestamp()
    });
    throw error;
  }
};

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

  const carriers = matchingDailyRows.reduce<Record<string, DailyCarrierInput>>((acc, dailyRow) => {
    const dailyId = text(dailyRow, ["id"]);
    const legacyCarriers = (dailyRow.carriers || {}) as Record<string, DailyCarrierInput>;
    Object.entries(legacyCarriers).forEach(([carrierId, input]) => {
      acc[carrierId] = packageInputFromRow(input as unknown as DbRow);
    });

    packageRows
      .filter((row) => text(row, ["daily_entry_id", "entry_id", "daily_id"]) === dailyId)
      .sort((first, second) => rowTimestamp(first) - rowTimestamp(second))
      .forEach((row) => {
        const carrierId = text(row, ["carrier_id", "transportadora_id"]);
        if (carrierId) acc[carrierId] = packageInputFromRow(row);
      });

    return acc;
  }, {});

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
  const dailyPayload = {
    ...rowCompanyPayload(),
    date: normalizedDate,
    updated_at: new Date().toISOString()
  };
  const nonZeroCarriers = Object.fromEntries(
    Object.entries(entry.carriers || {})
      .map(([carrierId, input]) => [carrierId, packageInputFromRow(input as unknown as DbRow)] as const)
      .filter(([, input]) => (Number(input.ml) || 0) + (Number(input.shopee) || 0) + (Number(input.avulso) || 0) > 0)
  );

  emit({
    stage: "ETAPA 1 - INÍCIO",
    status: "success",
    label: "INICIO_SAVE",
    payload: { input_date: entry.date, normalized_date: normalizedDate, app_id: APP_ID, company_id: COMPANY_ID, carriers: nonZeroCarriers },
    timestamp: debugTimestamp()
  });

  console.log("TENTANDO_SALVAR_DAILY_ENTRIES", { table: "daily_entries", operation: "save", payload: dailyPayload });
  const existingResult = await runDiagnosticSupabase<DbRow[]>(
    "ETAPA 2 - DAILY_ENTRIES",
    "ANTES_DAILY_ENTRIES",
    "DEPOIS_DAILY_ENTRIES",
    "daily_entries",
    "select_before_save",
    { app_id: APP_ID, company_id: COMPANY_ID, input_date: entry.date, normalized_date: normalizedDate },
    () =>
      runSupabase<DbRow[]>(
        "daily_entries",
        "select_before_save",
        { app_id: APP_ID, company_id: COMPANY_ID, input_date: entry.date, normalized_date: normalizedDate },
        () => selectDailyEntryByDate(normalizedDate),
        { throwOnError: true }
      ),
    emit
  );
  const existing = ((existingResult.data || []) as DbRow[])
    .filter((row) => companyMatches(row, company) && rowDate(row) === normalizedDate)
    .sort((first, second) => rowTimestamp(second) - rowTimestamp(first))[0];

  const dailyOperation = existing?.id ? "update" : "insert";
  const dailyOperationPayload = existing?.id ? { id: text(existing, ["id"]), ...dailyPayload } : { id: "generated", ...dailyPayload };
  let dailyResult: SupabaseResult<DbRow>;
  dailyResult = existing?.id
    ? await runDiagnosticSupabase<DbRow>(
        "ETAPA 2 - DAILY_ENTRIES",
        "ANTES_DAILY_ENTRIES",
        "DEPOIS_DAILY_ENTRIES",
        "daily_entries",
        "update",
        dailyOperationPayload,
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
          ),
        emit
      )
    : await runDiagnosticSupabase<DbRow>(
        "ETAPA 2 - DAILY_ENTRIES",
        "ANTES_DAILY_ENTRIES",
        "DEPOIS_DAILY_ENTRIES",
        "daily_entries",
        "insert",
        dailyOperationPayload,
        () =>
          runSupabase<DbRow>(
            "daily_entries",
            "insert",
            dailyOperationPayload,
            () => requireSupabase().from("daily_entries").insert({ id: makeId(), ...dailyPayload }).select("*").maybeSingle(),
            { throwOnError: true }
          ),
        emit
      );

  const dailyId = text((dailyResult.data || existing || {}) as DbRow, ["id"]);
  if (!dailyId) throw new Error("Nao foi possivel identificar o lancamento diario salvo.");

  const rows = Object.entries(entry.carriers || {})
    .filter(([, input]) => (Number(input.ml) || 0) + (Number(input.shopee) || 0) + (Number(input.avulso) || 0) > 0)
    .map(([carrierId, input]) => packageRow(dailyId, carrierId, input));

  console.log("TENTANDO_SALVAR_PACKAGE_ENTRIES", {
    table: "package_entries",
    operation: "replace_for_daily_entry",
    input_date: entry.date,
    normalized_date: normalizedDate,
    daily_entry_id: dailyId,
    records: rows.length,
    payload: rows.map((row) => packageDebugPayload(row, carriers))
  });

  const existingPackagesResult = await runDiagnosticSupabase<DbRow[]>(
    "ETAPA 3 - PACKAGE_ENTRIES",
    "ANTES_PACKAGE_ENTRIES",
    "DEPOIS_PACKAGE_ENTRIES",
    "package_entries",
    "select_before_replace",
    { daily_entry_id: dailyId, app_id: APP_ID, company_id: COMPANY_ID, date: entry.date },
    () =>
      runSupabase<DbRow[]>(
        "package_entries",
        "select_before_replace",
        { daily_entry_id: dailyId, app_id: APP_ID, company_id: COMPANY_ID, date: entry.date },
        () => selectPackageEntriesByDailyId(dailyId),
        { throwOnError: true }
      ),
    emit
  );
  const existingPackages = ((existingPackagesResult.data || []) as DbRow[]).filter((row) => companyMatches(row, company));
  const desiredCarrierIds = new Set(rows.map((row) => String(row.carrier_id)));
  const confirmedPackageRows: DbRow[] = [];

  for (const row of rows) {
    const existingPackage = existingPackages.find((item) => text(item, ["carrier_id", "transportadora_id"]) === String(row.carrier_id));
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
      await runDiagnosticSupabase(
        "ETAPA 3 - PACKAGE_ENTRIES",
        "ANTES_PACKAGE_ENTRIES",
        "DEPOIS_PACKAGE_ENTRIES",
        "package_entries",
        "update",
        packageOperationPayload,
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
          ),
        emit
      );
    } else {
      const packageOperationPayload = { date: normalizedDate, ...packageDebugPayload(row, carriers) };
      await runDiagnosticSupabase(
        "ETAPA 3 - PACKAGE_ENTRIES",
        "ANTES_PACKAGE_ENTRIES",
        "DEPOIS_PACKAGE_ENTRIES",
        "package_entries",
        "insert",
        packageOperationPayload,
        () =>
          runSupabase(
            "package_entries",
            "insert",
            packageOperationPayload,
            () => requireSupabase().from("package_entries").insert(row).select("*"),
            { throwOnError: true }
          ),
        emit
      );
    }

    const confirmationPayload = {
      input_date: entry.date,
      normalized_date: normalizedDate,
      daily_entry_id: dailyId,
      carrier_id: row.carrier_id,
      app_id: APP_ID,
      company_id: COMPANY_ID
    };
    const confirmedResult = await runDiagnosticSupabase<DbRow[]>(
      "ETAPA 4 - CONFIRMAÇÃO",
      "ANTES_CONFIRMACAO",
      "DEPOIS_CONFIRMACAO",
      "package_entries",
      "confirm_by_daily_entry_and_carrier",
      confirmationPayload,
      () =>
        runSupabase<DbRow[]>(
          "package_entries",
          "confirm_by_daily_entry_and_carrier",
          confirmationPayload,
          () => selectConfirmedPackageEntry(dailyId, String(row.carrier_id)),
          { throwOnError: true }
        ),
      emit
    );
    const confirmedRow = ((confirmedResult.data || []) as DbRow[]).find(
      (item) =>
        text(item, ["carrier_id", "transportadora_id"]) === String(row.carrier_id) &&
        num(item, ["ml", "mercado_livre", "ml_count", "quantidade_ml"]) === Number(row.ml) &&
        num(item, ["shopee", "shopee_count", "quantidade_shopee"]) === Number(row.shopee) &&
        num(item, ["avulso", "avulso_count", "quantidade_avulso"]) === Number(row.avulso)
    );
    if (!confirmedRow) {
      throw new Error(
        `Erro: o Supabase nao confirmou a persistencia do lancamento. Data: ${entry.date}. Transportadora: ${
          packageDebugPayload(row, carriers).carrier_name
        }.`
      );
    }
    confirmedPackageRows.push(confirmedRow);
    emit({
      stage: "ETAPA 4 - CONFIRMAÇÃO",
      status: "success",
      label: "CONFIRMACAO_NO_SUPABASE",
      table: "package_entries",
      operation: "select",
      payload: confirmationPayload,
      httpStatus: confirmedResult.status,
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
      })),
      timestamp: debugTimestamp()
    });
  }

  const stalePackages = existingPackages.filter((row) => {
    const carrierId = text(row, ["carrier_id", "transportadora_id"]);
    return carrierId && !desiredCarrierIds.has(carrierId);
  });

  for (const stalePackage of stalePackages) {
    await runDiagnosticSupabase(
      "ETAPA 3 - PACKAGE_ENTRIES",
      "ANTES_PACKAGE_ENTRIES",
      "DEPOIS_PACKAGE_ENTRIES",
      "package_entries",
      "delete_stale_for_daily_entry",
      { id: text(stalePackage, ["id"]), daily_entry_id: dailyId, normalized_date: normalizedDate, app_id: APP_ID, company_id: COMPANY_ID },
      () =>
        runSupabase(
          "package_entries",
          "delete_stale_for_daily_entry",
          { id: text(stalePackage, ["id"]), daily_entry_id: dailyId, normalized_date: normalizedDate, app_id: APP_ID, company_id: COMPANY_ID },
          () => requireSupabase().from("package_entries").delete().eq("id", text(stalePackage, ["id"])).eq("company_id", COMPANY_ID).eq("app_id", APP_ID),
          { throwOnError: true }
        ),
      emit
    );
  }

  const freshEntry = buildEntryFromRows(normalizedDate, [((dailyResult.data || existing) as DbRow)], confirmedPackageRows) || { date: normalizedDate, carriers: {} };
  const expectedRows = rows.filter((row) => (Number(row.ml) || 0) + (Number(row.shopee) || 0) + (Number(row.avulso) || 0) > 0);
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
