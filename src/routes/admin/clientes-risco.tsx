import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertOctagon,
  AlertTriangle,
  Archive,
  CalendarClock,
  CheckCircle2,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { MetricCard } from "@/components/admin/dashboard/MetricCard";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  CATEGORY_LABEL,
  DEFAULT_RISK_FILTERS,
  SEVERITY_LABEL,
  STATUS_LABEL,
  computeMetrics,
  formatDateTimeBR,
  useRiskAlerts,
  useRiskAlertsFiltered,
  type RiskAlert,
  type RiskAlertStatus,
  type RiskFilters,
} from "@/lib/risk";
import type { RiskCategory, RiskSeverity } from "@/lib/risk/rules";
import { useDebounced } from "@/lib/fichas";
import { exportRiskPdf, exportRiskXlsx } from "@/lib/risk/export";
import { useActiveTattooArtistNames } from "@/lib/tattoo-artists";

const LEVEL_TONE: Record<RiskSeverity, string> = {
  high: "bg-red-500/10 text-red-600 border-red-500/30",
  attention: "bg-amber-500/10 text-amber-600 border-amber-500/30",
};

const STATUS_TONE: Record<RiskAlertStatus, string> = {
  pending_review: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  under_review: "bg-sky-500/10 text-sky-700 border-sky-500/30",
  reviewed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  requires_attention: "bg-red-500/10 text-red-700 border-red-500/30",
  released: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  archived: "bg-muted text-muted-foreground border-border/40",
};

const CATEGORY_OPTIONS: RiskCategory[] = [
  "medication",
  "allergy",
  "coagulation",
  "cardiovascular",
  "metabolic",
  "neurological",
  "infectious",
  "dermatologic",
  "pregnancy",
  "behavioral",
  "recovery",
  "general",
];

export default function AdminClientesRiscoPage() {
  const tattooArtists = useActiveTattooArtistNames();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useRiskAlerts();
  const [filters, setFilters] = useState<RiskFilters>(DEFAULT_RISK_FILTERS);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [xlsBusy, setXlsBusy] = useState(false);

  useEffect(() => {
    const h = () => refetch();
    window.addEventListener("risk:refresh", h);
    return () => window.removeEventListener("risk:refresh", h);
  }, [refetch]);

  const debouncedQ = useDebounced(filters.q, 200);
  const filtered = useRiskAlertsFiltered(data, { ...filters, q: debouncedQ });
  const metrics = useMemo(() => computeMetrics(data), [data]);

  const activeFilters =
    (filters.level ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (filters.tatuador ? 1 : 0) +
    (filters.category ? 1 : 0) +
    (filters.origin ? 1 : 0) +
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0) +
    (filters.showArchived ? 1 : 0);

  const hasRows = filtered.length > 0;

  const handleExport = async (kind: "pdf" | "xlsx") => {
    if (!hasRows) return;
    try {
      const finalFilters = { ...filters, q: debouncedQ };
      if (kind === "pdf") {
        setPdfBusy(true);
        exportRiskPdf(filtered, finalFilters);
        toast.success("PDF gerado.");
      } else {
        setXlsBusy(true);
        exportRiskXlsx(filtered, finalFilters);
        toast.success("Planilha gerada.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o arquivo.");
    } finally {
      setPdfBusy(false);
      setXlsBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes de risco"
        description="Alertas derivados das fichas clínicas — priorize, revise e registre a conduta administrativa com histórico auditável."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasRows || pdfBusy}
              onClick={() => handleExport("pdf")}
              className="gap-1.5"
            >
              {pdfBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasRows || xlsBusy}
              onClick={() => handleExport("xlsx")}
              className="gap-1.5"
            >
              {xlsBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Planilha
            </Button>
            <Button variant="outline" size="sm" disabled={!hasRows} onClick={() => window.print()}>
              Imprimir
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard icon={ShieldAlert} label="Ativos" value={metrics.total} />
        <MetricCard
          icon={AlertTriangle}
          label="Pendentes"
          value={metrics.pending}
          tone={metrics.pending > 0 ? "warning" : "default"}
        />
        <MetricCard
          icon={AlertOctagon}
          label="Alto"
          value={metrics.high}
          tone={metrics.high > 0 ? "danger" : "default"}
        />
        <MetricCard icon={CheckCircle2} label="Revisados" value={metrics.reviewed} />
        <MetricCard icon={CalendarClock} label="Hoje" value={metrics.today} />
        <MetricCard icon={Archive} label="Arquivados" value={metrics.archived} />
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, CPF, tatuador ou motivo..."
              className="pl-9"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={filters.level ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, level: v === "all" ? null : (v as RiskSeverity) }))
              }
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os níveis</SelectItem>
                <SelectItem value="high">Alto</SelectItem>
                <SelectItem value="attention">Atenção</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.status ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, status: v === "all" ? null : (v as RiskAlertStatus) }))
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending_review">Pendente</SelectItem>
                <SelectItem value="under_review">Em revisão</SelectItem>
                <SelectItem value="reviewed">Revisado</SelectItem>
                <SelectItem value="requires_attention">Requer atenção</SelectItem>
                <SelectItem value="released">Liberado</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.category ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, category: v === "all" ? null : (v as RiskCategory) }))
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.tatuador ?? "all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, tatuador: v === "all" ? null : v }))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Tatuador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tatuadores</SelectItem>
                {tattooArtists.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.origin ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  origin: v === "all" ? null : (v as "primeira_visita" | "recorrente"),
                }))
              }
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="primeira_visita">Primeira visita</SelectItem>
                <SelectItem value="recorrente">Recorrente</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={filters.showArchived ? "secondary" : "outline"}
              size="sm"
              onClick={() => setFilters((f) => ({ ...f, showArchived: !f.showArchived }))}
              className="gap-1.5"
            >
              <Archive className="h-3.5 w-3.5" /> {filters.showArchived ? "Ocultar" : "Incluir"}{" "}
              arquivados
            </Button>
            {activeFilters > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => setFilters(DEFAULT_RISK_FILTERS)}
              >
                <X className="h-3.5 w-3.5" /> Limpar ({activeFilters})
              </Button>
            )}
          </div>
        </div>
        {(activeFilters > 0 || debouncedQ) && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            Mostrando {filtered.length} de {data.length} alertas
          </div>
        )}
      </div>

      {/* Corpo */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={ShieldAlert}
          title="Falha ao carregar alertas"
          description={error.message || "Tente atualizar em instantes."}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={
            data.length === 0 ? "Nenhum alerta de risco" : "Nenhum resultado com esses filtros"
          }
          description={
            data.length === 0
              ? "Alertas aparecem aqui automaticamente conforme as fichas de anamnese forem preenchidas com respostas relevantes."
              : "Ajuste os filtros ou a pesquisa para localizar o alerta desejado."
          }
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden overflow-hidden rounded-xl border border-border/50 bg-card/50 shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Origem</th>
                  <th className="px-4 py-3 text-left">Tatuador</th>
                  <th className="px-4 py-3 text-left">Nível</th>
                  <th className="px-4 py-3 text-left">Motivos</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Detectado</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((a) => (
                  <RowDesktop
                    key={a.id}
                    a={a}
                    onOpen={() => navigate(`/admin/clientes-risco/${encodeURIComponent(a.id)}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="grid gap-2 md:hidden">
            {filtered.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/admin/clientes-risco/${encodeURIComponent(a.id)}`)}
                className="rounded-xl border border-border/50 bg-card/50 p-3 text-left shadow-sm active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-[11px] font-semibold text-muted-foreground">
                    {a.clienteIniciais}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{a.clienteNome}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {a.origemLabel} · {a.tatuador || "sem tatuador"}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={LEVEL_TONE[a.level]}>
                        {SEVERITY_LABEL[a.level]}
                      </Badge>
                      <Badge variant="outline" className={STATUS_TONE[a.status]}>
                        {STATUS_LABEL[a.status]}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDateTimeBR(a.detectedAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                      {a.reasonSummary}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RowDesktop({ a, onOpen }: { a: RiskAlert; onOpen: () => void }) {
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-[11px] font-semibold text-muted-foreground">
            {a.clienteIniciais}
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{a.clienteNome}</div>
            <div className="truncate text-xs text-muted-foreground">{a.cpfMasked}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{a.origemLabel}</td>
      <td className="px-4 py-3 text-muted-foreground">{a.tatuador ?? "—"}</td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={LEVEL_TONE[a.level]}>
          {SEVERITY_LABEL[a.level]}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {a.reasons.slice(0, 3).map((r) => (
            <span
              key={r.ruleId}
              className="rounded-md border border-border/40 bg-background/60 px-1.5 py-0.5 text-[11px] text-muted-foreground"
              title={CATEGORY_LABEL[r.category]}
            >
              {r.label}
            </span>
          ))}
          {a.reasons.length > 3 && (
            <span className="text-[11px] text-muted-foreground">+{a.reasons.length - 3}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={STATUS_TONE[a.status]}>
          {STATUS_LABEL[a.status]}
        </Badge>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{formatDateTimeBR(a.detectedAt)}</td>
      <td className="px-4 py-3 text-right">
        <Button variant="outline" size="sm" onClick={onOpen}>
          Revisar
        </Button>
      </td>
    </tr>
  );
}
