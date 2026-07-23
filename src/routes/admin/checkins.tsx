import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Filter,
  Loader2,
  MoreHorizontal,
  Phone,
  PlayCircle,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  Timer,
  UserPlus,
  UserX,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  DEFAULT_CHECKIN_FILTERS,
  type CheckIn,
  type CheckInFilters,
  STATUS_LABEL,
  OPEN_STATUSES,
  callCheckIn,
  cancelCheckIn,
  completeCheckIn,
  computeMetrics,
  filterCheckIns,
  formatTimeBR,
  formatWait,
  noShowCheckIn,
  startCheckIn,
  todayISO,
  useCheckInsList,
  useDebounced,
  waitMinutes,
} from "@/lib/checkins";
import { exportCheckInsPdf, exportCheckInsXlsx } from "@/lib/checkins/export";
import { getErrorMessage } from "@/lib/errors";
import { useActiveTattooArtistNames } from "@/lib/tattoo-artists";

import { NewCheckInDialog } from "@/components/admin/checkins/NewCheckInDialog";

function statusBadge(status: CheckIn["status"]) {
  const map: Record<CheckIn["status"], { label: string; className: string }> = {
    waiting: {
      label: "Aguardando",
      className: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    },
    called: { label: "Chamado", className: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
    in_service: {
      label: "Em atendimento",
      className: "bg-primary/15 text-primary border-primary/40",
    },
    completed: {
      label: "Concluído",
      className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    },
    cancelled: { label: "Cancelado", className: "bg-muted text-muted-foreground border-border" },
    no_show: {
      label: "Não compareceu",
      className: "bg-destructive/15 text-destructive border-destructive/30",
    },
  };
  const s = map[status];
  return (
    <Badge variant="outline" className={s.className}>
      {s.label}
    </Badge>
  );
}

export default function AdminCheckinsPage() {
  const tattooArtists = useActiveTattooArtistNames();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useCheckInsList();
  const [filters, setFilters] = useState<CheckInFilters>(DEFAULT_CHECKIN_FILTERS);
  const [newOpen, setNewOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [xlsBusy, setXlsBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const debouncedQ = useDebounced(filters.q, 200);

  // Relógio para tempo de espera em tempo real
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const metrics = useMemo(() => computeMetrics(data), [data]);
  const filtered = useMemo(
    () => filterCheckIns(data, { ...filters, q: debouncedQ }),
    [data, filters, debouncedQ],
  );

  // Fila operacional do dia: waiting/called por posição, in_service acima
  const today = todayISO();
  const fila = useMemo(() => {
    return data
      .filter((r) => r.queueDay === today && OPEN_STATUSES.includes(r.status))
      .sort((a, b) => {
        const rank = { in_service: 0, called: 1, waiting: 2 } as const;
        const ra = rank[a.status as keyof typeof rank] ?? 3;
        const rb = rank[b.status as keyof typeof rank] ?? 3;
        if (ra !== rb) return ra - rb;
        return a.queuePosition - b.queuePosition;
      });
  }, [data, today]);

  const activeFilters =
    (filters.status ? 1 : 0) +
    (filters.tatuador ? 1 : 0) +
    (filters.risco ? 1 : 0) +
    (filters.ficha ? 1 : 0) +
    (filters.dia !== "hoje" ? 1 : 0);

  function reset() {
    setFilters(DEFAULT_CHECKIN_FILTERS);
  }

  async function withBusy(id: string, fn: () => Promise<unknown>, successMsg: string) {
    setBusyId(id);
    try {
      await fn();
      toast.success(successMsg);
      refetch();
    } catch (e) {
      toast.error(getErrorMessage(e, "Falha na operação"));
    } finally {
      setBusyId(null);
    }
  }

  async function onCall(c: CheckIn) {
    await withBusy(c.id, () => callCheckIn(c.id), `${c.clienteNome} chamado.`);
  }
  async function onStart(c: CheckIn) {
    await withBusy(c.id, () => startCheckIn(c.id), `Atendimento iniciado.`);
  }
  async function onComplete(c: CheckIn) {
    await withBusy(c.id, () => completeCheckIn(c.id), `Atendimento concluído.`);
  }
  async function onCancel(c: CheckIn) {
    const motivo = window.prompt("Motivo do cancelamento:", "")?.trim();
    if (!motivo) return;
    await withBusy(c.id, () => cancelCheckIn(c.id, motivo), `Check-in cancelado.`);
  }
  async function onNoShow(c: CheckIn) {
    if (!window.confirm(`Marcar ${c.clienteNome} como não compareceu?`)) return;
    await withBusy(c.id, () => noShowCheckIn(c.id), `Marcado como não compareceu.`);
  }

  async function onPdf() {
    if (filtered.length === 0) return toast.info("Nada para exportar com os filtros atuais.");
    setPdfBusy(true);
    try {
      exportCheckInsPdf(filtered, { ...filters, q: debouncedQ });
      toast.success("PDF gerado.");
    } catch (e) {
      toast.error(`Falha ao gerar PDF: ${(e as Error).message}`);
    } finally {
      setPdfBusy(false);
    }
  }
  async function onXls() {
    if (filtered.length === 0) return toast.info("Nada para exportar com os filtros atuais.");
    setXlsBusy(true);
    try {
      exportCheckInsXlsx(filtered, { ...filters, q: debouncedQ });
      toast.success("Planilha gerada.");
    } catch (e) {
      toast.error(`Falha ao gerar planilha: ${(e as Error).message}`);
    } finally {
      setXlsBusy(false);
    }
  }

  return (
    <div className="space-y-6" data-print-area>
      <PageHeader
        title="Check-ins e recepção"
        description="Fila viva do dia, histórico auditável e transições operacionais dos atendimentos."
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
            <Button size="sm" onClick={() => setNewOpen(true)} data-no-print>
              <UserPlus className="mr-1.5 h-4 w-4" /> Novo check-in
            </Button>
          </>
        }
      />

      {/* Métricas do dia */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
        <MetricCard icon={Clock} label="Aguardando" value={metrics.aguardando} />
        <MetricCard icon={Phone} label="Chamados" value={metrics.chamados} />
        <MetricCard icon={PlayCircle} label="Em atendimento" value={metrics.emAtendimento} />
        <MetricCard icon={CheckCircle2} label="Concluídos" value={metrics.concluidos} />
        <MetricCard
          icon={UserX}
          label="Não compareceu"
          value={metrics.ausentes}
          tone={metrics.ausentes > 0 ? "warning" : "default"}
        />
        <MetricCard icon={X} label="Cancelados" value={metrics.cancelados} />
        <MetricCard
          icon={Timer}
          label="Espera média"
          value={metrics.esperaMediaMin == null ? "—" : formatWait(metrics.esperaMediaMin)}
        />
      </div>

      {/* Fila operacional (sempre baseada em hoje/abertos, ignora filtros de tela) */}
      <section
        className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm"
        data-no-print
      >
        <header className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div>
            <h2 className="font-semibold text-foreground">Fila do dia</h2>
            <p className="text-xs text-muted-foreground">
              {fila.length} {fila.length === 1 ? "cliente" : "clientes"} em aberto agora.
            </p>
          </div>
        </header>

        {isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : fila.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={ClipboardList}
              title="Nenhum cliente em aberto"
              description="Quando a recepção registrar um check-in, ele aparece aqui."
              action={
                <Button size="sm" onClick={() => setNewOpen(true)}>
                  <UserPlus className="mr-1.5 h-4 w-4" /> Criar check-in
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {fila.map((c, idx) => {
              const wait = waitMinutes(c);
              const long = wait >= 60;
              return (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/60 font-mono text-sm text-muted-foreground">
                    {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/checkins/${c.id}`)}
                    className="flex flex-1 min-w-0 items-center gap-3 text-left"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {c.clienteIniciais}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium text-foreground">
                          {c.clienteNome}
                        </span>
                        {c.riskFlag && (
                          <ShieldAlert
                            className="h-3.5 w-3.5 shrink-0 text-destructive"
                            aria-label="Alerta de saúde"
                          />
                        )}
                        {!c.hasFicha && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 text-amber-600 text-[10px]"
                          >
                            sem ficha
                          </Badge>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{c.tatuador ?? "sem tatuador"}</span>
                        <span>·</span>
                        <span>chegou {formatTimeBR(c.arrivalAt)}</span>
                      </span>
                    </span>
                  </button>

                  <div className="hidden sm:flex flex-col items-end gap-1">
                    {statusBadge(c.status)}
                    <span
                      className={`text-xs tabular-nums ${long ? "text-destructive font-medium" : "text-muted-foreground"}`}
                    >
                      <Clock className="mr-1 inline h-3 w-3" />
                      {formatWait(wait)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {c.status === "waiting" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === c.id}
                        onClick={() => onCall(c)}
                      >
                        {busyId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Phone className="h-3.5 w-3.5" />
                        )}
                        <span className="ml-1 hidden md:inline">Chamar</span>
                      </Button>
                    )}
                    {(c.status === "waiting" || c.status === "called") && (
                      <Button size="sm" disabled={busyId === c.id} onClick={() => onStart(c)}>
                        {busyId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <PlayCircle className="h-3.5 w-3.5" />
                        )}
                        <span className="ml-1 hidden md:inline">Iniciar</span>
                      </Button>
                    )}
                    {c.status === "in_service" && (
                      <Button size="sm" disabled={busyId === c.id} onClick={() => onComplete(c)}>
                        {busyId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        <span className="ml-1 hidden md:inline">Concluir</span>
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/admin/checkins/${c.id}`)}>
                          Abrir detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/admin/clientes/${c.cpf}`)}>
                          Ficha do cliente
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {c.status !== "in_service" && (
                          <DropdownMenuItem onClick={() => onNoShow(c)}>
                            Marcar não compareceu
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive" onClick={() => onCancel(c)}>
                          Cancelar check-in
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Histórico com filtros */}
      <section className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm">
        <header
          className="flex flex-col gap-3 border-b border-border/60 p-4 md:flex-row md:items-center"
          data-no-print
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="Buscar por nome, CPF ou tatuador…"
              className="pl-9"
              aria-label="Pesquisar check-ins"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
            <Select
              value={filters.dia}
              onValueChange={(v) => setFilters((f) => ({ ...f, dia: v as CheckInFilters["dia"] }))}
            >
              <SelectTrigger className="w-full md:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="todos">Todos os dias</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.status || "all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  status: v === "all" ? "" : (v as CheckInFilters["status"]),
                }))
              }
            >
              <SelectTrigger className="w-full md:w-[170px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="abertos">Somente abertos</SelectItem>
                <SelectItem value="waiting">Aguardando</SelectItem>
                <SelectItem value="called">Chamado</SelectItem>
                <SelectItem value="in_service">Em atendimento</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
                <SelectItem value="no_show">Não compareceu</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.tatuador || "all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, tatuador: v === "all" ? "" : v }))}
            >
              <SelectTrigger className="w-full md:w-[190px]">
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
              value={filters.risco || "all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  risco: v === "all" ? "" : (v as CheckInFilters["risco"]),
                }))
              }
            >
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="Risco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Risco (todos)</SelectItem>
                <SelectItem value="com">Com alertas</SelectItem>
                <SelectItem value="sem">Sem alertas</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.ficha || "all"}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  ficha: v === "all" ? "" : (v as CheckInFilters["ficha"]),
                }))
              }
            >
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="Ficha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Ficha (todas)</SelectItem>
                <SelectItem value="com">Com ficha</SelectItem>
                <SelectItem value="sem">Sem ficha</SelectItem>
              </SelectContent>
            </Select>
            {activeFilters > 0 && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="mr-1 h-3.5 w-3.5" /> Limpar
              </Button>
            )}
          </div>
        </header>

        {error ? (
          <div className="p-6 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Falha ao carregar: {error.message}
          </div>
        ) : isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Filter}
              title="Nenhum check-in encontrado"
              description="Ajuste os filtros ou amplie o escopo para outros dias."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Cliente</th>
                  <th className="px-4 py-2 text-left font-medium">Tatuador</th>
                  <th className="px-4 py-2 text-left font-medium">Data</th>
                  <th className="px-4 py-2 text-left font-medium">Chegada</th>
                  <th className="px-4 py-2 text-left font-medium">Espera</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const wait = waitMinutes(c);
                  return (
                    <tr
                      key={c.id}
                      className="cursor-pointer border-t border-border/50 transition-colors hover:bg-background/30"
                      onClick={() => navigate(`/admin/checkins/${c.id}`)}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                            {c.clienteIniciais}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-medium text-foreground">
                                {c.clienteNome}
                              </span>
                              {c.riskFlag && (
                                <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{c.cpfMasked}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.tatuador ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {new Date(c.queueDay).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                        {formatTimeBR(c.arrivalAt)}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                        {formatWait(wait)}
                      </td>
                      <td className="px-4 py-2.5">{statusBadge(c.status)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/checkins/${c.id}`);
                          }}
                        >
                          Abrir
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <NewCheckInDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(id) => {
          refetch();
          navigate(`/admin/checkins/${id}`);
        }}
      />
    </div>
  );
}
