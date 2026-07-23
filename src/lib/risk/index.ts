// ============================================================================
// Fonte Única do módulo Clientes de Risco — 85 TATTOO
// ----------------------------------------------------------------------------
// Alertas são DERIVADOS das fichas (anamnese base do cliente e cada sessão
// recorrente), avaliados pelas regras versionadas em `./rules.ts`. A camada de
// REVISÃO ADMINISTRATIVA é persistida em `risk_reviews` e o histórico
// imutável em `risk_review_events`. O `alert_id` é estável e igual ao id da
// ficha (`<cpf>:v0` ou `<cpf>:s<idx>`), garantindo integração com Fichas,
// Documentos, Check-ins e Relatórios sem duplicação de identidade.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { onlyDigits, rowToCliente, type Anamnese, type Cliente } from "@/lib/clientes";
import {
  CATEGORY_LABEL,
  RISK_RULES,
  RISK_RULES_VERSION,
  SEVERITY_LABEL,
  evaluateAnamnese,
  levelFromHits,
  type RiskCategory,
  type RiskRuleHit,
  type RiskSeverity,
} from "./rules";
import { formatDateBR, formatDateTimeBR, maskCpfSafe, parseFichaId } from "@/lib/fichas";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type RiskAlertStatus =
  "pending_review" | "under_review" | "reviewed" | "requires_attention" | "released" | "archived";

export type RiskAlertOrigin = "primeira_visita" | "recorrente";

export interface RiskAlertReason {
  ruleId: string;
  label: string;
  category: RiskCategory;
  severity: RiskSeverity;
  version: number;
}

export interface RiskAlert {
  /** ID estável — mesmo id de ficha: "<cpf>:v0" ou "<cpf>:s<idx>". */
  id: string;
  cpf: string;
  cpfMasked: string;
  clienteNome: string;
  clienteIniciais: string;
  tatuador: string | null;
  origin: RiskAlertOrigin;
  origemLabel: string;
  formId: string;
  formVersion: number;
  detectedAt: string;
  level: RiskSeverity;
  reasons: RiskAlertReason[];
  reasonSummary: string;
  status: RiskAlertStatus;
  decision: string | null;
  observacao: string | null;
  previousDecision: string | null;
  previousObservacao: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  hasReview: boolean;
  isNewVersion: boolean;
  temAssinatura: boolean;
  temFicha: boolean;
  rulesVersion: number;
}

export interface RiskAlertDetalhe extends RiskAlert {
  cliente: {
    cpf: string;
    nome: string;
    telefone?: string;
    email?: string;
    dataNascimento?: string;
    genero?: string;
    endereco?: string;
    tipoSanguineo?: string;
  };
  anamnese: Anamnese;
  answers: Array<{ questionId: keyof Anamnese; label: string; answer: string; triggered: boolean }>;
  outrasVersoes: Array<{
    id: string;
    origin: RiskAlertOrigin;
    level: RiskSeverity;
    status: RiskAlertStatus;
    detectedAt: string;
  }>;
  timeline: RiskReviewEvent[];
}

export interface RiskReviewEvent {
  id: string;
  alertId: string;
  kind:
    | "created"
    | "review_started"
    | "decision_recorded"
    | "decision_changed"
    | "note_added"
    | "archived"
    | "reopened"
    | "new_version";
  fromStatus: RiskAlertStatus | null;
  toStatus: RiskAlertStatus | null;
  fromDecision: string | null;
  toDecision: string | null;
  actorId: string | null;
  motivo: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

interface ReviewRow {
  alert_id: string;
  cpf: string;
  form_id: string;
  form_version: number;
  level: string;
  status: string;
  decision: string | null;
  observacao: string | null;
  previous_decision: string | null;
  previous_observacao: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

async function fetchAllClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .order("atualizado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => rowToCliente(r as never));
}

async function fetchClienteByCpf(cpf: string): Promise<Cliente | null> {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return null;
  const { data, error } = await supabase.from("clientes").select("*").eq("cpf", d).maybeSingle();
  if (error) throw error;
  return data ? rowToCliente(data as never) : null;
}

async function fetchAllReviews(): Promise<Map<string, ReviewRow>> {
  const { data, error } = await supabase.from("risk_reviews").select("*");
  if (error) throw error;
  const map = new Map<string, ReviewRow>();
  (data ?? []).forEach((r) => map.set(r.alert_id, r as ReviewRow));
  return map;
}

async function fetchReviewByAlert(alertId: string): Promise<ReviewRow | null> {
  const { data, error } = await supabase
    .from("risk_reviews")
    .select("*")
    .eq("alert_id", alertId)
    .maybeSingle();
  if (error) throw error;
  return (data as ReviewRow | null) ?? null;
}

async function fetchTimeline(alertId: string): Promise<RiskReviewEvent[]> {
  const { data, error } = await supabase
    .from("risk_review_events")
    .select("*")
    .eq("alert_id", alertId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    alertId: r.alert_id as string,
    kind: r.kind as RiskReviewEvent["kind"],
    fromStatus: (r.from_status as RiskAlertStatus | null) ?? null,
    toStatus: (r.to_status as RiskAlertStatus | null) ?? null,
    fromDecision: (r.from_decision as string | null) ?? null,
    toDecision: (r.to_decision as string | null) ?? null,
    actorId: (r.actor_id as string | null) ?? null,
    motivo: (r.motivo as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

// ---------------------------------------------------------------------------
// Derivação
// ---------------------------------------------------------------------------

function initials(nome: string): string {
  const p = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "—";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function hitsToReasons(hits: RiskRuleHit[]): RiskAlertReason[] {
  return hits.map((h) => ({
    ruleId: h.ruleId,
    label: h.label,
    category: h.category,
    severity: h.severity,
    version: h.version,
  }));
}

function summarize(reasons: RiskAlertReason[]): string {
  if (reasons.length === 0) return "";
  if (reasons.length === 1) return reasons[0].label;
  if (reasons.length === 2) return `${reasons[0].label} · ${reasons[1].label}`;
  return `${reasons[0].label} · ${reasons[1].label} · +${reasons.length - 2}`;
}

function mergeReview(
  base: Omit<
    RiskAlert,
    | "status"
    | "decision"
    | "observacao"
    | "previousDecision"
    | "previousObservacao"
    | "reviewedBy"
    | "reviewedAt"
    | "hasReview"
    | "isNewVersion"
  >,
  review: ReviewRow | undefined,
): RiskAlert {
  if (!review) {
    return {
      ...base,
      status: "pending_review",
      decision: null,
      observacao: null,
      previousDecision: null,
      previousObservacao: null,
      reviewedBy: null,
      reviewedAt: null,
      hasReview: false,
      isNewVersion: false,
    };
  }
  const isNewVersion = review.form_version !== base.formVersion;
  return {
    ...base,
    status: (review.status as RiskAlertStatus) ?? "pending_review",
    decision: review.decision,
    observacao: review.observacao,
    previousDecision: review.previous_decision,
    previousObservacao: review.previous_observacao,
    reviewedBy: review.reviewed_by,
    reviewedAt: review.reviewed_at,
    hasReview: true,
    isNewVersion,
  };
}

function deriveClienteAlerts(c: Cliente, reviews: Map<string, ReviewRow>): RiskAlert[] {
  const cpf = onlyDigits(c.cpf);
  const nome = c.dadosCadastrais?.nomeCompleto || "";
  const iniciaisStr = initials(nome);
  const tatuadorBase = c.dadosCadastrais?.tatuador || null;
  const out: RiskAlert[] = [];

  // Ficha base
  const baseAnamnese = c.anamnese || ({} as Anamnese);
  const hitsBase = evaluateAnamnese(baseAnamnese);
  const levelBase = levelFromHits(hitsBase);
  if (levelBase) {
    const reasons = hitsToReasons(hitsBase);
    const id = `${cpf}:v0`;
    out.push(
      mergeReview(
        {
          id,
          cpf,
          cpfMasked: maskCpfSafe(cpf),
          clienteNome: nome,
          clienteIniciais: iniciaisStr,
          tatuador: tatuadorBase,
          origin: "primeira_visita",
          origemLabel: "Primeira visita",
          formId: id,
          formVersion: 1,
          detectedAt: c.criadoEm,
          level: levelBase,
          reasons,
          reasonSummary: summarize(reasons),
          temAssinatura: Boolean(c.assinatura),
          temFicha: true,
          rulesVersion: RISK_RULES_VERSION,
        },
        reviews.get(id),
      ),
    );
  }

  // Sessões recorrentes
  (c.sessoes || []).forEach((s, idx) => {
    const a = s.anamnese || ({} as Anamnese);
    const hits = evaluateAnamnese(a);
    const level = levelFromHits(hits);
    if (!level) return;
    const reasons = hitsToReasons(hits);
    const id = `${cpf}:s${idx}`;
    out.push(
      mergeReview(
        {
          id,
          cpf,
          cpfMasked: maskCpfSafe(cpf),
          clienteNome: nome,
          clienteIniciais: iniciaisStr,
          tatuador: s.tatuador || tatuadorBase,
          origin: "recorrente",
          origemLabel: `Sessão #${idx + 1}`,
          formId: id,
          formVersion: idx + 2,
          detectedAt: s.data || c.atualizadoEm,
          level,
          reasons,
          reasonSummary: summarize(reasons),
          temAssinatura: Boolean(s.assinatura),
          temFicha: true,
          rulesVersion: RISK_RULES_VERSION,
        },
        reviews.get(id),
      ),
    );
  });

  return out;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export interface AsyncList<T> {
  data: T[];
  isLoading: boolean;
  isEmpty: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useRiskAlerts(): AsyncList<RiskAlert> {
  const [data, setData] = useState<RiskAlert[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([fetchAllClientes(), fetchAllReviews()])
      .then(([clientes, reviews]) => {
        if (!alive) return;
        const all = clientes.flatMap((c) => deriveClienteAlerts(c, reviews));
        all.sort((a, b) => (b.detectedAt || "").localeCompare(a.detectedAt || ""));
        setData(all);
      })
      .catch((e: Error) => {
        if (!alive) return;
        setError(e);
        setData([]);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tick]);

  return {
    data,
    isLoading,
    isEmpty: !isLoading && data.length === 0,
    error,
    refetch: () => setTick((t) => t + 1),
  };
}

export interface AsyncOne<T> {
  data: T | null;
  isLoading: boolean;
  notFound: boolean;
  error: Error | null;
  refetch: () => void;
}

const QUESTION_LABELS: Partial<Record<keyof Anamnese, string>> = {
  tratamentoMedico: "Em tratamento médico",
  alergia: "Alergia",
  cirurgiaRecente: "Cirurgia recente",
  diabetes: "Diabetes",
  gestante: "Gestante",
  hipertensao: "Hipertensão",
  marcapasso: "Uso de marcapasso",
  doencaTransmissivel: "Doença transmissível",
  convulsao: "Convulsão",
  circulatorio: "Alteração circulatória",
  problemaPele: "Problema de pele",
  fumante: "Fumante",
  alimentou24h: "Alimentou-se nas últimas 24h",
  drogasAlcool: "Álcool/drogas nas últimas 24h",
  bronzeado: "Bronzeado recente",
  depressaoAnsiedade: "Depressão/ansiedade",
  anemia: "Anemia",
  queloide: "Tendência a quelóide",
  cardiopatia: "Cardiopatia",
  hemofilia: "Hemofilia/coagulação",
  hepatite: "Hepatite",
  vitiligo: "Vitiligo",
};

export function useRiskAlert(id: string | undefined): AsyncOne<RiskAlertDetalhe> {
  const [state, setState] = useState<AsyncOne<RiskAlertDetalhe>>({
    data: null,
    isLoading: true,
    notFound: false,
    error: null,
    refetch: () => {},
  });
  const [tick, setTick] = useState(0);
  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    const parsed = id ? parseFichaId(id) : null;
    if (!parsed) {
      setState({ data: null, isLoading: false, notFound: true, error: null, refetch });
      return;
    }
    setState((s) => ({ ...s, isLoading: true, error: null, refetch }));

    Promise.all([fetchClienteByCpf(parsed.cpf), fetchReviewByAlert(id!), fetchTimeline(id!)])
      .then(([c, review, timeline]) => {
        if (!alive) return;
        if (!c) {
          setState({ data: null, isLoading: false, notFound: true, error: null, refetch });
          return;
        }
        const reviewsMap = new Map<string, ReviewRow>();
        if (review) reviewsMap.set(review.alert_id, review);
        const allAlerts = deriveClienteAlerts(c, reviewsMap);
        const target = allAlerts.find((a) => a.id === id);
        if (!target) {
          // Pode ter sido um alerta arquivado ou já sem hits atuais.
          setState({ data: null, isLoading: false, notFound: true, error: null, refetch });
          return;
        }

        const anamneseSrc =
          parsed.kind === "v0"
            ? c.anamnese || ({} as Anamnese)
            : c.sessoes?.[parsed.index]?.anamnese || ({} as Anamnese);

        const triggeredIds = new Set(target.reasons.map((r) => r.ruleId));
        const answers = RISK_RULES.filter((r) => r.active).map((r) => {
          const raw = anamneseSrc[r.questionId];
          return {
            questionId: r.questionId,
            label: QUESTION_LABELS[r.questionId] || r.label,
            answer:
              raw === "sim"
                ? "Sim"
                : raw === "nao"
                  ? "Não"
                  : typeof raw === "string" && raw.length
                    ? raw
                    : "—",
            triggered: triggeredIds.has(r.id),
          };
        });

        setState({
          data: {
            ...target,
            cliente: {
              cpf: c.cpf,
              nome: c.dadosCadastrais?.nomeCompleto || "",
              telefone: c.dadosCadastrais?.telefone,
              email: c.dadosCadastrais?.email,
              dataNascimento: c.dadosCadastrais?.dataNascimento,
              genero: c.dadosCadastrais?.genero,
              endereco: c.dadosCadastrais?.endereco,
              tipoSanguineo: anamneseSrc?.tipoSanguineo,
            },
            anamnese: anamneseSrc,
            answers,
            outrasVersoes: allAlerts
              .filter((a) => a.id !== target.id)
              .map((a) => ({
                id: a.id,
                origin: a.origin,
                level: a.level,
                status: a.status,
                detectedAt: a.detectedAt,
              })),
            timeline,
          },
          isLoading: false,
          notFound: false,
          error: null,
          refetch,
        });
      })
      .catch((e: Error) => {
        if (!alive) return;
        setState({ data: null, isLoading: false, notFound: false, error: e, refetch });
      });

    return () => {
      alive = false;
    };
  }, [id, tick, refetch]);

  return state;
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

export interface RiskFilters {
  q: string;
  level: RiskSeverity | null;
  status: RiskAlertStatus | null;
  tatuador: string | null;
  category: RiskCategory | null;
  origin: RiskAlertOrigin | null;
  from: string | null; // ISO date
  to: string | null; // ISO date
  showArchived: boolean;
}

export const DEFAULT_RISK_FILTERS: RiskFilters = {
  q: "",
  level: null,
  status: null,
  tatuador: null,
  category: null,
  origin: null,
  from: null,
  to: null,
  showArchived: false,
};

export function useRiskAlertsFiltered(data: RiskAlert[], f: RiskFilters): RiskAlert[] {
  return useMemo(() => {
    const term = f.q.trim().toLowerCase();
    const termDigits = onlyDigits(f.q);
    return data.filter((a) => {
      if (!f.showArchived && a.status === "archived") return false;
      if (f.level && a.level !== f.level) return false;
      if (f.status && a.status !== f.status) return false;
      if (f.tatuador && (a.tatuador ?? "").toLowerCase() !== f.tatuador.toLowerCase()) return false;
      if (f.origin && a.origin !== f.origin) return false;
      if (f.category && !a.reasons.some((r) => r.category === f.category)) return false;
      if (f.from && a.detectedAt < f.from) return false;
      if (f.to && a.detectedAt > f.to + "T23:59:59") return false;
      if (term) {
        const hitText =
          a.clienteNome.toLowerCase().includes(term) ||
          (a.tatuador ?? "").toLowerCase().includes(term) ||
          a.reasonSummary.toLowerCase().includes(term);
        const hitDigits = termDigits.length > 0 && a.cpf.includes(termDigits);
        if (!hitText && !hitDigits) return false;
      }
      return true;
    });
  }, [data, f]);
}

// ---------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------

export interface RiskMetrics {
  total: number;
  pending: number;
  high: number;
  reviewed: number;
  today: number;
  archived: number;
  withoutSignature: number;
}

export function computeMetrics(all: RiskAlert[]): RiskMetrics {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const visible = all.filter((a) => a.status !== "archived");
  return {
    total: visible.length,
    pending: visible.filter((a) => a.status === "pending_review" || a.status === "under_review")
      .length,
    high: visible.filter((a) => a.level === "high").length,
    reviewed: visible.filter(
      (a) =>
        a.status === "reviewed" || a.status === "released" || a.status === "requires_attention",
    ).length,
    today: visible.filter((a) => a.detectedAt >= todayIso).length,
    archived: all.filter((a) => a.status === "archived").length,
    withoutSignature: visible.filter((a) => !a.temAssinatura).length,
  };
}

// ---------------------------------------------------------------------------
// Mutations (RPC)
// ---------------------------------------------------------------------------

export interface SetReviewInput {
  alertId: string;
  cpf: string;
  formId: string;
  formVersion: number;
  level: RiskSeverity;
  newStatus: RiskAlertStatus;
  decision: string;
  observacao: string;
  motivoAlteracao?: string;
}

export async function saveReview(input: SetReviewInput): Promise<void> {
  const { error } = await supabase.rpc("risk_review_set", {
    _alert_id: input.alertId,
    _cpf: input.cpf,
    _form_id: input.formId,
    _form_version: input.formVersion,
    _level: input.level,
    _new_status: input.newStatus,
    _decision: input.decision,
    _observacao: input.observacao,
    _motivo_alt: input.motivoAlteracao ?? undefined,
  });
  if (error) throw error;
}

export async function addReviewNote(alertId: string, texto: string): Promise<void> {
  const { error } = await supabase.rpc("risk_review_add_note", {
    _alert_id: alertId,
    _texto: texto,
  });
  if (error) throw error;
}

export async function archiveAlert(alertId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("risk_review_archive", {
    _alert_id: alertId,
    _motivo: motivo,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Rótulos / cores
// ---------------------------------------------------------------------------

export const STATUS_LABEL: Record<RiskAlertStatus, string> = {
  pending_review: "Pendente",
  under_review: "Em revisão",
  reviewed: "Revisado",
  requires_attention: "Requer atenção",
  released: "Liberado",
  archived: "Arquivado",
};

export { CATEGORY_LABEL, SEVERITY_LABEL, RISK_RULES_VERSION, RISK_RULES };
export { formatDateBR, formatDateTimeBR };
