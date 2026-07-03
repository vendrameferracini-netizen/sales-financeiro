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
  total: number;
  packages: number;
};
