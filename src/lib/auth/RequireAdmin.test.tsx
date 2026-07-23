import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./AuthProvider";
import RequireAdmin from "./RequireAdmin";

const { mockGetSession, mockOnAuthStateChange, mockRpc, mockSignOut } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockRpc: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
    },
    rpc: mockRpc,
  },
}));

const adminSession = {
  access_token: "token",
  refresh_token: "refresh",
  expires_in: 3600,
  expires_at: 9999999999,
  token_type: "bearer",
  user: {
    id: "d65e5b1d-5224-478b-aeba-5dbdef96466d",
    email: "tattoo85house@gmail.com",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-07-18T00:00:00.000Z",
  },
};

function renderGuard(initialPath = "/admin") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/admin-login" element={<div>login</div>} />
          <Route path="/acesso-negado" element={<div>negado</div>} />
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<div>painel</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("RequireAdmin", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockOnAuthStateChange.mockReset();
    mockRpc.mockReset();
    mockSignOut.mockReset();
    mockOnAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });
  });

  it("usuario sem sessao nao entra", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    renderGuard();

    await waitFor(() => {
      expect(screen.getByText("login")).toBeInTheDocument();
    });
    expect(screen.queryByText("painel")).not.toBeInTheDocument();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("usuario com role recepcao nao entra", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: adminSession },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: false, error: null });

    renderGuard();

    await waitFor(() => {
      expect(screen.getByText("negado")).toBeInTheDocument();
    });
    expect(screen.queryByText("painel")).not.toBeInTheDocument();
  });

  it("usuario com role gerente nao entra", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: adminSession },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: false, error: null });

    renderGuard();

    await waitFor(() => {
      expect(screen.getByText("negado")).toBeInTheDocument();
    });
    expect(screen.queryByText("painel")).not.toBeInTheDocument();
  });

  it("usuario com role admin entra", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: adminSession },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: true, error: null });

    renderGuard();

    await waitFor(() => {
      expect(screen.getByText("painel")).toBeInTheDocument();
    });
    expect(screen.queryByText("negado")).not.toBeInTheDocument();
  });

  it("erro no rpc nao libera acesso", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: adminSession },
      error: null,
    });
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });

    renderGuard();

    await waitFor(() => {
      expect(screen.getByText("negado")).toBeInTheDocument();
    });
    expect(screen.queryByText("painel")).not.toBeInTheDocument();
  });

  it("rota /admin com F5 continua funcionando", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: adminSession },
      error: null,
    });
    mockRpc.mockResolvedValue({ data: true, error: null });

    renderGuard("/admin");

    await waitFor(() => {
      expect(screen.getByText("painel")).toBeInTheDocument();
    });
    expect(mockRpc).toHaveBeenCalledWith("has_role", {
      _user_id: "d65e5b1d-5224-478b-aeba-5dbdef96466d",
      _role: "admin",
    });
  });
});
