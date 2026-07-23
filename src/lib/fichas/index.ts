// ============================================================================
// Fonte única do módulo de Fichas — 85 TATTOO
// ----------------------------------------------------------------------------
// Uma "ficha" é derivada da tabela `clientes`:
//   • Primeira visita  → anamnese base do cliente (id: "<cpf>:v0")
//   • Recorrente       → cada `sessao.anamnese` do cliente (id: "<cpf>:s<idx>")
//
// Toda a UI administrativa (listagem, detalhe, risco, relatórios, dashboard)
// consome os hooks/utilitários deste módulo. Não há armazenamento paralelo,
// nem localStorage para dados clínicos ou assinaturas.
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type Anamnese, type Cliente, type Sessao, onlyDigits, rowToCliente } from "@/lib/clientes";
import { getRiscos, RISK_KEYS } from "@/lib/admin";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type FichaTipo = "primeira_visita" | "recorrente";
export type FichaStatus = "concluida" | "incompleta" | "sem_ficha";
export type RiscoNivel = "none" | "attention";

export interface FichaResumo {
  /** ID composto estável: "<cpf>:v0" (primeira visita) ou "<cpf>:s<idx>". */
  id: string;
  cpf: string;
  cpfMasked: string;
  clienteNome: string;
  clienteIniciais: string;
  tatuador: string | null;
  tipo: FichaTipo;
  status: FichaStatus;
  risco: RiscoNivel;
  riscoMotivos: string[];
  temAssinatura: boolean;
  temContrato: boolean;
  versao: number;
  data: string; // ISO — primeira visita usa criadoEm; recorrente usa sessao.data
  atualizadoEm: string;
}

export interface FichaDetalhe extends FichaResumo {
  cliente: {
    cpf: string;
    nome: string;
    dataNascimento?: string;
    telefone?: string;
    email?: string;
    endereco?: string;
    genero?: string;
    rg?: string;
    comoConheceu?: string;
  };
  anamnese: Anamnese;
  assinaturaPath: string | null;
  tipoSanguineo: string;
  criadoEm: string;
  // referências úteis para navegação/histórico
  outrasFichas: Array<Pick<FichaResumo, "id" | "tipo" | "data" | "status" | "risco" | "versao">>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FICHA_KEYS: Array<keyof Anamnese> = [
  "tratamentoMedico",
  "alergia",
  "cirurgiaRecente",
  "diabetes",
  "gestante",
  "hipertensao",
  "marcapasso",
  "doencaTransmissivel",
  "convulsao",
  "circulatorio",
  "problemaPele",
  "fumante",
  "alimentou24h",
  "drogasAlcool",
  "bronzeado",
  "depressaoAnsiedade",
  "anemia",
  "queloide",
  "cardiopatia",
  "hemofilia",
  "hepatite",
  "vitiligo",
];

/** Ficha é considerada "concluída" se todas as perguntas Sim/Não têm resposta. */
function computeStatus(a: Anamnese | undefined | null): FichaStatus {
  if (!a) return "sem_ficha";
  const respondidas = FICHA_KEYS.filter((k) => {
    const v = a[k];
    return v === "sim" || v === "nao";
  }).length;
  if (respondidas === 0) return "sem_ficha";
  if (respondidas >= FICHA_KEYS.length - 2) return "concluida";
  return "incompleta";
}

function iniciais(nome: string): string {
  const p = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "—";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export function maskCpfSafe(cpf: string): string {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.***-${d.slice(9, 11)}`;
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function formatDateTimeBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

// ---------------------------------------------------------------------------
// Derivação: cliente → lista de fichas
// ---------------------------------------------------------------------------

function clienteToFichas(c: Cliente): FichaResumo[] {
  const cpf = onlyDigits(c.cpf);
  const nome = c.dadosCadastrais?.nomeCompleto || "";
  const nomeIni = iniciais(nome);
  const tatuadorBase = c.dadosCadastrais?.tatuador || null;
  const anamneseBase = c.anamnese || ({} as Anamnese);
  const temContrato = Boolean(c.assinatura);

  const fichas: FichaResumo[] = [];

  const statusBase = computeStatus(anamneseBase);
  if (statusBase !== "sem_ficha") {
    const motivos = getRiscos(anamneseBase);
    fichas.push({
      id: `${cpf}:v0`,
      cpf,
      cpfMasked: maskCpfSafe(cpf),
      clienteNome: nome,
      clienteIniciais: nomeIni,
      tatuador: tatuadorBase,
      tipo: "primeira_visita",
      status: statusBase,
      risco: motivos.length > 0 ? "attention" : "none",
      riscoMotivos: motivos,
      temAssinatura: Boolean(c.assinatura),
      temContrato,
      versao: 1,
      data: c.criadoEm,
      atualizadoEm: c.atualizadoEm,
    });
  }

  (c.sessoes || []).forEach((s: Sessao, idx: number) => {
    const a = s.anamnese || ({} as Anamnese);
    const status = computeStatus(a);
    if (status === "sem_ficha") return;
    const motivos = getRiscos(a);
    fichas.push({
      id: `${cpf}:s${idx}`,
      cpf,
      cpfMasked: maskCpfSafe(cpf),
      clienteNome: nome,
      clienteIniciais: nomeIni,
      tatuador: s.tatuador || tatuadorBase,
      tipo: "recorrente",
      status,
      risco: motivos.length > 0 ? "attention" : "none",
      riscoMotivos: motivos,
      temAssinatura: Boolean(s.assinatura),
      temContrato: Boolean(s.assinatura),
      versao: idx + 2,
      data: s.data || c.atualizadoEm,
      atualizadoEm: s.data || c.atualizadoEm,
    });
  });

  return fichas;
}

// ---------------------------------------------------------------------------
// Repositório (Lovable Cloud)
// ---------------------------------------------------------------------------

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

export function useFichas(): AsyncList<FichaResumo> {
  const [data, setData] = useState<FichaResumo[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchAllClientes()
      .then((rows) => {
        if (!alive) return;
        const all = rows.flatMap(clienteToFichas);
        // Mais recente primeiro
        all.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
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

/** Decodifica um id composto no formato "<cpf>:v0" | "<cpf>:s<idx>". */
export function parseFichaId(id: string): { cpf: string; kind: "v0" | "s"; index: number } | null {
  const m = /^(\d{11}):(v0|s(\d+))$/.exec(id || "");
  if (!m) return null;
  const cpf = m[1];
  if (m[2] === "v0") return { cpf, kind: "v0", index: 0 };
  return { cpf, kind: "s", index: parseInt(m[3], 10) };
}

export function useFichaDetalhe(id: string | undefined): AsyncOne<FichaDetalhe> {
  const [state, setState] = useState<AsyncOne<FichaDetalhe>>({
    data: null,
    isLoading: true,
    notFound: false,
    error: null,
    refetch: () => {},
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const refetch = () => setTick((t) => t + 1);
    const parsed = id ? parseFichaId(id) : null;
    if (!parsed) {
      setState({ data: null, isLoading: false, notFound: true, error: null, refetch });
      return;
    }
    setState((s) => ({ ...s, isLoading: true, error: null }));
    fetchClienteByCpf(parsed.cpf)
      .then((c) => {
        if (!alive) return;
        if (!c) {
          setState({ data: null, isLoading: false, notFound: true, error: null, refetch });
          return;
        }
        const fichas = clienteToFichas(c);
        const target =
          parsed.kind === "v0"
            ? fichas.find((f) => f.tipo === "primeira_visita")
            : fichas.find((f) => f.id === `${parsed.cpf}:s${parsed.index}`);
        if (!target) {
          setState({ data: null, isLoading: false, notFound: true, error: null, refetch });
          return;
        }
        const anamneseSrc =
          parsed.kind === "v0"
            ? c.anamnese || ({} as Anamnese)
            : c.sessoes?.[parsed.index]?.anamnese || ({} as Anamnese);
        const assinaturaPath =
          parsed.kind === "v0"
            ? c.assinatura || null
            : c.sessoes?.[parsed.index]?.assinatura || null;

        const detalhe: FichaDetalhe = {
          ...target,
          cliente: {
            cpf: c.cpf,
            nome: c.dadosCadastrais?.nomeCompleto || "",
            dataNascimento: c.dadosCadastrais?.dataNascimento,
            telefone: c.dadosCadastrais?.telefone,
            email: c.dadosCadastrais?.email,
            endereco: c.dadosCadastrais?.endereco,
            genero: c.dadosCadastrais?.genero,
            rg: c.dadosCadastrais?.rg,
            comoConheceu: c.dadosCadastrais?.comoConheceu,
          },
          anamnese: anamneseSrc,
          assinaturaPath: assinaturaPath || null,
          tipoSanguineo: anamneseSrc?.tipoSanguineo || "",
          criadoEm: c.criadoEm,
          outrasFichas: fichas
            .filter((f) => f.id !== target.id)
            .map((f) => ({
              id: f.id,
              tipo: f.tipo,
              data: f.data,
              status: f.status,
              risco: f.risco,
              versao: f.versao,
            })),
        };
        setState({ data: detalhe, isLoading: false, notFound: false, error: null, refetch });
      })
      .catch((e: Error) => {
        if (!alive) return;
        setState({ data: null, isLoading: false, notFound: false, error: e, refetch });
      });
    return () => {
      alive = false;
    };
  }, [id, tick]);

  return state;
}

// ---------------------------------------------------------------------------
// Filtros / busca
// ---------------------------------------------------------------------------

export interface FichasFilters {
  q: string;
  tipo: FichaTipo | null;
  status: FichaStatus | null;
  risco: "com" | "sem" | null;
  tatuador: string | null;
  assinatura: "com" | "sem" | null;
}

export const DEFAULT_FICHAS_FILTERS: FichasFilters = {
  q: "",
  tipo: null,
  status: null,
  risco: null,
  tatuador: null,
  assinatura: null,
};

export function useFichasFiltradas(data: FichaResumo[], filters: FichasFilters): FichaResumo[] {
  return useMemo(() => {
    const termRaw = filters.q.trim().toLowerCase();
    const termDigits = onlyDigits(filters.q);
    return data.filter((f) => {
      if (filters.tipo && f.tipo !== filters.tipo) return false;
      if (filters.status && f.status !== filters.status) return false;
      if (filters.risco === "com" && f.risco === "none") return false;
      if (filters.risco === "sem" && f.risco !== "none") return false;
      if (filters.tatuador && (f.tatuador ?? "").toLowerCase() !== filters.tatuador.toLowerCase())
        return false;
      if (filters.assinatura === "com" && !f.temAssinatura) return false;
      if (filters.assinatura === "sem" && f.temAssinatura) return false;
      if (termRaw) {
        const hitText =
          f.clienteNome.toLowerCase().includes(termRaw) ||
          (f.tatuador ?? "").toLowerCase().includes(termRaw);
        const hitDigits = termDigits.length > 0 && f.cpf.includes(termDigits);
        if (!hitText && !hitDigits) return false;
      }
      return true;
    });
  }, [data, filters]);
}

// ---------------------------------------------------------------------------
// Debounce util
// ---------------------------------------------------------------------------

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setV(value), ms);
    return () => clearTimeout(h);
  }, [value, ms]);
  return v;
}

// ---------------------------------------------------------------------------
// Textos / rótulos
// ---------------------------------------------------------------------------

export const TIPO_LABEL: Record<FichaTipo, string> = {
  primeira_visita: "Primeira visita",
  recorrente: "Recorrente",
};

export const STATUS_LABEL: Record<FichaStatus, string> = {
  concluida: "Concluída",
  incompleta: "Incompleta",
  sem_ficha: "Sem ficha",
};

export { RISK_KEYS };
