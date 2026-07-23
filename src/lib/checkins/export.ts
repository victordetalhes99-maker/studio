import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { CheckIn, CheckInFilters } from "./index";
import {
  STATUS_LABEL,
  formatDateTimeBR,
  formatTimeBR,
  formatWait,
  serviceMinutes,
  waitMinutes,
} from "./index";

const GOLD: [number, number, number] = [201, 162, 39];
const BLACK: [number, number, number] = [17, 17, 17];
const GRAPHITE: [number, number, number] = [60, 60, 60];

function fileBase() {
  return `85-tattoo-checkins-${new Date().toISOString().slice(0, 10)}`;
}

function filtersLines(f: CheckInFilters, total: number): string[] {
  const out: string[] = [];
  out.push(`Escopo: ${f.dia === "hoje" ? "hoje" : "todos os dias"}`);
  if (f.q.trim()) out.push(`Pesquisa: "${f.q.trim()}"`);
  if (f.status)
    out.push(
      `Status: ${f.status === "abertos" ? "abertos" : STATUS_LABEL[f.status as keyof typeof STATUS_LABEL]}`,
    );
  if (f.tatuador) out.push(`Tatuador: ${f.tatuador}`);
  if (f.risco) out.push(`Risco: ${f.risco === "com" ? "com alertas" : "sem alertas"}`);
  if (f.ficha) out.push(`Ficha: ${f.ficha === "com" ? "com ficha" : "sem ficha"}`);
  out.push(`Registros: ${total}`);
  return out;
}

export function exportCheckInsPdf(rows: CheckIn[], filters: CheckInFilters): void {
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
  doc.text("Check-ins e recepção", 40, 54);
  doc.setTextColor(220, 220, 220);
  doc.setFontSize(9);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, w - 40, 34, { align: "right" });

  doc.setTextColor(...GRAPHITE);
  doc.setFontSize(9);
  const lines = filtersLines(filters, rows.length);
  lines.forEach((l, i) => doc.text(l, 40, 92 + i * 12));

  const startY = 92 + lines.length * 12 + 8;

  autoTable(doc, {
    startY,
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: BLACK, textColor: GOLD, halign: "left" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    head: [
      [
        "Cliente",
        "Tatuador",
        "Chegada",
        "Chamado",
        "Início",
        "Fim",
        "Espera",
        "Duração",
        "Status",
        "Risco",
      ],
    ],
    body: rows.map((r) => [
      `${r.clienteNome}\n${r.cpfMasked}`,
      r.tatuador ?? "—",
      formatDateTimeBR(r.arrivalAt),
      formatTimeBR(r.calledAt),
      formatTimeBR(r.startedAt),
      formatTimeBR(r.completedAt),
      formatWait(waitMinutes(r)),
      serviceMinutes(r) != null ? `${serviceMinutes(r)} min` : "—",
      STATUS_LABEL[r.status],
      r.riskFlag ? "Sim" : "—",
    ]),
  });

  doc.save(`${fileBase()}.pdf`);
}

export function exportCheckInsXlsx(rows: CheckIn[], _filters: CheckInFilters): void {
  const data = rows.map((r) => ({
    Cliente: r.clienteNome,
    CPF: r.cpfMasked,
    Tatuador: r.tatuador ?? "",
    Data: r.queueDay,
    Chegada: formatTimeBR(r.arrivalAt),
    Chamado: formatTimeBR(r.calledAt),
    Início: formatTimeBR(r.startedAt),
    Conclusão: formatTimeBR(r.completedAt),
    "Espera (min)": waitMinutes(r),
    "Duração (min)": serviceMinutes(r) ?? "",
    Status: STATUS_LABEL[r.status],
    Risco: r.riskFlag ? "Sim" : "",
    Ficha: r.hasFicha ? "Sim" : "",
    Assinatura: r.hasAssinatura ? "Sim" : "",
    Posição: r.queuePosition,
    Observações: r.observacoes ?? "",
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Check-ins");
  XLSX.writeFile(wb, `${fileBase()}.xlsx`);
}
