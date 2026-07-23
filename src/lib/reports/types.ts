// ============================================================================
// Tipos do módulo de Relatórios — 85 TATTOO
// Todos os relatórios consomem as fontes centrais dos módulos (clientes-admin,
// fichas, contratos, documentos, risk, checkins). Esta camada define apenas os
// contratos que a UI consome — nenhum dado é fabricado.
// ============================================================================

export type ReportPeriodPreset =
  | "hoje"
  | "ontem"
  | "semana"
  | "semana_anterior"
  | "mes_atual"
  | "mes_anterior"
  | "ultimos_30"
  | "personalizado";

export interface ReportPeriod {
  preset: ReportPeriodPreset;
  inicio?: string; // ISO
  fim?: string; // ISO
}

export interface ReportFilterState {
  period: ReportPeriod;
  tatuadorId?: string | null;
  status?: string | null;
  tipo?: string | null;
  risco?: boolean | null;
  q?: string;
}

// --------------------------- Overview ---------------------------------------
export interface ReportOverviewCard {
  key:
    | "atendimentos"
    | "clientes"
    | "tatuadores"
    | "contratos"
    | "fichas"
    | "clientes-risco"
    | "documentos"
    | "check-ins";
  value: number | null;
  hint: string;
}

export interface ReportOverview {
  updatedAt: string;
  cards: Record<ReportOverviewCard["key"], ReportOverviewCard>;
}

// --------------------------- Tatuadores -------------------------------------
export interface TattooArtistPerformance {
  id: string; // slug estável baseado no nome
  nome: string;
  iniciais: string;
  status: "ativo" | "inativo" | "pausado";
  clientesHoje: number | null;
  clientesPeriodo: number | null; // atendimentos (sessões + primeira visita) no período
  clientesNovos: number | null; // clientes que apareceram pela 1ª vez no período
  clientesRecorrentes: number | null; // clientes com mais de 1 atendimento no período
  fichasConcluidas: number | null;
  contratosAssinados: number | null;
  checkinsPeriodo?: number | null;
  ultimaAtividade: string | null;
}

export interface TattooArtistDetail extends TattooArtistPerformance {
  nomeCompleto?: string | null;
  especialidade?: string | null;
  checkinsPeriodo: number | null;
  pendencias: number | null;
  atendimentos: AttendanceRow[];
}

// --------------------------- Linhas de tabela --------------------------------
export interface AttendanceRow {
  id: string;
  cliente: string;
  cpf?: string | null;
  tatuador: string | null;
  data: string | null;
  horario: string | null;
  tipo: string | null;
  status: "aguardando" | "em_atendimento" | "concluido" | "cancelado" | null;
  ficha: boolean;
  contrato: boolean;
  checkin: boolean;
}

export interface ClientRow {
  id: string;
  nome: string;
  tatuador: string | null;
  cadastro: string | null;
  ultimoAtendimento: string | null;
  atendimentos: number | null;
  ficha: boolean;
  contrato: boolean;
  status: "ativo" | "inativo" | "risco" | null;
}

export interface ContractRow {
  id: string;
  cliente: string;
  tatuador: string | null;
  data: string | null;
  status: "assinado" | "pendente" | "erro" | null;
  temAssinatura: boolean;
  temPdf: boolean;
  versao?: string | null;
}

export interface FormRow {
  id: string;
  cliente: string;
  tatuador: string | null;
  tipo: string | null;
  data: string | null;
  status: "concluida" | "incompleta" | "sem_ficha" | null;
  risco: boolean;
  contrato: boolean;
}

export interface RiskRow {
  id: string;
  cliente: string;
  tatuador: string | null;
  motivo: string | null;
  categoria?: string | null;
  nivel: "atencao" | "alto" | null;
  data: string | null;
  status: "aguardando_revisao" | "revisado" | "arquivado" | null;
  responsavel?: string | null;
}

export interface DocumentRow {
  id: string;
  documento: string;
  cliente: string;
  tatuador: string | null;
  tipo: "ficha" | "contrato" | "assinatura" | "termo_lgpd" | null;
  data: string | null;
  tamanho?: string | null;
  status: "disponivel" | "pendente" | "erro" | "arquivado" | null;
}

export interface CheckInRow {
  id: string;
  cliente: string;
  tatuador: string | null;
  chegada: string | null;
  inicio: string | null;
  conclusao: string | null;
  status:
    | "aguardando"
    | "chamado"
    | "em_atendimento"
    | "concluido"
    | "cancelado"
    | "nao_compareceu"
    | null;
  tempoEspera: number | null; // minutos
  duracao: number | null; // minutos
}

// --------------------------- Relatórios agregados ---------------------------
export interface AttendanceReport {
  totalPeriodo: number | null;
  hoje: number | null;
  concluidos: number | null;
  pendentes: number | null;
  cancelados: number | null;
  mediaDiaria: number | null;
  duracaoMedia: number | null; // minutos
  rows: AttendanceRow[];
}

export interface ClientReport {
  total: number | null;
  novos: number | null;
  recorrentes: number | null;
  comFicha: number | null;
  comContrato: number | null;
  comRisco: number | null;
  rows: ClientRow[];
}

export interface ContractReport {
  total: number | null;
  assinados: number | null;
  pendentes: number | null;
  semPdf: number | null;
  comErro: number | null;
  rows: ContractRow[];
}

export interface FormReport {
  total: number | null;
  concluidas: number | null;
  incompletas: number | null;
  comAlerta: number | null;
  primeiraVisita: number | null;
  recorrentes: number | null;
  rows: FormRow[];
}

export interface RiskReport {
  totalAlertas: number | null;
  aguardandoRevisao: number | null;
  revisados: number | null;
  nivelAtencao: number | null;
  nivelAlto: number | null;
  rows: RiskRow[];
}

export interface DocumentReport {
  total: number | null;
  disponiveis: number | null;
  pendentes: number | null;
  falhas: number | null;
  contratos: number | null;
  fichas: number | null;
  assinaturas: number | null;
  rows: DocumentRow[];
}

export interface CheckInReport {
  hoje: number | null;
  periodo: number | null;
  aguardando: number | null;
  emAtendimento: number | null;
  atendidos: number | null;
  cancelados: number | null;
  naoCompareceram: number | null;
  mediaEspera: number | null; // minutos
  mediaDiaria: number | null;
  rows: CheckInRow[];
}

export interface AsyncResult<T> {
  data: T;
  isLoading: boolean;
  isEmpty: boolean;
  error: Error | null;
}

// --------------------------- Período ---------------------------------------

export interface ResolvedPeriod {
  start: Date; // inclusive
  end: Date; // exclusive
  days: number; // duração em dias (mínimo 1)
  label: string;
}

const PRESET_LABEL: Record<ReportPeriodPreset, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  semana: "Esta semana",
  semana_anterior: "Semana anterior",
  mes_atual: "Este mês",
  mes_anterior: "Mês anterior",
  ultimos_30: "Últimos 30 dias",
  personalizado: "Período personalizado",
};

export function periodPresetLabel(p: ReportPeriodPreset): string {
  return PRESET_LABEL[p];
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Resolve o período em janela [start, end) usando timezone local. */
export function resolvePeriod(p: ReportPeriod): ResolvedPeriod {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (p.preset) {
    case "hoje": {
      start = startOfDay(now);
      end = addDays(start, 1);
      break;
    }
    case "ontem": {
      end = startOfDay(now);
      start = addDays(end, -1);
      break;
    }
    case "semana": {
      // segunda a domingo — começa na segunda-feira
      const day = now.getDay(); // 0=domingo
      const diffToMonday = (day + 6) % 7;
      start = addDays(startOfDay(now), -diffToMonday);
      end = addDays(start, 7);
      break;
    }
    case "semana_anterior": {
      const day = now.getDay();
      const diffToMonday = (day + 6) % 7;
      const thisMonday = addDays(startOfDay(now), -diffToMonday);
      end = thisMonday;
      start = addDays(thisMonday, -7);
      break;
    }
    case "mes_atual": {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    }
    case "mes_anterior": {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    }
    case "ultimos_30": {
      end = addDays(startOfDay(now), 1);
      start = addDays(end, -30);
      break;
    }
    case "personalizado": {
      start = p.inicio ? startOfDay(new Date(p.inicio)) : new Date(0);
      end = p.fim ? addDays(startOfDay(new Date(p.fim)), 1) : addDays(startOfDay(now), 1);
      if (end.getTime() <= start.getTime()) {
        end = addDays(start, 1);
      }
      break;
    }
    default: {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
  }

  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  const label =
    p.preset === "personalizado"
      ? `${start.toLocaleDateString("pt-BR")} — ${addDays(end, -1).toLocaleDateString("pt-BR")}`
      : PRESET_LABEL[p.preset];
  return { start, end, days, label };
}

export function isInPeriod(iso: string | null | undefined, r: ResolvedPeriod): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= r.start.getTime() && t < r.end.getTime();
}
