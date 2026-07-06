import { Carrier, DailyEntry } from "../types";
import { daysBetween, formatDate } from "./dates";
import { getPackageTotal, normalizeCarrierInput } from "./calculations";

export type CarrierReportType = "summary" | "daily";
export type CarrierReportFormat = "pdf" | "excel";

export type CarrierDailyReportRow = {
  date: string;
  ml: number;
  shopee: number;
  avulso: number;
  totalPackages: number;
  totalRevenue: number;
};

export type CarrierTransportReport = {
  carrier: Carrier;
  start: string;
  end: string;
  periodLabel: string;
  days: CarrierDailyReportRow[];
  totals: Omit<CarrierDailyReportRow, "date">;
};

const carrierDayValue = (carrier: Carrier, row: Pick<CarrierDailyReportRow, "ml" | "shopee" | "avulso">) =>
  row.ml * carrier.rates.ml + row.shopee * carrier.rates.shopee + row.avulso * carrier.rates.avulso;

export const buildCarrierTransportReport = (
  entries: Record<string, DailyEntry>,
  carrier: Carrier,
  start: string,
  end: string
): CarrierTransportReport => {
  const days = daysBetween(start, end).map((date) => {
    const input = normalizeCarrierInput(entries[date]?.carriers?.[carrier.id]);
    const row = {
      date,
      ml: input.ml,
      shopee: input.shopee,
      avulso: input.avulso,
      totalPackages: getPackageTotal(input),
      totalRevenue: carrierDayValue(carrier, input)
    };
    return row;
  }).filter((row) => row.totalPackages > 0);

  const totals = days.reduce(
    (acc, row) => ({
      ml: acc.ml + row.ml,
      shopee: acc.shopee + row.shopee,
      avulso: acc.avulso + row.avulso,
      totalPackages: acc.totalPackages + row.totalPackages,
      totalRevenue: acc.totalRevenue + row.totalRevenue
    }),
    { ml: 0, shopee: 0, avulso: 0, totalPackages: 0, totalRevenue: 0 }
  );

  return {
    carrier,
    start,
    end,
    periodLabel: `${formatDate(start)} a ${formatDate(end)}`,
    days,
    totals
  };
};

export const carrierReportFileName = (report: CarrierTransportReport, extension: "pdf" | "xlsx") => {
  const carrierName = report.carrier.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `financeiro-salles-${carrierName}-${report.start}-a-${report.end}.${extension}`;
};
