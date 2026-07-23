import { ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import { StatusBadge } from "@/components/admin/backup/StatusBadge";
import { useBackupJobs } from "@/lib/backup/hooks";
import { formatBytes, formatDateTime } from "@/lib/backup/format";

export default function BackupIntegridadePage() {
  const { data: jobs } = useBackupJobs();
  const comHash = jobs.filter((j) => j.checksum_sha256);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--gold)]" />
          Validação de integridade
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Cada execução calcula SHA-256 no momento do envio e valida o arquivo remoto. Um backup só
          recebe o status <em>Concluído</em> após bater tamanho e hash com o manifesto.
        </p>
      </div>

      {comHash.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nenhuma validação registrada"
          description="Execute o primeiro backup para gerar o hash de integridade."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border/40 bg-background/40 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Execução</th>
                <th className="px-4 py-2.5">Tamanho</th>
                <th className="px-4 py-2.5">SHA-256</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {comHash.map((j) => (
                <tr key={j.id}>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDateTime(j.started_at)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatBytes(j.size_bytes)}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                    {j.checksum_sha256}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={j.status} />
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
