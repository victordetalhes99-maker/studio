import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string | null;
  hint?: string;
  tone?: "default" | "warning" | "danger";
  className?: string;
}

/**
 * Card de indicador — quando o dado ainda não existe (value === null),
 * exibimos "—" e um hint informando que aguarda integração. Nunca inventamos
 * zeros ou variações fictícias.
 */
export function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  className,
}: MetricCardProps) {
  const isEmpty = value === null || value === undefined;
  const display = isEmpty ? "—" : typeof value === "number" ? value.toLocaleString("pt-BR") : value;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border/70 bg-card/60 p-5 backdrop-blur-sm transition-all",
        "hover:border-[color:var(--gold)]/60 hover:shadow-[0_0_0_1px_var(--gold)/20,0_18px_50px_-30px_var(--gold)/40]",
        tone === "danger" && "border-destructive/30",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground transition-colors",
            "group-hover:border-[color:var(--gold)]/50 group-hover:text-[color:var(--gold)]",
            tone === "danger" && "text-destructive group-hover:text-destructive",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <div
        className={cn(
          "metric-num mt-4 text-3xl font-semibold tracking-tight",
          isEmpty ? "text-muted-foreground/60" : "text-foreground",
        )}
      >
        {display}
      </div>
      {hint ? (
        <p className="mt-1.5 text-xs text-muted-foreground/80">{hint}</p>
      ) : (
        isEmpty && <p className="mt-1.5 text-xs text-muted-foreground/70">Aguardando integração</p>
      )}
    </div>
  );
}
