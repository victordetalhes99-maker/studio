import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import { Button } from "@/components/ui/button";

interface PendingModulePageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  ctaLabel?: string;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
  columns?: string[];
}

/**
 * Layout reutilizado por módulos administrativos que ainda dependem de
 * integração com a base de dados. Mantém a estrutura de página real
 * (cabeçalho, filtros, área principal) apresentando um estado vazio
 * profissional em vez de dados fictícios.
 */
export function PendingModulePage({
  title,
  description,
  icon,
  emptyTitle,
  emptyDescription,
  ctaLabel,
  actions,
  filters,
  columns,
}: PendingModulePageProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} actions={actions} />

      {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}

      {columns && columns.length > 0 && (
        <div className="hidden overflow-hidden rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm md:block">
          <div
            className="grid gap-2 border-b border-border/40 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
          >
            {columns.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <div className="p-6">
            <EmptyState
              icon={icon}
              title={emptyTitle}
              description={emptyDescription}
              action={ctaLabel ? <Button variant="outline">{ctaLabel}</Button> : undefined}
              compact
            />
          </div>
        </div>
      )}

      {(!columns || columns.length === 0) && (
        <EmptyState
          icon={icon}
          title={emptyTitle}
          description={emptyDescription}
          action={ctaLabel ? <Button variant="outline">{ctaLabel}</Button> : undefined}
        />
      )}
    </div>
  );
}
