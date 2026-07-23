import type { IdentitySettings, DocumentSettings } from "@/lib/settings/admin-config";
import type { StudioSettings } from "@/lib/settings";
import { maskCPF } from "@/lib/clientes";

export type VersionedTemplateKind = "contract" | "anamnese" | "lgpd";

export interface StoredDocumentTemplate {
  version: string;
  body: string;
  createdAt: string;
}

export const DEFAULT_CONTRACT_TEMPLATE_BODY = `TERMO DE RESPONSABILIDADE E CIENCIA DO PROCEDIMENTO

Partes:
- Cliente/titular: {{client.nome}} (CPF {{client.cpf_masked}})
- Profissional responsavel: {{artist.nome}}
- Estabelecimento: {{studio.nome_empresarial}} / {{studio.nome_estudio}} - Documento {{studio.documento}}

Dados do atendimento:
- Data do aceite: {{acceptance.date}}
- Horario do aceite: {{acceptance.time}}
- Identificacao do aceite: {{acceptance.id}}

O cliente declara que forneceu informacoes veridicas sobre seu estado de saude, contatos e historico relevante. Informacoes incompletas ou inexatas podem comprometer a seguranca do atendimento.

O profissional e o estabelecimento assumem deveres proprios de cuidado, higiene, orientacao, registro e conducao do procedimento dentro de suas atribuicoes. Este termo nao elimina responsabilidades legais, contratuais, regulatorias ou sanitarias aplicaveis.

O procedimento envolve riscos inerentes, variacoes biologicas e necessidade de cuidados pre e pos-procedimento, conforme orientacao tecnica do profissional responsavel.

Canal de contato institucional: {{studio.contact_channel}}
Canal LGPD: {{studio.lgpd_email}}
Responsavel pela privacidade: {{studio.privacy_responsible}}
Encarregado/DPO: {{studio.dpo_name}}
Endereco do estudio: {{studio.endereco_completo}}

Ao prosseguir com a assinatura, o cliente confirma leitura integral e concordancia com este termo na data e horario acima.`;

export const DEFAULT_ANAMNESE_TEMPLATE_BODY = `DECLARACAO DE CIENCIA DE RISCOS

Cliente: {{client.nome}} (CPF {{client.cpf_masked}})
Profissional responsavel: {{artist.nome}}
Data do aceite: {{acceptance.date}} {{acceptance.time}}

Declaro estar informado(a) sobre possiveis complicacoes e cuidados associados ao procedimento, inclusive quanto a alergias, infeccoes, queloides, reacoes organicas, condicoes de saude preexistentes e necessidade de procurar servico de saude diante de sinais anormais.

Algumas condicoes podem exigir avaliacao medica previa, revisao administrativa adicional ou adiamento do procedimento.

Canal de contato institucional: {{studio.contact_channel}}
Canal LGPD: {{studio.lgpd_email}}`;

export const DEFAULT_LGPD_TEMPLATE_BODY = `TRATAMENTO DE DADOS PESSOAIS E SENSIVEIS

Controlador:
- Nome empresarial: {{studio.nome_empresarial}}
- Nome fantasia: {{studio.nome_estudio}}
- Documento: {{studio.documento}}
- Endereco: {{studio.endereco_completo}}
- Canal de contato: {{studio.contact_channel}}
- Canal LGPD: {{studio.lgpd_email}}
- Responsavel pela privacidade: {{studio.privacy_responsible}}
- Encarregado/DPO: {{studio.dpo_name}}

Ao prosseguir, o titular confirma ciencia de que os dados cadastrais, de contato, de assinatura e de saude estritamente necessarios ao atendimento poderao ser coletados, armazenados e tratados para identificacao civil e operacional do atendimento, execucao segura do procedimento, cumprimento de obrigacoes legais, regulatorias, sanitarias e de guarda, alem de registro de consentimentos, auditoria, prevencao a fraude e seguranca da operacao.

Identificacao do aceite: {{acceptance.id}}
Data e horario do aceite: {{acceptance.datetime}}
Prazo interno de resposta LGPD: {{studio.privacy_deadline_days}} dia(s).`;

export interface TemplateSyncState {
  currentVersion: string;
  currentBody: string;
  history: StoredDocumentTemplate[];
}

export interface RenderClientSnapshot {
  cpf: string;
  nomeCompleto: string;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
}

export interface RenderArtistSnapshot {
  id?: string | null;
  nome: string;
}

export interface DocumentRenderContext {
  studio: StudioSettings;
  identity: IdentitySettings;
  documents: DocumentSettings;
  client: RenderClientSnapshot;
  artist: RenderArtistSnapshot | null;
  acceptanceId: string;
  acceptedAt: string;
  source: string;
}

export class DocumentConfigError extends Error {
  missingFields: string[];

  constructor(missingFields: string[]) {
    super(
      `Configuracao juridica incompleta. Preencha: ${missingFields.join(", ")} antes de gerar o documento.`,
    );
    this.name = "DocumentConfigError";
    this.missingFields = missingFields;
  }
}

function normalizeVersion(value: string, fallback: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function uniqueHistory(history: StoredDocumentTemplate[]): StoredDocumentTemplate[] {
  const out: StoredDocumentTemplate[] = [];
  const seen = new Set<string>();
  for (const item of history) {
    const key = `${item.version}::${item.body}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      version: item.version.trim(),
      body: item.body.trim(),
      createdAt: item.createdAt || new Date().toISOString(),
    });
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function nextVersionLabel(value: string) {
  const trimmed = value.trim() || "v1";
  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (!match) return `${trimmed}-2`;
  const prefix = match[1];
  const num = Number(match[2]);
  return `${prefix}${Number.isFinite(num) ? num + 1 : 2}`;
}

function ensureVersionChange(
  previous: TemplateSyncState,
  desiredVersion: string,
  desiredBody: string,
): TemplateSyncState {
  const history = uniqueHistory([
    ...previous.history,
    {
      version: previous.currentVersion,
      body: previous.currentBody,
      createdAt: new Date().toISOString(),
    },
  ]);

  const currentVersion = normalizeVersion(previous.currentVersion, "v1");
  const nextBody = desiredBody.trim();
  let nextVersion = normalizeVersion(desiredVersion, currentVersion);

  const unchanged = nextVersion === currentVersion && nextBody === previous.currentBody.trim();
  if (unchanged) {
    return {
      currentVersion,
      currentBody: previous.currentBody,
      history,
    };
  }

  const conflicting = history.find(
    (item) => item.version === nextVersion && item.body !== nextBody,
  );
  if (conflicting || (nextVersion === currentVersion && nextBody !== previous.currentBody.trim())) {
    let candidate = nextVersionLabel(nextVersion);
    const versions = new Set(history.map((item) => item.version));
    while (versions.has(candidate)) {
      candidate = nextVersionLabel(candidate);
    }
    nextVersion = candidate;
  }

  return {
    currentVersion: nextVersion,
    currentBody: nextBody,
    history: uniqueHistory([
      ...history,
      {
        version: nextVersion,
        body: nextBody,
        createdAt: new Date().toISOString(),
      },
    ]),
  };
}

export function syncVersionedTemplate(
  previous: TemplateSyncState,
  desiredVersion: string,
  desiredBody: string,
): TemplateSyncState {
  return ensureVersionChange(previous, desiredVersion, desiredBody);
}

export function sanitizeDocumentSettings(input: DocumentSettings): DocumentSettings {
  const contract = syncVersionedTemplate(
    {
      currentVersion: input.contractTemplateVersion,
      currentBody: input.contractTemplateBody,
      history: input.contractTemplateHistory,
    },
    input.contractTemplateVersion,
    input.contractTemplateBody,
  );

  const anamnese = syncVersionedTemplate(
    {
      currentVersion: input.anamneseTemplateVersion,
      currentBody: input.anamneseTemplateBody,
      history: input.anamneseTemplateHistory,
    },
    input.anamneseTemplateVersion,
    input.anamneseTemplateBody,
  );

  const lgpd = syncVersionedTemplate(
    {
      currentVersion: input.lgpdTemplateVersion,
      currentBody: input.lgpdTemplateBody,
      history: input.lgpdTemplateHistory,
    },
    input.lgpdTemplateVersion,
    input.lgpdTemplateBody,
  );

  return {
    ...input,
    contractTemplateVersion: contract.currentVersion,
    contractTemplateBody: contract.currentBody,
    contractTemplateHistory: contract.history,
    anamneseTemplateVersion: anamnese.currentVersion,
    anamneseTemplateBody: anamnese.currentBody,
    anamneseTemplateHistory: anamnese.history,
    lgpdTemplateVersion: lgpd.currentVersion,
    lgpdTemplateBody: lgpd.currentBody,
    lgpdTemplateHistory: lgpd.history,
  };
}

export function findTemplateBody(
  history: StoredDocumentTemplate[],
  version: string | null | undefined,
): string | null {
  if (!version) return null;
  const found = history.find((item) => item.version === version);
  return found?.body ?? null;
}

export async function sha256Hex(texto: string): Promise<string> {
  const enc = new TextEncoder().encode(texto);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function buildMissingLegalFields(studio: StudioSettings): string[] {
  const required: Array<[string, string]> = [
    ["nomeEstudio", "nome comercial"],
    ["nomeEmpresarial", "razao social"],
    ["documento", "documento/CNPJ"],
    ["endereco", "endereco"],
    ["telefone", "telefone institucional"],
    ["whatsapp", "WhatsApp institucional"],
    ["email", "e-mail institucional"],
    ["lgpdEmail", "e-mail LGPD"],
    ["privacyContactChannel", "canal LGPD"],
    ["privacyResponsible", "responsavel pela privacidade"],
  ];

  return required
    .filter(([key]) => String(studio[key as keyof StudioSettings] ?? "").trim().length === 0)
    .map(([, label]) => label);
}

function renderTokenMap(context: DocumentRenderContext) {
  const acceptedDate = new Date(context.acceptedAt);
  const cityState = [context.studio.cidade, context.studio.estado].filter(Boolean).join(" - ");
  return {
    "acceptance.date": acceptedDate.toLocaleDateString("pt-BR"),
    "acceptance.time": acceptedDate.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    "acceptance.datetime": acceptedDate.toLocaleString("pt-BR"),
    "acceptance.id": context.acceptanceId,
    "acceptance.source": context.source,
    "artist.id": context.artist?.id?.trim() || "",
    "artist.nome": context.artist?.nome?.trim() || "",
    "client.cpf": context.client.cpf,
    "client.cpf_masked": maskCPF(context.client.cpf),
    "client.email": context.client.email?.trim() || "",
    "client.endereco": context.client.endereco?.trim() || "",
    "client.nome": context.client.nomeCompleto.trim(),
    "client.telefone": context.client.telefone?.trim() || "",
    "document.file_prefix": context.documents.filePrefix,
    "document.naming_pattern": context.documents.namingPattern,
    "identity.pdf_footer": context.identity.pdfFooter,
    "identity.pdf_header": context.identity.pdfHeader,
    "identity.system_name": context.identity.systemName,
    "studio.contact_channel":
      context.studio.privacyContactChannel.trim() ||
      context.studio.email.trim() ||
      context.studio.whatsapp.trim() ||
      context.studio.telefone.trim(),
    "studio.dpo_name": context.studio.dpoName.trim(),
    "studio.documento": context.studio.documento.trim(),
    "studio.email": context.studio.email.trim(),
    "studio.endereco": context.studio.endereco.trim(),
    "studio.endereco_completo": [
      context.studio.endereco.trim(),
      cityState.trim(),
      context.studio.cep.trim(),
    ]
      .filter(Boolean)
      .join(" - "),
    "studio.estado": context.studio.estado.trim(),
    "studio.lgpd_email": context.studio.lgpdEmail.trim(),
    "studio.nome_empresarial": context.studio.nomeEmpresarial.trim(),
    "studio.nome_estudio": context.studio.nomeEstudio.trim(),
    "studio.privacy_contact_channel": context.studio.privacyContactChannel.trim(),
    "studio.privacy_deadline_days": String(context.studio.privacyResponseDeadlineDays),
    "studio.privacy_responsible": context.studio.privacyResponsible.trim(),
    "studio.site": context.studio.site.trim(),
    "studio.telefone": context.studio.telefone.trim(),
    "studio.timezone": context.studio.timezone.trim(),
    "studio.whatsapp": context.studio.whatsapp.trim(),
  };
}

export function renderDocumentTemplate(template: string, context: DocumentRenderContext) {
  const map = renderTokenMap(context);
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, token: string) => {
    return map[token as keyof typeof map] ?? "";
  });
}

function assertLegalReadiness(studio: StudioSettings) {
  const missingFields = buildMissingLegalFields(studio);
  if (missingFields.length > 0) {
    throw new DocumentConfigError(missingFields);
  }
}

export function buildContractText(context: DocumentRenderContext) {
  assertLegalReadiness(context.studio);
  return renderDocumentTemplate(context.documents.contractTemplateBody, context);
}

export function buildAnamneseText(context: DocumentRenderContext) {
  assertLegalReadiness(context.studio);
  return renderDocumentTemplate(context.documents.anamneseTemplateBody, context);
}

export function buildLgpdText(context: DocumentRenderContext) {
  assertLegalReadiness(context.studio);
  return renderDocumentTemplate(context.documents.lgpdTemplateBody, context);
}

export function buildPrivacyNoticeText(studio: StudioSettings, version: string) {
  assertLegalReadiness(studio);
  return `AVISO DE PRIVACIDADE
Versao: ${version}

Controlador:
- Nome empresarial: ${studio.nomeEmpresarial}
- Nome fantasia: ${studio.nomeEstudio}
- Documento: ${studio.documento}
- Endereco: ${[studio.endereco, studio.cidade, studio.estado, studio.cep].filter(Boolean).join(" - ")}
- Canal de contato: ${studio.privacyContactChannel || studio.email || studio.whatsapp || studio.telefone}
- Canal LGPD: ${studio.lgpdEmail}
- Responsavel/encarregado: ${studio.privacyResponsible}${studio.dpoName ? ` / ${studio.dpoName}` : ""}

Direitos do titular:
- confirmar o tratamento;
- acessar, corrigir, anonimizar, bloquear ou solicitar eliminacao quando aplicavel;
- revogar autorizacoes opcionais de uso de imagem;
- solicitar informacoes sobre compartilhamentos e retencao.

Prazo interno de resposta: ${studio.privacyResponseDeadlineDays} dia(s).`;
}

export interface ConsentSnapshotPayload {
  acceptedAt: string;
  artistSnapshot: Record<string, unknown>;
  clientSnapshot: Record<string, unknown>;
  configSnapshot: Record<string, unknown>;
  documentType: string;
  renderedText: string;
  signatureSnapshot: Record<string, unknown>;
  source: string;
  templateHash: string;
  templateVersion: string;
}

export async function buildConsentSnapshotPayload(
  kind: VersionedTemplateKind,
  context: DocumentRenderContext,
  signatureSnapshot: Record<string, unknown> = {},
): Promise<ConsentSnapshotPayload> {
  const renderedText =
    kind === "contract"
      ? buildContractText(context)
      : kind === "anamnese"
        ? buildAnamneseText(context)
        : buildLgpdText(context);

  const templateBody =
    kind === "contract"
      ? context.documents.contractTemplateBody
      : kind === "anamnese"
        ? context.documents.anamneseTemplateBody
        : context.documents.lgpdTemplateBody;

  const templateVersion =
    kind === "contract"
      ? context.documents.contractTemplateVersion
      : kind === "anamnese"
        ? context.documents.anamneseTemplateVersion
        : context.documents.lgpdTemplateVersion;

  return {
    acceptedAt: context.acceptedAt,
    artistSnapshot: context.artist
      ? {
          id: context.artist.id ?? null,
          nome: context.artist.nome,
        }
      : {},
    clientSnapshot: {
      cpf: context.client.cpf,
      cpfMasked: maskCPF(context.client.cpf),
      email: context.client.email ?? null,
      endereco: context.client.endereco ?? null,
      nomeCompleto: context.client.nomeCompleto,
      telefone: context.client.telefone ?? null,
    },
    configSnapshot: {
      documents: {
        filePrefix: context.documents.filePrefix,
        namingPattern: context.documents.namingPattern,
        pdfFooter: context.documents.pdfFooter,
        pdfHeader: context.documents.pdfHeader,
        templateBody,
        templateVersion,
      },
      identity: context.identity,
      studio: context.studio,
    },
    documentType: kind,
    renderedText,
    signatureSnapshot,
    source: context.source,
    templateHash: await sha256Hex(templateBody),
    templateVersion,
  };
}
