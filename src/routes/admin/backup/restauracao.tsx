import { AlertTriangle, RotateCcw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBackupJobs, useBackupSettings } from "@/lib/backup/hooks";
import { formatDateTime } from "@/lib/backup/format";

const FLUXO = [
  "Selecionar backup",
  "Verificar compatibilidade",
  "Validar integridade (hash)",
  "Ler manifesto",
  "Escolher escopo (completo, banco, documentos, configurações, parcial ou cliente)",
  "Gerar snapshot do estado atual",
  "Mostrar impacto (registros criados, alterados, substituídos)",
  "Reautenticação do administrador",
  "Confirmação explícita",
  "Execução monitorada",
  "Validação do resultado",
  "Relatório e auditoria",
];

export default function BackupRestauracaoPage() {
  const { data: jobs } = useBackupJobs();
  const { data: settings } = useBackupSettings();
  const compativeis = jobs.filter((j) => j.status === "completed");
  const habilitado = compativeis.length > 0 && !!settings?.encryption_enabled;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 text-sm text-red-300">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <strong className="text-red-200">Ação destrutiva</strong>
            <p>
              Nenhuma restauração pode ser executada em um único clique. O fluxo abaixo é
              obrigatório e sempre inclui snapshot automático do estado atual antes de qualquer
              alteração.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5 text-[color:var(--gold)]" />
          Fluxo protegido
        </div>
        <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FLUXO.map((f, i) => (
            <li
              key={f}
              className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/30 px-3 py-2 text-xs text-muted-foreground"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/60 text-[10px]">
                {i + 1}
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Executar restauração
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {habilitado
                ? "Selecione uma execução concluída para iniciar o fluxo."
                : "Restauração depende de: backup concluído + criptografia + destino validado."}
            </p>
          </div>
          <Button className="btn-gold" disabled={!habilitado}>
            Iniciar restauração
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {compativeis.slice(0, 5).map((j) => (
            <div
              key={j.id}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-background/30 px-3 py-2 text-xs"
            >
              <div>
                <div className="text-foreground">{formatDateTime(j.started_at)}</div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {j.checksum_sha256?.slice(0, 16) ?? "sem hash"}
                </div>
              </div>
              <Button size="sm" variant="outline" disabled>
                Selecionar
              </Button>
            </div>
          ))}
          {compativeis.length === 0 && (
            <p className="rounded-lg border border-dashed border-border/50 bg-background/30 px-3 py-4 text-center text-xs text-muted-foreground">
              Nenhuma execução concluída disponível para restauração.
            </p>
          )}
        </div>
      </div>

      {!settings?.encryption_enabled && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-300/90">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Restauração depende da configuração do backend e da criptografia autenticada.</p>
          </div>
        </div>
      )}
    </div>
  );
}
