import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  applyLegalFallbacks,
  buildConsentSnapshotPayload,
  buildContractText,
  buildMissingLegalFields,
  type DocumentRenderContext,
} from "@/lib/document-templates";
import { DEFAULT_IDENTITY, DEFAULT_DOCUMENT_SETTINGS } from "@/lib/settings/admin-config";
import { DEFAULT_STUDIO, type StudioSettings } from "@/lib/settings";

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  storage: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: supabaseMock,
}));

function createStudio(overrides: Partial<StudioSettings> = {}): StudioSettings {
  return {
    ...DEFAULT_STUDIO,
    nomeEstudio: "Studio Snapshot",
    nomeEmpresarial: "Studio Snapshot LTDA",
    documento: "12.345.678/0001-90",
    telefone: "(85) 3333-4444",
    whatsapp: "(85) 99999-0000",
    email: "contato@studiosnapshot.com",
    site: "https://studiosnapshot.com",
    endereco: "Rua das Agulhas, 85",
    cidade: "Fortaleza",
    estado: "CE",
    cep: "60000-000",
    lgpdEmail: "privacidade@studiosnapshot.com",
    privacyContactChannel: "privacidade@studiosnapshot.com",
    privacyResponsible: "Carla Privacidade",
    dpoName: "Carla DPO",
    privacyResponseDeadlineDays: 15,
    productionChecklistCompleted: true,
    ...overrides,
  };
}

function createContext(overrides: Partial<DocumentRenderContext> = {}): DocumentRenderContext {
  return {
    studio: createStudio(),
    identity: {
      ...DEFAULT_IDENTITY,
      systemName: "Studio Snapshot Admin",
      pdfHeader: "Studio Snapshot",
      pdfFooter: "Documento controlado pelo painel administrativo.",
    },
    documents: DEFAULT_DOCUMENT_SETTINGS,
    client: {
      cpf: "52998224725",
      nomeCompleto: "Cliente Snapshot",
      email: "cliente@example.com",
      telefone: "(85) 98888-7777",
      endereco: "Rua Teste, 1",
    },
    artist: {
      id: "artista-real",
      nome: "Artista Real",
    },
    acceptanceId: "acc-20260720-001",
    acceptedAt: "2026-07-20T12:30:00.000Z",
    source: "cadastro_padrao",
    ...overrides,
  };
}

describe("document-templates", () => {
  it("usa dados reais do estúdio e do tatuador no termo novo", () => {
    const text = buildContractText(createContext());
    expect(text).toContain("Studio Snapshot");
    expect(text).toContain("Studio Snapshot LTDA");
    expect(text).toContain("12.345.678/0001-90");
    expect(text).toContain("Artista Real");
    expect(text).toContain("Cliente Snapshot");
    expect(text).toContain("acc-20260720-001");
  });

  it("applyLegalFallbacks preenche apenas os campos vazios, preservando os reais", () => {
    const studio = createStudio({ documento: "", telefone: "" });
    const result = applyLegalFallbacks(studio);
    expect(result.documento).toBe("Dados institucionais ainda nao cadastrados");
    expect(result.telefone).toBe("Dados institucionais ainda nao cadastrados");
    // Campos ja preenchidos nao sao tocados:
    expect(result.nomeEmpresarial).toBe("Studio Snapshot LTDA");
    expect(result.email).toBe("contato@studiosnapshot.com");
  });

  it("applyLegalFallbacks usa nome comercial padrao quando nomeEstudio esta vazio", () => {
    const result = applyLegalFallbacks(createStudio({ nomeEstudio: "" }));
    expect(result.nomeEstudio).toBe("85 TATTOO Studio");
  });

  it("buildMissingLegalFields continua reportando os campos ausentes (uso administrativo)", () => {
    const missing = buildMissingLegalFields(createStudio({ documento: "", lgpdEmail: "" }));
    expect(missing).toContain("documento/CNPJ");
    expect(missing).toContain("e-mail LGPD");
    expect(missing).toHaveLength(2);
  });

  it("nunca bloqueia: usa fallback explicito quando faltam campos juridicos obrigatorios", () => {
    const text = buildContractText(
      createContext({
        studio: createStudio({
          nomeEmpresarial: "",
          documento: "",
          lgpdEmail: "",
        }),
      }),
    );
    // Nao lanca DocumentConfigError, e o documento e gerado mesmo assim.
    expect(text).toContain("Dados institucionais ainda nao cadastrados");
    // Campos preenchidos continuam usando o dado real, nao o fallback.
    expect(text).toContain("Artista Real");
    expect(text).toContain("Cliente Snapshot");
    // Nunca inventa CNPJ/endereco/telefone reais no lugar do fallback.
    expect(text).not.toContain("00.000.000/0000-00");
  });

  it("gera snapshot integral e permanece imutável após mudança posterior de configuração", async () => {
    const originalContext = createContext();
    const payload = await buildConsentSnapshotPayload("contract", originalContext, {
      storagePath: "assinaturas/52998224725/acc.png",
      present: true,
    });

    expect(payload.renderedText).toContain("Studio Snapshot");
    expect(payload.configSnapshot.documents).toMatchObject({
      templateVersion: originalContext.documents.contractTemplateVersion,
    });
    expect(payload.clientSnapshot).toMatchObject({
      cpf: "52998224725",
      nomeCompleto: "Cliente Snapshot",
    });
    expect(payload.artistSnapshot).toMatchObject({
      id: "artista-real",
      nome: "Artista Real",
    });

    const updatedContext = createContext({
      studio: createStudio({ nomeEstudio: "Studio Atualizado" }),
      documents: {
        ...DEFAULT_DOCUMENT_SETTINGS,
        contractTemplateVersion: "2026-07-termo-v99",
        contractTemplateBody: "MODELO NOVO {{studio.nome_estudio}}",
      },
    });

    const updatedPayload = await buildConsentSnapshotPayload("contract", updatedContext, {
      storagePath: "assinaturas/52998224725/acc.png",
      present: true,
    });

    expect(payload.renderedText).toContain("Studio Snapshot");
    expect(payload.renderedText).not.toEqual(updatedPayload.renderedText);
    expect(payload.templateVersion).toBe("2026-07-termo-v3");
    expect(updatedPayload.templateVersion).toBe("2026-07-termo-v99");
  });

  it("não mantém lista fixa de tatuadores no módulo de termo", () => {
    const source = readFileSync(join(process.cwd(), "src", "lib", "termo.ts"), "utf8");
    expect(source).not.toContain("TATUADORES");
  });
});
