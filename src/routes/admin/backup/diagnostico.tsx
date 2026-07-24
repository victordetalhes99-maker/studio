import { useEffect, useState } from "react";
import { Activity, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/backup/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { checkAdminAccess } from "@/lib/auth/adminAccess";
import { checkBrowserSupport } from "@/lib/backup/export-utils";
import { BACKUP_TABLES } from "@/lib/backup/local-export";

interface Check {
  label: string;
  detail: string;
  status: "conectado" | "erro" | "nao_configurado" | "validando";
}

async function runDiagnostics(): Promise<Check[]> {
  const checks: Check[] = [];

  // 1) Sessão
  const access = await checkAdminAccess();
  checks.push({
    label: "Sessão Supabase",
    detail: access.authenticated ? "Sessão ativa e válida." : "Nenhuma sessão autenticada.",
    status: access.authenticated ? "conectado" : "erro",
  });

  // 2) Role admin
  checks.push({
    label: "Role administrativa",
    detail: access.authorized
      ? "Usuário autenticado possui role admin."
      : (access.error ?? "Usuário autenticado não possui role admin."),
    status: access.authorized ? "conectado" : "erro",
  });

  // 3) Acesso às tabelas obrigatórias do backup
  for (const table of BACKUP_TABLES.filter((t) => t.required)) {
    const { error, count } = await supabase
      .from(table.name)
      .select("*", { count: "exact", head: true });
    checks.push({
      label: `Leitura: ${table.name}`,
      detail: error ? error.message : `Acessível (${count ?? 0} registro(s)).`,
      status: error ? "erro" : "conectado",
    });
  }

  // 4) Leitura de backup_jobs
  const { error: jobsReadError } = await supabase
    .from("backup_jobs")
    .select("id", { head: true, count: "exact" });
  checks.push({
    label: "Leitura de backup_jobs",
    detail: jobsReadError ? jobsReadError.message : "Histórico de execuções acessível.",
    status: jobsReadError ? "erro" : "conectado",
  });

  // 5) Inserção + remoção de um registro de diagnóstico real (não fictício:
  // é um registro de teste do próprio diagnóstico, removido imediatamente).
  if (access.authorized) {
    const startedAt = new Date().toISOString();
    const { data: inserted, error: insertError } = await supabase
      .from("backup_jobs")
      .insert({
        type: "manual",
        status: "failed",
        destination_kind: "local",
        started_at: startedAt,
        completed_at: startedAt,
        error_message: "Registro de diagnóstico automático — removido em seguida.",
        criado_por: access.user?.id ?? null,
        manifest: { diagnostic: true },
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      checks.push({
        label: "Permissão de escrita em backup_jobs",
        detail: insertError.message,
        status: "erro",
      });
    } else {
      const { error: deleteError } = await supabase
        .from("backup_jobs")
        .delete()
        .eq("id", inserted!.id);
      checks.push({
        label: "Permissão de escrita em backup_jobs",
        detail: deleteError
          ? `Inserção OK, mas falha ao limpar o registro de teste: ${deleteError.message}`
          : "Inserção e remoção do registro de teste concluídas.",
        status: deleteError ? "erro" : "conectado",
      });
    }
  } else {
    checks.push({
      label: "Permissão de escrita em backup_jobs",
      detail: "Não testado: role administrativa ausente.",
      status: "nao_configurado",
    });
  }

  // 6) Suporte do navegador
  const support = checkBrowserSupport();
  for (const s of support) {
    checks.push({
      label: `Suporte do navegador: ${s.label}`,
      detail: s.supported ? "Disponível." : "Indisponível neste navegador.",
      status: s.supported ? "conectado" : "erro",
    });
  }

  return checks;
}

export default function BackupDiagnosticoPage() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [running, setRunning] = useState(false);

  async function execute() {
    setRunning(true);
    try {
      const result = await runDiagnostics();
      setChecks(result);
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    execute();
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <Activity className="h-3.5 w-3.5 text-[color:var(--gold)]" />
              Diagnóstico da central
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Verificações reais executadas agora mesmo neste navegador: sessão, role, acesso às
              tabelas e suporte do navegador. Nenhum estado é derivado ou simulado.
            </p>
          </div>
          <Button size="sm" variant="outline" disabled={running} onClick={execute}>
            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
            {running ? "Verificando..." : "Rodar novamente"}
          </Button>
        </div>
      </div>

      {checks === null ? (
        <div className="rounded-xl border border-border/60 bg-card/40 p-5 text-xs text-muted-foreground backdrop-blur-sm">
          Executando verificações...
        </div>
      ) : (
        <ul className="space-y-2">
          {checks.map((c) => (
            <li
              key={c.label}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{c.label}</div>
                <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>
              </div>
              <StatusBadge status={c.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
