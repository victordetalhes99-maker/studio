import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportFilterState } from "../types";
import type { TattooArtistPerformance } from "../types";
import { buildFileName, dashNum, filtersDescription, nowPtBr, periodLabel } from "./format";

const GOLD: [number, number, number] = [201, 162, 39];
const BLACK: [number, number, number] = [17, 17, 17];
const GRAPHITE: [number, number, number] = [60, 60, 60];

export function exportTattooArtistsPdf(
  rows: TattooArtistPerformance[],
  filters: ReportFilterState,
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, pageWidth, 68, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 68, pageWidth, 2, "F");

  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("85 TATTOO", 40, 32);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("Relatório de desempenho dos tatuadores", 40, 52);

  doc.setTextColor(...GRAPHITE);
  doc.setFontSize(9);
  const infoY = 90;
  const infoLines = [
    `Gerado em: ${nowPtBr()}`,
    ...filtersDescription(filters),
    `Profissionais encontrados: ${rows.length}`,
  ];
  infoLines.forEach((line, i) => doc.text(line, 40, infoY + i * 12));

  const startY = infoY + infoLines.length * 12 + 10;

  const head = [
    [
      "Tatuador",
      "Status",
      "Hoje",
      "Período",
      "Novos",
      "Recorrentes",
      "Fichas",
      "Contratos",
      "Última atividade",
    ],
  ];

  const body = rows.map((r) => [
    r.nome,
    r.status,
    dashNum(r.clientesHoje),
    dashNum(r.clientesPeriodo),
    dashNum(r.clientesNovos),
    dashNum(r.clientesRecorrentes),
    dashNum(r.fichasConcluidas),
    dashNum(r.contratosAssinados),
    r.ultimaAtividade ? new Date(r.ultimaAtividade).toLocaleString("pt-BR") : "—",
  ]);

  autoTable(doc, {
    head,
    body,
    startY,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 6, textColor: BLACK },
    headStyles: { fillColor: BLACK, textColor: GOLD, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 246, 240] },
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      const p = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(...GRAPHITE);
      doc.text(
        `Gerado pelo sistema 85 Tattoo — página ${p}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 16,
        { align: "center" },
      );
    },
  });

  if (rows.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(...GRAPHITE);
    doc.text("Nenhum dado disponível para os filtros selecionados.", 40, startY + 20);
  }

  const anyNumeric = rows.some(
    (r) =>
      r.clientesHoje !== null ||
      r.clientesPeriodo !== null ||
      r.clientesNovos !== null ||
      r.clientesRecorrentes !== null ||
      r.fichasConcluidas !== null ||
      r.contratosAssinados !== null,
  );
  if (rows.length > 0 && !anyNumeric) {
    const y =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY;
    doc.setFontSize(9);
    doc.setTextColor(...GRAPHITE);
    doc.text("Os dados de atendimento ainda não estão disponíveis.", 40, y + 20);
  }

  doc.save(buildFileName("relatorio-tatuadores", filters.period, "pdf"));
}
