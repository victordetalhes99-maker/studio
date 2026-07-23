import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSession, mockRpc } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
    rpc: mockRpc,
  },
}));

import { checkAdminAccess } from "./adminAccess";

const session = {
  access_token: "token",
  refresh_token: "refresh",
  expires_in: 3600,
  expires_at: 9999999999,
  token_type: "bearer",
  user: {
    id: "d65e5b1d-5224-478b-aeba-5dbdef96466d",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-07-18T00:00:00.000Z",
  },
};

describe("adminAccess", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRpc.mockReset();
  });

  it("bloqueia usuario sem sessao", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(checkAdminAccess()).resolves.toMatchObject({
      authenticated: false,
      authorized: false,
      user: null,
      error: null,
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("usa session.user.id e rpc has_role com role admin", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });

    await expect(
      checkAdminAccess(session as Parameters<typeof checkAdminAccess>[0]),
    ).resolves.toMatchObject({
      authenticated: true,
      authorized: true,
      error: null,
    });

    expect(mockRpc).toHaveBeenCalledWith("has_role", {
      _user_id: "d65e5b1d-5224-478b-aeba-5dbdef96466d",
      _role: "admin",
    });
  });

  it("nao libera acesso quando o rpc retorna false", async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });

    await expect(
      checkAdminAccess(session as Parameters<typeof checkAdminAccess>[0]),
    ).resolves.toMatchObject({
      authenticated: true,
      authorized: false,
      error: null,
    });
  });

  it("nao libera acesso quando o rpc retorna null", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await expect(
      checkAdminAccess(session as Parameters<typeof checkAdminAccess>[0]),
    ).resolves.toMatchObject({
      authenticated: true,
      authorized: false,
      error: null,
    });
  });

  it("nao libera acesso quando o rpc falha", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });

    await expect(
      checkAdminAccess(session as Parameters<typeof checkAdminAccess>[0]),
    ).resolves.toMatchObject({
      authenticated: true,
      authorized: false,
      error: "Nao foi possivel validar o acesso administrativo. Tente novamente.",
    });
  });

  it("sessao expirada nao libera acesso", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: { message: "session expired" },
    });

    await expect(checkAdminAccess()).resolves.toMatchObject({
      authenticated: false,
      authorized: false,
      error: "Nao foi possivel conectar ao servico de autenticacao.",
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
