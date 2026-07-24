import { Link } from "react-router-dom";
import {
  Calendar,
  Cloud,
  Database,
  Download,
  Files,
  FileSignature,
  HardDrive,
  History,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import { ProtectionChecklist } from "@/components/admin/backup/ProtectionChecklist";
import { StatusBadge } from "@/components/admin/backup/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  useBackupAlerts,
  useBackupDestinations,
  useBackupJobs,
  useBackupOverview,
  useBackupSettings,
} from "@/lib/backup/hooks";
import { runLocalBackup } from "@/lib/backup/local-export";
import {
  DESTINATION_LABELS,
  formatBytes,
  formatDateTime,
  formatDuration,
} from "@/lib/backup/format";

function MetricRow({
  icon: Icon,
  label,
  value,
  hint,
  status,
}: {
  icon: typeof Cloud;
  label: string;
  value: string;
  hint?: string;
  status?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-[color:var(--gold)]" />
        {label}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-lg font-semibold text-foreground">{value}</span>
        {status ? <StatusBadge status={status} /> : null}
      </div>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

export default function BackupOverviewPage() {
  const overview = useBackupOverview();
  const destinations = useBackupDestinations();
  const jobs = useBackupJobs();
  const settings = useBackupSettings();
  const [running, setRunning] = useState(false);

  const alerts = useBackupAlerts(overview.data, destinations.data, jobs.data, settings.data);

  const ultimo = overview.data.ultimo_backup;
  const primeiroDestino = destinations.data.find((d) => d.status === "conectado");
  const segundoDestino = destinations.data.find(
    (d) => d.status === "conectado" && d.id !== primeiroDestino?.id,
  );

  async function handleRunBackup() {
    try {
      setRunning(true);
      const result = await runLocalBackup();
      overview.refetch();
      destinations.refetch();
      jobs.refetch();
      settings.refetch();
      toast.success(
        `Backup concluido. Arquivo ${result.filename} baixado com ${result.totalRecords} registro(s) de ${result.tablesIncluded} tabela(s).`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao executar o backup local.");
    } finally {
      setRunning(false);
    }
  }

  const checklist = [
    {
      label: "Banco principal",
      done: true,
      detail: "Supabase ativo. Consultas administrativas autenticadas via RLS.",
    },
    {
      label: "Exportação local",
      done: !!ultimo,
      detail: ultimo
        ? `Último backup local em ${formatDateTime(ultimo.started_at)}.`
        : 'Nenhum backup local executado ainda. Clique em "Executar backup manual".',
      to: "/admin/backup",
    },
    {
      label: "Destino externo",
      done: destinations.data.some((d) => d.status === "conectado"),
      detail:
        "Opcional. Cloudflare R2 e Google Drive não são necessários — o backup local funciona sem eles.",
      to: "/admin/backup/destinos",
    },
    {
      label: "Automação",
      done: !!settings.data?.auto_enabled,
      detail: settings.data?.auto_enabled
        ? `${settings.data.frequency} as ${String(settings.data.hour).padStart(2, "0")}:00 (${settings.data.timezone}).`
        : "Nenhum agendamento automático configurado. O backup manual continua disponível a qualquer momento.",
      to: "/admin/backup/politica",
    },
    {
      label: "Teste de restauração",
      done: false,
      detail: "A restauração automatizada ainda não está disponível nesta versão.",
      to: "/admin/backup/restauracao",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--gold)]" />
          Execucao de backup
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground/90">
          Gera uma copia local dos dados atuais do Supabase e baixa diretamente neste dispositivo.
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card/60 to-card/30 p-6 backdrop-blur-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--gold)]" />
              Protecao dos dados
            </div>
            <h2 className="mt-2 font-display text-2xl text-foreground sm:text-3xl">
              {ultimo ? "Protecao local configurada" : "Protecao ainda nao configurada"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Nenhum dado ficticio e exibido: destinos, execucoes e agendamento refletem exatamente
              o estado do backend.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="btn-gold"
              disabled={running}
              onClick={handleRunBackup}
              title="Gera um backup local e baixa o arquivo neste dispositivo."
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {running ? "Executando..." : "Executar backup manual"}
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/backup/destinos">
                <HardDrive className="mr-1.5 h-4 w-4" />
                Configurar destino
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <ProtectionChecklist items={checklist} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricRow
          icon={History}
          label="Ultimo backup"
          value={ultimo ? formatDateTime(ultimo.started_at) : "—"}
          hint={
            ultimo
              ? `${ultimo.type} · ${formatBytes(ultimo.size_bytes)} · ${formatDuration(ultimo.duration_ms)}`
              : "Nenhum backup executado"
          }
          status={ultimo?.status}
        />
        <MetricRow
          icon={Calendar}
          label="Proximo backup"
          value={
            settings.data?.auto_enabled
              ? `${settings.data.frequency} · ${String(settings.data.hour).padStart(2, "0")}:00`
              : "—"
          }
          hint={settings.data?.auto_enabled ? settings.data.timezone : "Agendamento nao ativado"}
        />
        <MetricRow
          icon={Cloud}
          label="Destino principal"
          value={primeiroDestino ? DESTINATION_LABELS[primeiroDestino.kind] : "—"}
          hint={primeiroDestino ? primeiroDestino.label : "Nenhum destino ativo"}
          status={primeiroDestino?.status ?? "nao_configurado"}
        />
        <MetricRow
          icon={Cloud}
          label="Destino secundario"
          value={segundoDestino ? DESTINATION_LABELS[segundoDestino.kind] : "—"}
          hint={segundoDestino ? segundoDestino.label : "Opcional para redundancia"}
          status={segundoDestino?.status ?? "nao_configurado"}
        />
        <MetricRow
          icon={Lock}
          label="Integridade"
          value={ultimo?.checksum_sha256 ? "Hash registrado" : "—"}
          hint={
            ultimo?.checksum_sha256
              ? `${ultimo.checksum_sha256.slice(0, 12)}...`
              : "Nenhuma validacao realizada"
          }
          status={
            ultimo ? (ultimo.status === "completed" ? "conectado" : ultimo.status) : undefined
          }
        />
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <Database className="h-3.5 w-3.5 text-[color:var(--gold)]" />
          Cobertura da protecao
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: Database, label: "Banco de dados" },
            { icon: Files, label: "Documentos e PDFs" },
            { icon: FileSignature, label: "Assinaturas" },
            { icon: Download, label: "Configuracoes" },
          ].map((c) => {
            const inclui = settings.data?.content?.[c.label] ?? true;
            return (
              <div
                key={c.label}
                className="rounded-lg border border-border/50 bg-background/30 p-3"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <c.icon className="h-3.5 w-3.5" />
                  {c.label}
                </div>
                <div className="mt-2 text-sm text-foreground">
                  {inclui ? "Incluido" : "Excluido"}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground/70">
                  {ultimo ? "presente no ultimo pacote" : "aguardando primeira execucao"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Alertas ativos
          </div>
          <ul className="mt-3 space-y-2">
            {alerts.slice(0, 4).map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-background/30 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      status={
                        a.severity === "critico"
                          ? "failed"
                          : a.severity === "atencao"
                            ? "partial"
                            : "queued"
                      }
                      label={
                        a.severity === "critico"
                          ? "Critico"
                          : a.severity === "atencao"
                            ? "Atencao"
                            : "Info"
                      }
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
              </li>
            ))}
          </ul>
        </div>
      )}

      {overview.error && (
        <EmptyState
          icon={ShieldCheck}
          title="Nao foi possivel carregar o estado da protecao"
          description="Verifique se voce esta autenticado como administrador. Nenhum dado e exibido em modo de fallback."
        />
      )}
    </div>
  );
}
