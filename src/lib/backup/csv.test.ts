import { describe, expect, it, vi } from "vitest";
import { toCsv } from "@/lib/backup/csv";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

describe("toCsv", () => {
  it("retorna string vazia para lista vazia", () => {
    expect(toCsv([])).toBe("");
  });

  it("gera cabecalho a partir da uniao de colunas de todas as linhas", () => {
    const csv = toCsv([
      { a: 1, b: 2 },
      { a: 3, c: 4 },
    ]);
    const [header] = csv.split("\r\n");
    expect(header.split(",")).toEqual(["a", "b", "c"]);
  });

  it("escapa celulas com virgula, aspas e quebra de linha (RFC 4180)", () => {
    const csv = toCsv([{ nome: 'Estúdio "85", Tattoo', obs: "linha1\nlinha2" }]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toContain('"Estúdio ""85"", Tattoo"');
    expect(lines[1]).toContain('"linha1\nlinha2"');
  });

  it("preserva acentuacao sem escapar (sem virgula/aspas/quebra)", () => {
    const csv = toCsv([{ nome: "José da Conceição" }]);
    expect(csv).toContain("José da Conceição");
  });

  it("trata null e undefined como celula vazia", () => {
    const csv = toCsv([{ a: null, b: undefined, c: 0 }]);
    const [, row] = csv.split("\r\n");
    expect(row).toBe(",,0");
  });
});
