import { useState } from "react";
import { Cloud, Download, HardDrive, Info, ShieldCheck, TestTube2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import { StatusBadge } from "@/components/admin/backup/StatusBadge";
import { useBackupDestinations, useBackupJobs } from "@/lib/backup/hooks";
import { formatDateTime } from "@/lib/backup/format";
import { runLocalBackup } from "@/lib/backup/local-export";

function LocalDestinationCard() {
  const jobsState = useBackupJobs();
  const [running, setRunning] = useState(false);
  const ultimoLocal = jobsState.data.find((j) => j.destination_kind === "local");

  async function handleRun() {
    try {
      setRunning(true);
      const result = await runLocalBackup();
      jobsState.refetch();
      toast.success(
        `Backup concluido. Arquivo ${result.filename} baixado com ${result.totalRecords} registro(s).`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao executar o backup local.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <Download className="h-3.5 w-3.5 text-[color:var(--gold)]" />
            Download local
          </div>
          <h3 className="mt-2 font-display text-lg text-foreground">Backup local (padrão)</h3>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Gera um arquivo JSON completo com os dados atuais e baixa direto neste dispositivo.
            Funciona sem credenciais e sem custo.
          </p>
        </div>
        <StatusBadge status="conectado" label="Disponível" />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/40 bg-background/30 p-2.5">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
            Requer credencial
          </dt>
          <dd className="mt-0.5 text-[11px] text-foreground">Não</dd>
        </div>
        <div className="rounded-lg border border-border/40 bg-background/30 p-2.5">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
            Custo externo
          </dt>
          <dd className="mt-0.5 text-[11px] text-foreground">Nenhum</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] text-muted-foreground/80">
          Última execução:{" "}
          {ultimoLocal ? formatDateTime(ultimoLocal.started_at) : "Nunca executado"}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={running} onClick={handleRun}>
            <TestTube2 className="mr-1.5 h-3.5 w-3.5" /> Testar exportação
          </Button>
          <Button size="sm" className="btn-gold" disabled={running} onClick={handleRun}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {running ? "Executando..." : "Executar backup"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function UnavailableDestinationCard({
  kind,
  icon: Icon,
  label,
  description,
}: {
  kind: string;
  icon: typeof Cloud;
  label: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <Icon className="h-3.5 w-3.5 text-[color:var(--gold)]" />
            {label}
          </div>
          <h3 className="mt-2 font-display text-lg text-foreground">{label}</h3>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">{description}</p>
        </div>
        <StatusBadge status="nao_configurado" />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] text-muted-foreground/80">Última validação: —</div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled>
            <TestTube2 className="mr-1.5 h-3.5 w-3.5" /> Testar
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled
            title={`Integração ${kind} não implementada`}
          >
            Integração não implementada
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function BackupDestinosPage() {
  const { error } = useBackupDestinations();

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground backdrop-blur-sm">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--gold)]" />
          <p>
            R2 e Google Drive são destinos opcionais. O backup local funciona sem serviços externos.
          </p>
        </div>
      </div>

      {error && (
        <EmptyState
          icon={HardDrive}
          title="Não foi possível carregar os destinos"
          description="Verifique se você está autenticado como administrador."
          compact
        />
      )}

      {!error && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <LocalDestinationCard />
          <UnavailableDestinationCard
            kind="Cloudflare R2"
            icon={Cloud}
            label="Cloudflare R2"
            description="Destino externo opcional para redundância. Ainda não há backend configurado — nenhuma credencial é solicitada no navegador."
          />
          <UnavailableDestinationCard
            kind="Google Drive"
            icon={HardDrive}
            label="Google Drive"
            description="Cópia secundária opcional via OAuth. Ainda não há backend configurado — nenhuma credencial é solicitada no navegador."
          />
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-border/50 bg-background/30 p-4 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--gold)]" />
        <p>
          Credenciais nunca são digitadas nem armazenadas no navegador. R2 e Google Drive só
          aparecerão como "Conectado" quando um backend real de integração existir.
        </p>
      </div>
    </div>
  );
}
