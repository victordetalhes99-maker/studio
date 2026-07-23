// ============================================================================
// Fonte única do módulo de Documentos — 85 TATTOO
// ----------------------------------------------------------------------------
// Nesta fase o sistema NÃO possui bucket de anexos genéricos. A Central de
// Documentos é um CATÁLOGO DERIVADO dos arquivos que realmente existem no
// backend:
//
//   • Contratos      → consent_records (tipo='termo')  — PDF gerado sob demanda
//   • Fichas         → clientes + sessoes              — PDF gerado sob demanda
//   • Assinaturas    → storage `assinaturas` (privado) — arquivo real (image/png)
//   • Termos LGPD    → consent_records (tipo='lgpd')   — registro de aceite
//
// Nada é criado, duplicado ou persistido aqui. Todas as ações administrativas
// (visualizar, baixar, imprimir) usam a fonte real correspondente.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { onlyDigits, rowToCliente, type Cliente, type Sessao } from "@/lib/clientes";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type DocumentoTipo = "contrato" | "ficha" | "assinatura" | "termo_lgpd";

export type DocumentoStatus =
  | "disponivel" // arquivo/PDF gerável agora
  | "pendente" // depende de dado ainda ausente (ex.: assinatura)
  | "erro"
  | "arquivado";

export type DocumentoOrigem = "consent_records" | "clientes" | "storage";

export interface DocumentoResumo {
  id: string; // ID composto, estável
  tipo: DocumentoTipo;
  clienteCpf: string;
  clienteCpfMasked: string;
  clienteNome: string;
  clienteIniciais: string;
  tatuador: string | null;
  origem: DocumentoOrigem;
  contratoId: string | null; // consent_records.id (para contratos)
  fichaId: string | null; // "<cpf>:v0" | "<cpf>:s<idx>"
  status: DocumentoStatus;
  fileName: string; // amigável, sem CPF completo
  mimeType: string;
  sizeBytes: number | null;
  storagePath: string | null; // apenas para assinaturas
  temPdf: boolean; // pode gerar/baixar PDF
  versao: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export const TIPO_LABEL: Record<DocumentoTipo, string> = {
  contrato: "Contrato",
  ficha: "Ficha",
  assinatura: "Assinatura",
  termo_lgpd: "Termo LGPD",
};

export const STATUS_LABEL: Record<DocumentoStatus, string> = {
  disponivel: "Disponível",
  pendente: "Pendente",
  erro: "Com erro",
  arquivado: "Arquivado",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

export function formatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Nome amigável de arquivo, seguro e previsível.
 * Padrão: `85-tattoo-<tipo>-<idSlug>.<ext>` — nunca inclui CPF completo.
 */
function safeFileName(tipo: DocumentoTipo, idSlug: string, ext: string): string {
  const s = idSlug
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return `85-tattoo-${tipo}-${s}.${ext}`;
}

// ---------------------------------------------------------------------------
// Fetching — usa Supabase diretamente para evitar duplicar chamadas dos hooks
// de contratos/fichas.
// ---------------------------------------------------------------------------

interface ConsentRow {
  id: string;
  cpf: string;
  tipo: string;
  versao: string;
  texto_hash: string;
  criado_em: string;
}

async function fetchConsents(): Promise<ConsentRow[]> {
  const { data, error } = await supabase
    .from("consent_records")
    .select("id, cpf, tipo, versao, texto_hash, criado_em")
    .in("tipo", ["termo", "lgpd"])
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ConsentRow[];
}

async function fetchClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .order("atualizado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => rowToCliente(r as never));
}

// ---------------------------------------------------------------------------
// Derivação de documentos
// ---------------------------------------------------------------------------

function fichaAnamneseTemConteudo(a: Record<string, unknown> | null | undefined): boolean {
  if (!a) return false;
  return Object.values(a).some((v) => v === "sim" || v === "nao");
}

function buildFromClientes(clientes: Cliente[]): DocumentoResumo[] {
  const out: DocumentoResumo[] = [];
  for (const c of clientes) {
    const cpf = onlyDigits(c.cpf);
    const nome = c.dadosCadastrais?.nomeCompleto || "";
    const ini = iniciais(nome);
    const cpfMasked = maskCpfSafe(cpf);
    const tatuadorBase = c.dadosCadastrais?.tatuador || null;
    const cpfSlug = cpf.slice(-6);

    // Ficha da primeira visita
    if (fichaAnamneseTemConteudo(c.anamnese as unknown as Record<string, unknown>)) {
      out.push({
        id: `ficha:${cpf}:v0`,
        tipo: "ficha",
        clienteCpf: cpf,
        clienteCpfMasked: cpfMasked,
        clienteNome: nome,
        clienteIniciais: ini,
        tatuador: tatuadorBase,
        origem: "clientes",
        contratoId: null,
        fichaId: `${cpf}:v0`,
        status: "disponivel",
        fileName: safeFileName("ficha", `${cpfSlug}-v1`, "pdf"),
        mimeType: "application/pdf",
        sizeBytes: null,
        storagePath: null,
        temPdf: true,
        versao: "1",
        criadoEm: c.criadoEm,
        atualizadoEm: c.atualizadoEm,
      });
    }

    // Assinatura base
    if (c.assinatura) {
      out.push({
        id: `assinatura:${cpf}:v0`,
        tipo: "assinatura",
        clienteCpf: cpf,
        clienteCpfMasked: cpfMasked,
        clienteNome: nome,
        clienteIniciais: ini,
        tatuador: tatuadorBase,
        origem: "storage",
        contratoId: null,
        fichaId: `${cpf}:v0`,
        status: "disponivel",
        fileName: safeFileName("assinatura", `${cpfSlug}-v1`, "png"),
        mimeType: "image/png",
        sizeBytes: null,
        storagePath: c.assinatura.startsWith("data:") ? null : c.assinatura,
        temPdf: false,
        versao: "1",
        criadoEm: c.criadoEm,
        atualizadoEm: c.atualizadoEm,
      });
    }

    // Fichas + assinaturas por sessão
    (c.sessoes || []).forEach((s: Sessao, idx: number) => {
      const versaoNum = idx + 2;
      if (fichaAnamneseTemConteudo(s.anamnese as unknown as Record<string, unknown>)) {
        out.push({
          id: `ficha:${cpf}:s${idx}`,
          tipo: "ficha",
          clienteCpf: cpf,
          clienteCpfMasked: cpfMasked,
          clienteNome: nome,
          clienteIniciais: ini,
          tatuador: s.tatuador || tatuadorBase,
          origem: "clientes",
          contratoId: null,
          fichaId: `${cpf}:s${idx}`,
          status: "disponivel",
          fileName: safeFileName("ficha", `${cpfSlug}-v${versaoNum}`, "pdf"),
          mimeType: "application/pdf",
          sizeBytes: null,
          storagePath: null,
          temPdf: true,
          versao: String(versaoNum),
          criadoEm: s.data || c.atualizadoEm,
          atualizadoEm: s.data || c.atualizadoEm,
        });
      }
      if (s.assinatura) {
        out.push({
          id: `assinatura:${cpf}:s${idx}`,
          tipo: "assinatura",
          clienteCpf: cpf,
          clienteCpfMasked: cpfMasked,
          clienteNome: nome,
          clienteIniciais: ini,
          tatuador: s.tatuador || tatuadorBase,
          origem: "storage",
          contratoId: null,
          fichaId: `${cpf}:s${idx}`,
          status: "disponivel",
          fileName: safeFileName("assinatura", `${cpfSlug}-v${versaoNum}`, "png"),
          mimeType: "image/png",
          sizeBytes: null,
          storagePath: s.assinatura.startsWith("data:") ? null : s.assinatura,
          temPdf: false,
          versao: String(versaoNum),
          criadoEm: s.data || c.atualizadoEm,
          atualizadoEm: s.data || c.atualizadoEm,
        });
      }
    });
  }
  return out;
}

function buildFromConsents(
  consents: ConsentRow[],
  clientesMap: Map<string, Cliente>,
): DocumentoResumo[] {
  return consents.map((row) => {
    const cpf = onlyDigits(row.cpf);
    const c = clientesMap.get(cpf);
    const nome = c?.dadosCadastrais?.nomeCompleto || "Titular removido";
    const cpfSlug = cpf.slice(-6);

    if (row.tipo === "termo") {
      const temAssinatura = Boolean(c?.assinatura);
      return {
        id: `contrato:${row.id}`,
        tipo: "contrato",
        clienteCpf: cpf,
        clienteCpfMasked: maskCpfSafe(cpf),
        clienteNome: nome,
        clienteIniciais: iniciais(nome),
        tatuador: c?.dadosCadastrais?.tatuador || null,
        origem: "consent_records",
        contratoId: row.id,
        fichaId: c ? `${cpf}:v0` : null,
        status: temAssinatura ? "disponivel" : "pendente",
        fileName: safeFileName("contrato", `${cpfSlug}-${row.versao}`, "pdf"),
        mimeType: "application/pdf",
        sizeBytes: null,
        storagePath: null,
        temPdf: temAssinatura,
        versao: row.versao,
        criadoEm: row.criado_em,
        atualizadoEm: row.criado_em,
      } satisfies DocumentoResumo;
    }
    // termo_lgpd
    return {
      id: `termo_lgpd:${row.id}`,
      tipo: "termo_lgpd",
      clienteCpf: cpf,
      clienteCpfMasked: maskCpfSafe(cpf),
      clienteNome: nome,
      clienteIniciais: iniciais(nome),
      tatuador: c?.dadosCadastrais?.tatuador || null,
      origem: "consent_records",
      contratoId: row.id,
      fichaId: null,
      status: "disponivel",
      fileName: safeFileName("termo_lgpd", `${cpfSlug}-${row.versao}`, "txt"),
      mimeType: "text/plain",
      sizeBytes: null,
      storagePath: null,
      temPdf: false,
      versao: row.versao,
      criadoEm: row.criado_em,
      atualizadoEm: row.criado_em,
    } satisfies DocumentoResumo;
  });
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

export function useDocumentos(): AsyncList<DocumentoResumo> {
  const [data, setData] = useState<DocumentoResumo[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [consents, clientes] = await Promise.all([fetchConsents(), fetchClientes()]);
        const map = new Map<string, Cliente>();
        clientes.forEach((c) => map.set(onlyDigits(c.cpf), c));
        const fromClientes = buildFromClientes(clientes);
        const fromConsents = buildFromConsents(consents, map);
        const all = [...fromConsents, ...fromClientes];
        // dedupe por id (ficha:v0 pode aparecer só uma vez, mas por segurança)
        const seen = new Set<string>();
        const dedup: DocumentoResumo[] = [];
        for (const d of all) {
          if (seen.has(d.id)) continue;
          seen.add(d.id);
          dedup.push(d);
        }
        dedup.sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));
        if (alive) setData(dedup);
      } catch (e) {
        if (alive) {
          setError(e as Error);
          setData([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
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

/**
 * Busca um documento pelo ID composto (contrato:<uuid>, ficha:<cpf>:v0,
 * assinatura:<cpf>:s0, termo_lgpd:<uuid>).
 * Reaproveita `useDocumentos` para manter uma única fonte.
 */
export function useDocumento(id: string | undefined): AsyncOne<DocumentoResumo> {
  const { data, isLoading, error, refetch } = useDocumentos();
  return useMemo<AsyncOne<DocumentoResumo>>(() => {
    if (isLoading) {
      return { data: null, isLoading: true, notFound: false, error, refetch };
    }
    if (!id) return { data: null, isLoading: false, notFound: true, error: null, refetch };
    const found = data.find((d) => d.id === id) ?? null;
    return {
      data: found,
      isLoading: false,
      notFound: !found,
      error,
      refetch,
    };
  }, [id, data, isLoading, error, refetch]);
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

export interface DocumentosFilters {
  q: string;
  tipo: DocumentoTipo | null;
  status: DocumentoStatus | null;
  tatuador: string | null;
  origem: DocumentoOrigem | null;
  periodo: "hoje" | "7d" | "30d" | null;
}

export const DEFAULT_DOCUMENTOS_FILTERS: DocumentosFilters = {
  q: "",
  tipo: null,
  status: null,
  tatuador: null,
  origem: null,
  periodo: null,
};

function inPeriodo(iso: string, p: DocumentosFilters["periodo"]): boolean {
  if (!p) return true;
  const t = new Date(iso).getTime();
  const now = Date.now();
  if (p === "hoje") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return t >= d.getTime();
  }
  if (p === "7d") return t >= now - 7 * 86400000;
  if (p === "30d") return t >= now - 30 * 86400000;
  return true;
}

export function useDocumentosFiltrados(
  rows: DocumentoResumo[],
  f: DocumentosFilters,
): DocumentoResumo[] {
  return useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return rows.filter((r) => {
      if (f.tipo && r.tipo !== f.tipo) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.origem && r.origem !== f.origem) return false;
      if (f.tatuador && (r.tatuador ?? "") !== f.tatuador) return false;
      if (!inPeriodo(r.criadoEm, f.periodo)) return false;
      if (q) {
        const hay =
          `${r.clienteNome} ${r.tatuador ?? ""} ${r.fileName} ${r.id} ${r.clienteCpfMasked}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, f]);
}

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ---------------------------------------------------------------------------
// Métricas para o header
// ---------------------------------------------------------------------------

export interface DocumentosMetrics {
  total: number;
  contratos: number;
  fichas: number;
  assinaturas: number;
  termos: number;
  pendentes: number;
  comErro: number;
}

export function computeMetrics(rows: DocumentoResumo[]): DocumentosMetrics {
  const m: DocumentosMetrics = {
    total: rows.length,
    contratos: 0,
    fichas: 0,
    assinaturas: 0,
    termos: 0,
    pendentes: 0,
    comErro: 0,
  };
  for (const r of rows) {
    if (r.tipo === "contrato") m.contratos++;
    else if (r.tipo === "ficha") m.fichas++;
    else if (r.tipo === "assinatura") m.assinaturas++;
    else if (r.tipo === "termo_lgpd") m.termos++;
    if (r.status === "pendente") m.pendentes++;
    if (r.status === "erro") m.comErro++;
  }
  return m;
}

// ---------------------------------------------------------------------------
// Ações: rota de visualização (respeita o módulo dono do dado)
// ---------------------------------------------------------------------------

export function documentoViewRoute(d: DocumentoResumo): string {
  if (d.tipo === "contrato" && d.contratoId) return `/admin/contratos/${d.contratoId}`;
  if (d.tipo === "ficha" && d.fichaId) return `/admin/fichas/${d.fichaId}`;
  return `/admin/documentos/${encodeURIComponent(d.id)}`;
}

/** URL assinada temporária para uma assinatura no bucket privado. */
export async function getAssinaturaSignedUrl(storagePath: string): Promise<string | null> {
  const { getAssinaturaUrl } = await import("@/lib/clientes");
  return getAssinaturaUrl(storagePath);
}

export function useRefetchDocumentos(): () => void {
  // conveniência: força recarregar a fonte central via evento global
  return useCallback(() => {
    window.dispatchEvent(new CustomEvent("documentos:refresh"));
  }, []);
}
