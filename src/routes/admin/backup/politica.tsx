import { Lock, ScrollText } from "lucide-react";
import { PendingModulePage } from "@/components/admin/layout/PendingModulePage";
import { useBackupSettings } from "@/lib/backup/hooks";

export default function BackupPoliticaPage() {
  const { data, isLoading } = useBackupSettings();

  if (isLoading || !data) {
    return (
      <PendingModulePage
        title="Política de backup"
        description="Frequência, retenção, conteúdo e criptografia dos pacotes."
        icon={ScrollText}
        emptyTitle="Carregando política"
        emptyDescription="Aguarde a leitura da configuração no backend."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <ScrollText className="h-3.5 w-3.5 text-[color:var(--gold)]" />
          Automação
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Backup automático" value={data.auto_enabled ? "Ativado" : "Desativado"} />
          <Field label="Frequência" value={data.frequency} />
          <Field label="Horário" value={`${String(data.hour).padStart(2, "0")}:00`} />
          <Field label="Fuso horário" value={data.timezone} />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground/70">
          Agendamento depende da configuração do backend (pg_cron ou worker externo). A política
          está salva, mas a execução automática só será disparada quando o scheduler estiver ativo.
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Retenção
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Diários" value={String(data.retention_daily)} />
          <Field label="Semanais" value={String(data.retention_weekly)} />
          <Field label="Mensais" value={String(data.retention_monthly)} />
          <Field label="Anuais" value={String(data.retention_yearly)} />
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Conteúdo incluído
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.entries(data.content).map(([k, v]) => (
            <div
              key={k}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-3 py-2 text-xs"
            >
              <span className="capitalize text-foreground">{k.replace(/_/g, " ")}</span>
              <span className={v ? "text-emerald-400" : "text-muted-foreground"}>
                {v ? "sim" : "não"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <Lock className="h-3.5 w-3.5 text-[color:var(--gold)]" />
          Criptografia
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Estado" value={data.encryption_enabled ? "Ativa" : "Não configurada"} />
          <Field label="Versão" value={data.encryption_version ?? "—"} />
        </div>
        {!data.encryption_enabled && (
          <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-300/90">
            Criptografia AES-GCM não configurada. Exportação de dados sensíveis permanecerá
            bloqueada até que a chave <code>BACKUP_ENCRYPTION_KEY</code> seja gerada no backend.
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">{label}</div>
      <div className="mt-1 text-sm text-foreground">{value}</div>
    </div>
  );
}
