import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Loader2,
  MessageSquarePlus,
  Phone,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  Timer,
  UserX,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  addCheckInNote,
  callCheckIn,
  cancelCheckIn,
  completeCheckIn,
  EVENT_LABEL,
  formatDateTimeBR,
  formatTimeBR,
  formatWait,
  noShowCheckIn,
  serviceMinutes,
  startCheckIn,
  STATUS_LABEL,
  useCheckIn,
  waitMinutes,
  type CheckIn,
} from "@/lib/checkins";
import { getErrorMessage } from "@/lib/errors";

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

export default function AdminCheckinDetalhePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, events, isLoading, notFound, error, refetch } = useCheckIn(id);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  async function run(fn: () => Promise<void>, msg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      refetch();
    } catch (e) {
      toast.error(getErrorMessage(e, "Falha na operação"));
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/checkins")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
        </Button>
        <EmptyState
          icon={ClipboardList}
          title="Check-in não encontrado"
          description="Ele pode ter sido excluído ou o link está incorreto."
        />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-6 text-sm text-destructive flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" /> Falha ao carregar:{" "}
        {error?.message ?? "erro desconhecido"}
      </div>
    );
  }

  const c = data;
  const wait = waitMinutes(c);
  const svc = serviceMinutes(c);

  return (
    <div className="space-y-6" data-print-area>
      <div data-no-print>
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/checkins")}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar para check-ins
        </Button>
      </div>

      <PageHeader
        title={c.clienteNome}
        description={`${c.cpfMasked} · ${c.tatuador ?? "sem tatuador"}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refetch} data-no-print>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Atualizar
            </Button>
            <Button variant="outline" size="sm" asChild data-no-print>
              <Link to={`/admin/clientes/${c.cpf}`}>
                <FileText className="mr-1.5 h-4 w-4" /> Ficha do cliente
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {statusBadge(c.status)}
        {c.riskFlag && (
          <Badge variant="destructive" className="gap-1">
            <ShieldAlert className="h-3 w-3" /> Risco
          </Badge>
        )}
        {!c.hasFicha && (
          <Badge variant="outline" className="border-amber-500/40 text-amber-600">
            Sem ficha
          </Badge>
        )}
      </div>

      {/* Ações da fila conforme status */}
      {["waiting", "called", "in_service"].includes(c.status) && (
        <section
          className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm"
          data-no-print
        >
          <div className="flex flex-wrap gap-2">
            {c.status === "waiting" && (
              <Button
                disabled={busy}
                onClick={() => run(() => callCheckIn(c.id), "Cliente chamado.")}
              >
                {busy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Phone className="mr-1.5 h-4 w-4" />
                )}
                Chamar
              </Button>
            )}
            {(c.status === "waiting" || c.status === "called") && (
              <Button
                disabled={busy}
                onClick={() => run(() => startCheckIn(c.id), "Atendimento iniciado.")}
              >
                {busy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="mr-1.5 h-4 w-4" />
                )}
                Iniciar atendimento
              </Button>
            )}
            {c.status === "in_service" && (
              <Button
                disabled={busy}
                onClick={() => run(() => completeCheckIn(c.id), "Atendimento concluído.")}
              >
                {busy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                )}
                Concluir atendimento
              </Button>
            )}
            {c.status !== "in_service" && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`Marcar ${c.clienteNome} como não compareceu?`)) return;
                  run(() => noShowCheckIn(c.id), "Marcado como não compareceu.");
                }}
              >
                <UserX className="mr-1.5 h-4 w-4" /> Não compareceu
              </Button>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                const motivo = window.prompt("Motivo do cancelamento:", "")?.trim();
                if (!motivo) return;
                run(() => cancelCheckIn(c.id, motivo), "Check-in cancelado.");
              }}
            >
              <X className="mr-1.5 h-4 w-4" /> Cancelar
            </Button>
          </div>
        </section>
      )}

      {/* Cabeçalho de tempos */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <TimeCard icon={Clock} label="Chegada" value={formatDateTimeBR(c.arrivalAt)} />
        <TimeCard icon={Phone} label="Chamado" value={formatTimeBR(c.calledAt)} />
        <TimeCard icon={PlayCircle} label="Início" value={formatTimeBR(c.startedAt)} />
        <TimeCard icon={CheckCircle2} label="Fim" value={formatTimeBR(c.completedAt)} />
        <TimeCard icon={Timer} label="Espera" value={formatWait(wait)} />
        <TimeCard icon={Timer} label="Duração" value={svc == null ? "—" : `${svc} min`} />
        <TimeCard icon={ClipboardList} label="Posição" value={String(c.queuePosition)} />
        <TimeCard
          icon={ClipboardList}
          label="Data"
          value={new Date(c.queueDay).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
        />
      </section>

      {/* Riscos e documentos */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" /> Alertas de saúde
          </h3>
          {c.riscoMotivos.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nenhum alerta declarado no cadastro.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {c.riscoMotivos.map((m) => (
                <li key={m} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4" /> Documentos
          </h3>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Ficha preenchida" value={c.hasFicha ? "Sim" : "Não"} good={c.hasFicha} />
            <Row
              label="Assinatura"
              value={c.hasAssinatura ? "Presente" : "Ausente"}
              good={c.hasAssinatura}
            />
            {c.cancelReason && <Row label="Motivo do cancelamento" value={c.cancelReason} />}
            {c.observacoes && (
              <div>
                <span className="text-muted-foreground text-xs">Observações</span>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.observacoes}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Nova observação */}
      <section
        className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm"
        data-no-print
      >
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <MessageSquarePlus className="h-4 w-4" /> Adicionar observação
        </h3>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 1000))}
          rows={2}
          placeholder="Registrar informação relevante (fica no histórico auditável)…"
          className="mt-2"
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={busy || note.trim().length === 0}
            onClick={() =>
              run(async () => {
                await addCheckInNote(c.id, note.trim());
                setNote("");
              }, "Observação registrada.")
            }
          >
            {busy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <MessageSquarePlus className="mr-1.5 h-4 w-4" />
            )}
            Salvar
          </Button>
        </div>
      </section>

      {/* Timeline */}
      <section className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm">
        <header className="border-b border-border/60 px-4 py-3">
          <h3 className="font-semibold text-foreground">Histórico</h3>
          <p className="text-xs text-muted-foreground">Toda ação é registrada de forma imutável.</p>
        </header>
        {events.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhum evento ainda.</div>
        ) : (
          <ol className="divide-y divide-border/60">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">{EVENT_LABEL[ev.kind] ?? ev.kind}</span>
                    {ev.fromStatus && ev.toStatus && ev.fromStatus !== ev.toStatus && (
                      <Badge variant="outline" className="text-[10px]">
                        {STATUS_LABEL[ev.fromStatus]} → {STATUS_LABEL[ev.toStatus]}
                      </Badge>
                    )}
                  </div>
                  {ev.motivo && <p className="mt-0.5 text-sm text-muted-foreground">{ev.motivo}</p>}
                  {typeof ev.detalhes?.texto === "string" && (
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">
                      {ev.detalhes.texto as string}
                    </p>
                  )}
                </div>
                <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                  {formatDateTimeBR(ev.criadoEm)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function TimeCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}

function Row({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span
        className={`text-sm ${good === true ? "text-emerald-500" : good === false ? "text-amber-600" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
