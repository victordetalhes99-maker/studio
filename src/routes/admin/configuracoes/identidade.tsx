import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Moon, Sun } from "lucide-react";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  DEFAULT_IDENTITY,
  useIdentitySettings,
  type IdentitySettings,
} from "@/lib/settings/admin-config";
import { getStoredAdminTheme, setStoredAdminTheme, type AdminTheme } from "@/lib/admin-theme";

export default function ConfigIdentidadePage() {
  const { data, updatedAt, isLoading, error, save } = useIdentitySettings();
  const [draft, setDraft] = useState<IdentitySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<AdminTheme>(getStoredAdminTheme);

  const current: IdentitySettings = { ...DEFAULT_IDENTITY, ...(draft ?? data) };
  const dirty = JSON.stringify(current) !== JSON.stringify(data);

  useEffect(() => setTheme(getStoredAdminTheme()), []);

  function update(patch: Partial<IdentitySettings>) {
    const base: IdentitySettings = { ...DEFAULT_IDENTITY, ...(draft ?? data) };
    setDraft({ ...base, ...patch });
  }

  function chooseTheme(next: AdminTheme) {
    setTheme(next);
    setStoredAdminTheme(next);
  }

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    const result = await save(current);
    setSaving(false);
    if (result.ok) {
      setDraft(null);
      toast.success("Identidade persistida no banco.");
      return;
    }
    toast.error(result.error);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300/90">
          Falha ao carregar identidade: {error}
        </div>
      )}

      <SettingsSection
        title="Aparência do painel"
        description="Preferência local deste navegador. Não afeta a página pública de cadastro nem os documentos gerados — esses continuam sempre no tema padrão da marca."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-md">
          <button
            type="button"
            onClick={() => chooseTheme("dark")}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4 text-left transition-colors",
              theme === "dark"
                ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10"
                : "border-border/60 bg-background/30 hover:border-border",
            )}
          >
            <Moon className="h-5 w-5 text-[color:var(--gold)]" />
            <div>
              <div className="text-sm font-medium text-foreground">Fundo preto</div>
              <div className="text-[11px] text-muted-foreground">Padrão do sistema</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => chooseTheme("light")}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4 text-left transition-colors",
              theme === "light"
                ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10"
                : "border-border/60 bg-background/30 hover:border-border",
            )}
          >
            <Sun className="h-5 w-5 text-[color:var(--gold)]" />
            <div>
              <div className="text-sm font-medium text-foreground">Fundo branco</div>
              <div className="text-[11px] text-muted-foreground">Texto escuro automático</div>
            </div>
          </button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Identidade nos documentos"
        description="Usado no nome exibido no sistema e no cabeçalho/rodapé dos PDFs gerados."
        footer={
          <>
            <div className="mr-auto text-[11px] text-muted-foreground">
              Última atualização: {updatedAt ? new Date(updatedAt).toLocaleString("pt-BR") : "—"}
            </div>
            <Button variant="ghost" disabled={!dirty || saving} onClick={() => setDraft(null)}>
              Descartar
            </Button>
            <Button
              className="btn-gold"
              disabled={!dirty || saving || isLoading}
              onClick={handleSave}
            >
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome do sistema">
            <Input
              value={current.systemName}
              onChange={(e) => update({ systemName: e.target.value })}
              disabled={isLoading}
            />
          </Field>
          <Field label="Cabeçalho PDF">
            <Input
              value={current.pdfHeader}
              onChange={(e) => update({ pdfHeader: e.target.value })}
              disabled={isLoading}
            />
          </Field>
          <Field label="Rodapé PDF">
            <Input
              value={current.pdfFooter}
              onChange={(e) => update({ pdfFooter: e.target.value })}
              disabled={isLoading}
            />
          </Field>
        </div>
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
