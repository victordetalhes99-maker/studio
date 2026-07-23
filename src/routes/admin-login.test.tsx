import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminLoginPage from "./admin-login";

const { mockSignInWithPassword, mockSignOut, mockRpc, mockUseAuth, mockToastSuccess, mockFrom } =
  vi.hoisted(() => ({
    mockSignInWithPassword: vi.fn(),
    mockSignOut: vi.fn(),
    mockRpc: vi.fn(),
    mockUseAuth: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockFrom: vi.fn(),
  }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
    rpc: mockRpc,
    from: mockFrom,
  },
}));

vi.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
  },
}));

function renderLogin(initialPath = "/admin-login") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin-login" element={<AdminLoginPage />} />
        <Route path="/admin/*" element={<div>painel</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const adminUser = {
  id: "d65e5b1d-5224-478b-aeba-5dbdef96466d",
  email: "tattoo85house@gmail.com",
};

const session = {
  access_token: "token",
  refresh_token: "refresh",
  expires_in: 3600,
  expires_at: 9999999999,
  token_type: "bearer",
  user: adminUser,
};

describe("AdminLoginPage", () => {
  beforeEach(() => {
    mockSignInWithPassword.mockReset();
    mockSignOut.mockReset();
    mockRpc.mockReset();
    mockUseAuth.mockReset();
    mockToastSuccess.mockReset();
    mockFrom.mockReset();

    mockUseAuth.mockReturnValue({
      authLoading: false,
      status: "unauthenticated",
      isAdmin: false,
      adminLoading: false,
    });

    mockRpc.mockImplementation((fn: string) => {
      if (fn === "check_login_lockout") {
        return Promise.resolve({ data: { locked: false }, error: null });
      }
      if (fn === "record_login_attempt") {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  it("credencial invalida nao cria acesso e nao consulta role", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "invalid login credentials" },
    });

    renderLogin();

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-errada" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(screen.getByText("E-mail ou senha incorretos.")).toBeInTheDocument();
    });

    expect(mockRpc).not.toHaveBeenCalledWith(
      "has_role",
      expect.objectContaining({ _role: "admin" }),
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("usa o user id retornado pelo signIn para validar a role admin", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: adminUser, session },
      error: null,
    });
    mockRpc.mockImplementation((fn: string, args?: unknown) => {
      if (fn === "check_login_lockout") {
        return Promise.resolve({ data: { locked: false }, error: null });
      }
      if (fn === "record_login_attempt") {
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === "has_role") {
        expect(args).toEqual({
          _user_id: "d65e5b1d-5224-478b-aeba-5dbdef96466d",
          _role: "admin",
        });
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    renderLogin();

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "tattoo85house@gmail.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-correta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(screen.getByText("painel")).toBeInTheDocument();
    });
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it("next valido redireciona corretamente", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: adminUser, session },
      error: null,
    });
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "check_login_lockout") {
        return Promise.resolve({ data: { locked: false }, error: null });
      }
      if (fn === "record_login_attempt") {
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === "has_role") {
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    renderLogin("/admin-login?next=%2Fadmin%2Fclientes");

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "tattoo85house@gmail.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-correta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(screen.getByText("painel")).toBeInTheDocument();
    });
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it("erro da rpc has_role encerra a sessao e mostra erro especifico", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: adminUser, session },
      error: null,
    });
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "check_login_lockout") {
        return Promise.resolve({ data: { locked: false }, error: null });
      }
      if (fn === "record_login_attempt") {
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === "has_role") {
        return Promise.resolve({
          data: null,
          error: { message: "permission denied for function has_role", code: "42501" },
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    renderLogin();

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "tattoo85house@gmail.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-correta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(
        screen.getByText("Nao foi possivel validar o acesso administrativo."),
      ).toBeInTheDocument();
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("usuario sem role admin encerra a sessao e nao entra", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: adminUser, session },
      error: null,
    });
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "check_login_lockout") {
        return Promise.resolve({ data: { locked: false }, error: null });
      }
      if (fn === "record_login_attempt") {
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === "has_role") {
        return Promise.resolve({ data: false, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    renderLogin();

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "tattoo85house@gmail.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "senha-correta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(
        screen.getByText("Este usuario nao possui acesso administrativo."),
      ).toBeInTheDocument();
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
