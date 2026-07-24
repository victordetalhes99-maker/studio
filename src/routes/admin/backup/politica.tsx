import { useEffect, useState } from "react";
import { Lock, ScrollText, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { PendingModulePage } from "@/components/admin/layout/PendingModulePage";
import { Button } from "@/components/ui/button";
import { useBackupSettings } from "@/lib/backup/hooks";
import {
  DEFAULT_BACKUP_PREFERENCES,
  loadBackupPreferences,
  saveBackupPreferences,
  type BackupPreferences,
} from "@/lib/backup/preferences";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">{label}</div>
      <div className="mt-1 text-sm text-foreground">{value}</div>
    </div>
  );
}

function PreferencesPanel() {
  const [prefs, setPrefs] = useState<BackupPreferences>(DEFAULT_BACKUP_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let alive = true;
    loadBackupPreferences()
      .then((p) => {
        if (alive) setPrefs(p);
      })
      .catch(() => {
        if (alive) setLoadError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await saveBackupPreferences(prefs);
      toast.success("Preferências salvas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar preferências.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 p-5 text-xs text-muted-foreground backdrop-blur-sm">
        Carregando preferências...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        <Settings2 className="h-3.5 w-3.5 text-[color:var(--gold)]" />
        Preferências de backup manual
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground/70">
        Não há agendamento automático nesta versão — apenas preferências para o fluxo manual, salvas
        em <code>app_config</code>.
      </p>
      {loadError && (
        <p className="mt-2 text-[11px] text-red-400">
          Não foi possível carregar as preferências salvas. Os valores abaixo são os padrões.
        </p>
      )}

      <div className="mt-4 space-y-3">
        <label className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/30 px-3 py-2.5 text-sm">
          <span className="text-foreground">Lembrar de fazer backup periodicamente</span>
          <input
            type="checkbox"
            checked={prefs.reminderEnabled}
            onChange={(e) => setPrefs((p) => ({ ...p, reminderEnabled: e.target.checked }))}
          />
        </label>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/30 px-3 py-2.5 text-sm">
          <span className="text-foreground">Intervalo recomendado (dias)</span>
          <input
            type="number"
            min={1}
            max={90}
            value={prefs.reminderIntervalDays}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, reminderIntervalDays: Number(e.target.value) || 7 }))
            }
            className="w-16 rounded-md border border-border/60 bg-background/60 px-2 py-1 text-right text-foreground"
          />
        </label>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/30 px-3 py-2.5 text-sm">
          <span className="text-foreground">Formato padrão de exportação</span>
          <select
            value={prefs.defaultFormat}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, defaultFormat: e.target.value as "json" | "csv" }))
            }
            className="rounded-md border border-border/60 bg-background/60 px-2 py-1 text-foreground"
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </label>

        <label className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/30 px-3 py-2.5 text-sm">
          <span className="text-foreground">Exigir confirmação antes de exportar</span>
          <input
            type="checkbox"
            checked={prefs.requireConfirmation}
            onChange={(e) => setPrefs((p) => ({ ...p, requireConfirmation: e.target.checked }))}
          />
        </label>
      </div>

      <Button className="btn-gold mt-4" size="sm" disabled={saving} onClick={handleSave}>
        {saving ? "Salvando..." : "Salvar preferências"}
      </Button>
    </div>
  );
}

export default function BackupPoliticaPage() {
  const { data, isLoading } = useBackupSettings();

  if (isLoading || !data) {
    return (
      <PendingModulePage
        title="Política de backup"
        description="Retenção informativa, conteúdo e preferências do fluxo manual."
        icon={ScrollText}
        emptyTitle="Carregando política"
        emptyDescription="Aguarde a leitura da configuração no backend."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PreferencesPanel />

      <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Retenção (informativa)
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Diários" value={String(data.retention_daily)} />
          <Field label="Semanais" value={String(data.retention_weekly)} />
          <Field label="Mensais" value={String(data.retention_monthly)} />
          <Field label="Anuais" value={String(data.retention_yearly)} />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground/70">
          Estes números são apenas uma referência. Como o backup é baixado localmente, a exclusão de
          cópias antigas é responsabilidade de quem administra os arquivos no dispositivo — não há
          limpeza automática no servidor.
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Conteúdo incluído no backup completo
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
          Criptografia (opcional)
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Estado" value={data.encryption_enabled ? "Ativa" : "Não configurada"} />
          <Field label="Versão" value={data.encryption_version ?? "—"} />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground/70">
          O backup local funciona normalmente sem criptografia adicional — o arquivo já fica apenas
          no seu dispositivo. Se quiser proteger o arquivo baixado, use a criptografia do próprio
          sistema operacional (ex.: um disco/pasta criptografado).
        </p>
      </div>
    </div>
  );
}
