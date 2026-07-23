// ============================================================================
// Exportação da listagem administrativa de Documentos.
// Exporta APENAS a coleção filtrada exibida na tela — nunca conteúdo médico,
// assinatura ou dados sensíveis embutidos.
// ============================================================================

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { DocumentoResumo, DocumentosFilters } from "./index";
import { TIPO_LABEL, STATUS_LABEL, formatDateTimeBR } from "./index";

const GOLD: [number, number, number] = [201, 162, 39];
const BLACK: [number, number, number] = [17, 17, 17];
const GRAPHITE: [number, number, number] = [60, 60, 60];

function now() {
  return new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function fileBase(): string {
  return `85-tattoo-documentos-${new Date().toISOString().slice(0, 10)}`;
}

function filtersLines(f: DocumentosFilters, total: number): string[] {
  const out: string[] = [];
  if (f.q.trim()) out.push(`Pesquisa: "${f.q.trim()}"`);
  if (f.tipo) out.push(`Tipo: ${TIPO_LABEL[f.tipo]}`);
  if (f.status) out.push(`Status: ${STATUS_LABEL[f.status]}`);
  if (f.tatuador) out.push(`Tatuador: ${f.tatuador}`);
  if (f.origem) out.push(`Origem: ${f.origem}`);
  if (f.periodo) out.push(`Período: ${f.periodo}`);
  out.push(`Registros: ${total}`);
  return out;
}

export function exportDocumentosPdf(rows: DocumentoResumo[], filters: DocumentosFilters): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

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
  doc.text("Central de documentos", 40, 54);

  doc.setTextColor(220, 220, 220);
  doc.setFontSize(9);
  doc.text(`Gerado em ${now()}`, w - 40, 34, { align: "right" });

  doc.setTextColor(...GRAPHITE);
  doc.setFontSize(9);
  const lines = filtersLines(filters, rows.length);
  lines.forEach((l, i) => doc.text(l, 40, 92 + i * 12));

  const startY = 92 + lines.length * 12 + 8;

  autoTable(doc, {
    startY,
    head: [["Documento", "Tipo", "Cliente", "Tatuador", "Status", "Versão", "Data"]],
    body: rows.map((r) => [
      r.fileName,
      TIPO_LABEL[r.tipo],
      r.clienteNome,
      r.tatuador ?? "—",
      STATUS_LABEL[r.status],
      r.versao ?? "—",
      formatDateTimeBR(r.criadoEm),
    ]),
    styles: { fontSize: 9, cellPadding: 6, textColor: GRAPHITE, lineColor: [230, 230, 230] },
    headStyles: { fillColor: BLACK, textColor: GOLD, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: 40, right: 40 },
  });

  doc.save(`${fileBase()}.pdf`);
}

export function exportDocumentosXlsx(rows: DocumentoResumo[], filters: DocumentosFilters): void {
  const wb = XLSX.utils.book_new();
  const header = [
    "ID",
    "Documento",
    "Tipo",
    "Cliente",
    "CPF",
    "Tatuador",
    "Status",
    "Origem",
    "Versão",
    "MIME",
    "Criado em",
    "Atualizado em",
  ];
  const body = rows.map((r) => [
    r.id,
    r.fileName,
    TIPO_LABEL[r.tipo],
    r.clienteNome,
    r.clienteCpfMasked,
    r.tatuador ?? "",
    STATUS_LABEL[r.status],
    r.origem,
    r.versao ?? "",
    r.mimeType,
    formatDateTimeBR(r.criadoEm),
    formatDateTimeBR(r.atualizadoEm),
  ]);
  const meta = [
    ["Central de documentos — 85 TATTOO"],
    ["Gerado em", now()],
    ["Registros", String(rows.length)],
    ...filtersLines(filters, rows.length).map((l) => [l]),
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(meta);
  const wsData = XLSX.utils.aoa_to_sheet([header, ...body]);
  XLSX.utils.book_append_sheet(wb, wsMeta, "Metadados");
  XLSX.utils.book_append_sheet(wb, wsData, "Documentos");
  XLSX.writeFile(wb, `${fileBase()}.xlsx`);
}
