// LGPD - registro de consentimento, mascaramento e auditoria.
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { onlyDigits } from "@/lib/clientes";
import { logSecure } from "@/lib/logger";

export const CONSENT_VERSAO = "2026-07-lgpd-v2";

export async function hashTexto(texto: string): Promise<string> {
  const enc = new TextEncoder().encode(texto);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getDeviceSnapshot(): Record<string, unknown> {
  if (typeof navigator === "undefined") return {};
  return {
    platform: navigator.platform,
    language: navigator.language,
    languages: navigator.languages,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen:
      typeof screen !== "undefined"
        ? { w: screen.width, h: screen.height, dpr: window.devicePixelRatio }
        : null,
    online: typeof navigator.onLine === "boolean" ? navigator.onLine : null,
  };
}

export interface ConsentInput {
  cpf: string;
  tipo: "lgpd" | "termo" | "anamnese" | "imagem";
  texto: string;
  versao?: string;
  finalidade?: string;
  contexto?: string;
  status?: "granted" | "denied" | "revoked";
  consentScope?: "required" | "optional";
  titularRef?: string;
  metadata?: Record<string, unknown>;
  documentType?: string;
  templateVersion?: string;
  templateHash?: string;
  renderedText?: string;
  renderedHtml?: string | null;
  configSnapshot?: Record<string, unknown>;
  clientSnapshot?: Record<string, unknown>;
  artistSnapshot?: Record<string, unknown>;
  acceptedAt?: string;
  acceptedBy?: string | null;
  signatureSnapshot?: Record<string, unknown>;
  source?: string;
}

export async function registrarConsentimento(c: ConsentInput): Promise<void> {
  const cpfD = onlyDigits(c.cpf);
  const texto_hash = await hashTexto(c.texto);
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const device = getDeviceSnapshot();
  const { error } = await supabase.rpc(
    "registrar_consentimento" as never,
    {
      _cpf: cpfD,
      _tipo: c.tipo,
      _texto_hash: texto_hash,
      _versao: c.versao ?? CONSENT_VERSAO,
      _finalidade: c.finalidade ?? null,
      _contexto: c.contexto ?? null,
      _status: c.status ?? "granted",
      _consent_scope: c.consentScope ?? "required",
      _titular_ref: c.titularRef ?? null,
      _metadata: (c.metadata ?? {}) as unknown as Json,
      _document_type: c.documentType ?? null,
      _template_version: c.templateVersion ?? null,
      _template_hash: c.templateHash ?? null,
      _rendered_text: c.renderedText ?? c.texto,
      _rendered_html: c.renderedHtml ?? null,
      _config_snapshot: (c.configSnapshot ?? {}) as unknown as Json,
      _client_snapshot: (c.clientSnapshot ?? {}) as unknown as Json,
      _artist_snapshot: (c.artistSnapshot ?? {}) as unknown as Json,
      _accepted_at: c.acceptedAt ?? new Date().toISOString(),
      _accepted_by: c.acceptedBy ?? null,
      _signature_snapshot: (c.signatureSnapshot ?? {}) as unknown as Json,
      _source: c.source ?? null,
      _ip: undefined,
      _user_agent: ua.slice(0, 1024),
      _device: device as unknown as Json,
    } as never,
  );
  if (error) {
    logSecure("warn", "registrarConsentimento falhou", { tipo: c.tipo, code: error.code });
    throw error;
  }
}

export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await supabase.rpc("rate_limit_check", {
    _key: key,
    _max: max,
    _window_seconds: windowSeconds,
  });
  if (error) {
    logSecure("warn", "rateLimit indisponivel", { key, code: error.code });
    return true;
  }
  return data === true;
}

export type AdminAcao =
  | "view_cliente"
  | "edit_cliente"
  | "export"
  | "delete"
  | "anonymize"
  | "unmask"
  | "login"
  | "dsr_resolve";

export async function logAdminAction(
  acao: AdminAcao,
  clienteCpf?: string | null,
  detalhes: Record<string, unknown> = {},
): Promise<void> {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const { error } = await supabase.rpc("log_admin_action", {
    _acao: acao,
    _cliente_cpf: clienteCpf ?? undefined,
    _detalhes: detalhes as unknown as Json,
    _ip: undefined,
    _user_agent: ua.slice(0, 1024),
  });
  if (error) logSecure("warn", "logAdminAction falhou", { acao, code: error.code });
}

export function maskCPFDisplay(cpf: string): string {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return cpf;
  return `***.***.***-${d.slice(9)}`;
}

export function maskPhoneDisplay(tel: string): string {
  const d = onlyDigits(tel);
  if (d.length < 10) return tel.length ? "***" : "";
  const ddd = d.slice(0, 2);
  const last = d.slice(-2);
  return `(${ddd}) ****-**${last}`;
}

export function maskEmailDisplay(email: string): string {
  if (!email || !email.includes("@")) return email;
  const [user, dom] = email.split("@");
  const head = user.slice(0, 1);
  const tail = user.slice(-1);
  return `${head}${"*".repeat(Math.max(1, user.length - 2))}${user.length > 1 ? tail : ""}@${dom}`;
}
