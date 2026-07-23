import { useState } from "react";
import { toast } from "sonner";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  DEFAULT_ADMIN_PROFILE,
  useAdminProfileSettings,
  type AdminProfileSettings,
} from "@/lib/settings/admin-config";

export default function ConfigAdministradorPage() {
  const auth = useAuth();
  const { data, updatedAt, isLoading, error, save } = useAdminProfileSettings();
  const [draft, setDraft] = useState<AdminProfileSettings | null>(null);
  const [saving, setSaving] = useState(false);

  const current: AdminProfileSettings = { ...DEFAULT_ADMIN_PROFILE, ...(draft ?? data) };
  const dirty = JSON.stringify(current) !== JSON.stringify(data);

  function update<K extends keyof AdminProfileSettings>(key: K, value: AdminProfileSettings[K]) {
    const base: AdminProfileSettings = { ...DEFAULT_ADMIN_PROFILE, ...(draft ?? data) };
    setDraft({ ...base, [key]: value } as AdminProfileSettings);
  }

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    const result = await save(current);
    setSaving(false);
    if (result.ok) {
      setDraft(null);
      toast.success("Perfil administrativo persistido no banco.");
      return;
    }
    toast.error(result.error);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300/90">
          Falha ao carregar dados do administrador: {error}
        </div>
      )}

      <SettingsSection
        title="Conta administrativa"
        description="Metadados administrativos persistidos em app_config, preservando o usuario autenticado do Supabase."
        footer={
          <>
            <div className="mr-auto text-[11px] text-muted-foreground">
              Ultima atualizacao: {updatedAt ? new Date(updatedAt).toLocaleString("pt-BR") : "-"}
            </div>
            <Button variant="ghost" disabled={!dirty || saving} onClick={() => setDraft(null)}>
              Descartar
            </Button>
            <Button
              className="btn-gold"
              disabled={!dirty || saving || isLoading}
              onClick={handleSave}
            >
              {saving ? "Salvando..." : "Salvar perfil"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Info label="E-mail autenticado" value={auth.email ?? "Sem sessao"} />
          <Info label="User ID" value={auth.userId ?? "-"} mono />
          <Field label="Nome exibido">
            <Input
              value={current.displayName}
              onChange={(e) => update("displayName", e.target.value)}
              disabled={isLoading}
            />
          </Field>
          <Field label="Cargo">
            <Input
              value={current.roleTitle}
              onChange={(e) => update("roleTitle", e.target.value)}
              disabled={isLoading}
            />
          </Field>
          <Field label="E-mail de suporte">
            <Input
              type="email"
              value={current.supportEmail}
              onChange={(e) => update("supportEmail", e.target.value)}
              disabled={isLoading}
            />
          </Field>
          <Field label="Avatar no branding">
            <Input
              value={current.avatarPath}
              onChange={(e) => update("avatarPath", e.target.value)}
              disabled={isLoading}
              placeholder="avatar-admin.png"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Label className="text-xs font-medium text-muted-foreground">Observacoes internas</Label>
          <Textarea
            className="mt-1.5"
            rows={4}
            value={current.notes}
            onChange={(e) => update("notes", e.target.value)}
            disabled={isLoading}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Restaurar padrao"
        description="Recupera os metadados de apresentacao sem alterar o usuario admin do Auth."
      >
        <Button
          variant="outline"
          disabled={saving || isLoading}
          onClick={() => setDraft(DEFAULT_ADMIN_PROFILE)}
        >
          Aplicar valores padrao
        </Button>
      </SettingsSection>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={mono ? "mt-1 font-mono text-xs text-foreground" : "mt-1 text-sm text-foreground"}
      >
        {value}
      </div>
    </div>
  );
}
