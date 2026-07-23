import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import {
  DEFAULT_STUDIO,
  studioSchema,
  useStudioSettings,
  type StudioSettings,
} from "@/lib/settings";
import { cn } from "@/lib/utils";

const FIELDS: Array<{
  key: keyof StudioSettings;
  label: string;
  type?: string;
  placeholder?: string;
  full?: boolean;
}> = [
  { key: "nomeEstudio", label: "Nome comercial", placeholder: "85 TATTOO Studio" },
  { key: "nomeEmpresarial", label: "Razao social", placeholder: "Nome juridico" },
  { key: "documento", label: "CNPJ", placeholder: "00.000.000/0000-00" },
  { key: "telefone", label: "Telefone institucional", placeholder: "(00) 0000-0000" },
  { key: "whatsapp", label: "WhatsApp institucional", placeholder: "(00) 00000-0000" },
  {
    key: "email",
    label: "E-mail institucional",
    type: "email",
    placeholder: "contato@estudio.com",
  },
  { key: "lgpdEmail", label: "E-mail LGPD", type: "email", placeholder: "privacidade@estudio.com" },
  {
    key: "privacyContactChannel",
    label: "Canal LGPD",
    placeholder: "Portal, e-mail ou telefone oficial",
    full: true,
  },
  {
    key: "privacyResponsible",
    label: "Responsavel pela privacidade",
    placeholder: "Nome ou area responsavel",
  },
  { key: "dpoName", label: "Encarregado / DPO", placeholder: "Preencher quando aplicavel" },
  { key: "site", label: "Site", placeholder: "https://..." },
  { key: "cep", label: "CEP", placeholder: "00000-000" },
  { key: "endereco", label: "Endereco", placeholder: "Rua, numero, complemento", full: true },
  { key: "cidade", label: "Cidade" },
  { key: "estado", label: "Estado" },
  { key: "timezone", label: "Fuso horario", placeholder: "America/Fortaleza" },
  { key: "horario", label: "Horario de atendimento", placeholder: "Seg-Sex, 10h-19h", full: true },
  { key: "privacyResponseDeadlineDays", label: "Prazo interno de resposta (dias)", type: "number" },
];

function formatDateTime(iso: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function ConfigGeralPage() {
  const { data, updatedAt, persistedInDb, isLoading, error, refetch, save } = useStudioSettings();
  const [draft, setDraft] = useState<StudioSettings | null>(null);
  const [saving, setSaving] = useState(false);

  const current = draft ?? data;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(data);

  const validation = useMemo(() => studioSchema.safeParse(current), [current]);
  const fieldErrors = useMemo(() => {
    if (validation.success) return {} as Partial<Record<keyof StudioSettings, string>>;
    const map: Partial<Record<keyof StudioSettings, string>> = {};
    for (const issue of validation.error.issues) {
      const k = issue.path[0] as keyof StudioSettings | undefined;
      if (k && !map[k]) map[k] = issue.message;
    }
    return map;
  }, [validation]);

  const update = (patch: Partial<StudioSettings>) => setDraft({ ...(draft ?? data), ...patch });

  const productionReadyFields = [
    current.nomeEmpresarial,
    current.documento,
    current.endereco,
    current.email,
    current.lgpdEmail,
    current.privacyContactChannel,
    current.privacyResponsible,
  ];
  const productionReady = productionReadyFields.every(
    (item) => String(item ?? "").trim().length > 0,
  );

  const handleSave = async () => {
    if (!dirty || !validation.success || saving) return;
    setSaving(true);
    const res = await save({
      ...validation.data,
      productionChecklistCompleted: productionReady && validation.data.productionChecklistCompleted,
    });
    setSaving(false);
    if (res.ok) {
      setDraft(null);
      toast.success(
        res.persistedInDb
          ? "Dados institucionais salvos no banco."
          : "Salvo localmente. Faca login como admin para persistir no banco.",
      );
    } else {
      toast.error(res.error);
    }
  };

  const handleReset = () => setDraft(null);

  return (
    <div className="space-y-6">
      {!persistedInDb && !isLoading && !error && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300/90">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            <strong>Sem persistencia no banco.</strong> Sem sessao administrativa autenticada, as
            alteracoes ficam apenas neste navegador. Faca login como admin para gravar em
            <code className="mx-1 rounded bg-background/40 px-1 py-0.5 text-[10px]">
              app_config
            </code>
            .
          </p>
        </div>
      )}
      {error && (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300/90">
          <span>Nao foi possivel carregar as configuracoes: {error}</span>
          <Button size="sm" variant="outline" onClick={refetch}>
            Tentar novamente
          </Button>
        </div>
      )}

      {!productionReady && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          Configuracao de producao ainda incompleta: preencha dados do controlador e canal LGPD
          antes de marcar a implantacao como concluida.
        </div>
      )}

      <SettingsSection
        title="Dados do controlador"
        description="Informacoes institucionais aplicadas ao aviso de privacidade, rodape, confirmacoes e documentos futuros."
        footer={
          <>
            <div className="mr-auto flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                {persistedInDb ? "Banco: app_config" : "Somente local (sem admin)"}
              </span>
              <span>Ultima atualizacao: {formatDateTime(updatedAt)}</span>
              {dirty && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">
                  Alteracoes nao salvas
                </span>
              )}
            </div>
            <Button variant="ghost" onClick={handleReset} disabled={!dirty || saving}>
              Descartar
            </Button>
            <Button
              className="btn-gold"
              disabled={!dirty || !validation.success || saving}
              onClick={handleSave}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Salvando...
                </>
              ) : (
                "Salvar alteracoes"
              )}
            </Button>
          </>
        }
      >
        <fieldset disabled={isLoading || saving} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className={cn(f.full && "sm:col-span-2")}>
                <Label className="text-xs font-medium text-muted-foreground">{f.label}</Label>
                <Input
                  className="mt-1.5"
                  type={f.type ?? "text"}
                  placeholder={f.placeholder}
                  value={String(current[f.key] ?? "")}
                  onChange={(e) =>
                    update({
                      [f.key]: f.type === "number" ? Number(e.target.value || 0) : e.target.value,
                    } as Partial<StudioSettings>)
                  }
                  aria-invalid={Boolean(fieldErrors[f.key])}
                />
                {fieldErrors[f.key] && (
                  <p className="mt-1 text-[11px] text-destructive">{fieldErrors[f.key]}</p>
                )}
              </div>
            ))}
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground">Descricao curta</Label>
            <Textarea
              className="mt-1.5"
              rows={3}
              maxLength={500}
              value={current.descricao}
              onChange={(e) => update({ descricao: e.target.value })}
            />
            {fieldErrors.descricao && (
              <p className="mt-1 text-[11px] text-destructive">{fieldErrors.descricao}</p>
            )}
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-background/20 p-4 text-sm">
            <input
              type="checkbox"
              checked={current.productionChecklistCompleted}
              onChange={(e) => update({ productionChecklistCompleted: e.target.checked })}
              disabled={!productionReady}
              className="mt-1 size-4 accent-[oklch(0.82_0.13_85)]"
            />
            <span className="text-foreground/85">
              Marcar configuracao de producao como concluida somente apos preencher dados do
              controlador, canal LGPD e responsavel institucional.
            </span>
          </label>
        </fieldset>

        {isLoading && (
          <p className="text-[11px] text-muted-foreground">Carregando configuracoes...</p>
        )}
      </SettingsSection>

      <SettingsSection
        title="Restaurar padrao"
        description="Volta os dados do controlador ao valor de fabrica. Documentos historicos nao sao afetados."
      >
        <Button
          variant="outline"
          size="sm"
          disabled={saving || isLoading}
          onClick={() => setDraft(DEFAULT_STUDIO)}
        >
          Aplicar valores padrao (revisar antes de salvar)
        </Button>
      </SettingsSection>
    </div>
  );
}
