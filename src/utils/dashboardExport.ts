import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { DashboardReport, dashboardReportFileName } from "./dashboardReport";
import { formatDate } from "./dates";
import { currency } from "./format";

const money = (value: number) => Number((Number.isFinite(value) ? value : 0).toFixed(2));

const ensureDashboardData = (report: DashboardReport) => {
  if (report.rows.length) return true;
  alert("Nenhum dado encontrado para exportar.");
  return false;
};

const drawDashboardChart = (doc: jsPDF, report: DashboardReport, startY: number) => {
  const chartX = 16;
  const chartY = startY;
  const chartW = 178;
  const chartH = 54;
  const maxValue = Math.max(1, ...report.rows.flatMap((row) => [row.ml, row.shopee, row.avulso]));
  const visibleRows = report.rows.slice(0, 18);
  const groupWidth = chartW / Math.max(1, visibleRows.length);
  const barWidth = Math.min(4, groupWidth / 4);

  doc.setDrawColor(5, 5, 5);
  doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Grafico por canal", chartX, chartY - 6);

  visibleRows.forEach((row, index) => {
    const baseX = chartX + index * groupWidth + groupWidth / 2 - barWidth * 1.5;
    const values = [
      { value: row.ml, color: [5, 5, 5] },
      { value: row.shopee, color: [208, 16, 27] },
      { value: row.avulso, color: [120, 120, 120] }
    ];

    values.forEach((item, itemIndex) => {
      const barH = (item.value / maxValue) * chartH;
      doc.setFillColor(item.color[0], item.color[1], item.color[2]);
      doc.rect(baseX + itemIndex * barWidth, chartY + chartH - barH, barWidth, barH, "F");
    });

    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text(formatDate(row.date).slice(0, 5), baseX - 1, chartY + chartH + 6);
  });

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(8);
  doc.text("ML", chartX, chartY + chartH + 16);
  doc.setFillColor(5, 5, 5);
  doc.rect(chartX + 14, chartY + chartH + 12, 4, 4, "F");
  doc.text("Shopee", chartX + 26, chartY + chartH + 16);
  doc.setFillColor(208, 16, 27);
  doc.rect(chartX + 53, chartY + chartH + 12, 4, 4, "F");
  doc.text("Avulso", chartX + 66, chartY + chartH + 16);
  doc.setFillColor(120, 120, 120);
  doc.rect(chartX + 92, chartY + chartH + 12, 4, 4, "F");
};

export const exportDashboardPdf = (report: DashboardReport) => {
  if (!ensureDashboardData(report)) return;

  const doc = new jsPDF();
  doc.setFillColor(5, 5, 5);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("FINANCEIRO SALLES", 14, 13);
  doc.setTextColor(208, 16, 27);
  doc.setFontSize(11);
  doc.text("DASHBOARD", 14, 21);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.text(report.periodLabel, 118, 21);

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Totais", 14, 40);
  doc.setFont("helvetica", "normal");
  doc.text(`Mercado Livre: ${report.totals.ml}`, 14, 50);
  doc.text(`Shopee: ${report.totals.shopee}`, 64, 50);
  doc.text(`Avulso: ${report.totals.avulso}`, 110, 50);
  doc.text(`Pacotes: ${report.totals.totalPackages}`, 150, 50);
  doc.text(`Valor total recebido: ${currency(report.totals.totalValue)}`, 14, 60);

  drawDashboardChart(doc, report, 82);

  let y = 160;
  doc.setFont("helvetica", "bold");
  doc.text("Data", 14, y);
  doc.text("ML", 68, y, { align: "right" });
  doc.text("Shopee", 96, y, { align: "right" });
  doc.text("Avulso", 126, y, { align: "right" });
  doc.text("Total", 160, y, { align: "right" });
  doc.text("Valor", 196, y, { align: "right" });
  doc.setFont("helvetica", "normal");

  report.rows.forEach((row, index) => {
    y += 8;
    if (y > 280) {
      doc.addPage();
      y = 24;
    }
    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(10, y - 5, 190, 8, "F");
    }
    doc.text(formatDate(row.date), 14, y);
    doc.text(String(row.ml), 68, y, { align: "right" });
    doc.text(String(row.shopee), 96, y, { align: "right" });
    doc.text(String(row.avulso), 126, y, { align: "right" });
    doc.text(String(row.totalPackages), 160, y, { align: "right" });
    doc.text(currency(row.totalValue), 196, y, { align: "right" });
  });

  doc.save(dashboardReportFileName(report, "pdf"));
};

export const exportDashboardExcel = (report: DashboardReport) => {
  if (!ensureDashboardData(report)) return;

  const workbook = XLSX.utils.book_new();
  const maxValue = Math.max(1, ...report.rows.flatMap((row) => [row.ml, row.shopee, row.avulso]));
  const bar = (value: number) => (value > 0 ? "|".repeat(Math.max(1, Math.round((value / maxValue) * 28))) : "");
  const rows = [
    ["FINANCEIRO SALLES"],
    ["Dashboard"],
    [`Periodo: ${report.periodLabel}`],
    [],
    ["Totais"],
    ["Mercado Livre", report.totals.ml],
    ["Shopee", report.totals.shopee],
    ["Avulso", report.totals.avulso],
    ["Total Geral de Pacotes", report.totals.totalPackages],
    ["Valor Total Recebido", money(report.totals.totalValue)],
    [],
    ["Grafico - dados por canal"],
    ["Data", "Mercado Livre", "Shopee", "Avulso"],
    ...report.rows.map((row) => [formatDate(row.date), row.ml, row.shopee, row.avulso]),
    [],
    ["Grafico visual"],
    ["Data", "ML", "Shopee", "Avulso"],
    ...report.rows.map((row) => [formatDate(row.date), bar(row.ml), bar(row.shopee), bar(row.avulso)]),
    [],
    ["Tabela resumida"],
    ["Data", "Mercado Livre", "Shopee", "Avulso", "Total de Pacotes", "Valor Total Recebido"],
    ...report.rows.map((row) => [formatDate(row.date), row.ml, row.shopee, row.avulso, row.totalPackages, money(row.totalValue)]),
    ["TOTAL", report.totals.ml, report.totals.shopee, report.totals.avulso, report.totals.totalPackages, money(report.totals.totalValue)]
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(workbook, sheet, "Dashboard");
  XLSX.writeFile(workbook, dashboardReportFileName(report, "xlsx"));
};
