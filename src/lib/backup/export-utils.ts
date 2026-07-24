// ============================================================================
// Utilitários de exportação local — sem dependência de serviços externos.
// Tudo aqui roda 100% no navegador com Supabase + Web APIs padrão.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/** Nome de qualquer tabela pública real do schema (fonte: types.ts gerado do banco). */
export type PublicTableName = keyof Database["public"]["Tables"];

/** Tamanho do lote usado para paginar consultas grandes (sem limite de 1.000). */
export const EXPORT_BATCH_SIZE = 1000;

/**
 * Padrão de nomes de coluna que NUNCA devem sair no backup, mesmo que a
 * tabela seja autorizada por RLS. Cobre credenciais, tokens e segredos —
 * não cobre dados pessoais do cliente (CPF, e-mail, telefone), que fazem
 * parte legítima do backup operacional.
 */
const FORBIDDEN_KEY_PATTERN =
  /(^password$|password_hash|senha_hash|refresh_token|access_token|service_role|service_key|private_key|api_key|apikey|secret|client_secret|encryption_key|bearer|authorization)/i;

/** Chaves de public.app_config que carregam segredo no valor (não só no nome). */
const FORBIDDEN_CONFIG_KEY_PATTERN = /(token|secret|key|credential|password|senha)/i;

export interface TableExportResult {
  table: string;
  status: "ok" | "skipped" | "error";
  rows: Record<string, unknown>[];
  count: number;
  reason?: string;
}

function isMissingRelationError(error: { code?: string; message?: string }): boolean {
  // 42P01 = undefined_table no Postgres/PostgREST.
  return error.code === "42P01" || /relation .* does not exist/i.test(error.message ?? "");
}

/** Remove recursivamente campos proibidos de um objeto de linha. Exportado para testes. */
export function stripForbiddenFields(
  row: Record<string, unknown>,
  tableName: string,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) {
      continue; // nunca incluir a chave, nem mascarada
    }
    if (tableName === "app_config" && key === "key" && typeof value === "string") {
      clean[key] = value;
      continue;
    }
    if (
      tableName === "app_config" &&
      key === "value" &&
      typeof row.key === "string" &&
      FORBIDDEN_CONFIG_KEY_PATTERN.test(row.key)
    ) {
      clean[key] = "[REDACTED]";
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

/**
 * Busca todas as linhas de uma tabela em lotes, sem assumir o limite padrão
 * de 1.000 registros do PostgREST. Sanitiza cada linha antes de retornar.
 */
export async function fetchAllRows(
  tableName: PublicTableName,
  options?: { orderBy?: string },
): Promise<TableExportResult> {
  const rows: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from(tableName)
      .select("*")
      .range(offset, offset + EXPORT_BATCH_SIZE - 1);

    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      if (isMissingRelationError(error)) {
        return { table: tableName, status: "skipped", rows: [], count: 0, reason: "not_found" };
      }
      return {
        table: tableName,
        status: "error",
        rows: [],
        count: 0,
        reason: error.message,
      };
    }

    const batch = (data ?? []) as Record<string, unknown>[];
    for (const row of batch) {
      rows.push(stripForbiddenFields(row, tableName));
    }

    if (batch.length < EXPORT_BATCH_SIZE) break;
    offset += EXPORT_BATCH_SIZE;
  }

  return { table: tableName, status: "ok", rows, count: rows.length };
}

/** Tamanho em bytes de uma string UTF-8, usando Blob (disponível em todo navegador moderno). */
export function utf8ByteLength(text: string): number {
  return new Blob([text]).size;
}

/** SHA-256 em hexadecimal via Web Crypto API — não depende de bibliotecas externas. */
export async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Dispara o download de um Blob e revoga a URL temporária em seguida. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revogação assíncrona: garante que o navegador já iniciou o download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function timestampForFilename(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
}

/** Suporte do navegador aos recursos necessários para o backup local. */
export function checkBrowserSupport(): { label: string; supported: boolean }[] {
  return [
    { label: "Blob", supported: typeof Blob !== "undefined" },
    { label: "URL.createObjectURL", supported: typeof URL?.createObjectURL === "function" },
    {
      label: "Web Crypto (SHA-256)",
      supported: typeof crypto?.subtle?.digest === "function",
    },
  ];
}
