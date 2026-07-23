import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Container preparado para receber gráficos reais quando existirem dados.
 * Enquanto não há dados, mantém aviso claro — nunca desenha valores aleatórios.
 */
export function ChartPlaceholder({
  title,
  hint,
  height = 240,
  className,
}: {
  title: string;
  hint?: string;
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <BarChart3 className="h-3.5 w-3.5 text-[color:var(--gold)]" aria-hidden />
        {title}
      </div>
      <div
        className="mt-3 flex items-center justify-center rounded-lg border border-dashed border-border/50 bg-background/30 text-center text-xs text-muted-foreground/70"
        style={{ minHeight: height }}
      >
        <span className="px-4">
          {hint ?? "Não há informações suficientes para gerar este gráfico."}
        </span>
      </div>
    </div>
  );
}
