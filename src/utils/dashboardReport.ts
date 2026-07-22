import { Carrier, DailyEntry } from "../types";
import { daysBetween, formatDate } from "./dates";
import { getPackageTotal, normalizeCarrierInput } from "./calculations";

export type DashboardDailyRow = {
  date: string;
  ml: number;
  shopee: number;
  avulso: number;
  totalPackages: number;
  totalValue: number;
};

export type DashboardReport = {
  start: string;
  end: string;
  periodLabel: string;
  rows: DashboardDailyRow[];
  totals: Omit<DashboardDailyRow, "date">;
};

export const buildDashboardReport = (entries: Record<string, DailyEntry>, carriers: Carrier[], start: string, end: string): DashboardReport => {
  const rows = daysBetween(start, end)
    .map((date) => {
      const dailyInputs = entries[date]?.carriers || {};
      const row = carriers.reduce<DashboardDailyRow>(
        (acc, carrier) => {
          const input = normalizeCarrierInput(dailyInputs[carrier.id]);
          acc.ml += input.ml;
          acc.shopee += input.shopee;
          acc.avulso += input.avulso;
          acc.totalPackages += getPackageTotal(input);
          acc.totalValue += input.ml * carrier.rates.ml + input.shopee * carrier.rates.shopee + input.avulso * carrier.rates.avulso;
          return acc;
        },
        { date, ml: 0, shopee: 0, avulso: 0, totalPackages: 0, totalValue: 0 }
      );
      return row;
    })
    .filter((row) => row.totalPackages > 0);

  const totals = rows.reduce(
    (acc, row) => ({
      ml: acc.ml + row.ml,
      shopee: acc.shopee + row.shopee,
      avulso: acc.avulso + row.avulso,
      totalPackages: acc.totalPackages + row.totalPackages,
      totalValue: acc.totalValue + row.totalValue
    }),
    { ml: 0, shopee: 0, avulso: 0, totalPackages: 0, totalValue: 0 }
  );

  return {
    start,
    end,
    periodLabel: `${formatDate(start)} a ${formatDate(end)}`,
    rows,
    totals
  };
};

export const dashboardReportFileName = (report: DashboardReport, extension: "pdf" | "xlsx") =>
  `financeiro-salles-dashboard-${report.start}-a-${report.end}.${extension}`;
