import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav
      aria-label="Trilha de navegação"
      className={cn("flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground", className)}
    >
      <Link
        to="/admin"
        className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
      >
        <Home className="h-3 w-3" aria-hidden />
        <span className="sr-only">Início</span>
      </Link>
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${c.label}-${i}`} className="inline-flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3 text-muted-foreground/50" aria-hidden />
            {c.to && !last ? (
              <Link
                to={c.to}
                className="rounded px-1 py-0.5 transition-colors hover:text-foreground"
              >
                {c.label}
              </Link>
            ) : (
              <span
                aria-current={last ? "page" : undefined}
                className={cn("px-1 py-0.5", last && "font-medium text-foreground")}
              >
                {c.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
