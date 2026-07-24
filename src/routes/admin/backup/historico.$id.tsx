import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, RefreshCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import { StatusBadge } from "@/components/admin/backup/StatusBadge";
import { useBackupJobs } from "@/lib/backup/hooks";
import {
  DESTINATION_LABELS,
  formatBytes,
  formatDateTime,
  formatDuration,
  TYPE_LABELS,
} from "@/lib/backup/format";

export default function BackupDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const { data: jobs, isLoading } = useBackupJobs();
  const job = jobs.find((j) => j.id === id);

  if (isLoading) {
    return <EmptyState icon={ShieldCheck} title="Carregando execução" compact />;
  }

  if (!job) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Execução não encontrada"
        description="A execução pode ter sido removida ou você não tem permissão para visualizá-la."
        action={
          <Button asChild variant="outline">
            <Link to="/admin/backup/historico">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <Link
        to="/admin/backup/historico"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao histórico
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Execução
          </div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">{job.id}</div>
          <h2 className="mt-2 font-display text-2xl text-foreground">
            {TYPE_LABELS[job.type] ?? job.type} · {formatDateTime(job.started_at)}
          </h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={job.status} />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!job.storage_path}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Baixar
            </Button>
            <Button size="sm" variant="outline" disabled={!job.checksum_sha256}>
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Validar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Início" value={formatDateTime(job.started_at)} />
        <Field label="Fim" value={formatDateTime(job.completed_at)} />
        <Field label="Tamanho" value={formatBytes(job.size_bytes)} />
        <Field label="Duração" value={formatDuration(job.duration_ms)} />
        <Field
          label="Destino"
          value={job.destination_kind ? DESTINATION_LABELS[job.destination_kind] : "—"}
        />
        <Field label="Registros" value={job.registros_incluidos?.toString() ?? "—"} />
        <Field label="Arquivos" value={job.arquivos_incluidos?.toString() ?? "—"} />
        <Field label="Versão do sistema" value={job.system_version ?? "—"} />
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Etapas</div>
        <ol className="mt-3 space-y-2">
          {(job.progress_stages ?? []).map((s, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-3 py-2 text-xs"
            >
              <span className="text-foreground">{s.label}</span>
              <StatusBadge status={s.error ? "failed" : s.done ? "completed" : "running"} />
            </li>
          ))}
          {(job.progress_stages ?? []).length === 0 && (
            <li className="rounded-lg border border-dashed border-border/50 bg-background/30 px-3 py-4 text-center text-xs text-muted-foreground">
              Nenhuma etapa registrada.
            </li>
          )}
        </ol>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Hash e integridade
        </div>
        <div className="mt-2 break-all font-mono text-xs text-muted-foreground">
          {job.checksum_sha256 ?? "—"}
        </div>
      </div>

      {job.error_message && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 text-sm text-red-300">
          <div className="text-[11px] uppercase tracking-[0.14em]">Erro</div>
          <p className="mt-2 whitespace-pre-wrap">{job.error_message}</p>
        </div>
      )}
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
