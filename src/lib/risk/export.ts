import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  formatDateBR,
  STATUS_LABEL,
  SEVERITY_LABEL,
  CATEGORY_LABEL,
  type RiskAlert,
  type RiskFilters,
} from "./index";

const GOLD: [number, number, number] = [201, 162, 39];
const BLACK: [number, number, number] = [17, 17, 17];
const GRAPHITE: [number, number, number] = [60, 60, 60];

function now() {
  return new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function fileBase() {
  return `85-tattoo-clientes-risco-${new Date().toISOString().slice(0, 10)}`;
}

function filterLines(f: RiskFilters, total: number): string[] {
  const out: string[] = [];
  if (f.q.trim()) out.push(`Pesquisa: "${f.q.trim()}"`);
  if (f.level) out.push(`Nível: ${SEVERITY_LABEL[f.level]}`);
  if (f.status) out.push(`Status: ${STATUS_LABEL[f.status]}`);
  if (f.tatuador) out.push(`Tatuador: ${f.tatuador}`);
  if (f.category) out.push(`Categoria: ${CATEGORY_LABEL[f.category]}`);
  if (f.origin)
    out.push(`Origem: ${f.origin === "primeira_visita" ? "Primeira visita" : "Recorrente"}`);
  if (f.from) out.push(`De: ${formatDateBR(f.from)}`);
  if (f.to) out.push(`Até: ${formatDateBR(f.to)}`);
  if (f.showArchived) out.push("Inclui arquivados");
  out.push(`Registros: ${total}`);
  return out;
}

export function exportRiskPdf(rows: RiskAlert[], filters: RiskFilters): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  doc.setFillColor(...BLACK);
  doc.rect(0, 0, w, 68, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 68, w, 2, "F");

  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("85 TATTOO · Clientes de Risco", 40, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(230, 230, 230);
  doc.text(`Emitido em ${now()}`, 40, 54);

  doc.setTextColor(...GRAPHITE);
  doc.setFontSize(9);
  const lines = filterLines(filters, rows.length);
  lines.forEach((l, i) => doc.text(l, 40, 92 + i * 12));

  autoTable(doc, {
    startY: 92 + lines.length * 12 + 10,
    head: [["Cliente", "CPF", "Origem", "Tatuador", "Nível", "Motivos", "Status", "Detectado"]],
    body: rows.map((r) => [
      r.clienteNome,
      r.cpfMasked,
      r.origemLabel,
      r.tatuador || "—",
      SEVERITY_LABEL[r.level],
      r.reasons.map((x) => x.label).join(" · "),
      STATUS_LABEL[r.status],
      formatDateBR(r.detectedAt),
    ]),
    headStyles: { fillColor: BLACK, textColor: GOLD, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 5 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: { 5: { cellWidth: 220 } },
    margin: { left: 40, right: 40 },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...GRAPHITE);
    doc.text(
      `85 TATTOO · Confidencial LGPD · Página ${i} de ${pages}`,
      w / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: "center" },
    );
  }

  doc.save(`${fileBase()}.pdf`);
}

export function exportRiskXlsx(rows: RiskAlert[], filters: RiskFilters): void {
  const wb = XLSX.utils.book_new();

  const summary = [
    ["85 TATTOO — Clientes de Risco"],
    [`Emitido em: ${now()}`],
    [],
    ["Filtros aplicados"],
    ...filterLines(filters, rows.length).map((l) => [l]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Resumo");

  const alerts = rows.map((r) => ({
    Cliente: r.clienteNome,
    CPF: r.cpfMasked,
    Origem: r.origemLabel,
    Tatuador: r.tatuador || "",
    Nível: SEVERITY_LABEL[r.level],
    Status: STATUS_LABEL[r.status],
    Motivos: r.reasons.map((x) => x.label).join(" · "),
    Categorias: Array.from(new Set(r.reasons.map((x) => CATEGORY_LABEL[x.category]))).join(", "),
    Decisão: r.decision || "",
    Observação: r.observacao || "",
    Assinatura: r.temAssinatura ? "Presente" : "Ausente",
    "Versão da ficha": r.formVersion,
    "Versão das regras": r.rulesVersion,
    Detectado: formatDateBR(r.detectedAt),
    "Revisado em": r.reviewedAt ? formatDateBR(r.reviewedAt) : "",
    "Alerta ID": r.id,
  }));
  const wsAlerts = XLSX.utils.json_to_sheet(alerts);
  XLSX.utils.book_append_sheet(wb, wsAlerts, "Alertas");

  const reasons: Array<Record<string, string | number>> = [];
  rows.forEach((r) => {
    r.reasons.forEach((x) =>
      reasons.push({
        "Alerta ID": r.id,
        Cliente: r.clienteNome,
        CPF: r.cpfMasked,
        Regra: x.ruleId,
        Motivo: x.label,
        Categoria: CATEGORY_LABEL[x.category],
        Severidade: SEVERITY_LABEL[x.severity],
        "Versão da regra": x.version,
      }),
    );
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reasons), "Motivos");

  XLSX.writeFile(wb, `${fileBase()}.xlsx`);
}
