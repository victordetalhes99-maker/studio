// ============================================================================
// Geração de CSV para exportação local — UTF-8 com BOM, escaping RFC 4180.
// ============================================================================

import { downloadBlob } from "./export-utils";

function csvEscapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  // Precisa de aspas se contiver vírgula, aspas ou quebra de linha.
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Converte uma lista de objetos em texto CSV (RFC 4180), preservando acentos. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";

  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>()),
  );

  const header = columns.map(csvEscapeCell).join(",");
  const lines = rows.map((row) => columns.map((col) => csvEscapeCell(row[col])).join(","));
  return [header, ...lines].join("\r\n");
}

/** Baixa um CSV com BOM UTF-8 (garante acentuação correta no Excel/Sheets). */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  const BOM = "\uFEFF";
  const csv = BOM + toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename);
}
