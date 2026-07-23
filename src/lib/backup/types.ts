// ============================================================================
// Central de proteção de dados — tipos do domínio.
// ============================================================================

export type DestinationKind = "r2" | "google_drive" | "local";
export type DestinationStatus =
  "nao_configurado" | "configuracao_incompleta" | "conectado" | "erro" | "desativado";

export interface BackupDestination {
  id: string;
  kind: DestinationKind;
  label: string;
  config_masked: Record<string, unknown>;
  status: DestinationStatus;
  last_tested_at: string | null;
  last_error: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type BackupJobStatus =
  "queued" | "running" | "completed" | "partial" | "failed" | "cancelado" | "validando";

export type BackupJobType = "completo" | "banco" | "documentos" | "incremental" | "manual";

export interface BackupJob {
  id: string;
  type: BackupJobType;
  status: BackupJobStatus;
  destination_id: string | null;
  destination_kind: DestinationKind | null;
  stage: string | null;
  progress_stages: Array<{ label: string; done: boolean; error?: string }>;
  content: Record<string, boolean>;
  size_bytes: number | null;
  duration_ms: number | null;
  checksum_sha256: string | null;
  manifest: Record<string, unknown> | null;
  storage_path: string | null;
  error_message: string | null;
  warnings: string[];
  registros_incluidos: number | null;
  arquivos_incluidos: number | null;
  system_version: string | null;
  started_at: string;
  completed_at: string | null;
  criado_por: string | null;
}

export interface BackupSettings {
  id: string;
  auto_enabled: boolean;
  frequency: "diario" | "semanal" | "mensal" | "personalizado" | "desativado";
  hour: number;
  timezone: string;
  retention_daily: number;
  retention_weekly: number;
  retention_monthly: number;
  retention_yearly: number;
  content: Record<string, boolean>;
  encryption_enabled: boolean;
  encryption_version: string | null;
}

export interface BackupOverview {
  destinos_conectados: number;
  destinos_total: number;
  ultimo_backup: BackupJob | null;
  auto_enabled: boolean;
  encryption_enabled: boolean;
}

export type RestoreStatus =
  | "preview"
  | "aguardando_confirmacao"
  | "running"
  | "completed"
  | "failed"
  | "cancelado"
  | "bloqueado";

export interface RestoreJob {
  id: string;
  backup_job_id: string | null;
  status: RestoreStatus;
  scope: "completo" | "banco" | "documentos" | "configuracoes" | "parcial" | "cliente";
  preview: Record<string, unknown> | null;
  impact: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface AsyncData<T> {
  data: T;
  isLoading: boolean;
  isEmpty: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface BackupAlert {
  id: string;
  severity: "info" | "atencao" | "critico" | "resolvido";
  title: string;
  description: string;
  action?: { label: string; to: string };
}
