import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { getAssinaturaUrl } from "@/lib/clientes";
import {
  formatDateTimeBR,
  ORIGEM_LABEL,
  STATUS_LABEL,
  type ContratoDetalhe,
  type ContratoResumo,
  type ContratosFilters,
} from "./index";
import { sha256Hex } from "./templates";

const GOLD: [number, number, number] = [201, 162, 39];
const BLACK: [number, number, number] = [17, 17, 17];
const GRAPHITE: [number, number, number] = [60, 60, 60];
const LEGACY_NOTICE = "Documento legado sem snapshot integral";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function now() {
  return new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function fileBase(prefix: string, filePrefix = "documento"): string {
  return `${slugify(filePrefix || "documento")}-${prefix}-${new Date().toISOString().slice(0, 10)}`;
}

function filtersLines(f: ContratosFilters, total: number): string[] {
  const out: string[] = [];
  if (f.q.trim()) out.push(`Pesquisa: "${f.q.trim()}"`);
  if (f.status) out.push(`Status: ${STATUS_LABEL[f.status]}`);
  if (f.tatuador) out.push(`Tatuador: ${f.tatuador}`);
  if (f.assinatura) out.push(`Assinatura: ${f.assinatura === "com" ? "presente" : "ausente"}`);
  if (f.origem) out.push(`Origem: ${ORIGEM_LABEL[f.origem]}`);
  if (f.versao) out.push(`Versão: ${f.versao}`);
  if (f.periodo) {
    out.push(
      `Período: ${
        f.periodo === "hoje" ? "hoje" : f.periodo === "7d" ? "últimos 7 dias" : "últimos 30 dias"
      }`,
    );
  }
  out.push(`Registros: ${total}`);
  return out;
}

function listBrand(rows: ContratoResumo[]) {
  const first = rows[0];
  return {
    filePrefix: first?.filePrefix || "documento",
    studioDisplayName: first?.studioDisplayName || "Contratos",
  };
}

export interface ResolvedContratoExportData {
  filePrefix: string;
  studioDisplayName: string;
  studioCompanyName: string | null;
  pdfHeader: string | null;
  pdfFooter: string | null;
  fileName: string;
  title: string;
  version: string;
  renderedText: string | null;
  displayText: string;
  isLegacy: boolean;
  legacyNotice: string | null;
  integrityStatus: string;
  calculatedHash: string | null;
}

export async function resolveContratoExportData(
  contrato: ContratoDetalhe,
): Promise<ResolvedContratoExportData> {
  const renderedText = contrato.renderedText?.trim() || null;
  const isLegacy = !renderedText;
  const calculatedHash = renderedText ? await sha256Hex(renderedText) : null;
  const integrityStatus =
    !renderedText || !contrato.textoHash
      ? "não verificado"
      : calculatedHash === contrato.textoHash
        ? "íntegro"
        : "divergente";

  return {
    filePrefix: contrato.filePrefix || "documento",
    studioDisplayName: contrato.studioDisplayName,
    studioCompanyName: contrato.studioCompanyName,
    pdfHeader: contrato.pdfHeader,
    pdfFooter: contrato.pdfFooter,
    fileName: fileBase(
      `contrato-${contrato.cliente.cpf}-${contrato.versao}-${contrato.id.slice(0, 8)}`,
      contrato.filePrefix,
    ),
    title: contrato.documentLabel,
    version: contrato.versao,
    renderedText,
    displayText:
      renderedText ??
      `${LEGACY_NOTICE}\n\nEste registro foi criado antes da captura integral do texto aceito. O sistema preserva metadados e hash armazenado, mas não reconstrói retroativamente um snapshot sem prova do conteúdo exibido no momento do aceite.`,
    isLegacy,
    legacyNotice: isLegacy ? LEGACY_NOTICE : null,
    integrityStatus,
    calculatedHash,
  };
}

export function exportContratosPdf(rows: ContratoResumo[], filters: ContratosFilters): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const brand = listBrand(rows);

  doc.setFillColor(...BLACK);
  doc.rect(0, 0, width, 68, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 68, width, 2, "F");

  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(brand.studioDisplayName, 40, 34);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Contratos e termos assinados", 40, 54);
  doc.setTextColor(220, 220, 220);
  doc.setFontSize(9);
  doc.text(`Gerado em ${now()}`, width - 40, 34, { align: "right" });

  doc.setTextColor(...GRAPHITE);
  doc.setFontSize(9);
  const lines = filtersLines(filters, rows.length);
  lines.forEach((line, index) => doc.text(line, 40, 92 + index * 12));

  autoTable(doc, {
    startY: 92 + lines.length * 12 + 8,
    head: [["Cliente", "CPF", "Tatuador", "Origem", "Versão", "Snapshot", "Status", "Aceito em"]],
    body: rows.map((row) => [
      row.clienteNome || "—",
      row.cpfMasked,
      row.tatuador ?? "—",
      ORIGEM_LABEL[row.origem],
      row.versao,
      row.hasSnapshot ? "Integral" : "Legado",
      STATUS_LABEL[row.status],
      formatDateTimeBR(row.aceitoEm),
    ]),
    styles: { fontSize: 9, cellPadding: 6, textColor: GRAPHITE },
    headStyles: { fillColor: BLACK, textColor: GOLD, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    margin: { left: 40, right: 40 },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `${brand.studioDisplayName} • Contratos • Página ${i} de ${pages}`,
      width / 2,
      doc.internal.pageSize.getHeight() - 18,
      { align: "center" },
    );
  }

  doc.save(`${fileBase("contratos", brand.filePrefix)}.pdf`);
}

export function exportContratosXlsx(rows: ContratoResumo[], filters: ContratosFilters): void {
  const wb = XLSX.utils.book_new();
  const brand = listBrand(rows);
  const resumo = [
    [`${brand.studioDisplayName} — Contratos e termos`],
    [`Gerado em ${now()}`],
    [],
    ...filtersLines(filters, rows.length).map((line) => [line]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo");

  const header = [
    "ID",
    "Cliente",
    "CPF",
    "Tatuador",
    "Origem",
    "Template",
    "Versão",
    "Snapshot",
    "Status",
    "Assinatura",
    "Aceito em",
  ];
  const body = rows.map((row) => [
    row.id,
    row.clienteNome,
    row.cpfMasked,
    row.tatuador ?? "",
    ORIGEM_LABEL[row.origem],
    row.templateId,
    row.versao,
    row.hasSnapshot ? "integral" : "legado",
    STATUS_LABEL[row.status],
    row.temAssinatura ? "Sim" : "",
    formatDateTimeBR(row.aceitoEm),
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...body]), "Contratos");

  XLSX.writeFile(wb, `${fileBase("contratos", brand.filePrefix)}.xlsx`);
}

async function fetchSignatureDataUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const url = await getAssinaturaUrl(path);
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function gerarContratoPdf(contrato: ContratoDetalhe): Promise<void> {
  const exportData = await resolveContratoExportData(contrato);
  const signatureDataUrl = await fetchSignatureDataUrl(contrato.assinaturaPath);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 50;
  const contentWidth = pageWidth - marginX * 2;

  doc.setFillColor(...BLACK);
  doc.rect(0, 0, pageWidth, 90, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 90, pageWidth, 3, "F");

  doc.setTextColor(...GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(exportData.pdfHeader || exportData.studioDisplayName, marginX, 42);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(exportData.title, marginX, 66);
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 220);
  doc.text(`Versão ${exportData.version}`, pageWidth - marginX, 42, { align: "right" });
  doc.text(`Emitido em ${now()}`, pageWidth - marginX, 60, { align: "right" });

  let y = 120;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 18;
  doc.setTextColor(...BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Contratante", marginX, y);
  doc.text("Contratado", pageWidth / 2 + 10, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRAPHITE);

  const left = [
    contrato.cliente.nomeCompleto,
    `CPF ${contrato.cliente.documento}`,
    contrato.cliente.telefone ? `Tel: ${contrato.cliente.telefone}` : "",
    contrato.cliente.email ?? "",
  ].filter(Boolean);
  const right = [
    exportData.studioCompanyName || exportData.studioDisplayName,
    `Tatuador: ${contrato.tatuador ?? "—"}`,
    `Origem: ${ORIGEM_LABEL[contrato.origem]}`,
  ];
  left.forEach((line, index) => doc.text(line, marginX, y + index * 13));
  right.forEach((line, index) => doc.text(line, pageWidth / 2 + 10, y + index * 13));
  y += Math.max(left.length, right.length) * 13 + 12;

  doc.setDrawColor(230, 230, 230);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  doc.text("Texto aceito pelo contratante", marginX, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRAPHITE);

  const wrapped = doc.splitTextToSize(exportData.displayText, contentWidth);
  for (const line of wrapped) {
    if (y > pageHeight - 200) {
      doc.addPage();
      y = 60;
    }
    doc.text(line, marginX, y);
    y += 13;
  }

  y += 20;
  if (y > pageHeight - 220) {
    doc.addPage();
    y = 60;
  }

  doc.setDrawColor(...GOLD);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  doc.text("Assinatura digital do contratante", marginX, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAPHITE);

  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, "PNG", marginX, y, 200, 70);
    } catch {
      doc.text("[assinatura não pôde ser renderizada]", marginX, y + 30);
    }
  } else {
    doc.setTextColor(150, 30, 30);
    doc.text("Nenhuma assinatura registrada para este aceite.", marginX, y + 20);
    doc.setTextColor(...GRAPHITE);
  }

  const info = [
    `Assinado em: ${formatDateTimeBR(contrato.assinadoEm)}`,
    `Aceite registrado: ${formatDateTimeBR(contrato.aceite.acceptedAt)}`,
    `IP: ${contrato.aceite.ip ?? "—"}`,
    `Fonte: ${contrato.aceite.source ?? "—"}`,
    `Contrato: ${contrato.id}`,
  ];
  info.forEach((line, index) => {
    doc.text(line, pageWidth - marginX, y + 12 + index * 12, { align: "right" });
  });

  y += 100;
  if (y > pageHeight - 90) {
    doc.addPage();
    y = 60;
  }

  doc.setDrawColor(230, 230, 230);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text("Integridade do documento", marginX, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAPHITE);
  const integrityLines = [
    `Algoritmo: SHA-256 • Status: ${exportData.integrityStatus}`,
    `Hash armazenado: ${contrato.textoHash ?? "—"}`,
    `Hash calculado: ${exportData.calculatedHash ?? "—"}`,
    `Template: ${contrato.templateId} • Versão ${contrato.versao}`,
    exportData.legacyNotice ? `Observação: ${exportData.legacyNotice}` : "",
  ].filter(Boolean);
  integrityLines.forEach((line, index) => doc.text(line, marginX, y + index * 11));

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      exportData.pdfFooter ||
        `${exportData.studioDisplayName} • Contrato ${contrato.id} • Página ${i} de ${pages}`,
      pageWidth / 2,
      pageHeight - 18,
      { align: "center" },
    );
  }

  doc.save(`${exportData.fileName}.pdf`);
}
