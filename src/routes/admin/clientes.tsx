import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ClipboardList,
  Download,
  FileText,
  Filter,
  Loader2,
  Search,
  ShieldAlert,
  UserPlus,
  Users,
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
  DEFAULT_FILTERS,
  type ClientFiltersState,
  formatDateBR,
  maskCpfSafe,
  useAdminClients,
  useDebounced,
  useFilteredClients,
} from "@/lib/clientes-admin";
import { exportClientsPdf, exportClientsXlsx } from "@/lib/clientes-admin/export";
import { useActiveTattooArtistNames } from "@/lib/tattoo-artists";

export default function AdminClientesPage() {
  const tattooArtists = useActiveTattooArtistNames();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useAdminClients();
  const [filters, setFilters] = useState<ClientFiltersState>(DEFAULT_FILTERS);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [xlsBusy, setXlsBusy] = useState(false);

  const debouncedQ = useDebounced(filters.q, 200);
  const filtered = useFilteredClients(data, { ...filters, q: debouncedQ });

  const metrics = useMemo(() => {
    const total = data.length;
    const comFicha = data.filter((c) => c.temFicha).length;
    const risco = data.filter((c) => c.riscoNivel === "attention").length;
    const aguardando = data.filter((c) => c.status === "aguardando").length;
    return { total, comFicha, risco, aguardando };
  }, [data]);

  const activeFilters =
    (filters.tatuador ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (filters.risco ? 1 : 0) +
    (filters.ficha ? 1 : 0);

  function reset() {
    setFilters(DEFAULT_FILTERS);
  }

  async function onPdf() {
    if (filtered.length === 0) {
      toast.info("Nenhum cliente para exportar com os filtros atuais.");
      return;
    }
    setPdfBusy(true);
    try {
      exportClientsPdf(filtered, { ...filters, q: debouncedQ });
      toast.success("PDF gerado com sucesso.");
    } catch (e) {
      toast.error(`Falha ao gerar PDF: ${(e as Error).message}`);
    } finally {
      setPdfBusy(false);
    }
  }

  async function onXls() {
    if (filtered.length === 0) {
      toast.info("Nenhum cliente para exportar com os filtros atuais.");
      return;
    }
    setXlsBusy(true);
    try {
      exportClientsXlsx(filtered, { ...filters, q: debouncedQ });
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
        title="Clientes"
        description="Base única de clientes cadastrados. Cada CPF é uma identidade estável e reúne ficha, sessões e histórico."
        actions={
          <>
            <Button variant="outline" onClick={onPdf} disabled={pdfBusy}>
              {pdfBusy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-1.5 h-4 w-4" />
              )}
              PDF
            </Button>
            <Button variant="outline" onClick={onXls} disabled={xlsBusy}>
              {xlsBusy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}
              Planilha
            </Button>
            <Button asChild className="btn-gold">
              <Link to="/">
                <UserPlus className="mr-1.5 h-4 w-4" />
                Novo check-in
              </Link>
            </Button>
          </>
        }
      />

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard
          icon={Users}
          label="Total cadastrado"
          value={isLoading ? null : metrics.total}
          hint={isLoading ? "Carregando…" : "Clientes com CPF único"}
        />
        <MetricCard
          icon={ClipboardList}
          label="Com ficha preenchida"
          value={isLoading ? null : metrics.comFicha}
        />
        <MetricCard
          icon={ShieldAlert}
          label="Alertas de risco"
          value={isLoading ? null : metrics.risco}
          tone={metrics.risco > 0 ? "danger" : "default"}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Aguardando atendimento"
          value={isLoading ? null : metrics.aguardando}
        />
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            Não foi possível carregar a base de clientes. {error.message}
          </div>
          <Button size="sm" variant="outline" onClick={refetch}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {/* Filtros */}
      <section
        aria-label="Filtros"
        className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm"
        data-no-print
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Buscar por nome, CPF, telefone, e-mail ou tatuador…"
              className="pl-9"
              inputMode="search"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:flex-wrap lg:gap-2">
            <Select
              value={filters.tatuador ?? "__all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, tatuador: v === "__all" ? null : v }))
              }
            >
              <SelectTrigger className="min-w-[9.5rem]">
                <SelectValue placeholder="Tatuador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos os tatuadores</SelectItem>
                {tattooArtists.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.status ?? "__all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  status: v === "__all" ? null : (v as ClientFiltersState["status"]),
                }))
              }
            >
              <SelectTrigger className="min-w-[8.5rem]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos os status</SelectItem>
                <SelectItem value="aguardando">Aguardando</SelectItem>
                <SelectItem value="atendido">Atendido</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.risco ?? "__all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  risco: v === "__all" ? null : (v as "com" | "sem"),
                }))
              }
            >
              <SelectTrigger className="min-w-[8.5rem]">
                <SelectValue placeholder="Risco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Qualquer risco</SelectItem>
                <SelectItem value="com">Com alertas</SelectItem>
                <SelectItem value="sem">Sem alertas</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.ficha ?? "__all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  ficha: v === "__all" ? null : (v as "com" | "sem"),
                }))
              }
            >
              <SelectTrigger className="min-w-[8.5rem]">
                <SelectValue placeholder="Ficha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Qualquer ficha</SelectItem>
                <SelectItem value="com">Ficha preenchida</SelectItem>
                <SelectItem value="sem">Ficha pendente</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.sort}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, sort: v as ClientFiltersState["sort"] }))
              }
            >
              <SelectTrigger className="min-w-[9.5rem]">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recentes">Mais recentes</SelectItem>
                <SelectItem value="antigos">Mais antigos</SelectItem>
                <SelectItem value="nome">Nome (A–Z)</SelectItem>
                <SelectItem value="ultima">Última sessão</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="risco">Risco primeiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {activeFilters > 0 || filters.q ? (
            <Button variant="ghost" size="sm" onClick={reset}>
              <X className="mr-1.5 h-4 w-4" />
              Limpar
            </Button>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span>
            {isLoading
              ? "Carregando clientes…"
              : `${filtered.length} de ${data.length} cliente${data.length === 1 ? "" : "s"}`}
          </span>
          {activeFilters > 0 ? (
            <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
              {activeFilters} filtro{activeFilters > 1 ? "s" : ""} ativo
              {activeFilters > 1 ? "s" : ""}
            </Badge>
          ) : null}
        </div>
      </section>

      {/* Tabela */}
      {isLoading ? (
        <div className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={data.length === 0 ? "Nenhum cliente cadastrado" : "Nenhum resultado"}
          description={
            data.length === 0
              ? "Assim que os check-ins acontecerem, os clientes aparecerão aqui automaticamente."
              : "Ajuste os filtros ou a pesquisa para encontrar o cliente."
          }
          action={
            data.length === 0 ? (
              <Button asChild className="btn-gold">
                <Link to="/">Abrir recepção</Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={reset}>
                Limpar filtros
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden overflow-hidden rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-background/40 text-left">
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Cliente
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      CPF
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Tatuador
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Sessões
                    </th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Última
                    </th>
                    <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.cpf}
                      onClick={() => navigate(`/admin/clientes/${c.cpf}`)}
                      className="cursor-pointer border-b border-border/30 last:border-0 transition-colors hover:bg-background/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/60 text-[11px] font-semibold text-[color:var(--gold)]">
                            {c.nomeIniciais}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">
                              {c.nome || "—"}
                            </div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {c.telefoneMasked ?? c.email ?? "—"}
                            </div>
                          </div>
                          {c.riscoNivel === "attention" ? (
                            <ShieldAlert
                              className="h-4 w-4 shrink-0 text-destructive"
                              aria-label="Alertas de anamnese"
                            />
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground/80">
                        {maskCpfSafe(c.cpf)}
                      </td>
                      <td className="px-4 py-3 text-foreground/85">{c.tatuador ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={
                            c.status === "aguardando"
                              ? "border-amber-500/40 text-amber-300"
                              : "border-emerald-500/40 text-emerald-300"
                          }
                        >
                          {c.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{c.totalSessoes}</td>
                      <td className="px-4 py-3 text-foreground/80">
                        {formatDateBR(c.ultimaSessao)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/admin/clientes/${c.cpf}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs uppercase tracking-[0.14em] text-[color:var(--gold)] hover:underline"
                        >
                          Abrir perfil
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile */}
          <div className="grid grid-cols-1 gap-2 md:hidden">
            {filtered.map((c) => (
              <Link
                key={c.cpf}
                to={`/admin/clientes/${c.cpf}`}
                className="rounded-xl border border-border/60 bg-card/40 p-3 text-sm backdrop-blur-sm active:bg-background/40"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background/60 text-xs font-semibold text-[color:var(--gold)]">
                    {c.nomeIniciais}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{c.nome || "—"}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {maskCpfSafe(c.cpf)}
                    </div>
                  </div>
                  {c.riscoNivel === "attention" ? (
                    <ShieldAlert className="h-4 w-4 text-destructive" />
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-y-1 text-[11px]">
                  <span className="text-muted-foreground">Tatuador</span>
                  <span className="text-right text-foreground/85">{c.tatuador ?? "—"}</span>
                  <span className="text-muted-foreground">Status</span>
                  <span className="text-right text-foreground/85">{c.status}</span>
                  <span className="text-muted-foreground">Sessões</span>
                  <span className="text-right tabular-nums text-foreground/85">
                    {c.totalSessoes}
                  </span>
                  <span className="text-muted-foreground">Última</span>
                  <span className="text-right text-foreground/85">
                    {formatDateBR(c.ultimaSessao)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
