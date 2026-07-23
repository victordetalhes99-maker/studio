// ============================================================================
// Fonte única do módulo de Check-ins — 85 TATTOO
// ----------------------------------------------------------------------------
// Toda leitura/gravação de check-ins passa por este módulo. Nenhum outro
// arquivo deve falar com a tabela `check_ins` diretamente.
//
// Estados válidos e transições:
//   waiting → called | in_service | cancelled | no_show
//   called  → in_service | waiting | cancelled | no_show
//   in_service → completed | cancelled
//   no_show / cancelled → waiting  (reabertura administrativa)
//
// A ordem de chegada é persistida em `queue_position` no dia (`queue_day`).
// O tempo de espera é sempre derivado no cliente a partir de `arrival_at`.
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { onlyDigits } from "@/lib/clientes";

// ----------------------------- Tipos ----------------------------------------

export type CheckInStatus =
  "waiting" | "called" | "in_service" | "completed" | "cancelled" | "no_show";

export type CheckInEventKind =
  | "created"
  | "called"
  | "started"
  | "completed"
  | "cancelled"
  | "no_show"
  | "reordered"
  | "note_added"
  | "reopened";

export interface CheckIn {
  id: string;
  cpf: string;
  cpfMasked: string;
  clienteNome: string;
  clienteIniciais: string;
  tatuador: string | null;
  status: CheckInStatus;
  arrivalAt: string;
  calledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  noShowAt: string | null;
  queueDay: string; // YYYY-MM-DD
  queuePosition: number;
  riskFlag: boolean;
  riscoMotivos: string[];
  hasFicha: boolean;
  hasAssinatura: boolean;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CheckInEvent {
  id: string;
  kind: CheckInEventKind;
  fromStatus: CheckInStatus | null;
  toStatus: CheckInStatus | null;
  motivo: string | null;
  detalhes: Record<string, unknown>;
  criadoEm: string;
}

// Labels ---------------------------------------------------------------------

export const STATUS_LABEL: Record<CheckInStatus, string> = {
  waiting: "Aguardando",
  called: "Chamado",
  in_service: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

export const STATUS_ORDER: CheckInStatus[] = [
  "waiting",
  "called",
  "in_service",
  "completed",
  "cancelled",
  "no_show",
];

export const OPEN_STATUSES: CheckInStatus[] = ["waiting", "called", "in_service"];

export const EVENT_LABEL: Record<CheckInEventKind, string> = {
  created: "Check-in criado",
  called: "Cliente chamado",
  started: "Atendimento iniciado",
  completed: "Atendimento concluído",
  cancelled: "Check-in cancelado",
  no_show: "Cliente não compareceu",
  reordered: "Posição alterada",
  note_added: "Observação adicionada",
  reopened: "Reaberto",
};

// ----------------------------- Helpers --------------------------------------

function iniciais(nome: string): string {
  const p = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "—";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function maskCpf(d: string): string {
  const s = onlyDigits(d);
  if (s.length !== 11) return d;
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.***-${s.slice(9, 11)}`;
}

export function formatTimeBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

export function formatDateTimeBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

/** Retorna minutos entre agora e o timestamp de chegada, congelado quando terminou. */
export function waitMinutes(
  c: Pick<
    CheckIn,
    "arrivalAt" | "startedAt" | "cancelledAt" | "noShowAt" | "completedAt" | "status"
  >,
  refNow?: number,
): number {
  const start = new Date(c.arrivalAt).getTime();
  const endIso =
    c.status === "in_service" || c.status === "completed"
      ? c.startedAt
      : c.status === "cancelled"
        ? c.cancelledAt
        : c.status === "no_show"
          ? c.noShowAt
          : null;
  const end = endIso ? new Date(endIso).getTime() : (refNow ?? Date.now());
  return Math.max(0, Math.round((end - start) / 60000));
}

export function formatWait(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/** Duração do atendimento em minutos (ou null se ainda não concluído). */
export function serviceMinutes(c: Pick<CheckIn, "startedAt" | "completedAt">): number | null {
  if (!c.startedAt || !c.completedAt) return null;
  return Math.max(
    0,
    Math.round((new Date(c.completedAt).getTime() - new Date(c.startedAt).getTime()) / 60000),
  );
}

// ----------------------------- Mapper ---------------------------------------

type Row = {
  id: string;
  cpf: string;
  cliente_nome: string;
  tatuador: string | null;
  status: CheckInStatus;
  arrival_at: string;
  called_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  no_show_at: string | null;
  queue_day: string;
  queue_position: number;
  risk_flag: boolean;
  risk_reasons: string[] | null;
  has_ficha: boolean;
  has_assinatura: boolean;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
};

function rowToCheckIn(r: Row): CheckIn {
  return {
    id: r.id,
    cpf: r.cpf,
    cpfMasked: maskCpf(r.cpf),
    clienteNome: r.cliente_nome,
    clienteIniciais: iniciais(r.cliente_nome),
    tatuador: r.tatuador,
    status: r.status,
    arrivalAt: r.arrival_at,
    calledAt: r.called_at,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    cancelledAt: r.cancelled_at,
    cancelReason: r.cancel_reason,
    noShowAt: r.no_show_at,
    queueDay: r.queue_day,
    queuePosition: r.queue_position,
    riskFlag: r.risk_flag,
    riscoMotivos: r.risk_reasons ?? [],
    hasFicha: r.has_ficha,
    hasAssinatura: r.has_assinatura,
    observacoes: r.observacoes,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
  };
}

// ----------------------------- Repositório ----------------------------------

export async function fetchCheckIns(opts?: { day?: string; limit?: number }): Promise<CheckIn[]> {
  let q = supabase
    .from("check_ins")
    .select(
      "id,cpf,cliente_nome,tatuador,status,arrival_at,called_at,started_at,completed_at,cancelled_at,cancel_reason,no_show_at,queue_day,queue_position,risk_flag,risk_reasons,has_ficha,has_assinatura,observacoes,criado_em,atualizado_em",
    )
    .order("arrival_at", { ascending: false })
    .limit(opts?.limit ?? 500);
  if (opts?.day) q = q.eq("queue_day", opts.day);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => rowToCheckIn(r as never));
}

export async function fetchCheckIn(id: string): Promise<CheckIn | null> {
  const { data, error } = await supabase.from("check_ins").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToCheckIn(data as never) : null;
}

export async function fetchCheckInEvents(id: string): Promise<CheckInEvent[]> {
  const { data, error } = await supabase
    .from("check_in_events")
    .select("id,kind,from_status,to_status,motivo,detalhes,criado_em")
    .eq("check_in_id", id)
    .order("criado_em", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id,
    kind: e.kind,
    fromStatus: e.from_status,
    toStatus: e.to_status,
    motivo: e.motivo,
    detalhes: (e.detalhes ?? {}) as Record<string, unknown>,
    criadoEm: e.criado_em,
  }));
}

// ----------------------------- Ações (RPC) ----------------------------------

export interface CreateCheckInInput {
  cpf: string;
  clienteNome: string;
  tatuador: string | null;
  riscoFlag: boolean;
  riscoMotivos: string[];
  temFicha: boolean;
  temAssinatura: boolean;
  observacoes?: string;
}

export async function createCheckIn(input: CreateCheckInInput): Promise<string> {
  const { data, error } = await supabase.rpc("checkin_create", {
    _cpf: onlyDigits(input.cpf),
    _cliente_nome: input.clienteNome,
    _tatuador: input.tatuador ?? "",
    _risk_flag: input.riscoFlag,
    _risk_reasons: input.riscoMotivos,
    _has_ficha: input.temFicha,
    _has_assinatura: input.temAssinatura,
    _observacoes: input.observacoes ?? undefined,
  });
  if (error) throw error;
  return data as string;
}

export async function callCheckIn(id: string) {
  const { error } = await supabase.rpc("checkin_call", { _id: id });
  if (error) throw error;
}
export async function startCheckIn(id: string) {
  const { error } = await supabase.rpc("checkin_start", { _id: id });
  if (error) throw error;
}
export async function completeCheckIn(id: string, observacao?: string) {
  const { error } = await supabase.rpc("checkin_complete", {
    _id: id,
    _observacao: observacao ?? undefined,
  });
  if (error) throw error;
}
export async function cancelCheckIn(id: string, motivo: string) {
  const { error } = await supabase.rpc("checkin_cancel", { _id: id, _motivo: motivo });
  if (error) throw error;
}
export async function noShowCheckIn(id: string) {
  const { error } = await supabase.rpc("checkin_no_show", { _id: id });
  if (error) throw error;
}
export async function addCheckInNote(id: string, texto: string) {
  const { error } = await supabase.rpc("checkin_add_note", { _id: id, _texto: texto });
  if (error) throw error;
}
export async function reorderCheckIn(id: string, position: number) {
  const { error } = await supabase.rpc("checkin_reorder", { _id: id, _new_position: position });
  if (error) throw error;
}

// ----------------------------- Hooks ----------------------------------------

export interface AsyncList<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCheckInsList(opts?: { day?: string }): AsyncList<CheckIn> {
  const [data, setData] = useState<CheckIn[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const day = opts?.day;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchCheckIns({ day })
      .then((rows) => alive && setData(rows))
      .catch((e: Error) => alive && (setError(e), setData([])))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tick, day]);

  // Realtime — recarrega em qualquer mudança na tabela
  useEffect(() => {
    const channel = supabase
      .channel("check_ins_stream")
      .on("postgres_changes", { event: "*", schema: "public", table: "check_ins" }, () => {
        setTick((t) => t + 1);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { data, isLoading, error, refetch: useCallback(() => setTick((t) => t + 1), []) };
}

export function useCheckIn(id: string | undefined) {
  const [state, setState] = useState<{
    data: CheckIn | null;
    events: CheckInEvent[];
    isLoading: boolean;
    notFound: boolean;
    error: Error | null;
  }>({ data: null, events: [], isLoading: true, notFound: false, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!id) {
      setState({ data: null, events: [], isLoading: false, notFound: true, error: null });
      return;
    }
    setState((s) => ({ ...s, isLoading: true, error: null }));
    Promise.all([fetchCheckIn(id), fetchCheckInEvents(id)])
      .then(([c, ev]) => {
        if (!alive) return;
        if (!c) setState({ data: null, events: [], isLoading: false, notFound: true, error: null });
        else setState({ data: c, events: ev, isLoading: false, notFound: false, error: null });
      })
      .catch(
        (error: Error) =>
          alive && setState({ data: null, events: [], isLoading: false, notFound: false, error }),
      );
    return () => {
      alive = false;
    };
  }, [id, tick]);

  return { ...state, refetch: useCallback(() => setTick((t) => t + 1), []) };
}

// ----------------------------- Filtros --------------------------------------

export interface CheckInFilters {
  q: string;
  status: CheckInStatus | "abertos" | "";
  tatuador: string;
  risco: "com" | "sem" | "";
  ficha: "com" | "sem" | "";
  dia: "hoje" | "todos";
}

export const DEFAULT_CHECKIN_FILTERS: CheckInFilters = {
  q: "",
  status: "",
  tatuador: "",
  risco: "",
  ficha: "",
  dia: "hoje",
};

export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function filterCheckIns(rows: CheckIn[], f: CheckInFilters): CheckIn[] {
  const q = f.q.trim().toLowerCase();
  const today = todayISO();
  return rows.filter((r) => {
    if (f.dia === "hoje" && r.queueDay !== today) return false;
    if (f.status === "abertos" && !OPEN_STATUSES.includes(r.status)) return false;
    if (f.status && f.status !== "abertos" && r.status !== f.status) return false;
    if (f.tatuador && (r.tatuador ?? "") !== f.tatuador) return false;
    if (f.risco === "com" && !r.riskFlag) return false;
    if (f.risco === "sem" && r.riskFlag) return false;
    if (f.ficha === "com" && !r.hasFicha) return false;
    if (f.ficha === "sem" && r.hasFicha) return false;
    if (q) {
      const bag = `${r.clienteNome} ${r.cpf} ${r.cpfMasked} ${r.tatuador ?? ""}`.toLowerCase();
      if (!bag.includes(q)) return false;
    }
    return true;
  });
}

// ----------------------------- Métricas do dia ------------------------------

export interface CheckInMetrics {
  aguardando: number;
  chamados: number;
  emAtendimento: number;
  concluidos: number;
  cancelados: number;
  ausentes: number;
  totalHoje: number;
  esperaMediaMin: number | null;
}

export function computeMetrics(rows: CheckIn[]): CheckInMetrics {
  const today = todayISO();
  const dia = rows.filter((r) => r.queueDay === today);
  const aguardando = dia.filter((r) => r.status === "waiting").length;
  const chamados = dia.filter((r) => r.status === "called").length;
  const emAtendimento = dia.filter((r) => r.status === "in_service").length;
  const concluidos = dia.filter((r) => r.status === "completed").length;
  const cancelados = dia.filter((r) => r.status === "cancelled").length;
  const ausentes = dia.filter((r) => r.status === "no_show").length;

  const finalizados = dia.filter((r) => r.startedAt);
  const esperaMediaMin =
    finalizados.length === 0
      ? null
      : Math.round(finalizados.reduce((sum, r) => sum + waitMinutes(r), 0) / finalizados.length);

  return {
    aguardando,
    chamados,
    emAtendimento,
    concluidos,
    cancelados,
    ausentes,
    totalHoje: dia.length,
    esperaMediaMin,
  };
}
