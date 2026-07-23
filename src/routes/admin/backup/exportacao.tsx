import { Download, FileJson, FileSpreadsheet, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBackupDestinations, useBackupSettings } from "@/lib/backup/hooks";

const EXPORTACOES = [
  {
    key: "completo",
    label: "Dados completos",
    format: "ZIP criptografado",
    icon: FileJson,
    sensivel: true,
  },
  { key: "clientes", label: "Clientes", format: "CSV", icon: FileSpreadsheet, sensivel: true },
  { key: "tatuadores", label: "Tatuadores", format: "CSV", icon: FileSpreadsheet, sensivel: false },
  { key: "fichas", label: "Fichas de anamnese", format: "JSON", icon: FileJson, sensivel: true },
  { key: "contratos", label: "Contratos", format: "PDF + JSON", icon: FileText, sensivel: false },
  { key: "check_ins", label: "Check-ins", format: "CSV", icon: FileSpreadsheet, sensivel: false },
  { key: "configuracoes", label: "Configurações", format: "JSON", icon: FileJson, sensivel: false },
];

export default function BackupExportacaoPage() {
  const { data: destinations } = useBackupDestinations();
  const { data: settings } = useBackupSettings();
  const podeExportar = destinations.some((d) => d.status === "conectado");
  const criptografiaOk = !!settings?.encryption_enabled;

  return (
    <div className="space-y-5">
      {!criptografiaOk && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-300/90">
          <div className="flex items-start gap-2">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Exportações de dados sensíveis exigem criptografia autenticada. Configure a chave em{" "}
              <strong>Política → Criptografia</strong> antes de liberar downloads.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {EXPORTACOES.map((e) => {
          const bloqueado = !podeExportar || (e.sensivel && !criptografiaOk);
          return (
            <div
              key={e.key}
              className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  <e.icon className="h-3.5 w-3.5 text-[color:var(--gold)]" />
                  {e.format}
                </div>
                <h3 className="mt-1 text-sm font-medium text-foreground">{e.label}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {bloqueado
                    ? e.sensivel && !criptografiaOk
                      ? "Bloqueado: criptografia não configurada."
                      : "Bloqueado: nenhum destino ativo."
                    : "Gera link temporário assinado (5 min)."}
                </p>
              </div>
              <Button size="sm" variant="outline" disabled={bloqueado}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
