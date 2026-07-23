import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ContratoDetalhe } from "@/lib/contratos";
import { resolveContratoExportData } from "@/lib/contratos/export";

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  storage: { from: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: supabaseMock,
}));

function createContrato(overrides: Partial<ContratoDetalhe> = {}): ContratoDetalhe {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    cpf: "52998224725",
    cpfMasked: "529.982.***-25",
    clienteNome: "Cliente Snapshot",
    clienteIniciais: "CS",
    tatuador: "Artista Real",
    tatuadorId: "artista-real",
    templateId: "termo-atendimento",
    versao: "2026-07-termo-v3",
    status: "signed",
    aceitoEm: "2026-07-20T12:30:00.000Z",
    assinadoEm: "2026-07-20T12:30:00.000Z",
    temAssinatura: true,
    temPdf: true,
    fichaId: "52998224725:v0",
    origem: "primeira_visita",
    atualizadoEm: "2026-07-20T12:30:00.000Z",
    hasSnapshot: true,
    legacyNotice: null,
    studioDisplayName: "Studio Snapshot",
    documentLabel: "Termo de atendimento e responsabilidade",
    filePrefix: "studio-snapshot",
    cliente: {
      cpf: "52998224725",
      cpfMasked: "529.982.***-25",
      nomeCompleto: "Cliente Snapshot",
      iniciais: "CS",
      documento: "529.982.247-25",
      telefone: "(85) 99999-0000",
      email: "cliente@example.com",
      endereco: "Rua Teste, 1",
    },
    tatuadorSnapshot: {
      id: "artista-real",
      displayName: "Artista Real",
    },
    assinaturaPath: "assinaturas/52998224725/acc.png",
    textoHash: "",
    templateHash: "template-hash",
    hashAlgoritmo: "SHA-256",
    renderedText: "TEXTO SALVO NO SNAPSHOT",
    renderedHtml: null,
    studioCompanyName: "Studio Snapshot LTDA",
    pdfHeader: "Studio Snapshot",
    pdfFooter: "Documento controlado pelo painel administrativo.",
    configSnapshot: { studio: { nomeEstudio: "Studio Snapshot" } },
    clientSnapshotRaw: { cpf: "52998224725" },
    artistSnapshotRaw: { nome: "Artista Real" },
    signatureSnapshot: { storagePath: "assinaturas/52998224725/acc.png" },
    aceite: {
      userAgent: "Vitest",
      ip: "127.0.0.1",
      device: null,
      versao: "2026-07-termo-v3",
      acceptedAt: "2026-07-20T12:30:00.000Z",
      acceptedBy: null,
      source: "sessao_recorrente",
    },
    historico: [],
    outrosContratos: [],
    ...overrides,
  };
}

describe("contratos export", () => {
  it("usa o snapshot salvo e o branding persistido na exportação", async () => {
    const contrato = createContrato();
    const cryptoHash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(contrato.renderedText || ""),
    );
    contrato.textoHash = Array.from(new Uint8Array(cryptoHash))
      .map((item) => item.toString(16).padStart(2, "0"))
      .join("");

    const data = await resolveContratoExportData(contrato);
    expect(data.displayText).toBe("TEXTO SALVO NO SNAPSHOT");
    expect(data.studioDisplayName).toBe("Studio Snapshot");
    expect(data.filePrefix).toBe("studio-snapshot");
    expect(data.isLegacy).toBe(false);
    expect(data.integrityStatus).toBe("íntegro");
  });

  it("identifica registros legados sem inventar snapshot retroativo", async () => {
    const data = await resolveContratoExportData(
      createContrato({
        hasSnapshot: false,
        legacyNotice: "Documento legado sem snapshot integral",
        renderedText: null,
        textoHash: null,
      }),
    );

    expect(data.isLegacy).toBe(true);
    expect(data.legacyNotice).toBe("Documento legado sem snapshot integral");
    expect(data.displayText).toContain("Documento legado sem snapshot integral");
  });

  it("remove branding hardcoded do exportador de contratos", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "lib", "contratos", "export.ts"),
      "utf8",
    );
    expect(source).not.toContain("85 TATTOO");
  });
});
