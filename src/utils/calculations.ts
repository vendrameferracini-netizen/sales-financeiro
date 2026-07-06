import { LOG_MANAGER_PACKAGE_RATE, partnerRates } from "../data/carriers";
import { Carrier, CarrierSummary, CostSummary, DailyEntry, DailyEvolution, FixedCost, PeriodSummary } from "../types";
import { daysBetween } from "./dates";
import { safeInt } from "./format";

export const blankCarrierInput = () => ({ ml: 0, shopee: 0, avulso: 0 });

export const normalizeCarrierInput = (input?: Partial<ReturnType<typeof blankCarrierInput>>) => ({
  ml: safeInt(input?.ml),
  shopee: safeInt(input?.shopee),
  avulso: safeInt(input?.avulso)
});

export const getCarrierDailyValue = (carriers: Carrier[], carrierId: string, input = blankCarrierInput()) => {
  const carrier = carriers.find((item) => item.id === carrierId);
  if (!carrier) return 0;
  return input.ml * carrier.rates.ml + input.shopee * carrier.rates.shopee + input.avulso * carrier.rates.avulso;
};

export const getPartnerRevenue = (input = blankCarrierInput()) =>
  input.ml * partnerRates.ml + input.shopee * partnerRates.shopee + input.avulso * partnerRates.avulso;

export const getPackageTotal = (input = blankCarrierInput()) => safeInt(input.ml) + safeInt(input.shopee) + safeInt(input.avulso);

export const buildDailyFullValueReport = (carrierInputs: Record<string, DailyEntry["carriers"][string]> = {}, carriers: Carrier[] = []) => {
  const rows = carriers
    .map((carrier) => {
      const input = normalizeCarrierInput(carrierInputs[carrier.id]);
      const totalPackages = getPackageTotal(input);
      const valueMl = input.ml * carrier.rates.ml;
      const valueShopee = input.shopee * carrier.rates.shopee;
      const valueAvulso = input.avulso * carrier.rates.avulso;
      return {
        carrierId: carrier.id,
        carrierName: carrier.name,
        ml: input.ml,
        shopee: input.shopee,
        avulso: input.avulso,
        totalPackages,
        valueMl,
        valueShopee,
        valueAvulso,
        totalValue: valueMl + valueShopee + valueAvulso
      };
    })
    .filter((row) => row.totalPackages > 0);

  const totals = rows.reduce(
    (acc, row) => ({
      ml: acc.ml + row.ml,
      shopee: acc.shopee + row.shopee,
      avulso: acc.avulso + row.avulso,
      totalPackages: acc.totalPackages + row.totalPackages,
      valueMl: acc.valueMl + row.valueMl,
      valueShopee: acc.valueShopee + row.valueShopee,
      valueAvulso: acc.valueAvulso + row.valueAvulso,
      totalValue: acc.totalValue + row.totalValue
    }),
    { ml: 0, shopee: 0, avulso: 0, totalPackages: 0, valueMl: 0, valueShopee: 0, valueAvulso: 0, totalValue: 0 }
  );

  return { rows, totals };
};

export const buildPeriodSummary = (
  entries: Record<string, DailyEntry>,
  carriers: Carrier[],
  start: string,
  end: string,
  label: string
): PeriodSummary => {
  const rows: CarrierSummary[] = carriers.map((carrier) => {
    const sums = daysBetween(start, end).reduce(
      (acc, date) => {
        const input = normalizeCarrierInput(entries[date]?.carriers?.[carrier.id]);
        acc.ml += input.ml;
        acc.shopee += input.shopee;
        acc.avulso += input.avulso;
        acc.totalRevenue += getCarrierDailyValue(carriers, carrier.id, input);
        acc.partnerRevenue += getPartnerRevenue(input);
        return acc;
      },
      { ml: 0, shopee: 0, avulso: 0, totalRevenue: 0, partnerRevenue: 0 }
    );
    const totalPackages = sums.ml + sums.shopee + sums.avulso;
    return {
      carrierId: carrier.id,
      carrierName: carrier.name,
      rates: carrier.rates,
      ml: sums.ml,
      shopee: sums.shopee,
      avulso: sums.avulso,
      totalPackages,
      totalRevenue: sums.totalRevenue,
      partnerRevenue: sums.partnerRevenue,
      difference: sums.totalRevenue - sums.partnerRevenue
    };
  });

  const totals = rows.reduce(
    (acc, row) => ({
      ml: acc.ml + row.ml,
      shopee: acc.shopee + row.shopee,
      avulso: acc.avulso + row.avulso,
      totalPackages: acc.totalPackages + row.totalPackages,
      totalRevenue: acc.totalRevenue + row.totalRevenue,
      partnerRevenue: acc.partnerRevenue + row.partnerRevenue,
      difference: acc.difference + row.difference
    }),
    { ml: 0, shopee: 0, avulso: 0, totalPackages: 0, totalRevenue: 0, partnerRevenue: 0, difference: 0 }
  );

  return { label, start, end, rows, totals };
};

export const buildDailyEvolution = (entries: Record<string, DailyEntry>, carriers: Carrier[], start: string, end: string): DailyEvolution[] =>
  daysBetween(start, end).map((date) => {
    const summary = buildPeriodSummary(entries, carriers, date, date, date).totals;
    return { date, packages: summary.totalPackages, revenue: summary.totalRevenue, difference: summary.difference };
  });

export const getCostSummary = (
  fixedCosts: FixedCost[],
  period: PeriodSummary,
  month: string,
  fortnight?: "first" | "second"
): CostSummary => {
  const filtered = (fixedCosts || []).filter((cost) => cost.month === month && (!fortnight || cost.fortnight === fortnight));
  const fixedTotal = filtered.reduce((sum, cost) => sum + (Number.isFinite(cost.amount) ? cost.amount : 0), 0);
  const logManager = period.totals.totalPackages * LOG_MANAGER_PACKAGE_RATE;
  return {
    fixedCosts: fixedTotal,
    logManager,
    total: fixedTotal + logManager,
    packages: period.totals.totalPackages
  };
};

export const hasSummaryData = (summary: PeriodSummary) => summary.rows.some((row) => row.totalPackages > 0);
