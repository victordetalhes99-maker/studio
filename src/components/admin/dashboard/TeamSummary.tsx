import { Link } from "react-router-dom";
import { ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TattooArtist } from "@/lib/admin-data/types";
import { cn } from "@/lib/utils";

interface TeamSummaryProps {
  artists: TattooArtist[];
  limit?: number;
}

export function TeamSummary({ artists, limit = 6 }: TeamSummaryProps) {
  const visible = artists.slice(0, limit);
  const total = artists.length;

  return (
    <section className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[color:var(--gold)]" aria-hidden />
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
            Equipe do estúdio
          </h2>
        </div>
        <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
          <Link to="/admin/tatuadores">
            Ver todos ({total}) <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visible.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-background/40 px-3 py-2"
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                "bg-gradient-to-br from-[color:var(--gold)]/25 to-[color:var(--gold)]/5 text-[color:var(--gold)] border border-[color:var(--gold)]/30",
              )}
            >
              {a.iniciais}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">{a.nome}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {a.status}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
