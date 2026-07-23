import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logSecure } from "@/lib/logger";

export interface AdminAccessCheckResult {
  authenticated: boolean;
  authorized: boolean;
  user: User | null;
  error: string | null;
}

function partialUid(uid: string | null | undefined): string | null {
  if (!uid) return null;
  return `${uid.slice(0, 8)}...`;
}

function extractProjectRef(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/^https:\/\/([^.]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

function sanitizeError(error: unknown) {
  if (!error || typeof error !== "object") return { message: "unknown" };
  const candidate = error as {
    code?: string;
    message?: string;
    name?: string;
    status?: number;
    statusCode?: number;
  };
  return {
    code: candidate.code ?? null,
    message: candidate.message ?? "unknown",
    name: candidate.name ?? null,
    status: candidate.status ?? candidate.statusCode ?? null,
  };
}

function debugAdminAccess(message: string, meta?: Record<string, unknown>) {
  logSecure("debug", `[admin-access] ${message}`, meta);
}

function mapRoleErrorMessage(error: unknown): string {
  const candidate = error as { message?: string; status?: number; code?: string } | null;
  const message = candidate?.message?.toLowerCase() ?? "";
  const status = candidate?.status ?? null;
  const code = candidate?.code ?? null;

  if (status === 0 || message.includes("network") || message.includes("fetch")) {
    return "Nao foi possivel conectar ao servico de autenticacao.";
  }

  if (status === 401 || status === 403 || code === "PGRST301") {
    return "Nao foi possivel validar o acesso administrativo. Tente novamente.";
  }

  return "Nao foi possivel validar o acesso administrativo. Tente novamente.";
}

async function evaluateSession(session: Session | null): Promise<AdminAccessCheckResult> {
  const uid = session?.user?.id ?? null;

  debugAdminAccess("authenticated user resolved", {
    authenticated: Boolean(uid),
    uid: partialUid(uid),
    projectRef: extractProjectRef(import.meta.env.VITE_SUPABASE_URL),
  });

  if (!uid || !session?.user) {
    return {
      authenticated: false,
      authorized: false,
      user: null,
      error: null,
    };
  }

  debugAdminAccess("has_role called", {
    uid: partialUid(uid),
    role: "admin",
  });

  const { data, error } = await supabase.rpc("has_role", {
    _user_id: uid,
    _role: "admin",
  });

  if (error) {
    debugAdminAccess("has_role error", {
      uid: partialUid(uid),
      error: sanitizeError(error),
    });
    return {
      authenticated: true,
      authorized: false,
      user: session.user,
      error: mapRoleErrorMessage(error),
    };
  }

  const authorized = data === true;

  debugAdminAccess("has_role result", {
    uid: partialUid(uid),
    rpcExecuted: true,
    authorized,
  });

  return {
    authenticated: true,
    authorized,
    user: session.user,
    error: null,
  };
}

export async function checkAdminAccess(
  sessionOverride?: Session | null,
): Promise<AdminAccessCheckResult> {
  if (sessionOverride !== undefined) {
    return evaluateSession(sessionOverride);
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    debugAdminAccess("session unavailable", {
      authenticated: false,
      uid: partialUid(session?.user?.id),
      error: sanitizeError(error),
      projectRef: extractProjectRef(import.meta.env.VITE_SUPABASE_URL),
    });
    return {
      authenticated: false,
      authorized: false,
      user: null,
      error: "Nao foi possivel conectar ao servico de autenticacao.",
    };
  }

  return evaluateSession(session ?? null);
}
