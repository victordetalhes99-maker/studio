// ============================================================================
// Backup local — destino principal, gratuito e independente de serviços
// externos. Lê os dados reais do Supabase (respeitando RLS), monta um JSON
// completo e baixa diretamente no dispositivo do administrador.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";
import { checkAdminAccess } from "@/lib/auth/adminAccess";
import { logSecure } from "@/lib/logger";
import { downloadCsv } from "./csv";
import {
  checkBrowserSupport,
  downloadBlob,
  fetchAllRows,
  sha256Hex,
  timestampForFilename,
  utf8ByteLength,
  type PublicTableName,
  type TableExportResult,
} from "./export-utils";

export const APP_NAME = "85 TATTOO";
export const FORMAT_VERSION = 1;

interface TableSpec {
  name: PublicTableName;
  /** Tabela obrigatória: falha de leitura interrompe o backup inteiro. */
  required: boolean;
}

/**
 * Tabelas incluídas no backup completo. Mantida em sincronia com o schema
 * real (supabase/migrations) — nunca inclui auth.users nem tabelas de
 * segredo puro.
 */
export const BACKUP_TABLES: TableSpec[] = [
  { name: "clientes", required: true },
  { name: "tattoo_artists", required: true },
  { name: "check_ins", required: true },
  { name: "check_in_events", required: false },
  { name: "consent_records", required: false },
  { name: "risk_reviews", required: false },
  { name: "risk_review_events", required: false },
  { name: "app_config", required: false },
  { name: "backup_jobs", required: false },
  { name: "backup_settings", required: false },
  { name: "backup_destinations", required: false },
  { name: "user_roles", required: false },
  { name: "admin_audit_log", required: false },
  { name: "data_subject_requests", required: false },
];

export class BackupAccessError extends Error {}
export class BackupDataError extends Error {}

export interface LocalBackupResult {
  filename: string;
  totalRecords: number;
  tablesIncluded: number;
  tablesSkipped: string[];
  sizeBytes: number;
  checksumSha256: string;
  durationMs: number;
}

async function requireAdmin(): Promise<string> {
  const access = await checkAdminAccess();
  if (!access.authenticated) {
    throw new BackupAccessError("Sessao expirada. Faca login novamente para gerar o backup.");
  }
  if (!access.authorized) {
    throw new BackupAccessError("Apenas administradores podem gerar o backup.");
  }
  return access.user!.id;
}

async function recordJob(params: {
  status: "completed" | "failed";
  startedAt: Date;
  completedAt: Date;
  sizeBytes?: number;
  checksum?: string;
  registros?: number;
  filename?: string;
  tablesCount?: number;
  skipped?: string[];
  errorMessage?: string;
  initiatedBy: string | null;
}): Promise<void> {
  try {
    const { error } = await supabase.from("backup_jobs").insert({
      type: "manual",
      status: params.status,
      destination_kind: "local",
      size_bytes: params.sizeBytes ?? null,
      duration_ms: params.completedAt.getTime() - params.startedAt.getTime(),
      checksum_sha256: params.checksum ?? null,
      registros_incluidos: params.registros ?? null,
      error_message: params.errorMessage ?? null,
      started_at: params.startedAt.toISOString(),
      completed_at: params.completedAt.toISOString(),
      criado_por: params.initiatedBy,
      manifest: {
        mode: "local-json",
        formatVersion: FORMAT_VERSION,
        filename: params.filename ?? null,
        tables_count: params.tablesCount ?? null,
        skipped_tables: params.skipped ?? [],
      },
    });
    if (error) {
      logSecure("warn", "[backup] falha ao registrar backup_jobs", { message: error.message });
    }
  } catch (err) {
    logSecure("warn", "[backup] excecao ao registrar backup_jobs", {
      message: err instanceof Error ? err.message : "unknown",
    });
  }
}

/**
 * Executa o backup local completo: valida sessão e role, lê todas as
 * tabelas autorizadas em lotes, monta o JSON, calcula o hash, baixa o
 * arquivo e registra a execução em public.backup_jobs.
 */
export async function runLocalBackup(): Promise<LocalBackupResult> {
  const startedAt = new Date();
  const uid = await requireAdmin();

  const support = checkBrowserSupport().filter((s) => !s.supported);
  if (support.length > 0) {
    throw new BackupDataError(
      `Este navegador nao suporta: ${support.map((s) => s.label).join(", ")}.`,
    );
  }

  const results: TableExportResult[] = [];
  for (const table of BACKUP_TABLES) {
    const result = await fetchAllRows(table.name, { orderBy: undefined });
    if (result.status === "error" && table.required) {
      const completedAt = new Date();
      await recordJob({
        status: "failed",
        startedAt,
        completedAt,
        errorMessage: `Falha ao ler tabela obrigatoria "${table.name}": ${result.reason}`,
        initiatedBy: uid,
      });
      throw new BackupDataError(
        `Nao foi possivel gerar o backup: falha ao ler "${table.name}" (${result.reason}).`,
      );
    }
    results.push(result);
  }

  const data: Record<string, unknown[]> = {};
  const skipped: string[] = [];
  let totalRecords = 0;

  for (const result of results) {
    if (result.status === "skipped") {
      skipped.push(result.table);
      continue;
    }
    if (result.status === "error") {
      // Tabela opcional que falhou: registra como aviso, não interrompe.
      skipped.push(`${result.table} (erro: ${result.reason})`);
      continue;
    }
    data[result.table] = result.rows;
    totalRecords += result.count;
  }

  const filename = `85tattoo-backup-${timestampForFilename(startedAt)}.json`;

  const payload = {
    metadata: {
      app: APP_NAME,
      formatVersion: FORMAT_VERSION,
      generatedAt: startedAt.toISOString(),
      generatedBy: uid,
      mode: "local-json",
      tables: Object.keys(data),
      skipped,
      totalRecords,
    },
    data,
  };

  const json = JSON.stringify(payload, null, 2);
  const sizeBytes = utf8ByteLength(json);
  const checksumSha256 = await sha256Hex(json);

  downloadBlob(new Blob([json], { type: "application/json" }), filename);

  const completedAt = new Date();
  await recordJob({
    status: "completed",
    startedAt,
    completedAt,
    sizeBytes,
    checksum: checksumSha256,
    registros: totalRecords,
    filename,
    tablesCount: Object.keys(data).length,
    skipped,
    initiatedBy: uid,
  });

  return {
    filename,
    totalRecords,
    tablesIncluded: Object.keys(data).length,
    tablesSkipped: skipped,
    sizeBytes,
    checksumSha256,
    durationMs: completedAt.getTime() - startedAt.getTime(),
  };
}

/** Exporta uma única tabela como JSON, respeitando RLS e sanitização. */
export async function exportTableAsJson(tableName: PublicTableName): Promise<void> {
  await requireAdmin();
  const result = await fetchAllRows(tableName);
  if (result.status === "error") {
    throw new BackupDataError(`Nao foi possivel exportar "${tableName}": ${result.reason}`);
  }
  const json = JSON.stringify(result.rows, null, 2);
  downloadBlob(
    new Blob([json], { type: "application/json" }),
    `85tattoo-${tableName}-${timestampForFilename()}.json`,
  );
}

/** Exporta uma única tabela como CSV, respeitando RLS e sanitização. */
export async function exportTableAsCsv(tableName: PublicTableName): Promise<void> {
  await requireAdmin();
  const result = await fetchAllRows(tableName);
  if (result.status === "error") {
    throw new BackupDataError(`Nao foi possivel exportar "${tableName}": ${result.reason}`);
  }
  downloadCsv(`85tattoo-${tableName}-${timestampForFilename()}.csv`, result.rows);
}
