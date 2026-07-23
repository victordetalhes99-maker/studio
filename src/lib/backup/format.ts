export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export const DESTINATION_LABELS: Record<string, string> = {
  r2: "Cloudflare R2",
  google_drive: "Google Drive",
  local: "Download local",
};

export const STATUS_LABELS: Record<string, string> = {
  nao_configurado: "Não configurado",
  configuracao_incompleta: "Configuração incompleta",
  conectado: "Conectado",
  erro: "Erro",
  desativado: "Desativado",
  queued: "Na fila",
  running: "Executando",
  completed: "Concluído",
  partial: "Parcial",
  failed: "Falhou",
  cancelado: "Cancelado",
  validando: "Validando",
  preview: "Prévia",
  aguardando_confirmacao: "Aguardando confirmação",
  bloqueado: "Bloqueado",
};

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export function statusTone(status: string | null | undefined): StatusTone {
  switch (status) {
    case "conectado":
    case "completed":
      return "success";
    case "running":
    case "queued":
    case "validando":
    case "aguardando_confirmacao":
    case "preview":
      return "info";
    case "configuracao_incompleta":
    case "partial":
    case "desativado":
    case "cancelado":
      return "warning";
    case "erro":
    case "failed":
    case "bloqueado":
      return "danger";
    default:
      return "neutral";
  }
}
