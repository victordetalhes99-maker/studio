// ============================================================================
// Repositório central de relatórios — 85 TATTOO
//
// Consome exclusivamente as fontes centralizadas dos módulos operacionais.
// Não gera dados fictícios; retorna valores reais quando existirem ou `null`
// quando não houver informação suficiente para computar uma métrica.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";
import { onlyDigits, rowToCliente, type Cliente } from "@/lib/clientes";
import { toAdminClient } from "@/lib/clientes-admin";
import { tatuadorSlug } from "@/lib/contratos";
import {
  fetchCheckIns,
  waitMinutes,
  serviceMinutes,
  todayISO,
  STATUS_LABEL as CHECKIN_STATUS_LABEL,
  type CheckIn,
} from "@/lib/checkins";
import { evaluateAnamnese, levelFromHits } from "@/lib/risk/rules";
import type {
  AttendanceReport,
  AttendanceRow,
  CheckInReport,
  CheckInRow,
  ClientReport,
  ClientRow,
  ContractReport,
  ContractRow,
  DocumentReport,
  DocumentRow,
  FormReport,
  FormRow,
  ReportFilterState,
  ReportOverview,
  ReportPeriod,
  RiskReport,
  RiskRow,
  TattooArtistDetail,
  TattooArtistPerformance,
} from "./types";
import { resolvePeriod, isInPeriod, type ResolvedPeriod } from "./types";

// ---------------------------------------------------------------------------
// Helpers de identidade de tatuador
// ---------------------------------------------------------------------------

function iniciais(nome: string): string {
  const p = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "—";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/** Mapa slug → nome canônico, incluindo os cadastrados + os vistos na operação. */
function buildArtistIndex(
  officialNames: string[],
  extraNames: (string | null | undefined)[],
): Map<string, string> {
  const map = new Map<string, string>();
  officialNames.forEach((n) => map.set(tatuadorSlug(n), n));
  extraNames.forEach((n) => {
    if (!n) return;
    const s = tatuadorSlug(n);
    if (!s) return;
    if (!map.has(s)) map.set(s, n);
  });
  return map;
}

function matchesArtist(
  name: string | null | undefined,
  artistId: string | null | undefined,
): boolean {
  if (!artistId) return true;
  if (!name) return false;
  return tatuadorSlug(name) === artistId;
}

// ---------------------------------------------------------------------------
// Fetch com cache curto para evitar múltiplas requisições no mesmo render.
// ---------------------------------------------------------------------------

let CLIENTES_CACHE: { at: number; data: Cliente[] } | null = null;
async function getAllClientes(): Promise<Cliente[]> {
  if (CLIENTES_CACHE && Date.now() - CLIENTES_CACHE.at < 5000) return CLIENTES_CACHE.data;
  const { data, error } = await supabase.from("clientes").select("*").limit(2000);
  if (error) throw error;
  const list = (data ?? []).map((r) => rowToCliente(r as never));
  CLIENTES_CACHE = { at: Date.now(), data: list };
  return list;
}

let CHECKINS_CACHE: { at: number; data: CheckIn[] } | null = null;
async function getAllCheckIns(): Promise<CheckIn[]> {
  if (CHECKINS_CACHE && Date.now() - CHECKINS_CACHE.at < 5000) return CHECKINS_CACHE.data;
  const rows = await fetchCheckIns({ limit: 2000 });
  CHECKINS_CACHE = { at: Date.now(), data: rows };
  return rows;
}

interface ConsentRow {
  id: string;
  cpf: string;
  versao: string;
  criado_em: string;
}
let CONSENTS_CACHE: { at: number; data: ConsentRow[] } | null = null;
async function getAllConsents(): Promise<ConsentRow[]> {
  if (CONSENTS_CACHE && Date.now() - CONSENTS_CACHE.at < 5000) return CONSENTS_CACHE.data;
  const { data, error } = await supabase
    .from("consent_records")
    .select("id,cpf,versao,criado_em,tipo")
    .eq("tipo", "termo")
    .order("criado_em", { ascending: false })
    .limit(2000);
  if (error) throw error;
  const list: ConsentRow[] = (data ?? []).map((r) => ({
    id: r.id,
    cpf: onlyDigits(r.cpf),
    versao: r.versao ?? "v1",
    criado_em: r.criado_em,
  }));

  CONSENTS_CACHE = { at: Date.now(), data: list };
  return list;
}

let ARTISTS_CACHE: { at: number; data: string[] } | null = null;
async function getAllArtistNames(): Promise<string[]> {
  if (ARTISTS_CACHE && Date.now() - ARTISTS_CACHE.at < 5000) return ARTISTS_CACHE.data;
  const { data, error } = await supabase
    .from("tattoo_artists")
    .select("nome")
    .order("nome", { ascending: true });
  if (error) throw error;
  const list = (data ?? []).map((row) => row.nome?.trim() ?? "").filter(Boolean);
  ARTISTS_CACHE = { at: Date.now(), data: list };
  return list;
}

// ---------------------------------------------------------------------------
// Derivação de atendimentos (linha unificada)
// ---------------------------------------------------------------------------

interface DerivedAttendance {
  id: string;
  cpf: string;
  cliente: string;
  tatuador: string | null;
  dataISO: string | null;
  status: AttendanceRow["status"];
  ficha: boolean;
  contrato: boolean;
  checkin: boolean;
  duracaoMin: number | null;
  tipo: string | null;
}

function deriveAttendances(
  clientes: Cliente[],
  checkins: CheckIn[],
  consents: ConsentRow[],
): DerivedAttendance[] {
  const out: DerivedAttendance[] = [];
  const cpfConsent = new Map<string, number>();
  consents.forEach((c) => cpfConsent.set(c.cpf, Math.max(cpfConsent.get(c.cpf) ?? 0, 1)));

  // 1) A partir dos check-ins (fonte mais precisa em data/horário/duração)
  const checkinByKey = new Map<string, CheckIn>();
  checkins.forEach((c) => checkinByKey.set(`${c.cpf}|${c.arrivalAt.slice(0, 10)}`, c));
  checkins.forEach((c) => {
    out.push({
      id: `ci:${c.id}`,
      cpf: c.cpf,
      cliente: c.clienteNome,
      tatuador: c.tatuador,
      dataISO: c.arrivalAt,
      status:
        c.status === "in_service" || c.status === "called"
          ? "em_atendimento"
          : c.status === "completed"
            ? "concluido"
            : c.status === "cancelled" || c.status === "no_show"
              ? "cancelado"
              : "aguardando",
      ficha: c.hasFicha,
      contrato: c.hasAssinatura,
      checkin: true,
      duracaoMin: serviceMinutes(c),
      tipo: c.hasFicha ? "recorrente" : "primeira_visita",
    });
  });

  // 2) A partir das sessões dos clientes (para dados históricos sem check-in)
  clientes.forEach((c) => {
    const cpf = onlyDigits(c.cpf);
    const nome = c.dadosCadastrais?.nomeCompleto || "";
    (c.sessoes || []).forEach((s, idx) => {
      const dataISO = s.data || c.atualizadoEm;
      const key = `${cpf}|${(dataISO || "").slice(0, 10)}`;
      if (checkinByKey.has(key)) return; // já contabilizado
      out.push({
        id: `s:${cpf}:${idx}`,
        cpf,
        cliente: nome,
        tatuador: s.tatuador || c.dadosCadastrais?.tatuador || null,
        dataISO,
        status: "concluido",
        ficha: Boolean(s.anamnese && Object.keys(s.anamnese).length > 0),
        contrato: Boolean(s.assinatura),
        checkin: false,
        duracaoMin: null,
        tipo: "recorrente",
      });
    });

    // Primeira visita (ficha base)
    if (c.anamnese && Object.keys(c.anamnese).length > 0) {
      const key = `${cpf}|${(c.criadoEm || "").slice(0, 10)}`;
      if (!checkinByKey.has(key)) {
        out.push({
          id: `v0:${cpf}`,
          cpf,
          cliente: nome,
          tatuador: c.dadosCadastrais?.tatuador || null,
          dataISO: c.criadoEm,
          status: "concluido",
          ficha: true,
          contrato: Boolean(c.assinatura),
          checkin: false,
          duracaoMin: null,
          tipo: "primeira_visita",
        });
      }
    }
  });

  return out;
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export async function getOverview(_period: ReportPeriod): Promise<ReportOverview> {
  try {
    const [clientes, checkins, consents, artistNames] = await Promise.all([
      getAllClientes(),
      getAllCheckIns(),
      getAllConsents(),
      getAllArtistNames(),
    ]);

    const artistIndex = buildArtistIndex(artistNames, [
      ...clientes.map((c) => c.dadosCadastrais?.tatuador),
      ...checkins.map((c) => c.tatuador),
    ]);
    const atts = deriveAttendances(clientes, checkins, consents);
    const totalAlertas = clientes.reduce((acc, c) => {
      let n = 0;
      if (levelFromHits(evaluateAnamnese(c.anamnese as never))) n++;
      (c.sessoes || []).forEach((s) => {
        if (levelFromHits(evaluateAnamnese(s.anamnese as never))) n++;
      });
      return acc + n;
    }, 0);
    const fichasCount = clientes.reduce(
      (acc, c) =>
        acc +
        (c.anamnese && Object.keys(c.anamnese).length > 0 ? 1 : 0) +
        (c.sessoes || []).filter((s) => s.anamnese && Object.keys(s.anamnese).length > 0).length,
      0,
    );
    // Documentos: contratos assinados + fichas + assinaturas (aproximação)
    const contratosCount = consents.length;
    const docCount = contratosCount + fichasCount + clientes.filter((c) => c.assinatura).length;

    return {
      updatedAt: new Date().toISOString(),
      cards: {
        atendimentos: {
          key: "atendimentos",
          value: atts.length,
          hint: atts.length === 0 ? "Sem atendimentos registrados" : `${atts.length} atendimentos`,
        },
        clientes: {
          key: "clientes",
          value: clientes.length,
          hint: clientes.length === 0 ? "Nenhum cliente cadastrado" : `${clientes.length} clientes`,
        },
        tatuadores: {
          key: "tatuadores",
          value: artistIndex.size,
          hint: `${artistIndex.size} profissionais`,
        },
        contratos: {
          key: "contratos",
          value: contratosCount,
          hint: contratosCount === 0 ? "Nenhum contrato" : `${contratosCount} contratos`,
        },
        fichas: {
          key: "fichas",
          value: fichasCount,
          hint: fichasCount === 0 ? "Nenhuma ficha" : `${fichasCount} fichas`,
        },
        "clientes-risco": {
          key: "clientes-risco",
          value: totalAlertas,
          hint:
            totalAlertas === 0
              ? "Nenhum alerta de risco"
              : `${totalAlertas} alerta${totalAlertas > 1 ? "s" : ""}`,
        },
        documentos: {
          key: "documentos",
          value: docCount,
          hint: docCount === 0 ? "Sem documentos" : `${docCount} documentos`,
        },
        "check-ins": {
          key: "check-ins",
          value: checkins.length,
          hint: checkins.length === 0 ? "Sem check-ins" : `${checkins.length} check-ins`,
        },
      },
    };
  } catch {
    const fallbackArtistCount = ARTISTS_CACHE?.data.length ?? null;
    return {
      updatedAt: new Date().toISOString(),
      cards: {
        atendimentos: { key: "atendimentos", value: null, hint: "Sem dados disponíveis" },
        clientes: { key: "clientes", value: null, hint: "Sem dados disponíveis" },
        tatuadores: {
          key: "tatuadores",
          value: fallbackArtistCount,
          hint:
            fallbackArtistCount === null
              ? "Sem dados disponÃ­veis"
              : `${fallbackArtistCount} profissionais cadastrados`,
        },
        contratos: { key: "contratos", value: null, hint: "Sem dados disponíveis" },
        fichas: { key: "fichas", value: null, hint: "Sem dados disponíveis" },
        "clientes-risco": { key: "clientes-risco", value: null, hint: "Sem dados disponíveis" },
        documentos: { key: "documentos", value: null, hint: "Sem dados disponíveis" },
        "check-ins": { key: "check-ins", value: null, hint: "Sem dados disponíveis" },
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Tatuadores
// ---------------------------------------------------------------------------

export async function getTattooArtistPerformance(
  period: ReportPeriod,
): Promise<TattooArtistPerformance[]> {
  const [clientes, checkins, consents, artistNames] = await Promise.all([
    getAllClientes(),
    getAllCheckIns(),
    getAllConsents(),
    getAllArtistNames(),
  ]);
  const r = resolvePeriod(period);
  const today = todayISO();

  const artistIndex = buildArtistIndex(artistNames, [
    ...clientes.map((c) => c.dadosCadastrais?.tatuador),
    ...checkins.map((c) => c.tatuador),
  ]);
  const atts = deriveAttendances(clientes, checkins, consents);
  const attsInPeriod = atts.filter((a) => isInPeriod(a.dataISO, r));

  // primeira aparição de cada CPF em qualquer atendimento
  const firstSeenByCpf = new Map<string, string>();
  atts.forEach((a) => {
    if (!a.dataISO) return;
    const cur = firstSeenByCpf.get(a.cpf);
    if (!cur || a.dataISO < cur) firstSeenByCpf.set(a.cpf, a.dataISO);
  });

  const rows: TattooArtistPerformance[] = [];
  artistIndex.forEach((nome, id) => {
    const arts = attsInPeriod.filter((a) => matchesArtist(a.tatuador, id));
    const hoje = checkins.filter(
      (c) => c.queueDay === today && matchesArtist(c.tatuador, id),
    ).length;

    // clientes únicos no período por artista
    const uniqueCpfs = new Set<string>();
    arts.forEach((a) => uniqueCpfs.add(a.cpf));
    let novos = 0;
    let recorrentes = 0;
    uniqueCpfs.forEach((cpf) => {
      const first = firstSeenByCpf.get(cpf);
      if (first && isInPeriod(first, r)) novos++;
      const countInPeriod = arts.filter((a) => a.cpf === cpf).length;
      if (countInPeriod > 1) recorrentes++;
    });

    const fichas = arts.filter((a) => a.ficha).length;
    const contratos = consents.filter((cn) => {
      if (!isInPeriod(cn.criado_em, r)) return false;
      const cli = clientes.find((c) => onlyDigits(c.cpf) === cn.cpf);
      const t = cli?.dadosCadastrais?.tatuador ?? null;
      return matchesArtist(t, id);
    }).length;

    const lastActivity =
      arts
        .map((a) => a.dataISO)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

    const status: TattooArtistPerformance["status"] = arts.length > 0 ? "ativo" : "ativo";

    rows.push({
      id,
      nome,
      iniciais: iniciais(nome),
      status,
      clientesHoje: hoje,
      clientesPeriodo: arts.length,
      clientesNovos: novos,
      clientesRecorrentes: recorrentes,
      fichasConcluidas: fichas,
      contratosAssinados: contratos,
      checkinsPeriodo: checkins.filter(
        (c) => isInPeriod(c.arrivalAt, r) && matchesArtist(c.tatuador, id),
      ).length,
      ultimaAtividade: lastActivity,
    });
  });

  rows.sort(
    (a, b) => (b.clientesPeriodo ?? 0) - (a.clientesPeriodo ?? 0) || a.nome.localeCompare(b.nome),
  );
  return rows;
}

export async function getTattooArtistDetails(
  id: string,
  period: ReportPeriod,
): Promise<TattooArtistDetail | null> {
  const list = await getTattooArtistPerformance(period);
  const base = list.find((a) => a.id === id);
  if (!base) return null;
  const [clientes, checkins, consents] = await Promise.all([
    getAllClientes(),
    getAllCheckIns(),
    getAllConsents(),
  ]);
  const r = resolvePeriod(period);
  const atts = deriveAttendances(clientes, checkins, consents)
    .filter((a) => matchesArtist(a.tatuador, id))
    .filter((a) => isInPeriod(a.dataISO, r));

  const attendanceRows: AttendanceRow[] = atts.map((a) => ({
    id: a.id,
    cliente: a.cliente || "—",
    cpf: a.cpf,
    tatuador: a.tatuador,
    data: a.dataISO ? new Date(a.dataISO).toLocaleDateString("pt-BR") : null,
    horario: a.dataISO
      ? new Date(a.dataISO).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : null,
    tipo: a.tipo,
    status: a.status,
    ficha: a.ficha,
    contrato: a.contrato,
    checkin: a.checkin,
  }));

  const pendencias = attendanceRows.filter(
    (a) => a.status === "aguardando" || a.status === "em_atendimento",
  ).length;

  return {
    ...base,
    nomeCompleto: base.nome,
    especialidade: null,
    checkinsPeriodo: base.checkinsPeriodo ?? 0,
    pendencias,
    atendimentos: attendanceRows,
  };
}

// ---------------------------------------------------------------------------
// Atendimentos
// ---------------------------------------------------------------------------

export async function getAttendances(
  period: ReportPeriod,
  filters?: Partial<ReportFilterState>,
): Promise<AttendanceReport> {
  const [clientes, checkins, consents] = await Promise.all([
    getAllClientes(),
    getAllCheckIns(),
    getAllConsents(),
  ]);
  const r = resolvePeriod(period);
  const q = (filters?.q ?? "").trim().toLowerCase();
  const derived = deriveAttendances(clientes, checkins, consents).filter((a) =>
    isInPeriod(a.dataISO, r),
  );
  const filtered = derived.filter((a) => {
    if (filters?.tatuadorId && !matchesArtist(a.tatuador, filters.tatuadorId)) return false;
    if (filters?.status && a.status !== filters.status) return false;
    if (q && !`${a.cliente} ${a.tatuador ?? ""} ${a.cpf}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const today = todayISO();
  const hoje = filtered.filter((a) => (a.dataISO ?? "").slice(0, 10) === today).length;
  const concluidos = filtered.filter((a) => a.status === "concluido").length;
  const pendentes = filtered.filter(
    (a) => a.status === "aguardando" || a.status === "em_atendimento",
  ).length;
  const cancelados = filtered.filter((a) => a.status === "cancelado").length;

  const duracoes = filtered.map((a) => a.duracaoMin).filter((v): v is number => v !== null);
  const duracaoMedia = duracoes.length
    ? Math.round(duracoes.reduce((s, v) => s + v, 0) / duracoes.length)
    : null;
  const mediaDiaria = filtered.length > 0 ? Math.round((filtered.length / r.days) * 10) / 10 : 0;

  const rows: AttendanceRow[] = filtered
    .sort((a, b) => (b.dataISO ?? "").localeCompare(a.dataISO ?? ""))
    .slice(0, 500)
    .map((a) => ({
      id: a.id,
      cliente: a.cliente || "—",
      cpf: a.cpf,
      tatuador: a.tatuador,
      data: a.dataISO ? new Date(a.dataISO).toLocaleDateString("pt-BR") : null,
      horario: a.dataISO
        ? new Date(a.dataISO).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : null,
      tipo: a.tipo,
      status: a.status,
      ficha: a.ficha,
      contrato: a.contrato,
      checkin: a.checkin,
    }));

  return {
    totalPeriodo: filtered.length,
    hoje,
    concluidos,
    pendentes,
    cancelados,
    mediaDiaria,
    duracaoMedia,
    rows,
  };
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export async function getClients(
  period: ReportPeriod,
  filters?: Partial<ReportFilterState>,
): Promise<ClientReport> {
  const clientesRaw = await getAllClientes();
  const clientes = clientesRaw.map(toAdminClient);
  const r = resolvePeriod(period);
  const q = (filters?.q ?? "").trim().toLowerCase();

  const filtered = clientes.filter((c) => {
    if (filters?.tatuadorId && !matchesArtist(c.tatuador, filters.tatuadorId)) return false;
    if (filters?.risco === true && c.riscoNivel !== "attention") return false;
    if (
      q &&
      !`${c.nome} ${c.cpf} ${c.telefone ?? ""} ${c.email ?? ""} ${c.tatuador ?? ""}`
        .toLowerCase()
        .includes(q)
    )
      return false;
    return true;
  });

  const novos = filtered.filter((c) => isInPeriod(c.criadoEm, r)).length;
  const recorrentes = filtered.filter((c) => c.totalSessoes > 1).length;
  const comFicha = filtered.filter((c) => c.temFicha).length;
  const comContrato = filtered.filter((c) => c.temAssinatura).length;
  const comRisco = filtered.filter((c) => c.riscoNivel === "attention").length;

  const rows: ClientRow[] = filtered.slice(0, 500).map((c) => ({
    id: c.cpf,
    nome: c.nome || "—",
    tatuador: c.tatuador,
    cadastro: c.criadoEm ? new Date(c.criadoEm).toLocaleDateString("pt-BR") : null,
    ultimoAtendimento: c.ultimaSessao ? new Date(c.ultimaSessao).toLocaleDateString("pt-BR") : null,
    atendimentos: c.totalSessoes,
    ficha: c.temFicha,
    contrato: c.temAssinatura,
    status: c.riscoNivel === "attention" ? "risco" : c.status === "atendido" ? "ativo" : "inativo",
  }));

  return {
    total: filtered.length,
    novos,
    recorrentes,
    comFicha,
    comContrato,
    comRisco,
    rows,
  };
}

// ---------------------------------------------------------------------------
// Contratos
// ---------------------------------------------------------------------------

export async function getContracts(
  period: ReportPeriod,
  filters?: Partial<ReportFilterState>,
): Promise<ContractReport> {
  const [consents, clientesRaw] = await Promise.all([getAllConsents(), getAllClientes()]);
  const r = resolvePeriod(period);
  const q = (filters?.q ?? "").trim().toLowerCase();
  const clientesByCpf = new Map<string, Cliente>();
  clientesRaw.forEach((c) => clientesByCpf.set(onlyDigits(c.cpf), c));

  const inPeriod = consents.filter((c) => isInPeriod(c.criado_em, r));

  const rows: ContractRow[] = inPeriod
    .map((c) => {
      const cli = clientesByCpf.get(c.cpf);
      const consentTs = new Date(c.criado_em).getTime();
      const sessoes = cli?.sessoes ?? [];
      let bestIdx = -1;
      let bestDist = Infinity;
      sessoes.forEach((s, idx) => {
        const t = new Date(s.data || "").getTime();
        if (!Number.isFinite(t)) return;
        const d = Math.abs(t - consentTs);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
        }
      });
      const withinDay = bestIdx >= 0 && bestDist <= 24 * 3600 * 1000;
      const sessao = withinDay ? sessoes[bestIdx] : null;
      const tatuador = sessao?.tatuador || cli?.dadosCadastrais?.tatuador || null;
      const temAssinatura = Boolean((sessao?.assinatura || cli?.assinatura) ?? false);
      return {
        id: c.id,
        cliente: cli?.dadosCadastrais?.nomeCompleto || "Titular removido",
        tatuador,
        data: new Date(c.criado_em).toLocaleDateString("pt-BR"),
        status: (temAssinatura ? "assinado" : "pendente") as ContractRow["status"],
        temAssinatura,
        temPdf: temAssinatura,
        versao: c.versao,
      };
    })
    .filter((row) => {
      if (filters?.tatuadorId && !matchesArtist(row.tatuador, filters.tatuadorId)) return false;
      if (filters?.status && row.status !== filters.status) return false;
      if (q) {
        const hit = `${row.cliente} ${row.tatuador ?? ""} ${row.versao ?? ""}`
          .toLowerCase()
          .includes(q);
        if (!hit) return false;
      }
      return true;
    });

  const total = rows.length;
  const assinados = rows.filter((r0) => r0.status === "assinado").length;
  const pendentes = total - assinados;
  const semPdf = rows.filter((r0) => !r0.temPdf).length;

  return { total, assinados, pendentes, semPdf, comErro: 0, rows };
}

// ---------------------------------------------------------------------------
// Fichas
// ---------------------------------------------------------------------------

export async function getForms(
  period: ReportPeriod,
  filters?: Partial<ReportFilterState>,
): Promise<FormReport> {
  const clientes = await getAllClientes();
  const r = resolvePeriod(period);
  const q = (filters?.q ?? "").trim().toLowerCase();

  interface DerivedForm {
    id: string;
    cpf: string;
    cliente: string;
    tatuador: string | null;
    tipo: "primeira_visita" | "recorrente";
    dataISO: string;
    status: FormRow["status"];
    risco: boolean;
    contrato: boolean;
  }

  const derived: DerivedForm[] = [];
  clientes.forEach((c) => {
    const cpf = onlyDigits(c.cpf);
    const nome = c.dadosCadastrais?.nomeCompleto || "";
    const tatBase = c.dadosCadastrais?.tatuador || null;
    if (c.anamnese && Object.keys(c.anamnese).length > 0) {
      const hits = evaluateAnamnese(c.anamnese as never);
      derived.push({
        id: `${cpf}:v0`,
        cpf,
        cliente: nome,
        tatuador: tatBase,
        tipo: "primeira_visita",
        dataISO: c.criadoEm,
        status: "concluida",
        risco: Boolean(levelFromHits(hits)),
        contrato: Boolean(c.assinatura),
      });
    }
    (c.sessoes || []).forEach((s, idx) => {
      if (!s.anamnese || Object.keys(s.anamnese).length === 0) return;
      const hits = evaluateAnamnese(s.anamnese as never);
      derived.push({
        id: `${cpf}:s${idx}`,
        cpf,
        cliente: nome,
        tatuador: s.tatuador || tatBase,
        tipo: "recorrente",
        dataISO: s.data || c.atualizadoEm,
        status: "concluida",
        risco: Boolean(levelFromHits(hits)),
        contrato: Boolean(s.assinatura),
      });
    });
  });

  const filtered = derived
    .filter((d) => isInPeriod(d.dataISO, r))
    .filter((d) => {
      if (filters?.tatuadorId && !matchesArtist(d.tatuador, filters.tatuadorId)) return false;
      if (filters?.tipo && d.tipo !== filters.tipo) return false;
      if (filters?.status && d.status !== filters.status) return false;
      if (filters?.risco === true && !d.risco) return false;
      if (q && !`${d.cliente} ${d.tatuador ?? ""} ${d.cpf}`.toLowerCase().includes(q)) return false;
      return true;
    });

  const rows: FormRow[] = filtered
    .sort((a, b) => b.dataISO.localeCompare(a.dataISO))
    .slice(0, 500)
    .map((d) => ({
      id: d.id,
      cliente: d.cliente || "—",
      tatuador: d.tatuador,
      tipo: d.tipo,
      data: d.dataISO ? new Date(d.dataISO).toLocaleDateString("pt-BR") : null,
      status: d.status,
      risco: d.risco,
      contrato: d.contrato,
    }));

  return {
    total: filtered.length,
    concluidas: filtered.filter((d) => d.status === "concluida").length,
    incompletas: filtered.filter((d) => d.status === "incompleta").length,
    comAlerta: filtered.filter((d) => d.risco).length,
    primeiraVisita: filtered.filter((d) => d.tipo === "primeira_visita").length,
    recorrentes: filtered.filter((d) => d.tipo === "recorrente").length,
    rows,
  };
}

// ---------------------------------------------------------------------------
// Clientes de risco
// ---------------------------------------------------------------------------

export async function getRiskClients(
  period: ReportPeriod,
  filters?: Partial<ReportFilterState>,
): Promise<RiskReport> {
  const clientes = await getAllClientes();
  const r = resolvePeriod(period);
  const { data: reviewRows } = await supabase
    .from("risk_reviews")
    .select("alert_id, status, decision, reviewed_by");
  const reviewByAlert = new Map<
    string,
    { status: string; decision: string | null; reviewedBy: string | null }
  >();
  (reviewRows ?? []).forEach((r0) =>
    reviewByAlert.set(r0.alert_id, {
      status: r0.status,
      decision: r0.decision,
      reviewedBy: r0.reviewed_by,
    }),
  );

  const q = (filters?.q ?? "").trim().toLowerCase();
  const rows: RiskRow[] = [];

  clientes.forEach((raw) => {
    const c = raw;
    const cpf = onlyDigits(c.cpf);
    const clienteNome = c.dadosCadastrais?.nomeCompleto || "";
    const push = (alertId: string, anamnese: unknown, dataIso: string, tatuador: string | null) => {
      const hits = evaluateAnamnese(anamnese as never);
      const lvl = levelFromHits(hits);
      if (!lvl) return;
      if (!isInPeriod(dataIso, r)) return;
      if (filters?.tatuadorId && !matchesArtist(tatuador, filters.tatuadorId)) return;
      if (q && !`${clienteNome} ${cpf} ${tatuador ?? ""}`.toLowerCase().includes(q)) return;
      const review = reviewByAlert.get(alertId);
      const status: RiskRow["status"] =
        !review || review.status === "pending_review"
          ? "aguardando_revisao"
          : review.status === "archived"
            ? "arquivado"
            : "revisado";
      if (filters?.status && status !== filters.status) return;
      rows.push({
        id: alertId,
        cliente: clienteNome,
        tatuador,
        motivo: hits.map((h) => h.label).join(" · "),
        categoria: hits[0]?.category ?? null,
        nivel: lvl === "high" ? "alto" : "atencao",
        data: dataIso ? new Date(dataIso).toLocaleDateString("pt-BR") : null,
        status,
        responsavel: review?.reviewedBy ?? null,
      });
    };
    push(`${cpf}:v0`, c.anamnese, c.criadoEm, c.dadosCadastrais?.tatuador ?? null);
    (c.sessoes || []).forEach((s, idx) =>
      push(
        `${cpf}:s${idx}`,
        s.anamnese,
        s.data || c.atualizadoEm,
        s.tatuador || c.dadosCadastrais?.tatuador || null,
      ),
    );
  });

  rows.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""));

  const totalAlertas = rows.length;
  const revisados = rows.filter((x) => x.status === "revisado").length;
  const aguardando = rows.filter((x) => x.status === "aguardando_revisao").length;
  const nivelAlto = rows.filter((x) => x.nivel === "alto").length;
  const nivelAtencao = rows.filter((x) => x.nivel === "atencao").length;

  return {
    totalAlertas,
    aguardandoRevisao: aguardando,
    revisados,
    nivelAtencao,
    nivelAlto,
    rows: rows.slice(0, 500),
  };
}

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

export async function getDocuments(
  period: ReportPeriod,
  filters?: Partial<ReportFilterState>,
): Promise<DocumentReport> {
  const [clientes, consents] = await Promise.all([getAllClientes(), getAllConsents()]);
  const r = resolvePeriod(period);
  const q = (filters?.q ?? "").trim().toLowerCase();
  const clientesByCpf = new Map<string, Cliente>();
  clientes.forEach((c) => clientesByCpf.set(onlyDigits(c.cpf), c));

  interface Doc {
    id: string;
    tipo: DocumentRow["tipo"];
    cliente: string;
    tatuador: string | null;
    dataISO: string;
    status: DocumentRow["status"];
    nome: string;
  }
  const derived: Doc[] = [];

  consents.forEach((c) => {
    const cli = clientesByCpf.get(c.cpf);
    derived.push({
      id: `contrato:${c.id}`,
      tipo: "contrato",
      cliente: cli?.dadosCadastrais?.nomeCompleto || "Titular removido",
      tatuador: cli?.dadosCadastrais?.tatuador ?? null,
      dataISO: c.criado_em,
      status: cli?.assinatura ? "disponivel" : "pendente",
      nome: `Contrato ${c.versao}`,
    });
  });

  clientes.forEach((c) => {
    const cpf = onlyDigits(c.cpf);
    if (c.anamnese && Object.keys(c.anamnese).length > 0) {
      derived.push({
        id: `ficha:${cpf}:v0`,
        tipo: "ficha",
        cliente: c.dadosCadastrais?.nomeCompleto || "",
        tatuador: c.dadosCadastrais?.tatuador ?? null,
        dataISO: c.criadoEm,
        status: "disponivel",
        nome: "Ficha de anamnese (1ª visita)",
      });
    }
    (c.sessoes || []).forEach((s, idx) => {
      if (s.anamnese && Object.keys(s.anamnese).length > 0) {
        derived.push({
          id: `ficha:${cpf}:s${idx}`,
          tipo: "ficha",
          cliente: c.dadosCadastrais?.nomeCompleto || "",
          tatuador: s.tatuador || c.dadosCadastrais?.tatuador || null,
          dataISO: s.data || c.atualizadoEm,
          status: "disponivel",
          nome: `Ficha de sessão #${idx + 1}`,
        });
      }
    });
    if (c.assinatura) {
      derived.push({
        id: `assinatura:${cpf}`,
        tipo: "assinatura",
        cliente: c.dadosCadastrais?.nomeCompleto || "",
        tatuador: c.dadosCadastrais?.tatuador ?? null,
        dataISO: c.atualizadoEm,
        status: "disponivel",
        nome: "Assinatura digital",
      });
    }
  });

  const filtered = derived.filter((d) => {
    if (!isInPeriod(d.dataISO, r)) return false;
    if (filters?.tatuadorId && !matchesArtist(d.tatuador, filters.tatuadorId)) return false;
    if (filters?.tipo && d.tipo !== filters.tipo) return false;
    if (filters?.status && d.status !== filters.status) return false;
    if (q && !`${d.nome} ${d.cliente} ${d.tatuador ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const rows: DocumentRow[] = filtered
    .sort((a, b) => b.dataISO.localeCompare(a.dataISO))
    .slice(0, 500)
    .map((d) => ({
      id: d.id,
      documento: d.nome,
      cliente: d.cliente || "—",
      tatuador: d.tatuador,
      tipo: d.tipo,
      data: d.dataISO ? new Date(d.dataISO).toLocaleDateString("pt-BR") : null,
      status: d.status,
    }));

  return {
    total: filtered.length,
    disponiveis: filtered.filter((d) => d.status === "disponivel").length,
    pendentes: filtered.filter((d) => d.status === "pendente").length,
    falhas: filtered.filter((d) => d.status === "erro").length,
    contratos: filtered.filter((d) => d.tipo === "contrato").length,
    fichas: filtered.filter((d) => d.tipo === "ficha").length,
    assinaturas: filtered.filter((d) => d.tipo === "assinatura").length,
    rows,
  };
}

// ---------------------------------------------------------------------------
// Check-ins
// ---------------------------------------------------------------------------

export async function getCheckIns(
  period: ReportPeriod,
  filters?: Partial<ReportFilterState>,
): Promise<CheckInReport> {
  const rows = await getAllCheckIns();
  const r = resolvePeriod(period);
  const q = (filters?.q ?? "").trim().toLowerCase();
  const inPeriod = rows.filter((c) => isInPeriod(c.arrivalAt, r));

  const filtered = inPeriod.filter((c) => {
    if (filters?.tatuadorId && !matchesArtist(c.tatuador, filters.tatuadorId)) return false;
    if (filters?.status && CHECKIN_STATUS_LABEL[c.status] !== filters.status) {
      const map: Record<string, CheckIn["status"][]> = {
        aguardando: ["waiting", "called"],
        em_atendimento: ["in_service"],
        concluido: ["completed"],
        cancelado: ["cancelled"],
        nao_compareceu: ["no_show"],
      };
      const allowed = map[filters.status];
      if (!allowed || !allowed.includes(c.status)) return false;
    }
    if (filters?.risco === true && !c.riskFlag) return false;
    if (q && !`${c.clienteNome} ${c.cpf} ${c.tatuador ?? ""}`.toLowerCase().includes(q))
      return false;
    return true;
  });

  const today = todayISO();
  const hoje = rows.filter((c) => c.queueDay === today).length;
  const aguardando = filtered.filter((c) => c.status === "waiting" || c.status === "called").length;
  const emAtendimento = filtered.filter((c) => c.status === "in_service").length;
  const atendidos = filtered.filter((c) => c.status === "completed").length;
  const cancelados = filtered.filter((c) => c.status === "cancelled").length;
  const naoCompareceram = filtered.filter((c) => c.status === "no_show").length;
  const esperas = filtered
    .map((c) => waitMinutes(c))
    .filter((v): v is number => Number.isFinite(v));
  const mediaEspera = esperas.length
    ? Math.round(esperas.reduce((s, v) => s + v, 0) / esperas.length)
    : null;
  const mediaDiaria = Math.round((filtered.length / r.days) * 10) / 10;

  const outRows: CheckInRow[] = filtered.slice(0, 500).map((c) => ({
    id: c.id,
    cliente: c.clienteNome,
    tatuador: c.tatuador,
    chegada: c.arrivalAt ? new Date(c.arrivalAt).toLocaleString("pt-BR") : null,
    inicio: c.startedAt ? new Date(c.startedAt).toLocaleString("pt-BR") : null,
    conclusao: c.completedAt ? new Date(c.completedAt).toLocaleString("pt-BR") : null,
    status:
      c.status === "in_service"
        ? "em_atendimento"
        : c.status === "completed"
          ? "concluido"
          : c.status === "cancelled"
            ? "cancelado"
            : c.status === "no_show"
              ? "nao_compareceu"
              : c.status === "called"
                ? "chamado"
                : "aguardando",
    tempoEspera: waitMinutes(c),
    duracao: serviceMinutes(c),
  }));

  return {
    hoje,
    periodo: filtered.length,
    aguardando,
    emAtendimento,
    atendidos,
    cancelados,
    naoCompareceram,
    mediaEspera,
    mediaDiaria,
    rows: outRows,
  };
}

// ---------------------------------------------------------------------------
// Utilidades exportadas para testes/uso avançado (opcional)
// ---------------------------------------------------------------------------

export function computePeriodLabel(period: ReportPeriod): string {
  return resolvePeriod(period).label;
}

export function invalidateReportsCache(): void {
  CLIENTES_CACHE = null;
  CHECKINS_CACHE = null;
  CONSENTS_CACHE = null;
  ARTISTS_CACHE = null;
}

export const reportsRepository = {
  getOverview,
  getTattooArtistPerformance,
  getTattooArtistDetails,
  getAttendances,
  getClients,
  getContracts,
  getForms,
  getRiskClients,
  getDocuments,
  getCheckIns,
};

// Reexport utilitário para consumidores externos
export type { ResolvedPeriod };
