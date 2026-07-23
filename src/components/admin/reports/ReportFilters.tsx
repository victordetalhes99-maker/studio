import { useMemo } from "react";
import { Filter, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ReportFilterState, ReportPeriodPreset } from "@/lib/reports/types";
import { cn } from "@/lib/utils";

interface ReportFiltersProps {
  value: ReportFilterState;
  onChange: (next: ReportFilterState) => void;
  onClear?: () => void;
  tatuadores?: { id: string; nome: string }[];
  statuses?: { value: string; label: string }[];
  tipos?: { value: string; label: string }[];
  showSearch?: boolean;
  showTatuador?: boolean;
  showStatus?: boolean;
  showTipo?: boolean;
  showRisco?: boolean;
  className?: string;
}

const PERIOD_LABEL: Record<ReportPeriodPreset, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  semana: "Esta semana",
  semana_anterior: "Semana anterior",
  mes_atual: "Este mês",
  mes_anterior: "Mês anterior",
  ultimos_30: "Últimos 30 dias",
  personalizado: "Período personalizado",
};

export function ReportFilters({
  value,
  onChange,
  onClear,
  tatuadores = [],
  statuses = [],
  tipos = [],
  showSearch = true,
  showTatuador = true,
  showStatus = false,
  showTipo = false,
  showRisco = false,
  className,
}: ReportFiltersProps) {
  const activeCount = useMemo(() => {
    let n = 0;
    if (value.period.preset !== "mes_atual") n++;
    if (value.tatuadorId) n++;
    if (value.status) n++;
    if (value.tipo) n++;
    if (value.risco) n++;
    if (value.q && value.q.trim()) n++;
    return n;
  }, [value]);

  const setField = <K extends keyof ReportFilterState>(k: K, v: ReportFilterState[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-3 backdrop-blur-sm md:flex-row md:flex-wrap md:items-end",
        className,
      )}
    >
      <div className="flex flex-1 flex-wrap items-end gap-3">
        <div className="min-w-[10rem] flex-1">
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Período
          </label>
          <Select
            value={value.period.preset}
            onValueChange={(v) =>
              onChange({ ...value, period: { ...value.period, preset: v as ReportPeriodPreset } })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABEL) as ReportPeriodPreset[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PERIOD_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showTatuador && (
          <div className="min-w-[10rem] flex-1">
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Tatuador
            </label>
            <Select
              value={value.tatuadorId ?? "__all__"}
              onValueChange={(v) => setField("tatuadorId", v === "__all__" ? null : v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {tatuadores.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showStatus && statuses.length > 0 && (
          <div className="min-w-[9rem] flex-1">
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Status
            </label>
            <Select
              value={value.status ?? "__all__"}
              onValueChange={(v) => setField("status", v === "__all__" ? null : v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showTipo && tipos.length > 0 && (
          <div className="min-w-[9rem] flex-1">
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Tipo
            </label>
            <Select
              value={value.tipo ?? "__all__"}
              onValueChange={(v) => setField("tipo", v === "__all__" ? null : v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {tipos.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showRisco && (
          <div className="min-w-[8rem]">
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Risco
            </label>
            <Select
              value={value.risco ? "sim" : "__all__"}
              onValueChange={(v) => setField("risco", v === "sim" ? true : null)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="sim">Com alerta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {showSearch && (
          <div className="min-w-[12rem] flex-1">
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Pesquisar
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={value.q ?? ""}
                onChange={(e) => setField("q", e.target.value)}
                placeholder="Buscar…"
                className="h-9 pl-8"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {activeCount > 0 && (
          <Badge
            variant="outline"
            className="border-[color:var(--gold)]/40 text-[color:var(--gold)]"
          >
            <Filter className="mr-1 h-3 w-3" /> {activeCount} ativo{activeCount > 1 ? "s" : ""}
          </Badge>
        )}
        {onClear && activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
