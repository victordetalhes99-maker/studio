import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportCardProps {
  icon: LucideIcon;
  title: string;
  to: string;
  summary: string;
  value: number | string | null;
  description: string;
  cta?: string;
}

/**
 * Cartão de relatório clicável.
 * - Valor "—" quando não há dado real (não inventamos zeros).
 * - Realce dourado no hover e no foco por teclado.
 * - Toda a área é um link (acessível).
 */
export function ReportCard({
  icon: Icon,
  title,
  to,
  summary,
  value,
  description,
  cta = "Ver relatório",
}: ReportCardProps) {
  const isEmpty = value === null || value === undefined;
  const display = isEmpty ? "—" : typeof value === "number" ? value.toLocaleString("pt-BR") : value;

  return (
    <Link
      to={to}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card/50 p-5 backdrop-blur-sm",
        "transition-all duration-200 cursor-pointer",
        "hover:-translate-y-0.5 hover:border-[color:var(--gold)]/60 hover:bg-card/70",
        "hover:shadow-[0_18px_50px_-30px_rgba(212,175,55,0.45)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gold)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
      aria-label={`Abrir relatório: ${title}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </span>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground transition-colors",
            "group-hover:border-[color:var(--gold)]/50 group-hover:text-[color:var(--gold)]",
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

      <p className="mt-1 text-xs font-medium text-foreground/80">{summary}</p>
      <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground/85">
        {description}
      </p>

      <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--gold)]/90 transition-colors group-hover:text-[color:var(--gold)]">
        {cta}
        <ArrowRight
          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
    </Link>
  );
}
