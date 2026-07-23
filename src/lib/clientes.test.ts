import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Mock do Supabase client.
 * Mantém estado em memória de "clientes" e "storage" para simular o
 * fluxo completo de check-in (consulta → cadastro → recorrente) e travar
 * os contratos das chamadas (RPC vs from().insert(), bucket "assinaturas").
 *
 * Se uma nova migration mudar o contrato (ex.: voltar a usar upsert,
 * renomear RPC, mexer no nome do bucket), os testes falham.
 */
type StorageObj = { path: string; size: number; contentType: string };
type ClienteRow = {
  cpf: string;
  sessoes?: unknown[];
  anamnese?: unknown;
  atualizado_em?: string;
  [k: string]: unknown;
};
type RpcCall = { fn: string; args: Record<string, unknown> };
type FromCall = {
  table: string;
  op: string;
  payload?: Record<string, unknown>;
  filter?: Record<string, unknown>;
};
type StorageCall = { bucket: string; op: string; path?: string };
const state = {
  clientes: [] as ClienteRow[],
  storage: { assinaturas: [] as StorageObj[] },
  calls: {
    rpc: [] as RpcCall[],
    from: [] as FromCall[],
    storage: [] as StorageCall[],
  },
};

function resetState() {
  state.clientes = [];
  state.storage.assinaturas = [];
  state.calls.rpc = [];
  state.calls.from = [];
  state.calls.storage = [];
}

type Row = Record<string, unknown>;
interface MockBuilder {
  insert: (payload: Row) => MockBuilder;
  upsert: (payload: Row) => MockBuilder;
  update: (payload: Row) => MockBuilder;
  select: () => MockBuilder;
  eq: (col: string, val: unknown) => MockBuilder;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  then: (resolve: (v: { data: unknown; error: unknown }) => unknown) => unknown;
}

vi.mock("@/integrations/supabase/client", () => {
  const fromBuilder = (table: string): MockBuilder => {
    let pendingOp: string | null = null;
    let pendingPayload: Row | null = null;
    const filter: Record<string, unknown> = {};

    const builder: MockBuilder = {
      insert(payload) {
        pendingOp = "insert";
        pendingPayload = payload;
        state.calls.from.push({ table, op: "insert", payload });
        return builder;
      },
      upsert(payload) {
        pendingOp = "upsert";
        pendingPayload = payload;
        state.calls.from.push({ table, op: "upsert", payload });
        return builder;
      },
      update(payload) {
        pendingOp = "update";
        pendingPayload = payload;
        state.calls.from.push({ table, op: "update", payload });
        return builder;
      },
      select() {
        pendingOp = pendingOp ?? "select";
        return builder;
      },
      eq(col, val) {
        filter[col] = val;
        return builder;
      },
      maybeSingle() {
        if (table === "clientes") {
          const row = state.clientes.find((c) => c.cpf === filter.cpf) ?? null;
          return Promise.resolve({ data: row, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then(resolve) {
        if (table === "clientes" && pendingPayload) {
          const payload = pendingPayload as ClienteRow;
          if (pendingOp === "insert") {
            state.clientes.push({ ...payload });
            return resolve({ data: payload, error: null });
          }
          if (pendingOp === "upsert") {
            const idx = state.clientes.findIndex((c) => c.cpf === payload.cpf);
            if (idx >= 0) state.clientes[idx] = { ...state.clientes[idx], ...payload };
            else state.clientes.push({ ...payload });
            return resolve({ data: payload, error: null });
          }
          if (pendingOp === "update") {
            const idx = state.clientes.findIndex((c) => c.cpf === filter.cpf);
            if (idx >= 0) state.clientes[idx] = { ...state.clientes[idx], ...payload };
            return resolve({ data: state.clientes[idx] ?? null, error: null });
          }
        }
        return resolve({ data: null, error: null });
      },
    };
    return builder;
  };

  const supabase = {
    from: (table: string) => fromBuilder(table),
    rpc: (fn: string, args: Record<string, unknown>) => {
      state.calls.rpc.push({ fn, args });
      if (fn === "checkin_get_cliente") {
        const d = String(args._cpf ?? "").replace(/\D/g, "");
        const row = state.clientes.find((c) => c.cpf === d) ?? null;
        return Promise.resolve({ data: row, error: null });
      }
      if (fn === "checkin_append_sessao") {
        const d = String(args._cpf ?? "").replace(/\D/g, "");
        const row = state.clientes.find((c) => c.cpf === d);
        if (!row) {
          return Promise.resolve({
            data: null,
            error: { message: "Cliente não encontrado" },
          });
        }
        row.sessoes = [...(row.sessoes ?? []), args._sessao];
        if (args._anamnese) row.anamnese = args._anamnese;
        row.atualizado_em = new Date().toISOString();
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({
        data: null,
        error: { message: `RPC desconhecida: ${fn}` },
      });
    },
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, blob: Blob, opts?: { contentType?: string }) => {
          state.calls.storage.push({ bucket, op: "upload", path });
          if (bucket !== "assinaturas") {
            return Promise.resolve({
              data: null,
              error: { message: `Bucket inesperado: ${bucket}` },
            });
          }
          state.storage.assinaturas.push({
            path,
            size: blob.size,
            contentType: opts?.contentType ?? "application/octet-stream",
          });
          return Promise.resolve({ data: { path }, error: null });
        },
        createSignedUrl: (path: string, _expiresIn: number) => {
          state.calls.storage.push({ bucket, op: "createSignedUrl", path });
          return Promise.resolve({
            data: { signedUrl: `https://signed.example/${bucket}/${path}` },
            error: null,
          });
        },
      }),
    },
  };

  return { supabase };
});

// Importa DEPOIS do mock estar registrado
import {
  addSessao,
  calculateAgeFromBirthDate,
  clearAssinaturaUrlCache,
  getCliente,
  isValidCPF,
  isMinorBirthDate,
  maskCPF,
  onlyDigits,
  saveCliente,
  type Anamnese,
  type Cliente,
  type Sessao,
} from "@/lib/clientes";

// Helpers de fixture
const CPF_VALIDO = "529.982.247-25"; // CPF válido conhecido
const CPF_DIGITS = "52998224725";

const DATA_URL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function fakeAnamnese(): Anamnese {
  return {
    tratamentoMedico: "nao",
    alergia: "nao",
    cirurgiaRecente: "nao",
    diabetes: "nao",
    gestante: "nao",
    hipertensao: "nao",
    marcapasso: "nao",
    doencaTransmissivel: "nao",
    convulsao: "nao",
    circulatorio: "nao",
    problemaPele: "nao",
    fumante: "nao",
    tipoSanguineo: "O+",
    alimentou24h: "sim",
    drogasAlcool: "nao",
    bronzeado: "nao",
    depressaoAnsiedade: "nao",
    anemia: "nao",
    queloide: "nao",
    cardiopatia: "nao",
    hemofilia: "nao",
    hepatite: "nao",
    vitiligo: "nao",
  };
}

function fakeCliente(): Cliente {
  const now = new Date().toISOString();
  const anamnese = fakeAnamnese();
  return {
    cpf: CPF_DIGITS,
    dadosCadastrais: {
      nomeCompleto: "Cliente Teste",
      dataNascimento: "1990-01-01",
      genero: "Feminino",
      rg: "123",
      cpf: CPF_DIGITS,
      telefone: "(85) 99999-0000",
      email: "teste@example.com",
      endereco: "Rua A, 1, Fortaleza — CE",
      comoConheceu: "Indicação",
      tatuador: "Ana",
    },
    anamnese,
    assinatura: DATA_URL_PNG,
    criadoEm: now,
    atualizadoEm: now,
    sessoes: [{ data: now, assinatura: DATA_URL_PNG, anamnese }],
    status: "aguardando",
  };
}

beforeEach(() => {
  resetState();
  clearAssinaturaUrlCache();
});

describe("validação de CPF e máscaras", () => {
  it("aceita CPF válido e rejeita inválido", () => {
    expect(isValidCPF(CPF_VALIDO)).toBe(true);
    expect(isValidCPF("111.111.111-11")).toBe(false);
    expect(isValidCPF("123")).toBe(false);
  });

  it("normaliza dígitos e aplica máscara", () => {
    expect(onlyDigits(CPF_VALIDO)).toBe(CPF_DIGITS);
    expect(maskCPF(CPF_DIGITS)).toBe(CPF_VALIDO);
  });

  it("calcula idade e identifica menoridade", () => {
    expect(calculateAgeFromBirthDate("2010-07-18", new Date("2026-07-18T12:00:00Z"))).toBe(16);
    expect(isMinorBirthDate("2010-07-18", 18)).toBe(true);
    expect(isMinorBirthDate("1990-01-01", 18)).toBe(false);
  });
});

describe("fluxo de check-in: novo cliente (primeiro cadastro)", () => {
  it("consulta retorna null via RPC checkin_get_cliente", async () => {
    const c = await getCliente(CPF_VALIDO);
    expect(c).toBeNull();
    expect(state.calls.rpc).toEqual([{ fn: "checkin_get_cliente", args: { _cpf: CPF_DIGITS } }]);
  });

  it("saveCliente sobe assinaturas e faz INSERT (não upsert)", async () => {
    await saveCliente(fakeCliente());

    // Storage: assinatura principal + 1 da sessão = 2 uploads no bucket correto
    const uploads = state.calls.storage.filter((s) => s.op === "upload");
    expect(uploads).toHaveLength(2);
    expect(uploads.every((u) => u.bucket === "assinaturas")).toBe(true);
    expect(state.storage.assinaturas.every((o) => o.contentType === "image/png")).toBe(true);

    // DB: usa insert, nunca upsert/update (RLS pública só libera INSERT pra anon)
    const dbOps = state.calls.from.filter((c) => c.table === "clientes");
    expect(dbOps).toHaveLength(1);
    expect(dbOps[0].op).toBe("insert");
    expect(state.calls.from.some((c) => c.op === "upsert")).toBe(false);
    expect(state.calls.from.some((c) => c.op === "update")).toBe(false);

    // Payload: cpf só dígitos, status seguro, assinatura é path (não dataURL)
    const payload = dbOps[0].payload as {
      cpf: string;
      status: string;
      assinatura: string;
      sessoes: { assinatura: string }[];
    };
    expect(payload.cpf).toBe(CPF_DIGITS);
    expect(payload.status).toBe("aguardando");
    expect(payload.assinatura).not.toMatch(/^data:/);
    expect(payload.assinatura.startsWith(`${CPF_DIGITS}/`)).toBe(true);
    expect(payload.sessoes[0].assinatura.startsWith(`${CPF_DIGITS}/`)).toBe(true);
  });

  it("marca cadastro de menor como pendente de responsavel", async () => {
    const cliente = fakeCliente();
    cliente.dadosCadastrais.dataNascimento = "2010-07-18";

    await saveCliente(cliente);

    const payload = state.calls.from.find((c) => c.table === "clientes")?.payload as {
      status: string;
      dados_cadastrais: { faixaEtaria?: string; guardianValidationStatus?: string };
    };
    expect(payload.status).toBe("pendente_responsavel");
    expect(payload.dados_cadastrais.faixaEtaria).toBe("menor");
    expect(payload.dados_cadastrais.guardianValidationStatus).toBe("pending");
  });
});

describe("fluxo de check-in: cliente recorrente", () => {
  it("após cadastro, getCliente devolve apenas dados mínimos via RPC (sem PII)", async () => {
    await saveCliente(fakeCliente());
    const found = await getCliente(CPF_VALIDO);
    expect(found).not.toBeNull();
    expect(found?.cpf).toBe(CPF_DIGITS);
    expect(found?.nomeCompleto).toBe("Cliente Teste");
    // ClientePublico NÃO expõe dados sensíveis para o kiosk anônimo:
    const extra = found as unknown as Record<string, unknown>;
    expect(extra.anamnese).toBeUndefined();
    expect(extra.dadosCadastrais).toBeUndefined();
    expect(extra.sessoes).toBeUndefined();
  });

  it("addSessao sobe nova assinatura e chama RPC checkin_append_sessao", async () => {
    await saveCliente(fakeCliente());

    const nova: Sessao = {
      data: new Date().toISOString(),
      assinatura: DATA_URL_PNG,
      anamnese: fakeAnamnese(),
    };
    await addSessao(CPF_VALIDO, nova);

    // Upload da nova assinatura
    const uploads = state.calls.storage.filter((s) => s.op === "upload");
    expect(uploads.length).toBeGreaterThanOrEqual(3); // 2 do save + 1 da sessão

    // RPC correta com cpf normalizado e path (não dataURL)
    const rpc = state.calls.rpc.find((r) => r.fn === "checkin_append_sessao");
    expect(rpc).toBeDefined();
    expect(rpc!.args._cpf).toBe(CPF_DIGITS);
    const sessaoArg = rpc!.args._sessao as { assinatura: string };
    expect(sessaoArg.assinatura.startsWith(`${CPF_DIGITS}/`)).toBe(true);

    // Nenhum UPDATE direto na tabela (anon não pode)
    expect(state.calls.from.some((c) => c.table === "clientes" && c.op === "update")).toBe(false);

    // E o cliente continua acessível via RPC mínima
    const found = await getCliente(CPF_VALIDO);
    expect(found).not.toBeNull();
    expect(found?.nomeCompleto).toBe("Cliente Teste");
  });

  it("addSessao propaga erro quando a RPC falha (cliente inexistente)", async () => {
    await expect(
      addSessao(CPF_VALIDO, {
        data: new Date().toISOString(),
        assinatura: DATA_URL_PNG,
        anamnese: fakeAnamnese(),
      }),
    ).rejects.toMatchObject({ message: "Cliente não encontrado" });
  });
});
