export type Channel = "ml" | "shopee" | "avulso";

export type Carrier = {
  id: string;
  name: string;
  rates: Record<Channel, number>;
  active: boolean;
};

export type DailyCarrierInput = Record<Channel, number>;

export type DailyEntry = {
  date: string;
  carriers: Record<string, DailyCarrierInput>;
};

export type SaveDebugStatus = "waiting" | "running" | "success" | "error" | "timeout";

export type SaveDebugStage = "ETAPA 1 - INÍCIO" | "ETAPA 2 - DAILY_ENTRIES" | "ETAPA 3 - PACKAGE_ENTRIES" | "ETAPA 4 - CONFIRMAÇÃO";

export type SaveDebugStep = {
  stage: SaveDebugStage;
  status: SaveDebugStatus;
  label: string;
  operation?: string;
  table?: string;
  payload?: unknown;
  httpStatus?: number;
  statusText?: string;
  data?: unknown;
  error?: unknown;
  records?: unknown;
  elapsedMs?: number;
  timestamp: string;
};

export type FixedCost = {
  id: string;
  description: string;
  category: string;
  amount: number;
  fortnight: "first" | "second";
  month: string;
};

export type CarrierSummary = {
  carrierId: string;
  carrierName: string;
  rates: Record<Channel, number>;
  ml: number;
  shopee: number;
  avulso: number;
  totalPackages: number;
  totalRevenue: number;
  partnerRevenue: number;
  difference: number;
  logManager: number;
};

export type PeriodSummary = {
  label: string;
  start: string;
  end: string;
  rows: CarrierSummary[];
  totals: Omit<CarrierSummary, "carrierId" | "carrierName" | "rates">;
};

export type DailyEvolution = {
  date: string;
  packages: number;
  revenue: number;
  difference: number;
};

export type CostSummary = {
  fixedCosts: number;
  logManager: number;
  logManagerByCarrier: { carrierId: string; carrierName: string; packages: number; value: number }[];
  total: number;
  packages: number;
};
