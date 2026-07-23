import type { StudioSettings } from "@/lib/settings";
import { buildPrivacyNoticeText } from "@/lib/document-templates";

export const CONSENT_TEXT_VERSION = "2026-07-lgpd-v3";

export const IMAGE_CONSENT_TEXT = `AUTORIZACAO OPCIONAL DE USO DE IMAGEM

O uso de fotografia, video ou imagens do procedimento para portfolio, redes sociais, publicidade ou materiais promocionais depende de autorizacao separada, opcional e revogavel. A recusa nao impede cadastro, atendimento nem procedimento.`;

export const LGPD_TEXTO = "";

export const IMAGE_CONSENT_PURPOSES = [
  "portfolio",
  "redes_sociais",
  "publicidade",
  "materiais_promocionais",
] as const;

export type ImageConsentPurpose = (typeof IMAGE_CONSENT_PURPOSES)[number];

export function buildPrivacyNotice(studio: StudioSettings, version = CONSENT_TEXT_VERSION): string {
  return buildPrivacyNoticeText(studio, version);
}
