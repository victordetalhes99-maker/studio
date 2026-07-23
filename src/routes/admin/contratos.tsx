import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  FileSignature,
  FileText,
  Filter,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
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
  DEFAULT_CONTRATOS_FILTERS,
  formatDateTimeBR,
  ORIGEM_LABEL,
  STATUS_LABEL,
  useContratos,
  useContratosFiltrados,
  useDebounced,
  type ContratoStatus,
  type ContratosFilters,
} from "@/lib/contratos";
import { exportContratosPdf, exportContratosXlsx } from "@/lib/contratos/export";
import { useActiveTattooArtistNames } from "@/lib/tattoo-artists";

export default function AdminContratosPage() {
  const tattooArtists = useActiveTattooArtistNames();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useContratos();
  const [filters, setFilters] = useState<ContratosFilters>(DEFAULT_CONTRATOS_FILTERS);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [xlsBusy, setXlsBusy] = useState(false);

  const debouncedQ = useDebounced(filters.q, 200);
  const filtered = useContratosFiltrados(data, { ...filters, q: debouncedQ });
  const versions = useMemo(
    () => Array.from(new Set(data.map((item) => item.versao))).sort((a, b) => b.localeCompare(a)),
    [data],
  );

  const metrics = useMemo(() => {
    const total = data.length;
    const assinados = data.filter((c) => c.temAssinatura).length;
    const semAssinatura = total - assinados;
    const hoje = data.filter((c) => {
      const d = new Date(c.aceitoEm);
      const n = new Date();
      return (
        d.getFullYear() === n.getFullYear() &&
        d.getMonth() === n.getMonth() &&
        d.getDate() === n.getDate()
      );
    }).length;
    const primeiraVisita = data.filter((c) => c.origem === "primeira_visita").length;
    const recorrentes = data.filter((c) => c.origem === "recorrente").length;
    return { total, assinados, semAssinatura, hoje, primeiraVisita, recorrentes };
  }, [data]);

  const activeFilters =
    (filters.status ? 1 : 0) +
    (filters.tatuador ? 1 : 0) +
    (filters.assinatura ? 1 : 0) +
    (filters.origem ? 1 : 0) +
    (filters.versao ? 1 : 0) +
    (filters.periodo ? 1 : 0);

  function reset() {
    setFilters(DEFAULT_CONTRATOS_FILTERS);
  }

  async function onPdf() {
    if (filtered.length === 0) {
      toast.info("Nenhum contrato para exportar com os filtros atuais.");
      return;
    }
    setPdfBusy(true);
    try {
      exportContratosPdf(filtered, { ...filters, q: debouncedQ });
      toast.success("PDF gerado com sucesso.");
    } catch (e) {
      toast.error(`Falha ao gerar PDF: ${(e as Error).message}`);
    } finally {
      setPdfBusy(false);
    }
  }

  async function onXls() {
    if (filtered.length === 0) {
      toast.info("Nenhum contrato para exportar com os filtros atuais.");
      return;
    }
    setXlsBusy(true);
    try {
      exportContratosXlsx(filtered, { ...filters, q: debouncedQ });
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
        title="Contratos e termos"
        description="Todos os aceites do termo de atendimento assinados por clientes na primeira visita e nas sessões recorrentes."
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MetricCard icon={FileSignature} label="Total" value={metrics.total} />
        <MetricCard icon={CheckCircle2} label="Com assinatura" value={metrics.assinados} />
        <MetricCard
          icon={ShieldCheck}
          label="Sem assinatura"
          value={metrics.semAssinatura}
          tone={metrics.semAssinatura > 0 ? "warning" : undefined}
        />
        <MetricCard icon={Sparkles} label="Primeira visita" value={metrics.primeiraVisita} />
        <MetricCard icon={RefreshCw} label="Recorrentes" value={metrics.recorrentes} />
        <MetricCard icon={FileSignature} label="Hoje" value={metrics.hoje} />
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
              placeholder="Buscar por nome, CPF, tatuador ou ID…"
              className="pl-9"
              aria-label="Pesquisar contratos"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
            <Select
              value={filters.status ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  status: v === "all" ? null : (v as ContratoStatus),
                }))
              }
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="signed">Assinado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
                <SelectItem value="superseded">Substituído</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.origem ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  origem: v === "all" ? null : (v as ContratosFilters["origem"]),
                }))
              }
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="primeira_visita">Primeira visita</SelectItem>
                <SelectItem value="recorrente">Recorrente</SelectItem>
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
                  assinatura: v === "all" ? null : (v as ContratosFilters["assinatura"]),
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
            <Select
              value={filters.versao ?? "all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, versao: v === "all" ? null : v }))}
            >
              <SelectTrigger className="w-full md:w-[140px]">
                <SelectValue placeholder="Versão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as versões</SelectItem>
                {versions.map((version) => (
                  <SelectItem key={version} value={version}>
                    {version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.periodo ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  periodo: v === "all" ? null : (v as ContratosFilters["periodo"]),
                }))
              }
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os períodos</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
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
          title="Não foi possível carregar os contratos"
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
          icon={FileSignature}
          title={data.length === 0 ? "Nenhum contrato registrado" : "Nenhum contrato encontrado"}
          description={
            data.length === 0
              ? "Os contratos aparecem aqui automaticamente após o aceite do termo pelos clientes no cadastro ou no check-in recorrente."
              : "Ajuste os filtros ou limpe a pesquisa para ver todos os contratos."
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
                  <th className="px-4 py-3 text-left font-medium">Origem</th>
                  <th className="px-4 py-3 text-left font-medium">Versão</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Assin.</th>
                  <th className="px-4 py-3 text-left font-medium">Aceito em</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer transition-colors hover:bg-background/30"
                    onClick={() => navigate(`/admin/contratos/${c.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/60 text-[11px] font-semibold text-[color:var(--gold)]">
                          {c.clienteIniciais}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">
                            {c.clienteNome || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">{c.cpfMasked}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground/80">{c.tatuador ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.origem === "primeira_visita" ? "default" : "secondary"}>
                        {ORIGEM_LABEL[c.origem]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="text-foreground/80">{c.versao}</div>
                        {!c.hasSnapshot && (
                          <div className="text-[11px] text-amber-300">{c.legacyNotice}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={c.status} />
                    </td>
                    <td className="px-4 py-3">
                      {c.temAssinatura ? (
                        <FileSignature className="h-4 w-4 text-[color:var(--gold)]" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground/80">{formatDateTimeBR(c.aceitoEm)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link to={`/admin/contratos/${c.id}`}>Ver contrato</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((c) => (
              <Link
                key={c.id}
                to={`/admin/contratos/${c.id}`}
                className="block rounded-xl border border-border/60 bg-card/40 p-4 transition-colors hover:border-[color:var(--gold)]/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">
                      {c.clienteNome || "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">{c.cpfMasked}</div>
                  </div>
                  <StatusPill status={c.status} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={c.origem === "primeira_visita" ? "default" : "secondary"}>
                    {ORIGEM_LABEL[c.origem]}
                  </Badge>
                  <span>Versão {c.versao}</span>
                  {!c.hasSnapshot && <span className="text-amber-300">Documento legado</span>}
                  {c.temAssinatura && (
                    <span className="flex items-center gap-1">
                      <FileSignature className="h-3 w-3" /> Assinado
                    </span>
                  )}
                  <span>· {formatDateTimeBR(c.aceitoEm)}</span>
                </div>
                {c.tatuador && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Tatuador: <span className="text-foreground/80">{c.tatuador}</span>
                  </div>
                )}
              </Link>
            ))}
          </div>

          <p className="text-xs text-muted-foreground" data-no-print>
            Exibindo {filtered.length} de {data.length} contrato(s).
          </p>
        </>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: ContratoStatus }) {
  const tones: Record<ContratoStatus, string> = {
    signed: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
    cancelled: "border-rose-500/40 text-rose-400 bg-rose-500/10",
    superseded: "border-slate-500/40 text-slate-300 bg-slate-500/10",
    error: "border-amber-500/40 text-amber-400 bg-amber-500/10",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tones[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
