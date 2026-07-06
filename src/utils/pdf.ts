import jsPDF from "jspdf";
import { PeriodSummary } from "../types";
import { CarrierReportType, CarrierTransportReport, carrierReportFileName } from "./carrierReport";
import { formatDate } from "./dates";
import { currency } from "./format";

const addHeader = (doc: jsPDF, reportType: string, period: string) => {
  doc.setFillColor(5, 5, 5);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("FINANCEIRO SALLES", 14, 13);
  doc.setTextColor(208, 16, 27);
  doc.setFontSize(11);
  doc.text(reportType.toUpperCase(), 14, 21);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.text(period, 118, 21);
};

const addRow = (doc: jsPDF, y: number, cols: string[], fill = false) => {
  if (fill) {
    doc.setFillColor(245, 245, 245);
    doc.rect(10, y - 5, 190, 8, "F");
  }
  const xs = [12, 48, 66, 86, 108, 134, 166, 190];
  cols.forEach((col, index) => doc.text(col, xs[index], y, { align: index >= 1 ? "right" : "left" }));
};

export const exportGeneralPdf = (summary: PeriodSummary, reportType: string) => {
  if (!summary.rows.some((row) => row.totalPackages > 0)) {
    alert("Nenhum dado encontrado para exportar.");
    return;
  }
  const doc = new jsPDF();
  addHeader(doc, reportType, `${formatDate(summary.start)} a ${formatDate(summary.end)}`);
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  let y = 40;
  addRow(doc, y, ["Transportadora", "ML", "Shopee", "Avulso", "Total", "Receita", "Parceria", "Dif."]);
  doc.setFont("helvetica", "normal");
  summary.rows
    .filter((row) => row.totalPackages > 0)
    .forEach((row, index) => {
      y += 8;
      if (y > 278) {
        doc.addPage();
        addHeader(doc, reportType, `${formatDate(summary.start)} a ${formatDate(summary.end)}`);
        y = 40;
      }
      addRow(
        doc,
        y,
        [
          row.carrierName,
          String(row.ml),
          String(row.shopee),
          String(row.avulso),
          String(row.totalPackages),
          currency(row.totalRevenue),
          currency(row.partnerRevenue),
          currency(row.difference)
        ],
        index % 2 === 0
      );
    });
  y += 12;
  doc.setFont("helvetica", "bold");
  addRow(doc, y, [
    "Totais",
    String(summary.totals.ml),
    String(summary.totals.shopee),
    String(summary.totals.avulso),
    String(summary.totals.totalPackages),
    currency(summary.totals.totalRevenue),
    currency(summary.totals.partnerRevenue),
    currency(summary.totals.difference)
  ]);
  doc.save(`financeiro-salles-${reportType.toLowerCase()}-geral.pdf`);
};

export const exportCarrierPdfs = (summary: PeriodSummary, reportType: string) => {
  const rows = summary.rows.filter((row) => row.totalPackages > 0);
  if (!rows.length) {
    alert("Nenhum dado encontrado para exportar.");
    return;
  }
  rows.forEach((row) => {
    const doc = new jsPDF();
    addHeader(doc, `${reportType} - ${row.carrierName}`, `${formatDate(summary.start)} a ${formatDate(summary.end)}`);
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(12);
    const items = [
      ["Transportadora", row.carrierName],
      ["ML", String(row.ml)],
      ["Valor ML", currency(row.rates.ml)],
      ["Shopee", String(row.shopee)],
      ["Valor Shopee", currency(row.rates.shopee)],
      ["Avulso", String(row.avulso)],
      ["Valor Avulso", currency(row.rates.avulso)],
      ["Total de pacotes", String(row.totalPackages)],
      ["Valor total cheio", currency(row.totalRevenue)],
      ["Data de emissao", new Date().toLocaleString("pt-BR")]
    ];
    items.forEach(([label, value], index) => {
      const rowY = 48 + index * 12;
      doc.setFont("helvetica", "bold");
      doc.text(label, 18, rowY);
      doc.setFont("helvetica", "normal");
      doc.text(value, 82, rowY);
    });
    doc.save(`financeiro-salles-${reportType.toLowerCase()}-${row.carrierName.replace(/\W+/g, "-").toLowerCase()}.pdf`);
  });
};

export const exportSelectedCarrierPdf = (report: CarrierTransportReport, reportType: CarrierReportType) => {
  if (report.totals.totalPackages <= 0) {
    alert("Nenhum dado encontrado para exportar.");
    return;
  }

  const doc = new jsPDF();
  addHeader(doc, `Fechamento - ${report.carrier.name}`, report.periodLabel);
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);

  if (reportType === "summary") {
    const items = [
      ["Transportadora", report.carrier.name],
      ["Periodo", report.periodLabel],
      ["Total Mercado Livre", String(report.totals.ml)],
      ["Total Shopee", String(report.totals.shopee)],
      ["Total Avulso", String(report.totals.avulso)],
      ["Total de pacotes", String(report.totals.totalPackages)],
      ["Valor unitario ML", currency(report.carrier.rates.ml)],
      ["Valor unitario Shopee", currency(report.carrier.rates.shopee)],
      ["Valor unitario Avulso", currency(report.carrier.rates.avulso)],
      ["Valor total cheio", currency(report.totals.totalRevenue)]
    ];

    items.forEach(([label, value], index) => {
      const rowY = 46 + index * 12;
      doc.setFont("helvetica", "bold");
      doc.text(label, 18, rowY);
      doc.setFont("helvetica", "normal");
      doc.text(value, 88, rowY);
    });
  } else {
    let y = 42;
    doc.setFont("helvetica", "bold");
    addRow(doc, y, ["Data", "ML", "Shopee", "Avulso", "Total", "Valor"]);
    doc.setFont("helvetica", "normal");

    report.days.forEach((row, index) => {
      y += 8;
      if (y > 276) {
        doc.addPage();
        addHeader(doc, `Fechamento - ${report.carrier.name}`, report.periodLabel);
        y = 42;
        doc.setFont("helvetica", "bold");
        addRow(doc, y, ["Data", "ML", "Shopee", "Avulso", "Total", "Valor"]);
        doc.setFont("helvetica", "normal");
        y += 8;
      }
      addRow(
        doc,
        y,
        [formatDate(row.date), String(row.ml), String(row.shopee), String(row.avulso), String(row.totalPackages), currency(row.totalRevenue)],
        index % 2 === 0
      );
    });

    y += 12;
    doc.setFont("helvetica", "bold");
    addRow(doc, y, [
      "Totais",
      String(report.totals.ml),
      String(report.totals.shopee),
      String(report.totals.avulso),
      String(report.totals.totalPackages),
      currency(report.totals.totalRevenue)
    ]);
  }

  doc.save(carrierReportFileName(report, "pdf"));
};
