import { describe, expect, it, vi } from "vitest";
import { sha256Hex, stripForbiddenFields, utf8ByteLength } from "@/lib/backup/export-utils";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

describe("stripForbiddenFields", () => {
  it("remove colunas de segredo (tokens, service_role, api keys)", () => {
    const row = {
      id: "1",
      email: "cliente@example.com",
      refresh_token: "abc123",
      access_token: "xyz",
      service_role_key: "super-secret",
      api_key: "key-1",
      encryption_key: "k",
    };
    const clean = stripForbiddenFields(row, "clientes");
    expect(clean).toEqual({ id: "1", email: "cliente@example.com" });
  });

  it("preserva dados pessoais legitimos (cpf, email, telefone)", () => {
    const row = { id: "1", cpf: "52998224725", email: "a@b.com", telefone: "119999999" };
    expect(stripForbiddenFields(row, "clientes")).toEqual(row);
  });

  it("redige o valor de app_config quando a chave parece um segredo", () => {
    const row = { key: "cron_token", value: "abc123", atualizado_em: "2026-01-01" };
    const clean = stripForbiddenFields(row, "app_config");
    expect(clean.value).toBe("[REDACTED]");
    expect(clean.key).toBe("cron_token");
  });

  it("mantem valores normais de app_config intactos", () => {
    const row = { key: "studio_name", value: "85 TATTOO", atualizado_em: "2026-01-01" };
    expect(stripForbiddenFields(row, "app_config").value).toBe("85 TATTOO");
  });
});

describe("utf8ByteLength", () => {
  it("calcula bytes corretamente para texto com acentos", () => {
    expect(utf8ByteLength("a")).toBe(1);
    expect(utf8ByteLength("á")).toBe(2); // UTF-8: 2 bytes
  });
});

describe("sha256Hex", () => {
  it("gera hash SHA-256 hexadecimal estavel", async () => {
    const hash = await sha256Hex("85 TATTOO");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    const hash2 = await sha256Hex("85 TATTOO");
    expect(hash).toBe(hash2);
  });

  it("gera hashes diferentes para conteudos diferentes", async () => {
    const a = await sha256Hex("a");
    const b = await sha256Hex("b");
    expect(a).not.toBe(b);
  });
});
