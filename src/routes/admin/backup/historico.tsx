import { Link } from "react-router-dom";
import { History, Play } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
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
} from "@/lib/backup/format";
import { executeManualBackup } from "@/lib/backup/manual";

export default function BackupHistoricoPage() {
  const jobsState = useBackupJobs();
  const destinationsState = useBackupDestinations();
  const [running, setRunning] = useState(false);

  async function handleRunBackup() {
    try {
      setRunning(true);
      const result = await executeManualBackup();
      jobsState.refetch();
      destinationsState.refetch();
      toast.success(
        result.url
          ? `Backup concluido. Planilha atualizada com ${result.totalClientes ?? 0} cliente(s).`
          : "Backup concluido com sucesso.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao executar o backup manual.");
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
          title="Dispara a edge function autenticada de backup manual."
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
                  <td className="px-4 py-3 text-foreground">{STATUS_LABELS[j.type] ?? j.type}</td>
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
