import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc,
  },
}));

import { hashTexto, registrarConsentimento } from "@/lib/lgpd-consent";

describe("lgpd-consent", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it("envia rendered_text e snapshots completos para a RPC", async () => {
    await registrarConsentimento({
      cpf: "529.982.247-25",
      tipo: "termo",
      texto: "TEXTO FINAL ACEITO",
      versao: "2026-07-termo-v3",
      documentType: "contract",
      templateVersion: "2026-07-termo-v3",
      templateHash: "hash-template",
      renderedText: "TEXTO FINAL ACEITO",
      configSnapshot: { studio: { nomeEstudio: "Studio Snapshot" } },
      clientSnapshot: { cpf: "52998224725", nomeCompleto: "Cliente Snapshot" },
      artistSnapshot: { id: "artista-real", nome: "Artista Real" },
      acceptedAt: "2026-07-20T12:30:00.000Z",
      signatureSnapshot: { storagePath: "assinaturas/52998224725/acc.png" },
      source: "sessao_recorrente",
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(fn).toBe("registrar_consentimento");
    expect(args._rendered_text).toBe("TEXTO FINAL ACEITO");
    expect(args._config_snapshot).toMatchObject({
      studio: { nomeEstudio: "Studio Snapshot" },
    });
    expect(args._client_snapshot).toMatchObject({
      cpf: "52998224725",
      nomeCompleto: "Cliente Snapshot",
    });
    expect(args._artist_snapshot).toMatchObject({
      id: "artista-real",
      nome: "Artista Real",
    });
    expect(args._source).toBe("sessao_recorrente");
    expect(args._texto_hash).toBe(await hashTexto("TEXTO FINAL ACEITO"));
  });
});
