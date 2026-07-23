import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  Archive,
  CheckCircle2,
  ClipboardList,
  FileText,
  History,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CATEGORY_LABEL,
  SEVERITY_LABEL,
  STATUS_LABEL,
  addReviewNote,
  archiveAlert,
  formatDateTimeBR,
  saveReview,
  useRiskAlert,
  type RiskAlertStatus,
  type RiskReviewEvent,
} from "@/lib/risk";
import type { RiskSeverity } from "@/lib/risk/rules";

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

const KIND_LABEL: Record<RiskReviewEvent["kind"], string> = {
  created: "Alerta iniciado",
  review_started: "Revisão iniciada",
  decision_recorded: "Decisão registrada",
  decision_changed: "Decisão alterada",
  note_added: "Observação adicionada",
  archived: "Alerta arquivado",
  reopened: "Alerta reaberto",
  new_version: "Nova versão detectada",
};

const KIND_ICON: Record<RiskReviewEvent["kind"], typeof CheckCircle2> = {
  created: ShieldAlert,
  review_started: AlertTriangle,
  decision_recorded: CheckCircle2,
  decision_changed: History,
  note_added: MessageSquarePlus,
  archived: Archive,
  reopened: RefreshCw,
  new_version: AlertOctagon,
};

export default function AdminRiskAlertDetalhePage() {
  const params = useParams();
  const rawId = params.id ? decodeURIComponent(params.id) : undefined;
  const navigate = useNavigate();
  const { data, isLoading, notFound, error, refetch } = useRiskAlert(rawId);

  const [newStatus, setNewStatus] = useState<RiskAlertStatus>("under_review");
  const [decision, setDecision] = useState("");
  const [observacao, setObservacao] = useState("");
  const [motivoAlt, setMotivoAlt] = useState("");
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setNewStatus(data.status === "pending_review" ? "under_review" : data.status);
    setDecision(data.decision || "");
    setObservacao(data.observacao || "");
    setMotivoAlt("");
  }, [data?.id, data?.decision, data?.observacao, data?.status, data]);

  const requireMotivo = useMemo(() => {
    if (!data) return false;
    if (!data.hasReview || !data.decision) return false;
    const changed = (decision || "") !== (data.decision || "") || newStatus !== data.status;
    return changed;
  }, [data, decision, newStatus]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (notFound || !data) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Alerta não encontrado"
        description="O alerta pode ter sido arquivado, a ficha foi anonimizada ou o link está inválido."
        action={
          <Button variant="outline" onClick={() => navigate("/admin/clientes-risco")}>
            Voltar
          </Button>
        }
      />
    );
  }
  if (error) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Falha ao carregar alerta"
        description={error.message}
        action={<Button onClick={() => refetch()}>Tentar novamente</Button>}
      />
    );
  }

  const handleSave = async () => {
    if (requireMotivo && motivoAlt.trim().length < 3) {
      toast.error("Informe o motivo da alteração (mín. 3 caracteres).");
      return;
    }
    try {
      setSaving(true);
      await saveReview({
        alertId: data.id,
        cpf: data.cpf,
        formId: data.formId,
        formVersion: data.formVersion,
        level: data.level,
        newStatus,
        decision,
        observacao,
        motivoAlteracao: requireMotivo ? motivoAlt.trim() : undefined,
      });
      toast.success("Revisão registrada.");
      refetch();
      window.dispatchEvent(new Event("risk:refresh"));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    const txt = noteText.trim();
    if (!txt) return;
    try {
      setNoteBusy(true);
      await addReviewNote(data.id, txt);
      setNoteText("");
      toast.success("Observação registrada.");
      refetch();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar.");
    } finally {
      setNoteBusy(false);
    }
  };

  const handleArchive = async () => {
    if (archiveReason.trim().length < 3) {
      toast.error("Motivo do arquivamento é obrigatório.");
      return;
    }
    try {
      setArchiveBusy(true);
      await archiveAlert(data.id, archiveReason.trim());
      toast.success("Alerta arquivado.");
      setArchiveOpen(false);
      setArchiveReason("");
      refetch();
      window.dispatchEvent(new Event("risk:refresh"));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Não foi possível arquivar.");
    } finally {
      setArchiveBusy(false);
    }
  };

  const fichaHref = `/admin/fichas/${encodeURIComponent(data.formId)}`;
  const clienteHref = `/admin/clientes/${encodeURIComponent(data.cpf)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.clienteNome || "Alerta de risco"}
        description={`${data.origemLabel} · ${data.reasons.length} motivo(s) sinalizado(s) · versão da ficha ${data.formVersion}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </Button>
            {data.status !== "archived" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setArchiveOpen((v) => !v)}
                className="gap-1.5"
              >
                <Archive className="h-3.5 w-3.5" /> Arquivar
              </Button>
            )}
          </>
        }
      />

      {/* Cabeçalho de status */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border/50 bg-card/50 p-5 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={LEVEL_TONE[data.level]}>
              Nível: {SEVERITY_LABEL[data.level]}
            </Badge>
            <Badge variant="outline" className={STATUS_TONE[data.status]}>
              {STATUS_LABEL[data.status]}
            </Badge>
            {data.isNewVersion && (
              <Badge
                variant="outline"
                className="border-amber-500/40 text-amber-700 bg-amber-500/10"
              >
                Nova versão desde a última revisão
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              Detectado em {formatDateTimeBR(data.detectedAt)}
            </span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Este alerta foi gerado automaticamente a partir da anamnese. Ele NÃO substitui análise
            clínica: use as informações abaixo para orientar a decisão administrativa.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to={fichaHref}>
                <FileText className="h-3.5 w-3.5" /> Ver ficha
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to={clienteHref}>
                <User className="h-3.5 w-3.5" /> Ver cliente
              </Link>
            </Button>
          </div>
        </div>

        {/* Cliente */}
        <div className="rounded-xl border border-border/50 bg-card/50 p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Cliente
          </h3>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Field label="Nome" value={data.cliente.nome} />
            <Field label="CPF" value={data.cpfMasked} />
            <Field label="Telefone" value={data.cliente.telefone || "—"} />
            <Field label="Tatuador" value={data.tatuador || "—"} />
            <Field label="Tipo sanguíneo" value={data.cliente.tipoSanguineo || "—"} />
          </dl>
        </div>
      </div>

      {/* Motivos */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Motivos detectados
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.reasons.map((r) => (
            <div key={r.ruleId} className="rounded-lg border border-border/50 bg-background/60 p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={LEVEL_TONE[r.severity]}>
                  {SEVERITY_LABEL[r.severity]}
                </Badge>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABEL[r.category]}
                </span>
              </div>
              <div className="mt-1.5 text-sm font-medium">{r.label}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Regra {r.ruleId} · versão {r.version}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Formulário de revisão */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Revisão administrativa
        </h3>
        {archiveOpen ? (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-sm">
              Arquivar suprime o alerta da listagem mas preserva histórico auditável.
            </p>
            <Input
              className="mt-2"
              placeholder="Motivo do arquivamento (obrigatório)"
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
            />
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={archiveBusy}
                onClick={handleArchive}
                className="gap-1.5"
              >
                {archiveBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}{" "}
                Confirmar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setArchiveOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as RiskAlertStatus)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="under_review">Em revisão</SelectItem>
                <SelectItem value="reviewed">Revisado</SelectItem>
                <SelectItem value="released">Liberado</SelectItem>
                <SelectItem value="requires_attention">Requer atenção</SelectItem>
                <SelectItem value="pending_review">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Decisão</label>
            <Input
              className="mt-1"
              placeholder="Ex.: Liberado após avaliação · Encaminhado para revisão médica"
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="lg:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Observação</label>
            <Textarea
              className="mt-1"
              rows={4}
              placeholder="Detalhes da conduta administrativa, contatos, encaminhamentos..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              maxLength={2000}
            />
          </div>
          {requireMotivo && (
            <div className="lg:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                Motivo da alteração (obrigatório para alterar decisão registrada)
              </label>
              <Input
                className="mt-1"
                placeholder="Ex.: Nova informação clínica recebida"
                value={motivoAlt}
                onChange={(e) => setMotivoAlt(e.target.value)}
                maxLength={200}
              />
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Salvar revisão
          </Button>
          {data.hasReview && data.previousDecision && (
            <span className="text-xs text-muted-foreground">
              Decisão anterior: <span className="italic">"{data.previousDecision}"</span>
            </span>
          )}
        </div>
      </div>

      {/* Adicionar observação avulsa */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <MessageSquarePlus className="h-4 w-4" /> Adicionar observação
        </h3>
        <Textarea
          className="mt-3"
          rows={3}
          placeholder="Registro rápido no histórico do alerta"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          maxLength={1000}
        />
        <div className="mt-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!noteText.trim() || noteBusy}
            onClick={handleAddNote}
            className="gap-1.5"
          >
            {noteBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <MessageSquarePlus className="h-3.5 w-3.5" />
            )}
            Registrar
          </Button>
        </div>
      </div>

      {/* Respostas relacionadas na anamnese */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <ClipboardList className="h-4 w-4" /> Respostas relevantes
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.answers.map((a) => (
            <div
              key={String(a.questionId)}
              className={`rounded-lg border p-3 text-sm ${a.triggered ? "border-amber-500/40 bg-amber-500/5" : "border-border/40 bg-background/60"}`}
            >
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{a.label}</div>
              <div className="mt-1 font-medium">{a.answer}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <History className="h-4 w-4" /> Histórico do alerta
        </h3>
        {data.timeline.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum evento registrado. Salve uma revisão ou adicione uma observação para iniciar o
            histórico.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {data.timeline.map((ev) => {
              const Icon = KIND_ICON[ev.kind];
              return (
                <li key={ev.id} className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/60 text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{KIND_LABEL[ev.kind]}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTimeBR(ev.createdAt)}
                      {ev.toStatus ? ` · ${STATUS_LABEL[ev.toStatus]}` : ""}
                    </div>
                    {ev.fromDecision || ev.toDecision ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {ev.fromDecision ? (
                          <>
                            De: <span className="italic">"{ev.fromDecision}"</span> ·{" "}
                          </>
                        ) : null}
                        {ev.toDecision ? (
                          <>
                            Para: <span className="italic">"{ev.toDecision}"</span>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    {ev.motivo ? (
                      <p className="mt-1 rounded-md border border-border/40 bg-background/50 p-2 text-xs">
                        {ev.motivo}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Outras versões deste cliente */}
      {data.outrasVersoes.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card/50 p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Outros alertas deste cliente
          </h3>
          <ul className="mt-3 space-y-1.5">
            {data.outrasVersoes.map((o) => (
              <li key={o.id}>
                <Link
                  to={`/admin/clientes-risco/${encodeURIComponent(o.id)}`}
                  className="flex items-center justify-between rounded-lg border border-border/40 bg-background/50 p-3 text-sm hover:bg-muted/40"
                >
                  <span>
                    {o.origin === "primeira_visita" ? "Primeira visita" : "Recorrente"} ·{" "}
                    {formatDateTimeBR(o.detectedAt)}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant="outline" className={LEVEL_TONE[o.level]}>
                      {SEVERITY_LABEL[o.level]}
                    </Badge>
                    <Badge variant="outline" className={STATUS_TONE[o.status]}>
                      {STATUS_LABEL[o.status]}
                    </Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{value}</dd>
    </div>
  );
}
