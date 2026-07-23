import { useState } from "react";
import { toast } from "sonner";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_OPERATION,
  useOperationSettings,
  type OperationSettings,
} from "@/lib/settings/admin-config";

export default function ConfigOperacaoPage() {
  const { data, updatedAt, isLoading, error, save } = useOperationSettings();
  const [draft, setDraft] = useState<OperationSettings | null>(null);
  const [saving, setSaving] = useState(false);

  const current: OperationSettings = { ...DEFAULT_OPERATION, ...(draft ?? data) };
  const dirty = JSON.stringify(current) !== JSON.stringify(data);

  function update<K extends keyof OperationSettings>(key: K, value: OperationSettings[K]) {
    const base: OperationSettings = { ...DEFAULT_OPERATION, ...(draft ?? data) };
    setDraft({ ...base, [key]: value } as OperationSettings);
  }

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    const result = await save(current);
    setSaving(false);
    if (result.ok) {
      setDraft(null);
      toast.success("Regras operacionais persistidas no banco.");
      return;
    }
    toast.error(result.error);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300/90">
          Falha ao carregar operacao: {error}
        </div>
      )}

      <SettingsSection
        title="Operacao do estudio"
        description="Parametros administrativos salvos em app_config para orientar recepcao e atendimento."
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
              {saving ? "Salvando..." : "Salvar operacao"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Horario de atendimento">
            <Input
              value={current.businessHours}
              onChange={(e) => update("businessHours", e.target.value)}
              disabled={isLoading}
            />
          </Field>
          <Field label="Duracao padrao (min)">
            <Input
              type="number"
              value={current.defaultSessionMinutes}
              onChange={(e) => update("defaultSessionMinutes", Number(e.target.value || 0))}
              disabled={isLoading}
            />
          </Field>
          <Field label="Tolerancia de atraso (min)">
            <Input
              type="number"
              value={current.lateToleranceMinutes}
              onChange={(e) => update("lateToleranceMinutes", Number(e.target.value || 0))}
              disabled={isLoading}
            />
          </Field>
          <Field label="Capacidade diaria">
            <Input
              type="number"
              value={current.dailyCapacity}
              onChange={(e) => update("dailyCapacity", Number(e.target.value || 0))}
              disabled={isLoading}
            />
          </Field>
          <Field label="Estrategia da fila">
            <Input
              value={current.queueStrategy}
              onChange={(e) => update("queueStrategy", e.target.value)}
              disabled={isLoading}
            />
          </Field>
          <Field label="Formas de pagamento">
            <Input
              value={current.paymentMethods.join(", ")}
              onChange={(e) => update("paymentMethods", splitList(e.target.value))}
              disabled={isLoading}
            />
          </Field>
          <Field label="Tipos de atendimento">
            <Input
              value={current.appointmentTypes.join(", ")}
              onChange={(e) => update("appointmentTypes", splitList(e.target.value))}
              disabled={isLoading}
            />
          </Field>
          <Field label="Salas">
            <Input
              value={current.rooms.join(", ")}
              onChange={(e) => update("rooms", splitList(e.target.value))}
              disabled={isLoading}
            />
          </Field>
          <Field label="Estacoes">
            <Input
              value={current.stations.join(", ")}
              onChange={(e) => update("stations", splitList(e.target.value))}
              disabled={isLoading}
            />
          </Field>
          <Field label="Regras de recorrencia">
            <Input
              value={current.recurrenceRules}
              onChange={(e) => update("recurrenceRules", e.target.value)}
              disabled={isLoading}
            />
          </Field>
        </div>

        <div className="mt-4">
          <Label className="text-xs font-medium text-muted-foreground">Regras de check-in</Label>
          <Textarea
            className="mt-1.5"
            rows={5}
            value={current.checkinRules}
            onChange={(e) => update("checkinRules", e.target.value)}
            disabled={isLoading}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Restaurar padrao"
        description="Volta a configuracao operacional para os valores de referencia."
      >
        <Button
          variant="outline"
          disabled={saving || isLoading}
          onClick={() => setDraft(DEFAULT_OPERATION)}
        >
          Aplicar valores padrao
        </Button>
      </SettingsSection>
    </div>
  );
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
