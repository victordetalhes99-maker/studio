import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ReportTableColumn<T> {
  key: string;
  label: string;
  className?: string;
  render: (row: T) => React.ReactNode;
}

interface ReportTableProps<T> {
  columns: ReportTableColumn<T>[];
  rows: T[];
  keyOf: (row: T) => string;
  isLoading?: boolean;
  emptyIcon?: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  onRowClick?: (row: T) => void;
  ariaLabel: string;
}

/**
 * Tabela reutilizada em todos os relatórios.
 * - Desktop: tabela.
 * - Mobile: cards empilhados (linhas viram cartões).
 * - Estados: loading, vazio, com dados.
 */
export function ReportTable<T>({
  columns,
  rows,
  keyOf,
  isLoading,
  emptyIcon = Inbox,
  emptyTitle,
  emptyDescription,
  onRowClick,
  ariaLabel,
}: ReportTableProps<T>) {
  if (isLoading) {
    return (
      <div className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      {/* Desktop */}
      <div
        className="hidden overflow-hidden rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm md:block"
        role="region"
        aria-label={ariaLabel}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-background/40 text-left">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={cn(
                      "px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
                      c.className,
                    )}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={keyOf(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b border-border/30 last:border-0 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-background/40",
                  )}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3 text-foreground/90", c.className)}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile */}
      <div className="grid grid-cols-1 gap-2 md:hidden">
        {rows.map((row) => (
          <div
            key={keyOf(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              "rounded-xl border border-border/60 bg-card/40 p-3 text-sm backdrop-blur-sm",
              onRowClick && "cursor-pointer active:bg-background/40",
            )}
          >
            <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5">
              {columns.map((c) => (
                <div key={c.key} className="contents">
                  <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {c.label}
                  </dt>
                  <dd className="min-w-0 text-foreground/90">{c.render(row)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}
