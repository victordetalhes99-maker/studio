import { Link } from "react-router-dom";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Database,
  FileSignature,
  Files,
  Palette,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/admin/dashboard/MetricCard";
import { QuickActionCard } from "@/components/admin/dashboard/QuickActionCard";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import {
  formatWaitShort,
  timeAgo,
  useDashboardSummary,
  type DashboardActivity,
} from "@/lib/dashboard";
import {
  formatTimeBR,
  formatWait,
  waitMinutes,
  STATUS_LABEL as CHECKIN_STATUS_LABEL,
} from "@/lib/checkins";
import { formatDateBR } from "@/lib/clientes-admin";
import { cn } from "@/lib/utils";

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const ACTIVITY_ICON: Record<DashboardActivity["kind"], typeof Users> = {
  cliente: UserPlus,
  checkin: Clock,
  ficha: ClipboardList,
  contrato: FileSignature,
  risco: ShieldAlert,
  backup: Database,
};

const SEVERITY_STYLE: Record<"info" | "atencao" | "critico", string> = {
  info: "border-border/60 bg-background/40 text-muted-foreground",
  atencao: "border-amber-500/30 bg-amber-500/5 text-amber-200",
  critico: "border-destructive/40 bg-destructive/10 text-destructive",
};

export default function AdminDashboardPage() {
  const s = useDashboardSummary();

  const dataAgora = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const backupLabel = !s.backup.configured
    ? "Não configurado"
    : s.backup.lastStatus
      ? s.backup.lastStatus.charAt(0).toUpperCase() + s.backup.lastStatus.slice(1)
      : "Aguardando execução";

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card/80 via-card/50 to-background/60 p-6 backdrop-blur-sm sm:p-8">
        <div
          className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[color:var(--gold)]/10 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--gold)]" />
              <span>{saudacao()}, administrador</span>
            </div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Dashboard
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Acompanhe a operação do estúdio, os atendimentos do dia e as principais pendências
              administrativas. Hoje é <span className="text-foreground/80">{dataAgora}</span>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {s.isLoading && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Atualizando…
              </span>
            )}
            <Button asChild className="btn-gold">
              <Link to="/admin/checkins">
                <ArrowUpRight className="mr-1.5 h-4 w-4" />
                Operação de hoje
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/relatorios">Relatórios</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Erros parciais */}
      {s.hasError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Algumas seções falharam ao carregar. As demais informações permanecem disponíveis.
        </div>
      )}

      {/* Indicadores */}
      <section aria-labelledby="ind">
        <h2
          id="ind"
          className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          Indicadores
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <LinkCard to="/admin/checkins">
            <MetricCard
              icon={Clock}
              label="Check-ins hoje"
              value={s.operation.total}
              hint={`${s.operation.aguardando} aguardando · ${s.operation.emAtendimento} em atendimento`}
            />
          </LinkCard>
          <LinkCard to="/admin/clientes">
            <MetricCard icon={Users} label="Clientes cadastrados" value={s.totals.clientes} />
          </LinkCard>
          <LinkCard to="/admin/tatuadores">
            <MetricCard
              icon={Palette}
              label="Tatuadores ativos"
              value={s.totals.tatuadoresAtivos}
            />
          </LinkCard>
          <LinkCard to="/admin/fichas">
            <MetricCard
              icon={ClipboardList}
              label="Fichas incompletas"
              value={s.totals.fichasIncompletas}
              hint={s.totals.fichasHoje !== null ? `${s.totals.fichasHoje} hoje` : undefined}
            />
          </LinkCard>
          <LinkCard to="/admin/contratos">
            <MetricCard
              icon={FileSignature}
              label="Contratos sem assinatura"
              value={s.totals.contratosPendentes}
              hint={
                s.totals.contratosTotal !== null ? `${s.totals.contratosTotal} no total` : undefined
              }
            />
          </LinkCard>
          <LinkCard to="/admin/clientes-risco">
            <MetricCard
              icon={ShieldAlert}
              label="Alertas de risco"
              value={s.totals.riscoPendentes}
              tone={s.totals.riscoPendentes ? "danger" : "default"}
              hint={s.totals.riscoAlto ? `${s.totals.riscoAlto} nível alto` : undefined}
            />
          </LinkCard>
          <LinkCard to="/admin/documentos">
            <MetricCard
              icon={Files}
              label="Documentos com erro"
              value={s.totals.documentosErro}
              tone={s.totals.documentosErro ? "danger" : "default"}
              hint={
                s.totals.documentosPendentes
                  ? `${s.totals.documentosPendentes} pendentes`
                  : undefined
              }
            />
          </LinkCard>
          <LinkCard to="/admin/backup">
            <MetricCard
              icon={Database}
              label="Backup"
              value={backupLabel}
              hint={
                s.backup.configured
                  ? `${s.backup.destinosConectados}/${s.backup.destinosTotal} destinos conectados`
                  : "Nenhum destino configurado"
              }
              tone={!s.backup.configured ? "warning" : "default"}
            />
          </LinkCard>
        </div>
      </section>

      {/* Operação do dia */}
      <section
        aria-labelledby="op"
        className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[color:var(--gold)]" />
            <h2
              id="op"
              className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground"
            >
              Operação de hoje
            </h2>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/checkins">
              Ver todos os check-ins <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <MiniStat label="Total" value={s.operation.total} />
          <MiniStat label="Aguardando" value={s.operation.aguardando} />
          <MiniStat label="Chamados" value={s.operation.chamados} />
          <MiniStat label="Em atendimento" value={s.operation.emAtendimento} />
          <MiniStat label="Concluídos" value={s.operation.concluidos} />
          <MiniStat label="Cancelados" value={s.operation.cancelados} />
          <MiniStat label="Espera média" value={formatWaitShort(s.operation.esperaMediaMin)} />
        </div>
      </section>

      {/* Fila + Em atendimento */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
              Fila resumida
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/checkins">Ver fila completa</Link>
            </Button>
          </div>
          {s.queue.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Fila vazia"
              description="Nenhum cliente aguardando no momento."
              compact
            />
          ) : (
            <ul className="mt-3 divide-y divide-border/50">
              {s.queue.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/60 text-xs font-semibold text-foreground">
                    {c.queuePosition}
                  </span>
                  <Link
                    to={`/admin/checkins/${c.id}`}
                    className="min-w-0 flex-1 hover:text-[color:var(--gold)]"
                  >
                    <div className="truncate text-sm font-medium text-foreground">
                      {c.clienteNome}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.tatuador ?? "Sem tatuador"} · Chegada {formatTimeBR(c.arrivalAt)}
                      {c.riskFlag ? " · ⚠ alerta" : ""}
                    </div>
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {CHECKIN_STATUS_LABEL[c.status]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatWait(waitMinutes(c))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
              Em atendimento
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/checkins">Ver todos</Link>
            </Button>
          </div>
          {s.inService.length === 0 ? (
            <EmptyState
              icon={PlayCircle}
              title="Nenhum atendimento em andamento"
              description="Assim que um cliente for iniciado, aparecerá aqui."
              compact
            />
          ) : (
            <ul className="mt-3 divide-y divide-border/50">
              {s.inService.map((c) => {
                const started = c.startedAt ? new Date(c.startedAt).getTime() : null;
                const dur = started
                  ? Math.max(0, Math.floor((Date.now() - started) / 60000))
                  : null;
                return (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    <PlayCircle className="h-4 w-4 text-[color:var(--gold)]" />
                    <Link
                      to={`/admin/checkins/${c.id}`}
                      className="min-w-0 flex-1 hover:text-[color:var(--gold)]"
                    >
                      <div className="truncate text-sm font-medium text-foreground">
                        {c.clienteNome}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.tatuador ?? "Sem tatuador"} · Início {formatTimeBR(c.startedAt)}
                      </div>
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {dur !== null ? `${dur}min` : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Pendências */}
      <section className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[color:var(--gold)]" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
              Pendências
            </h2>
          </div>
        </div>
        {s.pending.length === 0 ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/50 bg-background/30 px-4 py-3 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Nenhuma pendência crítica no momento.
          </div>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {s.pending.map((p) => (
              <li
                key={p.id}
                className={cn("rounded-lg border px-3 py-2.5", SEVERITY_STYLE[p.severity])}
              >
                <Link to={p.route} className="block">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{p.title}</span>
                    <span className="text-lg font-semibold text-foreground">{p.count}</span>
                  </div>
                  <div className="mt-0.5 text-xs opacity-80">{p.description}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Clientes recentes + Equipe hoje */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
              Clientes recentes
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/clientes">Ver todos</Link>
            </Button>
          </div>
          {s.recentClients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Sem clientes recentes"
              description="Novos cadastros aparecerão aqui."
              compact
            />
          ) : (
            <ul className="mt-3 divide-y divide-border/50">
              {s.recentClients.map((c) => (
                <li key={c.cpf} className="flex items-center gap-3 py-2.5">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <Link
                    to={`/admin/clientes/${c.cpf}`}
                    className="min-w-0 flex-1 hover:text-[color:var(--gold)]"
                  >
                    <div className="truncate text-sm font-medium text-foreground">{c.nome}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.tatuador ?? "Sem tatuador"} · {formatDateBR(c.criadoEm)}
                    </div>
                  </Link>
                  <div className="flex gap-1 text-[10px] uppercase tracking-wider">
                    {c.temFicha && (
                      <span className="rounded border border-border/50 px-1.5 py-0.5 text-muted-foreground">
                        Ficha
                      </span>
                    )}
                    {c.temAssinatura && (
                      <span className="rounded border border-border/50 px-1.5 py-0.5 text-muted-foreground">
                        Assinatura
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
              Equipe hoje
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/tatuadores">Gerenciar</Link>
            </Button>
          </div>
          {s.artistsToday.length === 0 ? (
            <EmptyState
              icon={Palette}
              title="Sem tatuadores em operação"
              description="Nenhum atendimento vinculado a tatuador hoje."
              compact
            />
          ) : (
            <ul className="mt-3 divide-y divide-border/50">
              {s.artistsToday.slice(0, 6).map((a) => (
                <li key={a.nome} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--gold)]/30 bg-[color:var(--gold)]/10 text-[10px] font-semibold text-[color:var(--gold)]">
                    {a.nome
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1 text-sm font-medium text-foreground truncate">
                    {a.nome}
                  </div>
                  <div className="flex gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <span>{a.aguardando} aguardando</span>
                    <span>{a.emAtendimento} em atend.</span>
                    <span>{a.concluidos} concluídos</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Atividade + Atalhos */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm lg:col-span-2">
          <div className="flex items-center gap-2">
            <ActivityIcon className="h-4 w-4 text-[color:var(--gold)]" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
              Atividade recente
            </h2>
          </div>
          {s.activity.length === 0 ? (
            <EmptyState
              icon={ActivityIcon}
              title="Nenhuma atividade recente"
              description="Novos eventos aparecerão aqui automaticamente."
              compact
            />
          ) : (
            <ul className="mt-3 divide-y divide-border/50">
              {s.activity.map((a) => {
                const Icon = ACTIVITY_ICON[a.kind];
                const content = (
                  <>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-foreground">{a.title}</div>
                      {a.subtitle && (
                        <div className="truncate text-xs text-muted-foreground">{a.subtitle}</div>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.at)}</span>
                  </>
                );
                return (
                  <li key={a.id} className="py-2.5">
                    {a.route ? (
                      <Link
                        to={a.route}
                        className="flex items-center gap-3 hover:text-[color:var(--gold)]"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
            Atalhos
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <QuickActionCard
              icon={ArrowUpRight}
              title="Abrir recepção"
              description="Iniciar check-in de cliente."
              to="/"
            />
            <QuickActionCard
              icon={ClipboardList}
              title="Ver fichas"
              description="Anamnese e prontuários."
              to="/admin/fichas"
            />
            <QuickActionCard
              icon={FileSignature}
              title="Ver contratos"
              description="Assinaturas e termos."
              to="/admin/contratos"
            />
            <QuickActionCard
              icon={ShieldAlert}
              title="Clientes de risco"
              description="Revisão clínica pendente."
              to="/admin/clientes-risco"
            />
            <QuickActionCard
              icon={Database}
              title="Central de backup"
              description="Configuração e histórico."
              to="/admin/backup"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers locais
// ---------------------------------------------------------------------------
function LinkCard({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gold)]/50 rounded-xl"
    >
      {children}
    </Link>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  const isEmpty = value === null || value === undefined || value === "—";
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          isEmpty ? "text-muted-foreground/60" : "text-foreground",
        )}
      >
        {isEmpty ? "—" : value}
      </div>
    </div>
  );
}
