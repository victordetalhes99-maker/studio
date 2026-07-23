import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { AttendanceRow, ReportFilterState, TattooArtistDetail } from "../types";
import { buildFileName, dashNum, filtersDescription, nowPtBr, slugify } from "./format";

const GOLD: [number, number, number] = [201, 162, 39];
const BLACK: [number, number, number] = [17, 17, 17];
const GRAPHITE: [number, number, number] = [60, 60, 60];

export function exportTattooArtistDetailPdf(
  detail: TattooArtistDetail,
  filters: ReportFilterState,
  attendances: AttendanceRow[],
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

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
  doc.text(`Relatório individual — ${detail.nome}`, 40, 52);

  doc.setTextColor(...GRAPHITE);
  doc.setFontSize(9);
  const infoY = 90;
  const lines = [
    `Gerado em: ${nowPtBr()}`,
    ...filtersDescription(filters),
    `Status: ${detail.status}`,
    detail.especialidade ? `Especialidade: ${detail.especialidade}` : "Especialidade: —",
  ];
  lines.forEach((l, i) => doc.text(l, 40, infoY + i * 12));

  const metricsStart = infoY + lines.length * 12 + 10;
  autoTable(doc, {
    startY: metricsStart,
    head: [["Métrica", "Valor"]],
    body: [
      ["Clientes hoje", dashNum(detail.clientesHoje)],
      ["Atendimentos no período", dashNum(detail.clientesPeriodo)],
      ["Clientes novos", dashNum(detail.clientesNovos)],
      ["Clientes recorrentes", dashNum(detail.clientesRecorrentes)],
      ["Fichas concluídas", dashNum(detail.fichasConcluidas)],
      ["Contratos assinados", dashNum(detail.contratosAssinados)],
      ["Check-ins no período", dashNum(detail.checkinsPeriodo)],
      ["Pendências", dashNum(detail.pendencias)],
    ],
    styles: { font: "helvetica", fontSize: 9, cellPadding: 5, textColor: BLACK },
    headStyles: { fillColor: BLACK, textColor: GOLD, fontStyle: "bold" },
    margin: { left: 40, right: 40 },
  });

  const afterMetrics =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
    metricsStart;

  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  doc.setFont("helvetica", "bold");
  doc.text("Atendimentos", 40, afterMetrics + 24);
  doc.setFont("helvetica", "normal");

  autoTable(doc, {
    startY: afterMetrics + 32,
    head: [["Cliente", "Data", "Horário", "Tipo", "Status", "Ficha", "Contrato", "Check-in"]],
    body: attendances.map((r) => [
      r.cliente,
      r.data ?? "—",
      r.horario ?? "—",
      r.tipo ?? "—",
      r.status ?? "—",
      r.ficha ? "Sim" : "—",
      r.contrato ? "Sim" : "—",
      r.checkin ? "Sim" : "—",
    ]),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4, textColor: BLACK },
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

  if (attendances.length === 0) {
    const y =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
      afterMetrics + 32;
    doc.setFontSize(9);
    doc.setTextColor(...GRAPHITE);
    doc.text("Nenhum atendimento disponível para os filtros selecionados.", 40, y + 20);
  }

  doc.save(buildFileName(`relatorio-${slugify(detail.nome)}`, filters.period, "pdf"));
}

export function exportTattooArtistDetailXlsx(
  detail: TattooArtistDetail,
  filters: ReportFilterState,
  attendances: AttendanceRow[],
): void {
  // dynamic import to avoid an unused named export cycle; use SheetJS
  import("xlsx").then((XLSX) => {
    const wb = XLSX.utils.book_new();
    const resumo = [
      ["Relatório individual", detail.nome],
      ["Gerado em", nowPtBr()],
      ...filtersDescription(filters).map((l) => l.split(": ") as [string, string]),
      ["Status", detail.status],
      ["Especialidade", detail.especialidade ?? "—"],
      [],
      ["Clientes hoje", detail.clientesHoje ?? "—"],
      ["Atendimentos no período", detail.clientesPeriodo ?? "—"],
      ["Clientes novos", detail.clientesNovos ?? "—"],
      ["Clientes recorrentes", detail.clientesRecorrentes ?? "—"],
      ["Fichas concluídas", detail.fichasConcluidas ?? "—"],
      ["Contratos assinados", detail.contratosAssinados ?? "—"],
      ["Check-ins", detail.checkinsPeriodo ?? "—"],
      ["Pendências", detail.pendencias ?? "—"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(resumo);
    ws["!cols"] = [{ wch: 26 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, "Resumo");

    if (attendances.length > 0) {
      const header = [
        "Cliente",
        "Data",
        "Horário",
        "Tipo",
        "Status",
        "Ficha",
        "Contrato",
        "Check-in",
      ];
      const rows = attendances.map((r) => [
        r.cliente,
        r.data ?? "—",
        r.horario ?? "—",
        r.tipo ?? "—",
        r.status ?? "—",
        r.ficha ? "Sim" : "—",
        r.contrato ? "Sim" : "—",
        r.checkin ? "Sim" : "—",
      ]);
      const wsA = XLSX.utils.aoa_to_sheet([header, ...rows]);
      wsA["!autofilter"] = {
        ref: XLSX.utils.encode_range({
          s: { c: 0, r: 0 },
          e: { c: header.length - 1, r: rows.length },
        }),
      };
      wsA["!cols"] = header.map(() => ({ wch: 18 }));
      XLSX.utils.book_append_sheet(wb, wsA, "Atendimentos");
    }

    XLSX.writeFile(wb, buildFileName(`relatorio-${slugify(detail.nome)}`, filters.period, "xlsx"));
  });
}
