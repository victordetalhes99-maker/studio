import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import { StatusBadge } from "@/components/admin/backup/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  useBackupAlerts,
  useBackupDestinations,
  useBackupJobs,
  useBackupOverview,
  useBackupSettings,
} from "@/lib/backup/hooks";

const SEVERITY_LABEL = {
  info: "Info",
  atencao: "Atenção",
  critico: "Crítico",
  resolvido: "Resolvido",
} as const;

const SEVERITY_STATUS = {
  info: "queued",
  atencao: "partial",
  critico: "failed",
  resolvido: "completed",
} as const;

export default function BackupAlertasPage() {
  const overview = useBackupOverview();
  const destinations = useBackupDestinations();
  const jobs = useBackupJobs();
  const settings = useBackupSettings();
  const alerts = useBackupAlerts(overview.data, destinations.data, jobs.data, settings.data);

  if (alerts.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Nenhum alerta ativo"
        description="A proteção dos dados está dentro dos parâmetros configurados."
      />
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((a) => (
        <div
          key={a.id}
          className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <StatusBadge
                status={SEVERITY_STATUS[a.severity]}
                label={SEVERITY_LABEL[a.severity]}
              />
              <span className="text-sm font-medium text-foreground">{a.title}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
          </div>
          {a.action && (
            <Button asChild size="sm" variant="outline">
              <Link to={a.action.to}>{a.action.label}</Link>
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
