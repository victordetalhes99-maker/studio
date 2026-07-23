import { useState } from "react";
import { FileDown, FileSpreadsheet, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface ExportActionsProps {
  disabled?: boolean;
  disabledReason?: string;
  onExportPdf?: () => void | Promise<void>;
  onExportXlsx?: () => void | Promise<void>;
  onPrint?: () => void;
}

type Job = "pdf" | "xlsx" | null;

export function ExportActions({
  disabled = false,
  disabledReason = "Disponível quando houver dados",
  onExportPdf,
  onExportXlsx,
  onPrint,
}: ExportActionsProps) {
  const [busy, setBusy] = useState<Job>(null);

  const run = async (job: Exclude<Job, null>, fn?: () => void | Promise<void>, label?: string) => {
    if (!fn || busy) return;
    setBusy(job);
    try {
      await fn();
      toast.success(label === "pdf" ? "PDF gerado com sucesso." : "Planilha gerada com sucesso.");
    } catch (err) {
      console.error("[export] falha", err);
      toast.error("Não foi possível gerar o arquivo. Tente novamente.");
    } finally {
      setBusy(null);
    }
  };

  const handlePdf = () => run("pdf", onExportPdf, "pdf");
  const handleXlsx = () => run("xlsx", onExportXlsx, "xlsx");
  const handlePrint = () => {
    if (!onPrint || busy) return;
    try {
      onPrint();
    } catch (err) {
      console.error("[print] falha", err);
      toast.error("Não foi possível abrir a impressão.");
    }
  };

  const isDisabled = disabled;

  return (
    <TooltipProvider delayDuration={150}>
      {/* Desktop */}
      <div className="hidden items-center gap-1.5 md:flex" data-no-print>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={isDisabled || busy !== null}
                onClick={handlePdf}
              >
                {busy === "pdf" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileDown className="h-3.5 w-3.5" />
                )}
                {busy === "pdf" ? "Gerando PDF..." : "PDF"}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{isDisabled ? disabledReason : "Exportar PDF"}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={isDisabled || busy !== null}
                onClick={handleXlsx}
              >
                {busy === "xlsx" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                )}
                {busy === "xlsx" ? "Gerando planilha..." : "Planilha"}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{isDisabled ? disabledReason : "Exportar planilha"}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={isDisabled || busy !== null}
                onClick={handlePrint}
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{isDisabled ? disabledReason : "Imprimir relatório"}</TooltipContent>
        </Tooltip>
      </div>

      {/* Mobile */}
      <div className="md:hidden" data-no-print>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isDisabled || busy !== null}
            >
              <FileDown className="h-3.5 w-3.5" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={isDisabled || busy !== null} onClick={handlePdf}>
              <FileDown className="mr-2 h-3.5 w-3.5" /> PDF
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isDisabled || busy !== null} onClick={handleXlsx}>
              <FileSpreadsheet className="mr-2 h-3.5 w-3.5" /> Planilha
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isDisabled || busy !== null} onClick={handlePrint}>
              <Printer className="mr-2 h-3.5 w-3.5" /> Imprimir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
}
