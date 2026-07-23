import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type Cliente, type Sessao, onlyDigits, rowToCliente } from "@/lib/clientes";
import { CONTRACT_TEMPLATE_ID, CONTRACT_TEMPLATE_LABEL } from "./templates";

export type ContratoStatus = "signed" | "cancelled" | "superseded" | "error";

export interface ContratoSnapshotCliente {
  cpf: string;
  cpfMasked: string;
  nomeCompleto: string;
  iniciais: string;
  documento: string;
  dataNascimento?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
}

export interface ContratoSnapshotTatuador {
  id: string;
  displayName: string;
}

export interface ContratoResumo {
  id: string;
  cpf: string;
  cpfMasked: string;
  clienteNome: string;
  clienteIniciais: string;
  tatuador: string | null;
  tatuadorId: string | null;
  templateId: string;
  versao: string;
  status: ContratoStatus;
  aceitoEm: string;
  assinadoEm: string | null;
  temAssinatura: boolean;
  temPdf: boolean;
  fichaId: string | null;
  origem: "primeira_visita" | "recorrente";
  atualizadoEm: string;
  hasSnapshot: boolean;
  legacyNotice: string | null;
  studioDisplayName: string;
  documentLabel: string;
  filePrefix: string;
}

export interface ContratoDetalhe extends ContratoResumo {
  cliente: ContratoSnapshotCliente;
  tatuadorSnapshot: ContratoSnapshotTatuador | null;
  assinaturaPath: string | null;
  textoHash: string | null;
  templateHash: string | null;
  hashAlgoritmo: "SHA-256";
  renderedText: string | null;
  renderedHtml: string | null;
  studioCompanyName: string | null;
  pdfHeader: string | null;
  pdfFooter: string | null;
  configSnapshot: Record<string, unknown> | null;
  clientSnapshotRaw: Record<string, unknown> | null;
  artistSnapshotRaw: Record<string, unknown> | null;
  signatureSnapshot: Record<string, unknown> | null;
  aceite: {
    userAgent: string | null;
    ip: string | null;
    device: Record<string, unknown> | null;
    versao: string;
    acceptedAt: string;
    acceptedBy: string | null;
    source: string | null;
  };
  historico: ContratoEvento[];
  outrosContratos: Array<Pick<ContratoResumo, "id" | "versao" | "aceitoEm" | "status">>;
}

export type ContratoEventoTipo =
  | "created"
  | "reviewed"
  | "terms_accepted"
  | "signature_registered"
  | "signed"
  | "pdf_generated"
  | "legacy_detected";

export interface ContratoEvento {
  tipo: ContratoEventoTipo;
  em: string;
  detalhes?: string;
}

interface ConsentRow {
  id: string;
  cpf: string;
  tipo: "lgpd" | "termo" | "anamnese" | string;
  versao: string;
  texto_hash: string | null;
  ip: string | null;
  user_agent: string | null;
  device: Record<string, unknown> | null;
  criado_em: string;
  source?: string | null;
  document_type?: string | null;
  template_version?: string | null;
  template_hash?: string | null;
  rendered_text?: string | null;
  rendered_html?: string | null;
  config_snapshot?: Record<string, unknown> | null;
  client_snapshot?: Record<string, unknown> | null;
  artist_snapshot?: Record<string, unknown> | null;
  accepted_at?: string | null;
  accepted_by?: string | null;
  signature_snapshot?: Record<string, unknown> | null;
}

interface MatchedSession {
  fichaId: string;
  origem: "primeira_visita" | "recorrente";
  tatuador: string | null;
  assinaturaPath: string | null;
}

const LEGACY_NOTICE = "Documento legado sem snapshot integral";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
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

export function formatCpfFull(cpf: string): string {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
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

export function tatuadorSlug(nome: string): string {
  return (nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function extractSnapshotBundle(configSnapshot: Record<string, unknown> | null) {
  return {
    documents: asRecord(configSnapshot?.documents),
    identity: asRecord(configSnapshot?.identity),
    studio: asRecord(configSnapshot?.studio),
  };
}

function resolveAcceptedAt(row: ConsentRow) {
  return row.accepted_at ?? row.criado_em;
}

function resolveVersion(row: ConsentRow) {
  return row.template_version?.trim() || row.versao?.trim() || "legacy";
}

function resolveSnapshotFlag(row: ConsentRow) {
  return Boolean(asString(row.rendered_text));
}

function resolveLegacyNotice(row: ConsentRow) {
  return resolveSnapshotFlag(row) ? null : LEGACY_NOTICE;
}

function matchSessao(cliente: Cliente, consentIso: string): MatchedSession {
  const cpf = onlyDigits(cliente.cpf);
  const sessoes: Sessao[] = cliente.sessoes || [];
  const consentTs = new Date(consentIso).getTime();

  let bestIdx = -1;
  let bestDist = Infinity;
  sessoes.forEach((s, idx) => {
    const t = new Date(s.data || "").getTime();
    if (!Number.isFinite(t)) return;
    const dist = Math.abs(t - consentTs);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = idx;
    }
  });

  const withinDay = bestIdx >= 0 && bestDist <= 24 * 3600 * 1000;
  if (withinDay) {
    const s = sessoes[bestIdx];
    if (bestIdx === 0) {
      return {
        fichaId: `${cpf}:v0`,
        origem: "primeira_visita",
        tatuador: s.tatuador || cliente.dadosCadastrais?.tatuador || null,
        assinaturaPath: s.assinatura || cliente.assinatura || null,
      };
    }
    return {
      fichaId: `${cpf}:s${bestIdx}`,
      origem: "recorrente",
      tatuador: s.tatuador || cliente.dadosCadastrais?.tatuador || null,
      assinaturaPath: s.assinatura || null,
    };
  }

  return {
    fichaId: `${cpf}:v0`,
    origem: "primeira_visita",
    tatuador: cliente.dadosCadastrais?.tatuador || null,
    assinaturaPath: cliente.assinatura || null,
  };
}

function resolveSourceOrigem(
  row: ConsentRow,
  fallback: "primeira_visita" | "recorrente",
): "primeira_visita" | "recorrente" {
  const source = row.source?.toLowerCase() ?? "";
  if (source.includes("recorrente")) return "recorrente";
  if (source.includes("cadastro")) return "primeira_visita";
  return fallback;
}

function resolveClientSnapshot(
  row: ConsentRow,
  cliente: Cliente | undefined,
): { data: ContratoSnapshotCliente; raw: Record<string, unknown> | null } {
  const raw = asRecord(row.client_snapshot);
  const cpf = onlyDigits(asString(raw?.cpf) ?? row.cpf);
  const nome =
    asString(raw?.nomeCompleto) ?? cliente?.dadosCadastrais?.nomeCompleto ?? "Titular removido";

  return {
    raw,
    data: {
      cpf,
      cpfMasked: maskCpfSafe(cpf),
      nomeCompleto: nome,
      iniciais: iniciais(nome),
      documento: formatCpfFull(cpf),
      dataNascimento: asString(raw?.dataNascimento) ?? cliente?.dadosCadastrais?.dataNascimento,
      telefone: asString(raw?.telefone) ?? cliente?.dadosCadastrais?.telefone,
      email: asString(raw?.email) ?? cliente?.dadosCadastrais?.email,
      endereco: asString(raw?.endereco) ?? cliente?.dadosCadastrais?.endereco,
    },
  };
}

function resolveArtistSnapshot(
  row: ConsentRow,
  fallbackName: string | null,
): { data: ContratoSnapshotTatuador | null; raw: Record<string, unknown> | null } {
  const raw = asRecord(row.artist_snapshot);
  const nome = asString(raw?.nome) ?? fallbackName;
  if (!nome) return { data: null, raw };
  return {
    raw,
    data: {
      id: asString(raw?.id) ?? tatuadorSlug(nome),
      displayName: nome,
    },
  };
}

function resolveAssinaturaPath(row: ConsentRow, fallback: string | null) {
  const raw = asRecord(row.signature_snapshot);
  return {
    raw,
    path: asString(raw?.storagePath) ?? asString(raw?.path) ?? fallback,
  };
}

function resolveStudioFields(row: ConsentRow) {
  const configSnapshot = asRecord(row.config_snapshot);
  const { documents, identity, studio } = extractSnapshotBundle(configSnapshot);
  return {
    configSnapshot,
    studioDisplayName:
      asString(studio?.nomeEstudio) ??
      asString(identity?.systemName) ??
      asString(identity?.pdfHeader) ??
      asString(studio?.nomeEmpresarial) ??
      "Documento contratual",
    studioCompanyName: asString(studio?.nomeEmpresarial),
    pdfHeader: asString(identity?.pdfHeader) ?? asString(documents?.pdfHeader),
    pdfFooter: asString(identity?.pdfFooter) ?? asString(documents?.pdfFooter),
    filePrefix: asString(documents?.filePrefix) ?? "documento",
  };
}

function buildResumo(row: ConsentRow, cliente: Cliente | undefined): ContratoResumo {
  const cpf = onlyDigits(row.cpf);
  const acceptedAt = resolveAcceptedAt(row);
  const matched = cliente ? matchSessao(cliente, acceptedAt) : null;
  const clientSnapshot = resolveClientSnapshot(row, cliente);
  const artistSnapshot = resolveArtistSnapshot(row, matched?.tatuador ?? null);
  const assinatura = resolveAssinaturaPath(row, matched?.assinaturaPath ?? null);
  const studio = resolveStudioFields(row);
  const hasSnapshot = resolveSnapshotFlag(row);

  return {
    id: row.id,
    cpf,
    cpfMasked: clientSnapshot.data.cpfMasked,
    clienteNome: clientSnapshot.data.nomeCompleto,
    clienteIniciais: clientSnapshot.data.iniciais,
    tatuador: artistSnapshot.data?.displayName ?? null,
    tatuadorId: artistSnapshot.data?.id ?? null,
    templateId: row.document_type?.trim() || CONTRACT_TEMPLATE_ID,
    versao: resolveVersion(row),
    status: "signed",
    aceitoEm: acceptedAt,
    assinadoEm: assinatura.path ? acceptedAt : null,
    temAssinatura: Boolean(assinatura.path),
    temPdf: true,
    fichaId: matched?.fichaId ?? null,
    origem: resolveSourceOrigem(row, matched?.origem ?? "primeira_visita"),
    atualizadoEm: acceptedAt,
    hasSnapshot,
    legacyNotice: resolveLegacyNotice(row),
    studioDisplayName: studio.studioDisplayName,
    documentLabel: CONTRACT_TEMPLATE_LABEL,
    filePrefix: studio.filePrefix,
  };
}

async function fetchConsentTermos(): Promise<ConsentRow[]> {
  const { data, error } = await supabase
    .from("consent_records")
    .select("*")
    .eq("tipo", "termo")
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ConsentRow[];
}

async function fetchClientesByCpfs(cpfs: string[]): Promise<Map<string, Cliente>> {
  const uniq = Array.from(new Set(cpfs.map(onlyDigits))).filter((c) => c.length === 11);
  if (uniq.length === 0) return new Map();
  const { data, error } = await supabase.from("clientes").select("*").in("cpf", uniq);
  if (error) throw error;
  const map = new Map<string, Cliente>();
  (data ?? []).forEach((r) => {
    const c = rowToCliente(r as never);
    map.set(onlyDigits(c.cpf), c);
  });
  return map;
}

async function fetchClienteByCpf(cpf: string): Promise<Cliente | null> {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return null;
  const { data, error } = await supabase.from("clientes").select("*").eq("cpf", d).maybeSingle();
  if (error) throw error;
  return data ? rowToCliente(data as never) : null;
}

async function fetchConsentTermosByCpf(cpf: string): Promise<ConsentRow[]> {
  const d = onlyDigits(cpf);
  const { data, error } = await supabase
    .from("consent_records")
    .select("*")
    .eq("tipo", "termo")
    .eq("cpf", d)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ConsentRow[];
}

export interface AsyncList<T> {
  data: T[];
  isLoading: boolean;
  isEmpty: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useContratos(): AsyncList<ContratoResumo> {
  const [data, setData] = useState<ContratoResumo[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const rows = await fetchConsentTermos();
        const clientes = await fetchClientesByCpfs(rows.map((r) => r.cpf));
        if (!alive) return;
        const out = rows
          .map((r) => buildResumo(r, clientes.get(onlyDigits(r.cpf))))
          .sort((a, b) => (b.aceitoEm || "").localeCompare(a.aceitoEm || ""));
        setData(out);
      } catch (err) {
        if (!alive) return;
        setError(err as Error);
        setData([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tick]);

  const refetch = useCallback(() => setTick((value) => value + 1), []);
  return {
    data,
    isLoading,
    isEmpty: !isLoading && data.length === 0,
    error,
    refetch,
  };
}

export interface AsyncOne<T> {
  data: T | null;
  isLoading: boolean;
  notFound: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useContratoDetalhe(id: string | undefined): AsyncOne<ContratoDetalhe> {
  const [state, setState] = useState<AsyncOne<ContratoDetalhe>>({
    data: null,
    isLoading: true,
    notFound: false,
    error: null,
    refetch: () => {},
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const refetch = () => setTick((value) => value + 1);
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      setState({ data: null, isLoading: false, notFound: true, error: null, refetch });
      return;
    }

    setState((current) => ({ ...current, isLoading: true, error: null }));
    (async () => {
      try {
        const { data: rowData, error: rowErr } = await supabase
          .from("consent_records")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (rowErr) throw rowErr;
        if (!rowData) {
          if (alive) {
            setState({ data: null, isLoading: false, notFound: true, error: null, refetch });
          }
          return;
        }

        const row = rowData as ConsentRow;
        if (row.tipo !== "termo") {
          if (alive) {
            setState({ data: null, isLoading: false, notFound: true, error: null, refetch });
          }
          return;
        }

        const cliente = await fetchClienteByCpf(row.cpf);
        const resumo = buildResumo(row, cliente ?? undefined);
        const acceptedAt = resolveAcceptedAt(row);
        const matched = cliente ? matchSessao(cliente, acceptedAt) : null;
        const outros = cliente ? await fetchConsentTermosByCpf(row.cpf) : [];
        const clientSnapshot = resolveClientSnapshot(row, cliente ?? undefined);
        const artistSnapshot = resolveArtistSnapshot(row, matched?.tatuador ?? null);
        const assinatura = resolveAssinaturaPath(row, matched?.assinaturaPath ?? null);
        const studio = resolveStudioFields(row);

        const historico: ContratoEvento[] = [
          { tipo: "created", em: row.criado_em },
          { tipo: "reviewed", em: acceptedAt },
          {
            tipo: "terms_accepted",
            em: acceptedAt,
            detalhes: `Versão ${resolveVersion(row)} aceita`,
          },
        ];

        if (resumo.temAssinatura) {
          historico.push({ tipo: "signature_registered", em: acceptedAt });
          historico.push({ tipo: "signed", em: acceptedAt });
        }
        if (!resumo.hasSnapshot) {
          historico.push({ tipo: "legacy_detected", em: acceptedAt, detalhes: LEGACY_NOTICE });
        }

        const detalhe: ContratoDetalhe = {
          ...resumo,
          cliente: clientSnapshot.data,
          tatuadorSnapshot: artistSnapshot.data,
          assinaturaPath: assinatura.path,
          textoHash: row.texto_hash ?? null,
          templateHash: row.template_hash ?? null,
          hashAlgoritmo: "SHA-256",
          renderedText: asString(row.rendered_text),
          renderedHtml: asString(row.rendered_html),
          studioCompanyName: studio.studioCompanyName,
          pdfHeader: studio.pdfHeader,
          pdfFooter: studio.pdfFooter,
          configSnapshot: studio.configSnapshot,
          clientSnapshotRaw: clientSnapshot.raw,
          artistSnapshotRaw: artistSnapshot.raw,
          signatureSnapshot: assinatura.raw,
          aceite: {
            userAgent: row.user_agent,
            ip: row.ip,
            device: asRecord(row.device),
            versao: resolveVersion(row),
            acceptedAt,
            acceptedBy: row.accepted_by ?? null,
            source: row.source ?? null,
          },
          historico,
          outrosContratos: outros
            .filter((other) => other.id !== row.id)
            .map((other) => ({
              id: other.id,
              versao: resolveVersion(other),
              aceitoEm: resolveAcceptedAt(other),
              status: "signed" as ContratoStatus,
            })),
        };

        if (alive) {
          setState({ data: detalhe, isLoading: false, notFound: false, error: null, refetch });
        }
      } catch (err) {
        if (alive) {
          setState({
            data: null,
            isLoading: false,
            notFound: false,
            error: err as Error,
            refetch,
          });
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, tick]);

  return state;
}

export interface ContratosFilters {
  q: string;
  status: ContratoStatus | null;
  tatuador: string | null;
  assinatura: "com" | "sem" | null;
  origem: "primeira_visita" | "recorrente" | null;
  versao: string | null;
  periodo: "hoje" | "7d" | "30d" | null;
}

export const DEFAULT_CONTRATOS_FILTERS: ContratosFilters = {
  q: "",
  status: null,
  tatuador: null,
  assinatura: null,
  origem: null,
  versao: null,
  periodo: null,
};

function inPeriodo(iso: string, p: ContratosFilters["periodo"]): boolean {
  if (!p) return true;
  const t = new Date(iso).getTime();
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (p === "hoje") return t >= startOfToday.getTime();
  if (p === "7d") return t >= now - 7 * 86400000;
  if (p === "30d") return t >= now - 30 * 86400000;
  return true;
}

export function useContratosFiltrados(
  data: ContratoResumo[],
  filters: ContratosFilters,
): ContratoResumo[] {
  return useMemo(() => {
    const termRaw = filters.q.trim().toLowerCase();
    const termDigits = onlyDigits(filters.q);
    return data.filter((c) => {
      if (filters.status && c.status !== filters.status) return false;
      if (filters.tatuador && (c.tatuador ?? "").toLowerCase() !== filters.tatuador.toLowerCase())
        return false;
      if (filters.assinatura === "com" && !c.temAssinatura) return false;
      if (filters.assinatura === "sem" && c.temAssinatura) return false;
      if (filters.origem && c.origem !== filters.origem) return false;
      if (filters.versao && c.versao !== filters.versao) return false;
      if (!inPeriodo(c.aceitoEm, filters.periodo)) return false;
      if (termRaw) {
        const hitText =
          c.clienteNome.toLowerCase().includes(termRaw) ||
          (c.tatuador ?? "").toLowerCase().includes(termRaw) ||
          c.id.toLowerCase().includes(termRaw) ||
          c.versao.toLowerCase().includes(termRaw) ||
          c.studioDisplayName.toLowerCase().includes(termRaw);
        const hitDigits = termDigits.length > 0 && c.cpf.includes(termDigits);
        if (!hitText && !hitDigits) return false;
      }
      return true;
    });
  }, [data, filters]);
}

export function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(handle);
  }, [value, ms]);
  return debounced;
}

export const STATUS_LABEL: Record<ContratoStatus, string> = {
  signed: "Assinado",
  cancelled: "Cancelado",
  superseded: "Substituído",
  error: "Com erro",
};

export const ORIGEM_LABEL: Record<"primeira_visita" | "recorrente", string> = {
  primeira_visita: "Primeira visita",
  recorrente: "Recorrente",
};

export const EVENT_LABEL: Record<ContratoEventoTipo, string> = {
  created: "Contrato criado",
  reviewed: "Dados revisados",
  terms_accepted: "Termos aceitos",
  signature_registered: "Assinatura registrada",
  signed: "Contrato concluído",
  pdf_generated: "PDF gerado",
  legacy_detected: "Documento legado identificado",
};
