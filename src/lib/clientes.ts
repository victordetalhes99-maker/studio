// Camada de dados — Supabase (Lovable Cloud)
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { logSecure } from "@/lib/logger";

export type YesNo = "sim" | "nao";

export interface DadosCadastrais {
  nomeCompleto: string;
  dataNascimento: string;
  genero: string;
  rg: string;
  cpf: string;
  telefone: string;
  email: string;
  endereco: string;
  comoConheceu: string;
  tatuador: string;
  responsavelLegalNome?: string;
  responsavelLegalContato?: string;
  idadeCalculada?: number;
  faixaEtaria?: "adulto" | "menor";
  guardianValidationStatus?: "not_required" | "pending" | "validated";
}

export interface Anamnese {
  tratamentoMedico: YesNo | "";
  alergia: YesNo | "";
  alergiaDesc?: string;
  cirurgiaRecente: YesNo | "";
  cirurgiaDesc?: string;
  diabetes: YesNo | "";
  diabetesDesc?: string;
  gestante: YesNo | "";
  hipertensao: YesNo | "";
  marcapasso: YesNo | "";
  doencaTransmissivel: YesNo | "";
  doencaTransmissivelDesc?: string;
  convulsao: YesNo | "";
  circulatorio: YesNo | "";
  problemaPele: YesNo | "";
  problemaPeleDesc?: string;
  fumante: YesNo | "";
  tipoSanguineo: string;
  alimentou24h: YesNo | "";
  drogasAlcool: YesNo | "";
  bronzeado: YesNo | "";
  depressaoAnsiedade: YesNo | "";
  anemia: YesNo | "";
  queloide: YesNo | "";
  cardiopatia: YesNo | "";
  hemofilia: YesNo | "";
  hepatite: YesNo | "";
  vitiligo: YesNo | "";
}

export interface Sessao {
  data: string;
  assinatura: string;
  anamnese: Anamnese;
  tatuador?: string;
}

export type StatusCliente = "aguardando" | "atendido" | "pendente_responsavel";

export interface Cliente {
  cpf: string;
  dadosCadastrais: DadosCadastrais;
  anamnese: Anamnese;
  assinatura: string;
  criadoEm: string;
  atualizadoEm: string;
  sessoes: Sessao[];
  status: StatusCliente;
}

// ---------- Helpers ----------
export function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

export function maskCPF(s: string) {
  const d = onlyDigits(s).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function isValidCPF(cpf: string) {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i);
  let r = (s * 10) % 11;
  if (r === 10) r = 0;
  if (r !== parseInt(d[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i);
  r = (s * 10) % 11;
  if (r === 10) r = 0;
  return r === parseInt(d[10]);
}

export function maskPhone(s: string) {
  const d = onlyDigits(s).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3").replace(/-$/, "");
}

export function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function calculateAgeFromBirthDate(iso: string, now = new Date()): number | null {
  if (!iso) return null;
  const birth = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export function isMinorBirthDate(iso: string, minimumAge = 18): boolean {
  const age = calculateAgeFromBirthDate(iso);
  return age !== null && age < minimumAge;
}

// ---------- Row <-> Cliente ----------
export type ClienteRow = {
  cpf: string;
  nome_completo: string;
  telefone: string | null;
  email: string | null;
  tatuador: string | null;
  dados_cadastrais: Json;
  anamnese: Json;
  assinatura: string | null;
  sessoes: Json;
  status: string;
  criado_em: string;
  atualizado_em: string;
};

export function rowToCliente(r: ClienteRow): Cliente {
  return {
    cpf: r.cpf,
    dadosCadastrais: (r.dados_cadastrais as unknown as DadosCadastrais) ?? ({} as DadosCadastrais),
    anamnese: (r.anamnese as unknown as Anamnese) ?? ({} as Anamnese),
    assinatura: r.assinatura ?? "",
    sessoes: (r.sessoes as unknown as Sessao[]) ?? [],
    status: (r.status as StatusCliente) ?? "aguardando",
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
  };
}

function clienteToInsert(c: Cliente) {
  const cpfD = onlyDigits(c.cpf);
  const idade = calculateAgeFromBirthDate(c.dadosCadastrais.dataNascimento);
  const menor = idade !== null && idade < 18;
  const dadosCadastrais = {
    ...c.dadosCadastrais,
    cpf: cpfD,
    idadeCalculada: idade ?? undefined,
    faixaEtaria: menor ? "menor" : "adulto",
    guardianValidationStatus: menor ? "pending" : "not_required",
  };
  const status: StatusCliente = menor ? "pendente_responsavel" : (c.status ?? "aguardando");
  return {
    cpf: cpfD,
    nome_completo: c.dadosCadastrais.nomeCompleto,
    telefone: c.dadosCadastrais.telefone || null,
    email: c.dadosCadastrais.email || null,
    tatuador: c.dadosCadastrais.tatuador || null,
    dados_cadastrais: dadosCadastrais as unknown as Json,
    anamnese: c.anamnese as unknown as Json,
    assinatura: c.assinatura || null,
    sessoes: c.sessoes as unknown as Json,
    status,
  };
}

// ---------- Storage de assinaturas ----------
// Assinaturas ficam num bucket privado "assinaturas".
// No banco guardamos apenas o caminho do arquivo (ex.: "12345678901/1700000000000.png").
// Compatível com registros antigos que ainda têm o dataURL inline.

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

const ASSINATURA_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ASSINATURA_ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

async function uploadAssinaturaIfNeeded(
  cpfD: string,
  value: string | null | undefined,
): Promise<string> {
  if (!value) return "";
  // Já é um caminho de storage — mantém
  if (!value.startsWith("data:")) return value;
  const blob = dataUrlToBlob(value);
  if (!ASSINATURA_ALLOWED_MIME.has(blob.type)) {
    throw new Error(`Formato de assinatura inválido (${blob.type}).`);
  }
  if (blob.size > ASSINATURA_MAX_BYTES) {
    throw new Error("Assinatura excede o limite de 2 MB.");
  }
  const path = `${cpfD}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const { error } = await supabase.storage
    .from("assinaturas")
    .upload(path, blob, { contentType: "image/png", upsert: false });
  if (error) {
    logSecure("warn", "uploadAssinatura falhou", { message: error.message, path });
    throw error;
  }
  return path;
}

// Cache em memória de URLs assinadas (válidas por 1h; cacheamos 50min).
// Deduplica chamadas paralelas pro mesmo path.
const SIGNED_URL_TTL_MS = 50 * 60 * 1000;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const signedUrlInflight = new Map<string, Promise<string | null>>();

export async function getAssinaturaUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith("data:")) return value; // legado

  const cached = signedUrlCache.get(value);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const inflight = signedUrlInflight.get(value);
  if (inflight) return inflight;

  const p = (async () => {
    const { data, error } = await supabase.storage.from("assinaturas").createSignedUrl(value, 3600);
    if (error || !data?.signedUrl) {
      if (error) logSecure("warn", "getAssinaturaUrl falhou", { message: error.message });
      return null;
    }
    signedUrlCache.set(value, {
      url: data.signedUrl,
      expiresAt: Date.now() + SIGNED_URL_TTL_MS,
    });
    return data.signedUrl;
  })();

  signedUrlInflight.set(value, p);
  try {
    return await p;
  } finally {
    signedUrlInflight.delete(value);
  }
}

export function clearAssinaturaUrlCache() {
  signedUrlCache.clear();
  signedUrlInflight.clear();
}

// Pré-aquece o cache de URLs assinadas para uma lista de paths/valores.
// Ignora dataURLs (legado) e valores vazios. Deduplica e respeita o cache existente.
export async function prefetchAssinaturaUrls(
  values: Array<string | null | undefined>,
  limit = 20,
): Promise<void> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (!v || v.startsWith("data:")) continue;
    if (seen.has(v)) continue;
    const cached = signedUrlCache.get(v);
    if (cached && cached.expiresAt > Date.now()) continue;
    seen.add(v);
    unique.push(v);
    if (unique.length >= limit) break;
  }
  if (unique.length === 0) return;
  await Promise.all(unique.map((v) => getAssinaturaUrl(v).catch(() => null)));
}

// ---------- API ----------
// IMPORTANTE (segurança): a RPC pública `checkin_get_cliente` agora devolve
// APENAS os campos mínimos necessários ao kiosk (cpf, nome, tatuador).
// Dados sensíveis (anamnese, endereço, email, telefone, sessões) NUNCA são
// expostos a chamadas anônimas — ficam acessíveis somente pelo painel admin
// via RLS na tabela `clientes`.
export interface ClientePublico {
  cpf: string;
  nomeCompleto: string;
  tatuador: string;
}

export async function getCliente(cpf: string): Promise<ClientePublico | null> {
  const cpfD = onlyDigits(cpf);
  const { data, error } = await supabase.rpc("checkin_get_cliente", { _cpf: cpfD });
  if (error) {
    logSecure("warn", "checkin_get_cliente falhou", { code: error.code });
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as {
    cpf?: string;
    nome_completo?: string;
    tatuador?: string | null;
  } | null;
  if (!row || !row.cpf || !row.nome_completo) return null;
  return {
    cpf: row.cpf,
    nomeCompleto: row.nome_completo,
    tatuador: row.tatuador ?? "",
  };
}

export async function saveCliente(c: Cliente): Promise<Cliente> {
  const cpfD = onlyDigits(c.cpf);
  // Sobe assinatura principal pro storage (se for dataURL)
  const assinaturaPath = await uploadAssinaturaIfNeeded(cpfD, c.assinatura);
  // Sobe cada assinatura das sessões
  const sessoesComPath: Sessao[] = [];
  for (const s of c.sessoes) {
    const p = await uploadAssinaturaIfNeeded(cpfD, s.assinatura);
    sessoesComPath.push({ ...s, assinatura: p });
  }
  const payload = clienteToInsert({ ...c, assinatura: assinaturaPath, sessoes: sessoesComPath });
  // RPC idempotente: se o cliente ja existir (ex.: reenvio apos falha numa
  // etapa seguinte), atualiza em vez de tentar um INSERT que sempre falharia
  // por violacao de unicidade do CPF. Nunca sobrescreve um cliente ja
  // atendido pelo estudio (a RPC recusa nesse caso).
  const { error } = await supabase.rpc(
    "finalizar_cadastro_cliente" as never,
    {
      _cpf: payload.cpf,
      _nome_completo: payload.nome_completo,
      _telefone: payload.telefone,
      _email: payload.email,
      _tatuador: payload.tatuador,
      _dados_cadastrais: payload.dados_cadastrais,
      _anamnese: payload.anamnese,
      _assinatura: payload.assinatura,
      _sessoes: payload.sessoes,
      _status: payload.status,
    } as never,
  );
  if (error) {
    logSecure("warn", "saveCliente falhou", { code: error.code, status: payload.status });
    throw error;
  }
  return {
    ...c,
    assinatura: assinaturaPath,
    sessoes: sessoesComPath,
  };
}

export async function addSessao(
  cpf: string,
  sessao: Sessao,
  anamneseAtualizada?: Anamnese,
): Promise<Sessao> {
  const cpfD = onlyDigits(cpf);
  const assinaturaPath = await uploadAssinaturaIfNeeded(cpfD, sessao.assinatura);
  const sessaoFinal: Sessao = { ...sessao, assinatura: assinaturaPath };
  const { error } = await supabase.rpc("checkin_append_sessao", {
    _cpf: cpfD,
    _sessao: sessaoFinal as unknown as Json,
    _anamnese: (anamneseAtualizada ?? null) as unknown as Json,

    _tatuador: sessaoFinal.tatuador ?? undefined,
  });
  if (error) {
    logSecure("warn", "addSessao falhou", { code: error.code });
    throw error;
  }
  return sessaoFinal;
}
