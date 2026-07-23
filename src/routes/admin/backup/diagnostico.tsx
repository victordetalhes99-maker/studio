import { Activity } from "lucide-react";
import { StatusBadge } from "@/components/admin/backup/StatusBadge";
import {
  useBackupDestinations,
  useBackupJobs,
  useBackupOverview,
  useBackupSettings,
} from "@/lib/backup/hooks";

interface Check {
  label: string;
  detail: string;
  status: string;
}

export default function BackupDiagnosticoPage() {
  const overview = useBackupOverview();
  const destinations = useBackupDestinations();
  const jobs = useBackupJobs();
  const settings = useBackupSettings();

  const checks: Check[] = [
    {
      label: "Banco principal",
      detail: overview.error ? overview.error.message : "Lovable Cloud alcançável.",
      status: overview.error ? "erro" : "conectado",
    },
    {
      label: "Destinos cadastrados",
      detail: `${destinations.data.length} destino(s). ${overview.data.destinos_conectados} conectado(s).`,
      status:
        destinations.data.length === 0
          ? "nao_configurado"
          : overview.data.destinos_conectados > 0
            ? "conectado"
            : "configuracao_incompleta",
    },
    {
      label: "Política salva",
      detail: settings.data
        ? `${settings.data.frequency} · retenção ${settings.data.retention_daily}/${settings.data.retention_weekly}/${settings.data.retention_monthly}/${settings.data.retention_yearly}`
        : "Política não encontrada.",
      status: settings.data ? "conectado" : "nao_configurado",
    },
    {
      label: "Criptografia",
      detail: settings.data?.encryption_enabled
        ? `Ativa (${settings.data.encryption_version ?? "sem versão"})`
        : "Chave BACKUP_ENCRYPTION_KEY não configurada.",
      status: settings.data?.encryption_enabled ? "conectado" : "nao_configurado",
    },
    {
      label: "Scheduler automático",
      detail: settings.data?.auto_enabled
        ? "Habilitado — depende de scheduler ativo no backend."
        : "Desativado.",
      status: settings.data?.auto_enabled ? "conectado" : "desativado",
    },
    {
      label: "Execuções registradas",
      detail: `${jobs.data.length} no histórico.`,
      status: jobs.data.length > 0 ? "conectado" : "nao_configurado",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <Activity className="h-3.5 w-3.5 text-[color:var(--gold)]" />
          Diagnóstico da central
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Verificações em tempo real. Nenhum estado é simulado — cada item reflete a resposta do
          backend agora.
        </p>
      </div>

      <ul className="space-y-2">
        {checks.map((c) => (
          <li
            key={c.label}
            className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">{c.label}</div>
              <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>
            </div>
            <StatusBadge status={c.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
