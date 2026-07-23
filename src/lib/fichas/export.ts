import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { FichaResumo, FichasFilters } from "./index";
import { formatDateBR, TIPO_LABEL, STATUS_LABEL } from "./index";

const GOLD: [number, number, number] = [201, 162, 39];
const BLACK: [number, number, number] = [17, 17, 17];
const GRAPHITE: [number, number, number] = [60, 60, 60];

function now() {
  return new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function fileBase(): string {
  return `85-tattoo-fichas-${new Date().toISOString().slice(0, 10)}`;
}

function filtersLines(f: FichasFilters, total: number): string[] {
  const out: string[] = [];
  if (f.q.trim()) out.push(`Pesquisa: "${f.q.trim()}"`);
  if (f.tipo) out.push(`Tipo: ${TIPO_LABEL[f.tipo]}`);
  if (f.status) out.push(`Status: ${STATUS_LABEL[f.status]}`);
  if (f.risco) out.push(`Risco: ${f.risco === "com" ? "com alertas" : "sem alertas"}`);
  if (f.tatuador) out.push(`Tatuador: ${f.tatuador}`);
  if (f.assinatura) out.push(`Assinatura: ${f.assinatura === "com" ? "presente" : "ausente"}`);
  out.push(`Registros: ${total}`);
  return out;
}

export function exportFichasPdf(rows: FichaResumo[], filters: FichasFilters): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  // Cabeçalho preto/dourado
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, w, 68, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 68, w, 2, "F");

  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("85 TATTOO", 40, 34);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Fichas dos clientes", 40, 54);

  doc.setTextColor(220, 220, 220);
  doc.setFontSize(9);
  doc.text(`Gerado em ${now()}`, w - 40, 34, { align: "right" });

  // Filtros
  doc.setTextColor(...GRAPHITE);
  doc.setFontSize(9);
  const lines = filtersLines(filters, rows.length);
  lines.forEach((l, i) => doc.text(l, 40, 92 + i * 12));

  const startY = 92 + lines.length * 12 + 8;

  autoTable(doc, {
    startY,
    head: [["Cliente", "CPF", "Tatuador", "Tipo", "Status", "Risco", "Assin.", "Data"]],
    body: rows.map((r) => [
      r.clienteNome || "—",
      r.cpfMasked,
      r.tatuador ?? "—",
      TIPO_LABEL[r.tipo],
      STATUS_LABEL[r.status],
      r.risco === "attention" ? "Sim" : "—",
      r.temAssinatura ? "Sim" : "—",
      formatDateBR(r.data),
    ]),
    styles: { fontSize: 9, cellPadding: 6, textColor: GRAPHITE },
    headStyles: { fillColor: BLACK, textColor: GOLD, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: 40, right: 40 },
  });

  // Rodapé
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `85 TATTOO — Fichas • Página ${i} de ${pages}`,
      w / 2,
      doc.internal.pageSize.getHeight() - 18,
      { align: "center" },
    );
  }

  doc.save(`${fileBase()}.pdf`);
}

export function exportFichasXlsx(rows: FichaResumo[], filters: FichasFilters): void {
  const wb = XLSX.utils.book_new();

  const resumo = [
    ["85 TATTOO — Fichas dos clientes"],
    [`Gerado em ${now()}`],
    [],
    ...filtersLines(filters, rows.length).map((l) => [l]),
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  const header = [
    "Cliente",
    "CPF",
    "Tatuador",
    "Tipo",
    "Status",
    "Risco",
    "Motivos de risco",
    "Assinatura",
    "Contrato",
    "Versão",
    "Data",
  ];
  const body = rows.map((r) => [
    r.clienteNome,
    r.cpfMasked,
    r.tatuador ?? "",
    TIPO_LABEL[r.tipo],
    STATUS_LABEL[r.status],
    r.risco === "attention" ? "Sim" : "",
    r.riscoMotivos.join("; "),
    r.temAssinatura ? "Sim" : "",
    r.temContrato ? "Sim" : "",
    r.versao,
    formatDateBR(r.data),
  ]);
  const wsData = XLSX.utils.aoa_to_sheet([header, ...body]);
  XLSX.utils.book_append_sheet(wb, wsData, "Fichas");

  XLSX.writeFile(wb, `${fileBase()}.xlsx`);
}
