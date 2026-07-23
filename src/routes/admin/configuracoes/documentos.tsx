import { useState } from "react";
import { toast } from "sonner";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StoredDocumentTemplate } from "@/lib/document-templates";
import {
  DEFAULT_DOCUMENT_SETTINGS,
  useDocumentSettings,
  type DocumentSettings,
} from "@/lib/settings/admin-config";

export default function ConfigDocumentosPage() {
  const { data, updatedAt, isLoading, error, save } = useDocumentSettings();
  const [draft, setDraft] = useState<DocumentSettings | null>(null);
  const [saving, setSaving] = useState(false);

  const current: DocumentSettings = { ...DEFAULT_DOCUMENT_SETTINGS, ...(draft ?? data) };
  const dirty = JSON.stringify(current) !== JSON.stringify(data);

  function update<K extends keyof DocumentSettings>(key: K, value: DocumentSettings[K]) {
    const base: DocumentSettings = { ...DEFAULT_DOCUMENT_SETTINGS, ...(draft ?? data) };
    setDraft({ ...base, [key]: value } as DocumentSettings);
  }

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    const result = await save(current);
    setSaving(false);
    if (result.ok) {
      setDraft(null);
      toast.success("Configurações de documentos persistidas no banco.");
      return;
    }
    toast.error(result.error);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300/90">
          Falha ao carregar configurações de documentos: {error}
        </div>
      )}

      <SettingsSection
        title="Modelos e nomenclatura"
        description="Editor persistente de metadados, versões e modelos versionados do fluxo documental."
        footer={
          <>
            <div className="mr-auto text-[11px] text-muted-foreground">
              Última atualização: {updatedAt ? new Date(updatedAt).toLocaleString("pt-BR") : "-"}
            </div>
            <Button variant="ghost" disabled={!dirty || saving} onClick={() => setDraft(null)}>
              Descartar
            </Button>
            <Button
              className="btn-gold"
              disabled={!dirty || saving || isLoading}
              onClick={handleSave}
            >
              {saving ? "Salvando..." : "Salvar documentos"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Prefixo de arquivo">
            <Input
              value={current.filePrefix}
              onChange={(e) => update("filePrefix", e.target.value)}
              disabled={isLoading}
            />
          </Field>
          <Field label="Padrão de nomenclatura">
            <Input
              value={current.namingPattern}
              onChange={(e) => update("namingPattern", e.target.value)}
              disabled={isLoading}
            />
          </Field>
          <Field label="Versão da ficha">
            <Input
              value={current.fichaVersionLabel}
              onChange={(e) => update("fichaVersionLabel", e.target.value)}
              disabled={isLoading}
            />
          </Field>
          <Field label="Cabeçalho PDF">
            <Input
              value={current.pdfHeader}
              onChange={(e) => update("pdfHeader", e.target.value)}
              disabled={isLoading}
            />
          </Field>
          <Field label="Rodapé PDF">
            <Input
              value={current.pdfFooter}
              onChange={(e) => update("pdfFooter", e.target.value)}
              disabled={isLoading}
            />
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4">
          <Block
            label="Resumo do contrato"
            value={current.contractLead}
            onChange={(value) => update("contractLead", value)}
            disabled={isLoading}
          />
          <Block
            label="Resumo da ficha"
            value={current.ficheLead}
            onChange={(value) => update("ficheLead", value)}
            disabled={isLoading}
          />
          <Block
            label="Resumo do termo LGPD"
            value={current.consentLead}
            onChange={(value) => update("consentLead", value)}
            disabled={isLoading}
          />
        </div>

        <TemplateEditor
          title="Modelo de contrato"
          version={current.contractTemplateVersion}
          body={current.contractTemplateBody}
          history={current.contractTemplateHistory}
          disabled={isLoading}
          onVersionChange={(value) => update("contractTemplateVersion", value)}
          onBodyChange={(value) => update("contractTemplateBody", value)}
        />

        <TemplateEditor
          title="Modelo de ficha/anamnese"
          version={current.anamneseTemplateVersion}
          body={current.anamneseTemplateBody}
          history={current.anamneseTemplateHistory}
          disabled={isLoading}
          onVersionChange={(value) => update("anamneseTemplateVersion", value)}
          onBodyChange={(value) => update("anamneseTemplateBody", value)}
        />

        <TemplateEditor
          title="Modelo LGPD"
          version={current.lgpdTemplateVersion}
          body={current.lgpdTemplateBody}
          history={current.lgpdTemplateHistory}
          disabled={isLoading}
          onVersionChange={(value) => update("lgpdTemplateVersion", value)}
          onBodyChange={(value) => update("lgpdTemplateBody", value)}
        />

        <p className="mt-4 text-xs text-muted-foreground">
          Placeholders aceitos na nomenclatura: <code>{`{prefix}`}</code>, <code>{`{tipo}`}</code>,
          <code>{` {cpfMasked}`}</code>, <code>{` {versao}`}</code> e <code>{` {data}`}</code>.
        </p>
      </SettingsSection>

      <SettingsSection
        title="Restaurar padrão"
        description="Recupera a configuração de documentos sem apagar contratos, fichas ou snapshots já emitidos."
      >
        <Button
          variant="outline"
          disabled={saving || isLoading}
          onClick={() => setDraft(DEFAULT_DOCUMENT_SETTINGS)}
        >
          Aplicar valores padrão
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

function Block({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Textarea
        className="mt-1.5"
        rows={3}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function TemplateEditor({
  title,
  version,
  body,
  history,
  disabled,
  onVersionChange,
  onBodyChange,
}: {
  title: string;
  version: string;
  body: string;
  history: StoredDocumentTemplate[];
  disabled?: boolean;
  onVersionChange: (value: string) => void;
  onBodyChange: (value: string) => void;
}) {
  return (
    <div className="mt-6 rounded-xl border border-border/60 bg-card/20 p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[200px_1fr]">
        <Field label={`${title} · versão atual`}>
          <Input
            value={version}
            onChange={(e) => onVersionChange(e.target.value)}
            disabled={disabled}
          />
        </Field>
        <div>
          <Label className="text-xs font-medium text-muted-foreground">{title} · corpo</Label>
          <Textarea
            className="mt-1.5 min-h-52"
            value={body}
            disabled={disabled}
            onChange={(e) => onBodyChange(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4">
        <Label className="text-xs font-medium text-muted-foreground">Histórico persistido</Label>
        <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-border/50 bg-background/30">
          <table className="w-full text-sm">
            <thead className="border-b border-border/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Versão</th>
                <th className="px-3 py-2 text-left font-medium">Criado em</th>
                <th className="px-3 py-2 text-left font-medium">Prévia</th>
              </tr>
            </thead>
            <tbody>
              {[...history]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((item) => (
                  <tr
                    key={`${item.version}-${item.createdAt}`}
                    className="border-b border-border/30 last:border-0"
                  >
                    <td className="px-3 py-2 align-top">{item.version}</td>
                    <td className="px-3 py-2 align-top">
                      {new Date(item.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {item.body.slice(0, 140)}
                      {item.body.length > 140 ? "..." : ""}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
