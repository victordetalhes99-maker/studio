import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FileSignature,
  FileText,
  Files,
  Filter,
  Loader2,
  RefreshCw,
  Search,
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
  DEFAULT_DOCUMENTOS_FILTERS,
  STATUS_LABEL,
  TIPO_LABEL,
  computeMetrics,
  documentoViewRoute,
  formatDateTimeBR,
  useDebounced,
  useDocumentos,
  useDocumentosFiltrados,
  type DocumentoResumo,
  type DocumentoStatus,
  type DocumentoTipo,
  type DocumentosFilters,
} from "@/lib/documentos";
import { exportDocumentosPdf, exportDocumentosXlsx } from "@/lib/documentos/export";
import { useActiveTattooArtistNames } from "@/lib/tattoo-artists";

const STATUS_TONE: Record<DocumentoStatus, string> = {
  disponivel: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  pendente: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  erro: "bg-red-500/10 text-red-600 border-red-500/30",
  arquivado: "bg-muted text-muted-foreground border-border/40",
};

const TIPO_ICON: Record<DocumentoTipo, typeof Files> = {
  contrato: FileSignature,
  ficha: FileText,
  assinatura: FileSignature,
  termo_lgpd: ShieldCheck,
};

export default function AdminDocumentosPage() {
  const tattooArtists = useActiveTattooArtistNames();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useDocumentos();
  const [filters, setFilters] = useState<DocumentosFilters>(DEFAULT_DOCUMENTOS_FILTERS);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [xlsBusy, setXlsBusy] = useState(false);

  useEffect(() => {
    const h = () => refetch();
    window.addEventListener("documentos:refresh", h);
    return () => window.removeEventListener("documentos:refresh", h);
  }, [refetch]);

  const debouncedQ = useDebounced(filters.q, 200);
  const filtered = useDocumentosFiltrados(data, { ...filters, q: debouncedQ });
  const metrics = useMemo(() => computeMetrics(data), [data]);

  const activeFilters =
    (filters.tipo ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (filters.tatuador ? 1 : 0) +
    (filters.origem ? 1 : 0) +
    (filters.periodo ? 1 : 0);

  const hasRows = filtered.length > 0;

  const handleExport = async (kind: "pdf" | "xlsx") => {
    if (!hasRows) return;
    try {
      if (kind === "pdf") {
        setPdfBusy(true);
        exportDocumentosPdf(filtered, { ...filters, q: debouncedQ });
        toast.success("PDF da listagem gerado.");
      } else {
        setXlsBusy(true);
        exportDocumentosXlsx(filtered, { ...filters, q: debouncedQ });
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
        title="Central de documentos"
        description="Visualize, organize e acompanhe fichas, contratos, assinaturas e termos vinculados aos clientes do estúdio."
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
        <MetricCard icon={Files} label="Total" value={metrics.total} />
        <MetricCard icon={FileSignature} label="Contratos" value={metrics.contratos} />
        <MetricCard icon={FileText} label="Fichas" value={metrics.fichas} />
        <MetricCard icon={FileSignature} label="Assinaturas" value={metrics.assinaturas} />
        <MetricCard icon={ShieldCheck} label="Termos LGPD" value={metrics.termos} />
        <MetricCard
          icon={Loader2}
          label="Pendentes"
          value={metrics.pendentes}
          tone={metrics.pendentes > 0 ? "warning" : "default"}
        />
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, arquivo, tatuador ou ID..."
              className="pl-9"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={filters.tipo ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, tipo: v === "all" ? null : (v as DocumentoTipo) }))
              }
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="contrato">Contratos</SelectItem>
                <SelectItem value="ficha">Fichas</SelectItem>
                <SelectItem value="assinatura">Assinaturas</SelectItem>
                <SelectItem value="termo_lgpd">Termos LGPD</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.status ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, status: v === "all" ? null : (v as DocumentoStatus) }))
              }
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="disponivel">Disponível</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="erro">Com erro</SelectItem>
                <SelectItem value="arquivado">Arquivado</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.tatuador ?? "all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, tatuador: v === "all" ? null : v }))}
            >
              <SelectTrigger className="w-[170px]">
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
              value={filters.periodo ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  periodo: v === "all" ? null : (v as DocumentosFilters["periodo"]),
                }))
              }
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
              </SelectContent>
            </Select>
            {activeFilters > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => setFilters(DEFAULT_DOCUMENTOS_FILTERS)}
              >
                <X className="h-3.5 w-3.5" /> Limpar ({activeFilters})
              </Button>
            )}
          </div>
        </div>
        {(activeFilters > 0 || debouncedQ) && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            Mostrando {filtered.length} de {data.length} documentos
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
          icon={Files}
          title="Falha ao carregar documentos"
          description={error.message || "Tente atualizar em instantes."}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Files}
          title={
            data.length === 0 ? "Nenhum documento ainda" : "Nenhum resultado com esses filtros"
          }
          description={
            data.length === 0
              ? "Os documentos aparecem aqui automaticamente conforme fichas, contratos e assinaturas forem sendo registrados."
              : "Ajuste os filtros ou a pesquisa para localizar o documento."
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-border/50 bg-card/50 shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Documento</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Tatuador</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Versão</th>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((d) => {
                  const Icon = TIPO_ICON[d.tipo];
                  return (
                    <tr key={d.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">{d.fileName}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {d.mimeType}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{TIPO_LABEL[d.tipo]}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{d.clienteNome}</div>
                        <div className="text-xs text-muted-foreground">{d.clienteCpfMasked}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{d.tatuador ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={STATUS_TONE[d.status]}>
                          {STATUS_LABEL[d.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{d.versao ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTimeBR(d.criadoEm)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              navigate(`/admin/documentos/${encodeURIComponent(d.id)}`)
                            }
                          >
                            Detalhes
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={documentoViewRoute(d)}>Abrir</Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-2 md:hidden">
            {filtered.map((d) => {
              const Icon = TIPO_ICON[d.tipo];
              return (
                <button
                  key={d.id}
                  onClick={() => navigate(`/admin/documentos/${encodeURIComponent(d.id)}`)}
                  className="rounded-xl border border-border/50 bg-card/50 p-3 text-left shadow-sm active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{d.fileName}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {TIPO_LABEL[d.tipo]} · {d.clienteNome}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={STATUS_TONE[d.status]}>
                          {STATUS_LABEL[d.status]}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDateTimeBR(d.criadoEm)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Re-export para satisfazer eventuais imports antigos
export type { DocumentoResumo };
