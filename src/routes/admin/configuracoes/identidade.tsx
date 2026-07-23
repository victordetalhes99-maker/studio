import { useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_IDENTITY,
  getBrandingAssetUrl,
  removeBrandingAsset,
  uploadBrandingAsset,
  useIdentitySettings,
  type IdentitySettings,
} from "@/lib/settings/admin-config";

type AssetKind = "logo" | "icon" | "background";

export default function ConfigIdentidadePage() {
  const { data, updatedAt, isLoading, error, save } = useIdentitySettings();
  const [draft, setDraft] = useState<IdentitySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<AssetKind | null>(null);

  const current: IdentitySettings = { ...DEFAULT_IDENTITY, ...(draft ?? data) };
  const dirty = JSON.stringify(current) !== JSON.stringify(data);

  const logoInput = useRef<HTMLInputElement | null>(null);
  const iconInput = useRef<HTMLInputElement | null>(null);
  const backgroundInput = useRef<HTMLInputElement | null>(null);

  const previews = useMemo(
    () => ({
      logo: getBrandingAssetUrl(current.logoPath),
      icon: getBrandingAssetUrl(current.iconPath),
      background: getBrandingAssetUrl(current.backgroundPath),
    }),
    [current.backgroundPath, current.iconPath, current.logoPath],
  );

  function update(patch: Partial<IdentitySettings>) {
    const base: IdentitySettings = { ...DEFAULT_IDENTITY, ...(draft ?? data) };
    setDraft({ ...base, ...patch });
  }

  async function handleUpload(kind: AssetKind, file: File | null) {
    if (!file) return;
    setUploading(kind);
    try {
      const path = await uploadBrandingAsset(file, kind);
      update(
        kind === "logo"
          ? { logoPath: path }
          : kind === "icon"
            ? { iconPath: path }
            : { backgroundPath: path },
      );
      toast.success("Arquivo enviado para o bucket branding.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no upload.");
    } finally {
      setUploading(null);
    }
  }

  async function handleRemove(kind: AssetKind) {
    const path =
      kind === "logo"
        ? current.logoPath
        : kind === "icon"
          ? current.iconPath
          : current.backgroundPath;
    if (!path) return;
    try {
      await removeBrandingAsset(path);
      update(
        kind === "logo"
          ? { logoPath: "" }
          : kind === "icon"
            ? { iconPath: "" }
            : { backgroundPath: "" },
      );
      toast.success("Arquivo removido do branding.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao remover arquivo.");
    }
  }

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    const result = await save(current);
    setSaving(false);
    if (result.ok) {
      setDraft(null);
      toast.success("Identidade visual persistida no banco.");
      return;
    }
    toast.error(result.error);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300/90">
          Falha ao carregar identidade visual: {error}
        </div>
      )}

      <SettingsSection
        title="Identidade visual"
        description="Arquivos persistidos no bucket publico branding e metadados salvos em app_config."
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
              {saving ? "Salvando..." : "Salvar identidade"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <AssetCard
            title="Logotipo"
            preview={previews.logo}
            busy={uploading === "logo"}
            onChoose={() => logoInput.current?.click()}
            onRemove={() => handleRemove("logo")}
            disabled={isLoading}
          />
          <AssetCard
            title="Icone"
            preview={previews.icon}
            busy={uploading === "icon"}
            onChoose={() => iconInput.current?.click()}
            onRemove={() => handleRemove("icon")}
            disabled={isLoading}
          />
          <AssetCard
            title="Imagem de fundo"
            preview={previews.background}
            busy={uploading === "background"}
            onChoose={() => backgroundInput.current?.click()}
            onRemove={() => handleRemove("background")}
            disabled={isLoading}
          />
        </div>

        <input
          ref={logoInput}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={(e) => handleUpload("logo", e.target.files?.[0] ?? null)}
        />
        <input
          ref={iconInput}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={(e) => handleUpload("icon", e.target.files?.[0] ?? null)}
        />
        <input
          ref={backgroundInput}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => handleUpload("background", e.target.files?.[0] ?? null)}
        />

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome do sistema">
            <Input
              value={current.systemName}
              onChange={(e) => update({ systemName: e.target.value })}
              disabled={isLoading}
            />
          </Field>
          <Field label="Cabecalho PDF">
            <Input
              value={current.pdfHeader}
              onChange={(e) => update({ pdfHeader: e.target.value })}
              disabled={isLoading}
            />
          </Field>
          <Field label="Rodape PDF">
            <Input
              value={current.pdfFooter}
              onChange={(e) => update({ pdfFooter: e.target.value })}
              disabled={isLoading}
            />
          </Field>
          <Field label="Cor principal">
            <Input
              type="color"
              value={current.primaryColor}
              onChange={(e) => update({ primaryColor: e.target.value })}
              disabled={isLoading}
            />
          </Field>
          <Field label="Cor de destaque">
            <Input
              type="color"
              value={current.accentColor}
              onChange={(e) => update({ accentColor: e.target.value })}
              disabled={isLoading}
            />
          </Field>
          <Field label="Cor de superficie">
            <Input
              type="color"
              value={current.surfaceColor}
              onChange={(e) => update({ surfaceColor: e.target.value })}
              disabled={isLoading}
            />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Restaurar padrao"
        description="Recupera a configuracao padrao da identidade visual sem apagar os arquivos do bucket."
      >
        <Button
          variant="outline"
          disabled={isLoading || saving}
          onClick={() => setDraft(DEFAULT_IDENTITY)}
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

function AssetCard({
  title,
  preview,
  busy,
  disabled,
  onChoose,
  onRemove,
}: {
  title: string;
  preview: string | null;
  busy: boolean;
  disabled?: boolean;
  onChoose: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/30 p-4">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-3 flex h-36 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border/50 bg-card/40">
        {preview ? (
          <img src={preview} alt={title} className="max-h-full w-auto object-contain" />
        ) : (
          <div className="text-xs text-muted-foreground">Nenhum arquivo enviado</div>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" onClick={onChoose} disabled={busy || disabled}>
          {busy ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
          )}
          Enviar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={!preview || busy || disabled}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remover
        </Button>
      </div>
    </div>
  );
}
