import { Link } from "react-router-dom";
import { History, Play } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import { StatusBadge } from "@/components/admin/backup/StatusBadge";
import { Button } from "@/components/ui/button";
import { useBackupDestinations, useBackupJobs } from "@/lib/backup/hooks";
import {
  DESTINATION_LABELS,
  formatBytes,
  formatDateTime,
  formatDuration,
  STATUS_LABELS,
  TYPE_LABELS,
} from "@/lib/backup/format";
import { runLocalBackup } from "@/lib/backup/local-export";
import type { BackupJobStatus, BackupJobType, DestinationKind } from "@/lib/backup/types";

const PERIOD_OPTIONS = [
  { value: "all", label: "Qualquer período" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

export default function BackupHistoricoPage() {
  const jobsState = useBackupJobs();
  const destinationsState = useBackupDestinations();
  const [running, setRunning] = useState(false);

  const [statusFilter, setStatusFilter] = useState<BackupJobStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<BackupJobType | "all">("all");
  const [destinationFilter, setDestinationFilter] = useState<DestinationKind | "all">("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("");

  const filteredJobs = useMemo(() => {
    const periodDays = periodFilter === "all" ? null : Number(periodFilter);
    const cutoff = periodDays ? Date.now() - periodDays * 24 * 60 * 60 * 1000 : null;
    return jobsState.data.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (typeFilter !== "all" && j.type !== typeFilter) return false;
      if (destinationFilter !== "all" && j.destination_kind !== destinationFilter) return false;
      if (cutoff && new Date(j.started_at).getTime() < cutoff) return false;
      if (
        userFilter.trim() &&
        !j.criado_por?.toLowerCase().includes(userFilter.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [jobsState.data, statusFilter, typeFilter, destinationFilter, periodFilter, userFilter]);

  async function handleRunBackup() {
    try {
      setRunning(true);
      const result = await runLocalBackup();
      jobsState.refetch();
      destinationsState.refetch();
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Toda execucao registrada e auditavel, com hash e responsavel. Nenhuma linha ficticia.
        </p>
        <Button
          className="btn-gold"
          disabled={running}
          onClick={handleRunBackup}
          title="Gera um backup local e baixa o arquivo neste dispositivo."
        >
          <Play className="mr-1.5 h-4 w-4" />
          {running ? "Executando..." : "Executar backup manual"}
        </Button>
      </div>

      {jobsState.error && (
        <EmptyState
          icon={History}
          title="Historico indisponivel"
          description="Autentique-se como administrador para visualizar as execucoes."
        />
      )}

      {!jobsState.error && jobsState.data.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-card/30 p-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as BackupJobStatus | "all")}
            className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 text-xs text-foreground"
          >
            <option value="all">Qualquer status</option>
            {Object.keys(STATUS_LABELS)
              .filter((k) =>
                [
                  "queued",
                  "running",
                  "completed",
                  "partial",
                  "failed",
                  "cancelado",
                  "validando",
                ].includes(k),
              )
              .map((k) => (
                <option key={k} value={k}>
                  {STATUS_LABELS[k]}
                </option>
              ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as BackupJobType | "all")}
            className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 text-xs text-foreground"
          >
            <option value="all">Qualquer tipo</option>
            {["completo", "banco", "documentos", "incremental", "manual"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={destinationFilter}
            onChange={(e) => setDestinationFilter(e.target.value as DestinationKind | "all")}
            className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 text-xs text-foreground"
          >
            <option value="all">Qualquer destino</option>
            {Object.entries(DESTINATION_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 text-xs text-foreground"
          >
            {PERIOD_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            placeholder="Filtrar por UUID do usuário"
            className="min-w-[180px] flex-1 rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60"
          />
        </div>
      )}

      {!jobsState.error && !jobsState.isLoading && jobsState.data.length === 0 && (
        <EmptyState
          icon={History}
          title="Nenhum backup foi executado"
          description="Dispare o primeiro backup manual ou configure os destinos externos para iniciar o historico."
          action={
            <Button asChild variant="outline">
              <Link to="/admin/backup/destinos">Configurar destino</Link>
            </Button>
          }
        />
      )}

      {jobsState.data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border/40 bg-background/40 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Data</th>
                <th className="px-4 py-2.5">Tipo</th>
                <th className="px-4 py-2.5">Destino</th>
                <th className="px-4 py-2.5">Tamanho</th>
                <th className="px-4 py-2.5">Duracao</th>
                <th className="px-4 py-2.5">Integridade</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {jobsState.data.map((j) => (
                <tr key={j.id} className="hover:bg-background/30">
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDateTime(j.started_at)}
                  </td>
                  <td className="px-4 py-3 text-foreground">{TYPE_LABELS[j.type] ?? j.type}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {j.destination_kind ? DESTINATION_LABELS[j.destination_kind] : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatBytes(j.size_bytes)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDuration(j.duration_ms)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                    {j.checksum_sha256 ? `${j.checksum_sha256.slice(0, 10)}...` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={j.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/admin/backup/historico/${j.id}`}
                      className="text-xs font-medium text-[color:var(--gold)] hover:underline"
                    >
                      Detalhes →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
