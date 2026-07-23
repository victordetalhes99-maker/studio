import { Check, Circle, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Item {
  label: string;
  done: boolean;
  detail: string;
  to?: string;
}

export function ProtectionChecklist({ items }: { items: Item[] }) {
  const doneCount = items.filter((i) => i.done).length;
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5 text-[color:var(--gold)]" />
            Estado da proteção
          </div>
          <h3 className="mt-2 font-display text-xl text-foreground">
            {doneCount}/{items.length} etapas concluídas
          </h3>
        </div>
      </div>
      <ul className="mt-4 divide-y divide-border/40">
        {items.map((it) => (
          <li key={it.label} className="flex items-start gap-3 py-3">
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                it.done
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-border/60 bg-background/60 text-muted-foreground",
              )}
            >
              {it.done ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{it.label}</span>
                {it.to && !it.done && (
                  <Link
                    to={it.to}
                    className="text-[11px] font-medium text-[color:var(--gold)] hover:underline"
                  >
                    configurar →
                  </Link>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{it.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
