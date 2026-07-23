import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  FileSignature,
  FileText,
  Filter,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
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
  DEFAULT_FICHAS_FILTERS,
  type FichasFilters,
  formatDateBR,
  STATUS_LABEL,
  TIPO_LABEL,
  useDebounced,
  useFichas,
  useFichasFiltradas,
} from "@/lib/fichas";
import { exportFichasPdf, exportFichasXlsx } from "@/lib/fichas/export";
import { useActiveTattooArtistNames } from "@/lib/tattoo-artists";

export default function AdminFichasPage() {
  const tattooArtists = useActiveTattooArtistNames();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useFichas();
  const [filters, setFilters] = useState<FichasFilters>(DEFAULT_FICHAS_FILTERS);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [xlsBusy, setXlsBusy] = useState(false);

  const debouncedQ = useDebounced(filters.q, 200);
  const filtered = useFichasFiltradas(data, { ...filters, q: debouncedQ });

  const metrics = useMemo(() => {
    const total = data.length;
    const concluidas = data.filter((f) => f.status === "concluida").length;
    const incompletas = data.filter((f) => f.status === "incompleta").length;
    const alerta = data.filter((f) => f.risco === "attention").length;
    const primeiraVisita = data.filter((f) => f.tipo === "primeira_visita").length;
    const recorrentes = data.filter((f) => f.tipo === "recorrente").length;
    const hoje = data.filter((f) => {
      const d = new Date(f.data);
      const n = new Date();
      return (
        d.getFullYear() === n.getFullYear() &&
        d.getMonth() === n.getMonth() &&
        d.getDate() === n.getDate()
      );
    }).length;
    return { total, concluidas, incompletas, alerta, primeiraVisita, recorrentes, hoje };
  }, [data]);

  const activeFilters =
    (filters.tipo ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (filters.risco ? 1 : 0) +
    (filters.tatuador ? 1 : 0) +
    (filters.assinatura ? 1 : 0);

  function reset() {
    setFilters(DEFAULT_FICHAS_FILTERS);
  }

  async function onPdf() {
    if (filtered.length === 0) {
      toast.info("Nenhuma ficha para exportar com os filtros atuais.");
      return;
    }
    setPdfBusy(true);
    try {
      exportFichasPdf(filtered, { ...filters, q: debouncedQ });
      toast.success("PDF gerado com sucesso.");
    } catch (e) {
      toast.error(`Falha ao gerar PDF: ${(e as Error).message}`);
    } finally {
      setPdfBusy(false);
    }
  }

  async function onXls() {
    if (filtered.length === 0) {
      toast.info("Nenhuma ficha para exportar com os filtros atuais.");
      return;
    }
    setXlsBusy(true);
    try {
      exportFichasXlsx(filtered, { ...filters, q: debouncedQ });
      toast.success("Planilha gerada com sucesso.");
    } catch (e) {
      toast.error(`Falha ao gerar planilha: ${(e as Error).message}`);
    } finally {
      setXlsBusy(false);
    }
  }

  return (
    <div className="space-y-6" data-print-area>
      <PageHeader
        title="Fichas dos clientes"
        description="Acompanhe o preenchimento, os alertas de saúde e os documentos relacionados aos atendimentos."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refetch} data-no-print>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={onPdf} disabled={pdfBusy} data-no-print>
              {pdfBusy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-1.5 h-4 w-4" />
              )}
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={onXls} disabled={xlsBusy} data-no-print>
              {xlsBusy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-1.5 h-4 w-4" />
              )}
              Planilha
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} data-no-print>
              <Printer className="mr-1.5 h-4 w-4" /> Imprimir
            </Button>
          </>
        }
      />

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
        <MetricCard icon={ClipboardList} label="Total" value={metrics.total} />
        <MetricCard icon={ClipboardList} label="Concluídas" value={metrics.concluidas} />
        <MetricCard icon={ClipboardList} label="Incompletas" value={metrics.incompletas} />
        <MetricCard icon={ShieldAlert} label="Com alerta" value={metrics.alerta} tone="warning" />
        <MetricCard icon={Sparkles} label="Primeira visita" value={metrics.primeiraVisita} />
        <MetricCard icon={RefreshCw} label="Recorrentes" value={metrics.recorrentes} />
        <MetricCard icon={ClipboardList} label="Hoje" value={metrics.hoje} />
      </div>

      {/* Filtros */}
      <div
        className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm"
        data-no-print
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Buscar por nome, CPF ou tatuador…"
              className="pl-9"
              aria-label="Pesquisar fichas"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
            <Select
              value={filters.tipo ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  tipo: v === "all" ? null : (v as FichasFilters["tipo"]),
                }))
              }
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="primeira_visita">Primeira visita</SelectItem>
                <SelectItem value="recorrente">Recorrente</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.status ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  status: v === "all" ? null : (v as FichasFilters["status"]),
                }))
              }
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="incompleta">Incompleta</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.risco ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  risco: v === "all" ? null : (v as FichasFilters["risco"]),
                }))
              }
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Risco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Risco (todos)</SelectItem>
                <SelectItem value="com">Com alertas</SelectItem>
                <SelectItem value="sem">Sem alertas</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.tatuador ?? "all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, tatuador: v === "all" ? null : v }))}
            >
              <SelectTrigger className="w-full md:w-[200px]">
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
              value={filters.assinatura ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  assinatura: v === "all" ? null : (v as FichasFilters["assinatura"]),
                }))
              }
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Assinatura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Assinatura (todas)</SelectItem>
                <SelectItem value="com">Com assinatura</SelectItem>
                <SelectItem value="sem">Sem assinatura</SelectItem>
              </SelectContent>
            </Select>
            {activeFilters > 0 || filters.q ? (
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="mr-1 h-3.5 w-3.5" /> Limpar
                {activeFilters > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFilters}
                  </Badge>
                )}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Resultado */}
      {error ? (
        <EmptyState
          icon={Filter}
          title="Não foi possível carregar as fichas"
          description={error.message}
          action={
            <Button variant="outline" onClick={refetch}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Tentar novamente
            </Button>
          }
        />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={data.length === 0 ? "Nenhuma ficha registrada" : "Nenhuma ficha encontrada"}
          description={
            data.length === 0
              ? "As fichas aparecem aqui automaticamente após o preenchimento pelos clientes no cadastro ou no check-in recorrente."
              : "Ajuste os filtros ou limpe a pesquisa para ver todas as fichas."
          }
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden overflow-hidden rounded-xl border border-border/60 bg-card/40 md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Tatuador</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Risco</th>
                  <th className="px-4 py-3 text-left font-medium">Assin.</th>
                  <th className="px-4 py-3 text-left font-medium">Data</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((f) => (
                  <tr
                    key={f.id}
                    className="cursor-pointer transition-colors hover:bg-background/30"
                    onClick={() => navigate(`/admin/fichas/${f.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/60 text-[11px] font-semibold text-[color:var(--gold)]">
                          {f.clienteIniciais}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">
                            {f.clienteNome || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">{f.cpfMasked}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground/80">{f.tatuador ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={f.tipo === "primeira_visita" ? "default" : "secondary"}>
                        {TIPO_LABEL[f.tipo]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={f.status} />
                    </td>
                    <td className="px-4 py-3">
                      {f.risco === "attention" ? (
                        <Badge variant="destructive" className="gap-1">
                          <ShieldAlert className="h-3 w-3" /> Alerta
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {f.temAssinatura ? (
                        <FileSignature className="h-4 w-4 text-[color:var(--gold)]" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground/80">{formatDateBR(f.data)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link to={`/admin/fichas/${f.id}`}>Ver ficha</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((f) => (
              <Link
                key={f.id}
                to={`/admin/fichas/${f.id}`}
                className="block rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-[color:var(--gold)]/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">
                      {f.clienteNome || "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">{f.cpfMasked}</div>
                  </div>
                  <StatusPill status={f.status} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={f.tipo === "primeira_visita" ? "default" : "secondary"}>
                    {TIPO_LABEL[f.tipo]}
                  </Badge>
                  {f.risco === "attention" && (
                    <Badge variant="destructive" className="gap-1">
                      <ShieldAlert className="h-3 w-3" /> Alerta
                    </Badge>
                  )}
                  {f.temAssinatura && (
                    <span className="flex items-center gap-1">
                      <FileSignature className="h-3 w-3" /> Assinada
                    </span>
                  )}
                  <span>· {formatDateBR(f.data)}</span>
                </div>
                {f.tatuador && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Tatuador: <span className="text-foreground/80">{f.tatuador}</span>
                  </div>
                )}
              </Link>
            ))}
          </div>

          <p className="text-xs text-muted-foreground" data-no-print>
            Exibindo {filtered.length} de {data.length} ficha(s).
          </p>
        </>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: keyof typeof STATUS_LABEL }) {
  const tones: Record<string, string> = {
    concluida: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
    incompleta: "border-amber-500/40 text-amber-400 bg-amber-500/10",
    sem_ficha: "border-border/60 text-muted-foreground bg-background/40",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tones[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
