import { Link } from "react-router-dom";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { Button } from "@/components/ui/button";
import { useBackupOverview, useBackupSettings } from "@/lib/backup/hooks";

export default function ConfigBackupPage() {
  const overview = useBackupOverview();
  const settings = useBackupSettings();

  const destinos = overview.data.destinos_total ?? 0;
  const conectados = overview.data.destinos_conectados ?? 0;
  const ultimo =
    overview.data.ultimo_backup?.completed_at ?? overview.data.ultimo_backup?.started_at;

  return (
    <SettingsSection
      title="Backup"
      description="Leitura real do estado de backup salvo no backend."
      footer={
        <Button asChild className="btn-gold">
          <Link to="/admin/backup">Abrir central de backup</Link>
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Destinos" value={String(destinos)} />
        <Card label="Conectados" value={String(conectados)} />
        <Card
          label="Backup automatico"
          value={settings.data?.auto_enabled ? "Ativo" : "Desativado"}
        />
        <Card
          label="Criptografia"
          value={settings.data?.encryption_enabled ? "Ativa" : "Nao configurada"}
        />
      </div>
      <div className="mt-4 rounded-lg border border-border/50 bg-background/30 p-4 text-sm text-muted-foreground">
        {overview.error || settings.error
          ? "O painel nao conseguiu validar todas as estruturas de backup neste navegador."
          : destinos === 0
            ? "Nenhum destino de backup configurado ainda. Cadastre pelo menos um destino antes de depender do fluxo automatico."
            : `Ultima execucao registrada: ${ultimo ? new Date(ultimo).toLocaleString("pt-BR") : "ainda nao executado"}.`}
      </div>
    </SettingsSection>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
