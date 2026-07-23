import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  type Anamnese,
  type Cliente,
  type DadosCadastrais,
  type Sessao,
  onlyDigits,
  rowToCliente,
} from "@/lib/clientes";
import { getRiscos } from "@/lib/admin";

export type ClientStatus = "aguardando" | "atendido" | "pendente_responsavel";
export type ClientRiskLevel = "none" | "attention";

export interface AdminClient {
  cpf: string;
  nome: string;
  nomeIniciais: string;
  telefone: string | null;
  telefoneMasked: string | null;
  email: string | null;
  tatuador: string | null;
  status: ClientStatus;
  temFicha: boolean;
  temAssinatura: boolean;
  riscoNivel: ClientRiskLevel;
  riscoMotivos: string[];
  totalSessoes: number;
  ultimaSessao: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface AdminClientDetail extends AdminClient {
  dadosCadastrais: DadosCadastrais;
  anamnese: Anamnese;
  assinatura: string;
  sessoes: Sessao[];
}

export function maskCpfSafe(cpf: string): string {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.***-${d.slice(9, 11)}`;
}

export function maskPhoneDisplay(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = onlyDigits(v);
  if (d.length < 10) return v;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function iniciais(nome: string): string {
  const p = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "-";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function isFichaPreenchida(a: Anamnese | undefined | null): boolean {
  if (!a) return false;
  const keys: Array<keyof Anamnese> = [
    "tratamentoMedico",
    "alergia",
    "diabetes",
    "hipertensao",
    "cardiopatia",
    "hemofilia",
  ];
  return keys.some((k) => {
    const v = a[k];
    return typeof v === "string" && v.length > 0;
  });
}

function ultimaSessaoISO(sessoes: Sessao[]): string | null {
  if (!sessoes || sessoes.length === 0) return null;
  const datas = sessoes.map((s) => s.data).filter(Boolean) as string[];
  if (datas.length === 0) return null;
  return datas.sort().at(-1) ?? null;
}

export function toAdminClient(c: Cliente): AdminClient {
  const nome = c.dadosCadastrais?.nomeCompleto || "";
  const riscoMotivos = getRiscos(c.anamnese || ({} as Anamnese));
  return {
    cpf: onlyDigits(c.cpf),
    nome,
    nomeIniciais: iniciais(nome),
    telefone: c.dadosCadastrais?.telefone || null,
    telefoneMasked: maskPhoneDisplay(c.dadosCadastrais?.telefone),
    email: c.dadosCadastrais?.email || null,
    tatuador: c.dadosCadastrais?.tatuador || null,
    status: c.status,
    temFicha: isFichaPreenchida(c.anamnese),
    temAssinatura: Boolean(c.assinatura),
    riscoNivel: riscoMotivos.length > 0 ? "attention" : "none",
    riscoMotivos,
    totalSessoes: c.sessoes?.length ?? 0,
    ultimaSessao: ultimaSessaoISO(c.sessoes ?? []),
    criadoEm: c.criadoEm,
    atualizadoEm: c.atualizadoEm,
  };
}

async function fetchAllClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .order("atualizado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => rowToCliente(r as never));
}

async function fetchOneCliente(cpf: string): Promise<Cliente | null> {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return null;
  const { data, error } = await supabase.from("clientes").select("*").eq("cpf", d).maybeSingle();
  if (error) throw error;
  return data ? rowToCliente(data as never) : null;
}

export interface AsyncList<T> {
  data: T[];
  isLoading: boolean;
  isEmpty: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useAdminClients(): AsyncList<AdminClient> {
  const [data, setData] = useState<AdminClient[]>([]);
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
        setData(rows.map(toAdminClient));
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

export function useAdminClient(cpf: string | undefined): AsyncOne<AdminClientDetail> {
  const [state, setState] = useState<AsyncOne<AdminClientDetail>>({
    data: null,
    isLoading: true,
    notFound: false,
    error: null,
    refetch: () => {},
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!cpf) {
      setState({
        data: null,
        isLoading: false,
        notFound: true,
        error: null,
        refetch: () => setTick((t) => t + 1),
      });
      return;
    }
    setState((s) => ({ ...s, isLoading: true, error: null }));
    fetchOneCliente(cpf)
      .then((row) => {
        if (!alive) return;
        if (!row) {
          setState({
            data: null,
            isLoading: false,
            notFound: true,
            error: null,
            refetch: () => setTick((t) => t + 1),
          });
          return;
        }
        const base = toAdminClient(row);
        const detail: AdminClientDetail = {
          ...base,
          dadosCadastrais: row.dadosCadastrais,
          anamnese: row.anamnese,
          assinatura: row.assinatura,
          sessoes: row.sessoes,
        };
        setState({
          data: detail,
          isLoading: false,
          notFound: false,
          error: null,
          refetch: () => setTick((t) => t + 1),
        });
      })
      .catch((e: Error) => {
        if (!alive) return;
        setState({
          data: null,
          isLoading: false,
          notFound: false,
          error: e,
          refetch: () => setTick((t) => t + 1),
        });
      });
    return () => {
      alive = false;
    };
  }, [cpf, tick]);

  return state;
}

export type SortKey = "nome" | "recentes" | "antigos" | "ultima" | "status" | "risco";

export interface ClientFiltersState {
  q: string;
  tatuador: string | null;
  status: ClientStatus | null;
  risco: "com" | "sem" | null;
  ficha: "com" | "sem" | null;
  sort: SortKey;
}

export const DEFAULT_FILTERS: ClientFiltersState = {
  q: "",
  tatuador: null,
  status: null,
  risco: null,
  ficha: null,
  sort: "recentes",
};

export function useFilteredClients(
  data: AdminClient[],
  filters: ClientFiltersState,
): AdminClient[] {
  return useMemo(() => {
    const termRaw = filters.q.trim().toLowerCase();
    const termDigits = onlyDigits(filters.q);
    let list = data.filter((c) => {
      if (filters.tatuador && (c.tatuador ?? "").toLowerCase() !== filters.tatuador.toLowerCase())
        return false;
      if (filters.status && c.status !== filters.status) return false;
      if (filters.risco === "com" && c.riscoNivel === "none") return false;
      if (filters.risco === "sem" && c.riscoNivel !== "none") return false;
      if (filters.ficha === "com" && !c.temFicha) return false;
      if (filters.ficha === "sem" && c.temFicha) return false;
      if (termRaw) {
        const hitText =
          c.nome.toLowerCase().includes(termRaw) ||
          (c.email ?? "").toLowerCase().includes(termRaw) ||
          (c.tatuador ?? "").toLowerCase().includes(termRaw);
        const hitDigits =
          termDigits.length > 0 &&
          (c.cpf.includes(termDigits) || onlyDigits(c.telefone ?? "").includes(termDigits));
        if (!hitText && !hitDigits) return false;
      }
      return true;
    });

    list = list.slice().sort((a, b) => {
      switch (filters.sort) {
        case "nome":
          return a.nome.localeCompare(b.nome, "pt-BR");
        case "antigos":
          return a.criadoEm.localeCompare(b.criadoEm);
        case "recentes":
          return b.criadoEm.localeCompare(a.criadoEm);
        case "ultima": {
          const av = a.ultimaSessao ?? "";
          const bv = b.ultimaSessao ?? "";
          return bv.localeCompare(av);
        }
        case "status":
          return a.status.localeCompare(b.status);
        case "risco":
          return Number(b.riscoNivel !== "none") - Number(a.riscoNivel !== "none");
      }
    });

    return list;
  }, [data, filters]);
}

export async function updateStatus(cpf: string, next: ClientStatus): Promise<void> {
  const d = onlyDigits(cpf);
  const { error } = await supabase.from("clientes").update({ status: next }).eq("cpf", d);
  if (error) throw error;
}

export async function anonymizeClient(cpf: string): Promise<void> {
  const d = onlyDigits(cpf);
  const { error } = await supabase.rpc("anonymize_cliente", { _cpf: d });
  if (error) throw error;
}

export async function deleteClientLgpd(cpf: string): Promise<void> {
  const d = onlyDigits(cpf);
  const { error } = await supabase.from("data_subject_requests").insert({
    cpf: d,
    tipo: "delete",
    motivo: "Solicitacao administrativa para analise de eliminacao.",
    status: "pendente",
  } as never);
  if (error) throw error;
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

export function formatDateTimeBR(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setV(value), ms);
    return () => clearTimeout(h);
  }, [value, ms]);
  return v;
}

export function useRefetchOnFocus(refetch: () => void) {
  const cb = useCallback(() => refetch(), [refetch]);
  useEffect(() => {
    window.addEventListener("focus", cb);
    return () => window.removeEventListener("focus", cb);
  }, [cb]);
}
