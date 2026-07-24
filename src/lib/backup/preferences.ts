// ============================================================================
// Preferências reais de backup, persistidas em public.app_config (chave/valor
// já existente — nenhuma migration nova foi necessária para isto).
// Não há agendamento automático aqui: são apenas preferências informativas
// que o admin configura para o fluxo manual.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";

const CONFIG_PREFIX = "backup_pref_";

export interface BackupPreferences {
  reminderEnabled: boolean;
  reminderIntervalDays: number;
  defaultFormat: "json" | "csv";
  requireConfirmation: boolean;
}

export const DEFAULT_BACKUP_PREFERENCES: BackupPreferences = {
  reminderEnabled: false,
  reminderIntervalDays: 7,
  defaultFormat: "json",
  requireConfirmation: true,
};

const KEYS = {
  reminderEnabled: `${CONFIG_PREFIX}reminder_enabled`,
  reminderIntervalDays: `${CONFIG_PREFIX}reminder_interval_days`,
  defaultFormat: `${CONFIG_PREFIX}default_format`,
  requireConfirmation: `${CONFIG_PREFIX}require_confirmation`,
} as const;

export async function loadBackupPreferences(): Promise<BackupPreferences> {
  const { data, error } = await supabase
    .from("app_config")
    .select("key, value")
    .in("key", Object.values(KEYS));

  if (error) throw error;

  const map = new Map((data ?? []).map((r) => [r.key, r.value]));

  return {
    reminderEnabled: map.get(KEYS.reminderEnabled) === "true",
    reminderIntervalDays: Number(map.get(KEYS.reminderIntervalDays)) || 7,
    defaultFormat: (map.get(KEYS.defaultFormat) as "json" | "csv") ?? "json",
    requireConfirmation: map.get(KEYS.requireConfirmation) !== "false",
  };
}

export async function saveBackupPreferences(prefs: BackupPreferences): Promise<void> {
  const rows = [
    { key: KEYS.reminderEnabled, value: String(prefs.reminderEnabled) },
    { key: KEYS.reminderIntervalDays, value: String(prefs.reminderIntervalDays) },
    { key: KEYS.defaultFormat, value: prefs.defaultFormat },
    { key: KEYS.requireConfirmation, value: String(prefs.requireConfirmation) },
  ];
  const { error } = await supabase.from("app_config").upsert(rows, { onConflict: "key" });
  if (error) throw error;
}
