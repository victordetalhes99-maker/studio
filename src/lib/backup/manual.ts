import { supabase } from "@/integrations/supabase/client";

export interface ManualBackupSuccess {
  success: true;
  spreadsheetId?: string | null;
  url?: string | null;
  tab?: string | null;
  csvTab?: string | null;
  totalClientes?: number | null;
  duracaoMs?: number | null;
}

interface FunctionErrorPayload {
  error?: string;
  message?: string;
}

function sanitizeMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function readFunctionError(error: unknown): Promise<string> {
  if (error && typeof error === "object" && "context" in error) {
    const maybeResponse = (error as { context?: unknown }).context;
    if (maybeResponse instanceof Response) {
      try {
        const payload = (await maybeResponse.clone().json()) as FunctionErrorPayload;
        return (
          sanitizeMessage(payload.error) ??
          sanitizeMessage(payload.message) ??
          sanitizeMessage((error as { message?: unknown }).message) ??
          "Nao foi possivel executar o backup manual."
        );
      } catch {
        return (
          sanitizeMessage((error as { message?: unknown }).message) ??
          "Nao foi possivel executar o backup manual."
        );
      }
    }
  }

  return (
    sanitizeMessage((error as { message?: unknown } | null)?.message) ??
    "Nao foi possivel executar o backup manual."
  );
}

export async function executeManualBackup(): Promise<ManualBackupSuccess> {
  const { data, error } = await supabase.functions.invoke("backup-to-sheets", {
    body: {
      source: "admin-backup-center",
      trigger: "manual",
      requestedAt: new Date().toISOString(),
    },
  });

  if (error) {
    throw new Error(await readFunctionError(error));
  }

  const payload = (data ?? {}) as ManualBackupSuccess & FunctionErrorPayload;
  if (payload.success !== true) {
    throw new Error(
      sanitizeMessage(payload.error) ??
        sanitizeMessage(payload.message) ??
        "Nao foi possivel executar o backup manual.",
    );
  }

  return payload;
}
