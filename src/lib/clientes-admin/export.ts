import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { AdminClient, ClientFiltersState } from "./index";
import { formatDateBR, maskCpfSafe } from "./index";

const GOLD: [number, number, number] = [201, 162, 39];
const BLACK: [number, number, number] = [17, 17, 17];
const GRAPHITE: [number, number, number] = [60, 60, 60];

function today() {
  return new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function fileBase(): string {
  const d = new Date().toISOString().slice(0, 10);
  return `85-tattoo-clientes-${d}`;
}

function filtersLines(f: ClientFiltersState, total: number): string[] {
  const out: string[] = [];
  if (f.q.trim()) out.push(`Pesquisa: "${f.q.trim()}"`);
  if (f.tatuador) out.push(`Tatuador: ${f.tatuador}`);
  if (f.status) out.push(`Status: ${f.status}`);
  if (f.risco) out.push(`Risco: ${f.risco === "com" ? "com alertas" : "sem alertas"}`);
  if (f.ficha) out.push(`Ficha: ${f.ficha === "com" ? "preenchida" : "pendente"}`);
  out.push(`Registros encontrados: ${total}`);
  return out;
}

export function exportClientsPdf(rows: AdminClient[], filters: ClientFiltersState): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  doc.setFillColor(...BLACK);
  doc.rect(0, 0, w, 68, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 68, w, 2, "F");

  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("85 TATTOO", 40, 32);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("Relatório de clientes", 40, 52);

  doc.setTextColor(...GRAPHITE);
  doc.setFontSize(9);
  const infoY = 90;
  const lines = [`Gerado em: ${today()}`, ...filtersLines(filters, rows.length)];
  lines.forEach((l, i) => doc.text(l, 40, infoY + i * 12));

  const startY = infoY + lines.length * 12 + 10;

  autoTable(doc, {
    startY,
    head: [["Cliente", "CPF", "Tatuador", "Status", "Ficha", "Risco", "Sessões", "Último atend."]],
    body: rows.map((c) => [
      c.nome || "—",
      maskCpfSafe(c.cpf),
      c.tatuador ?? "—",
      c.status,
      c.temFicha ? "Sim" : "Não",
      c.riscoNivel === "attention" ? c.riscoMotivos.join(", ") || "Atenção" : "—",
      String(c.totalSessoes),
      formatDateBR(c.ultimaSessao),
    ]),
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
        w / 2,
        doc.internal.pageSize.getHeight() - 16,
        { align: "center" },
      );
    },
  });

  if (rows.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(...GRAPHITE);
    doc.text("Nenhum cliente encontrado para os filtros selecionados.", 40, startY + 20);
  }

  doc.save(`${fileBase()}.pdf`);
}

export function exportClientsXlsx(rows: AdminClient[], filters: ClientFiltersState): void {
  const wb = XLSX.utils.book_new();

  const resumo = [
    ["85 TATTOO — Relatório de clientes"],
    ["Gerado em", today()],
    ...filtersLines(filters, rows.length).map((l) => {
      const [k, ...rest] = l.split(":");
      return [k, rest.join(":").trim()];
    }),
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  const body = rows.map((c) => ({
    Cliente: c.nome,
    CPF: maskCpfSafe(c.cpf),
    Telefone: c.telefoneMasked ?? "",
    Email: c.email ?? "",
    Tatuador: c.tatuador ?? "",
    Status: c.status,
    "Ficha preenchida": c.temFicha ? "Sim" : "Não",
    "Tem assinatura": c.temAssinatura ? "Sim" : "Não",
    Risco: c.riscoNivel === "attention" ? "Sim" : "Não",
    "Motivos de risco": c.riscoMotivos.join("; "),
    "Total de sessões": c.totalSessoes,
    "Última sessão": formatDateBR(c.ultimaSessao),
    "Cadastrado em": formatDateBR(c.criadoEm),
    "Atualizado em": formatDateBR(c.atualizadoEm),
  }));
  const wsData = XLSX.utils.json_to_sheet(body);
  (wsData as { ["!autofilter"]?: unknown })["!autofilter"] = {
    ref: `A1:N${Math.max(1, body.length + 1)}`,
  };
  XLSX.utils.book_append_sheet(wb, wsData, "Clientes");

  XLSX.writeFile(wb, `${fileBase()}.xlsx`);
}
