import * as XLSX from "xlsx";
import { PeriodSummary } from "../types";
import { CarrierReportType, CarrierTransportReport, carrierReportFileName } from "./carrierReport";
import { formatDate } from "./dates";
import { currency } from "./format";

const money = (value: number) => Number((Number.isFinite(value) ? value : 0).toFixed(2));

const sheetName = (name: string) =>
  name
    .replace(/[\\/?*[\]:]/g, " ")
    .trim()
    .slice(0, 31) || "Transportadora";

const uniqueSheetName = (baseName: string, usedNames: Set<string>) => {
  const base = sheetName(baseName);
  let name = base;
  let counter = 2;
  while (usedNames.has(name)) {
    const suffix = ` ${counter}`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    counter += 1;
  }
  usedNames.add(name);
  return name;
};

export const exportGeneralExcel = (summary: PeriodSummary, reportType: string) => {
  const rows = summary.rows.filter((row) => row.totalPackages > 0);
  if (!rows.length) {
    alert("Nenhum dado encontrado para exportar.");
    return;
  }

  const workbook = XLSX.utils.book_new();
  const period = `${formatDate(summary.start)} a ${formatDate(summary.end)}`;
  const issuedAt = new Date().toLocaleString("pt-BR");

  const generalRows = [
    ["FINANCEIRO SALLES"],
    [`Relatorio: ${reportType}`],
    [`Periodo: ${period}`],
    [`Emissao: ${issuedAt}`],
    [],
    [
      "Transportadora",
      "ML",
      "Valor ML",
      "Shopee",
      "Valor Shopee",
      "Avulso",
      "Valor Avulso",
      "Total Pacotes",
      "Receita Total",
      "Receita Parceria",
      "Diferenca"
    ],
    ...rows.map((row) => [
      row.carrierName,
      row.ml,
      money(row.rates.ml),
      row.shopee,
      money(row.rates.shopee),
      row.avulso,
      money(row.rates.avulso),
      row.totalPackages,
      money(row.totalRevenue),
      money(row.partnerRevenue),
      money(row.difference)
    ]),
    [],
    [
      "TOTAL GERAL",
      summary.totals.ml,
      "",
      summary.totals.shopee,
      "",
      summary.totals.avulso,
      "",
      summary.totals.totalPackages,
      money(summary.totals.totalRevenue),
      money(summary.totals.partnerRevenue),
      money(summary.totals.difference)
    ]
  ];

  const generalSheet = XLSX.utils.aoa_to_sheet(generalRows);
  generalSheet["!cols"] = [
    { wch: 24 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 }
  ];
  const usedSheetNames = new Set(["Geral"]);
  XLSX.utils.book_append_sheet(workbook, generalSheet, "Geral");

  rows.forEach((row) => {
    const carrierRows = [
      ["FINANCEIRO SALLES"],
      [`Transportadora: ${row.carrierName}`],
      [`Relatorio: ${reportType}`],
      [`Periodo: ${period}`],
      [`Emissao: ${issuedAt}`],
      [],
      ["Plataforma", "Quantidade", "Valor Unitario", "Total"],
      ["Mercado Livre", row.ml, money(row.rates.ml), money(row.ml * row.rates.ml)],
      ["Shopee", row.shopee, money(row.rates.shopee), money(row.shopee * row.rates.shopee)],
      ["Avulso", row.avulso, money(row.rates.avulso), money(row.avulso * row.rates.avulso)],
      [],
      ["Total Pacotes", row.totalPackages],
      ["Valor total cheio", currency(row.totalRevenue)]
    ];
    const carrierSheet = XLSX.utils.aoa_to_sheet(carrierRows);
    carrierSheet["!cols"] = [{ wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(workbook, carrierSheet, uniqueSheetName(row.carrierName, usedSheetNames));
  });

  XLSX.writeFile(workbook, `financeiro-salles-${reportType.toLowerCase()}-fechamento.xlsx`);
};

export const exportSelectedCarrierExcel = (report: CarrierTransportReport, reportType: CarrierReportType) => {
  if (report.totals.totalPackages <= 0) {
    alert("Nenhum dado encontrado para exportar.");
    return;
  }

  const workbook = XLSX.utils.book_new();
  const issuedAt = new Date().toLocaleString("pt-BR");
  const rows =
    reportType === "summary"
      ? [
          ["FINANCEIRO SALLES"],
          [`Transportadora: ${report.carrier.name}`],
          [`Periodo: ${report.periodLabel}`],
          [`Emissao: ${issuedAt}`],
          [],
          ["Campo", "Valor"],
          ["Total Mercado Livre", report.totals.ml],
          ["Total Shopee", report.totals.shopee],
          ["Total Avulso", report.totals.avulso],
          ["Total de pacotes", report.totals.totalPackages],
          ["Valor unitario ML", money(report.carrier.rates.ml)],
          ["Valor unitario Shopee", money(report.carrier.rates.shopee)],
          ["Valor unitario Avulso", money(report.carrier.rates.avulso)],
          ["Valor total cheio", money(report.totals.totalRevenue)]
        ]
      : [
          ["FINANCEIRO SALLES"],
          [`Transportadora: ${report.carrier.name}`],
          [`Periodo: ${report.periodLabel}`],
          [`Emissao: ${issuedAt}`],
          [],
          ["Data", "Mercado Livre", "Shopee", "Avulso", "Total de pacotes", "Valor total do dia"],
          ...report.days.map((row) => [formatDate(row.date), row.ml, row.shopee, row.avulso, row.totalPackages, money(row.totalRevenue)]),
          [],
          ["TOTAL", report.totals.ml, report.totals.shopee, report.totals.avulso, report.totals.totalPackages, money(report.totals.totalRevenue)]
        ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName(report.carrier.name));
  XLSX.writeFile(workbook, carrierReportFileName(report, "xlsx"));
};
