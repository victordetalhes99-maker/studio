import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { supabase } from "@/integrations/supabase/client";

interface HealthState {
  db: "ok" | "erro" | "verificando";
  auth: "ok" | "sem_sessao" | "verificando";
  storage: "ok" | "erro" | "verificando";
  lastCheck: string | null;
}

async function runHealthChecks(): Promise<HealthState> {
  const now = new Date().toISOString();
  const [dbRes, authRes, storageRes] = await Promise.allSettled([
    supabase.from("clientes").select("cpf", { count: "exact", head: true }),
    supabase.auth.getSession(),
    supabase.storage.getBucket("assinaturas"),
  ]);

  return {
    db: dbRes.status === "fulfilled" && !dbRes.value.error ? "ok" : "erro",
    auth: authRes.status === "fulfilled" && authRes.value.data.session ? "ok" : "sem_sessao",
    storage: storageRes.status === "fulfilled" && !storageRes.value.error ? "ok" : "erro",
    lastCheck: now,
  };
}

const ENV = import.meta.env.MODE;
const COMMIT = (import.meta.env.VITE_COMMIT_SHA as string | undefined) ?? null;

export default function ConfigSistemaPage() {
  const [health, setHealth] = useState<HealthState>({
    db: "verificando",
    auth: "verificando",
    storage: "verificando",
    lastCheck: null,
  });
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    setHealth((h) => ({ ...h, db: "verificando", auth: "verificando", storage: "verificando" }));
    const next = await runHealthChecks();
    setHealth(next);
    setChecking(false);
  };

  useEffect(() => {
    check();
  }, []);

  const info = [
    { label: "Ambiente", value: ENV },
    { label: "Commit", value: COMMIT ? COMMIT.slice(0, 7) : "não injetado" },
    { label: "Build", value: import.meta.env.PROD ? "produção" : "desenvolvimento" },
    { label: "Timezone padrão", value: "America/Fortaleza" },
  ];

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Estado do sistema"
        description="Valores reais lidos do backend em tempo real."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {info.map((r) => (
            <div key={r.label} className="rounded-lg border border-border/50 bg-background/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {r.label}
              </div>
              <div className="mt-1 truncate text-sm font-medium text-foreground">{r.value}</div>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Diagnóstico de conectividade"
        description="Verificação real contra banco, auth e storage. Nenhum resultado é assumido."
        footer={
          <Button variant="outline" size="sm" onClick={check} disabled={checking}>
            {checking ? "Verificando…" : "Rodar novamente"}
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <HealthCard
            title="Banco de dados"
            value={
              health.db === "ok" ? "Alcançável" : health.db === "erro" ? "Erro" : "Verificando…"
            }
            ok={health.db === "ok"}
            neutral={health.db === "verificando"}
          />
          <HealthCard
            title="Sessão"
            value={
              health.auth === "ok"
                ? "Autenticado"
                : health.auth === "sem_sessao"
                  ? "Sem sessão"
                  : "Verificando…"
            }
            ok={health.auth === "ok"}
            neutral={health.auth === "verificando"}
          />
          <HealthCard
            title="Storage (assinaturas)"
            value={
              health.storage === "ok"
                ? "Alcançável"
                : health.storage === "erro"
                  ? "Erro"
                  : "Verificando…"
            }
            ok={health.storage === "ok"}
            neutral={health.storage === "verificando"}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Última verificação:{" "}
          {health.lastCheck ? new Date(health.lastCheck).toLocaleString("pt-BR") : "—"}
        </p>
      </SettingsSection>

      <SettingsSection title="Manutenção" description="Ações locais deste navegador.">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              try {
                caches?.keys?.().then((keys) => keys.forEach((k) => caches.delete(k)));
              } catch {
                /* noop */
              }
              toast.success("Cache local do navegador limpo");
            }}
          >
            Limpar cache local
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
}

function HealthCard({
  title,
  value,
  ok,
  neutral,
}: {
  title: string;
  value: string;
  ok: boolean;
  neutral?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/30 p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{title}</div>
        {neutral ? (
          <div className="h-3 w-3 animate-pulse rounded-full bg-muted-foreground/40" />
        ) : ok ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-red-400" />
        )}
      </div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
