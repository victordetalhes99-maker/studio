import { useState } from "react";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportTableAsCsv, exportTableAsJson, runLocalBackup } from "@/lib/backup/local-export";
import type { PublicTableName } from "@/lib/backup/export-utils";

type ExportFormat = "csv" | "json" | "full";

interface ExportOption {
  key: string;
  label: string;
  format: ExportFormat;
  table?: PublicTableName;
  icon: typeof FileJson;
}

const EXPORTACOES: ExportOption[] = [
  { key: "completo", label: "Backup completo", format: "full", icon: FileJson },
  { key: "clientes", label: "Clientes", format: "csv", table: "clientes", icon: FileSpreadsheet },
  {
    key: "tatuadores",
    label: "Tatuadores",
    format: "csv",
    table: "tattoo_artists",
    icon: FileSpreadsheet,
  },
  {
    key: "check_ins",
    label: "Check-ins",
    format: "csv",
    table: "check_ins",
    icon: FileSpreadsheet,
  },
  {
    key: "fichas",
    label: "Fichas / consentimentos",
    format: "json",
    table: "consent_records",
    icon: FileJson,
  },
  {
    key: "risco",
    label: "Clientes de risco",
    format: "json",
    table: "risk_reviews",
    icon: FileJson,
  },
  {
    key: "configuracoes",
    label: "Configurações não sensíveis",
    format: "json",
    table: "app_config",
    icon: FileJson,
  },
];

export default function BackupExportacaoPage() {
  const [runningKey, setRunningKey] = useState<string | null>(null);

  async function handleExport(option: ExportOption) {
    setRunningKey(option.key);
    try {
      if (option.format === "full") {
        const result = await runLocalBackup();
        toast.success(`${result.filename} baixado com ${result.totalRecords} registro(s).`);
        return;
      }
      if (!option.table) return;
      if (option.format === "csv") {
        await exportTableAsCsv(option.table);
      } else {
        await exportTableAsJson(option.table);
      }
      toast.success(`Exportação de "${option.label}" concluída.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar.");
    } finally {
      setRunningKey(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground backdrop-blur-sm">
        Cada exportação lê os dados diretamente do Supabase (respeitando RLS) e baixa neste
        dispositivo. Nenhum destino externo é necessário.
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {EXPORTACOES.map((e) => {
          const running = runningKey === e.key;
          return (
            <div
              key={e.key}
              className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  <e.icon className="h-3.5 w-3.5 text-[color:var(--gold)]" />
                  {e.format === "full" ? "JSON" : e.format.toUpperCase()}
                </div>
                <h3 className="mt-1 text-sm font-medium text-foreground">{e.label}</h3>
                <p className="mt-1 text-xs text-muted-foreground">Download direto.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={running}
                onClick={() => handleExport(e)}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {running ? "Gerando..." : "Exportar"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
