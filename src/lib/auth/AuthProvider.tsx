import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { checkAdminAccess } from "./adminAccess";

export type AuthStatus = "loading" | "unauthenticated" | "authenticated";

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  email: string | null;
  userId: string | null;
  authLoading: boolean;
  adminLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean | null;
  authError: string | null;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [adminLoading, setAdminLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const validationTokenRef = useRef(0);

  const validateAdmin = useCallback(async (nextSession: Session | null) => {
    const currentValidation = ++validationTokenRef.current;

    if (!nextSession?.user?.id) {
      setIsAdmin(false);
      setAdminLoading(false);
      setAuthError(null);
      return;
    }

    setAdminLoading(true);
    setIsAdmin(null);
    setAuthError(null);

    try {
      const result = await checkAdminAccess(nextSession);
      if (validationTokenRef.current !== currentValidation) return;
      setIsAdmin(result.authorized);
      setAuthError(result.error);
    } catch {
      if (validationTokenRef.current !== currentValidation) return;
      setIsAdmin(false);
      setAuthError("Nao foi possivel validar o acesso administrativo. Tente novamente.");
    } finally {
      if (validationTokenRef.current === currentValidation) {
        setAdminLoading(false);
      }
    }
  }, []);

  const applySession = useCallback(
    (nextSession: Session | null) => {
      setSession(nextSession);
      setAuthLoading(false);

      if (!nextSession?.user?.id) {
        validationTokenRef.current += 1;
        setAdminLoading(false);
        setIsAdmin(false);
        setAuthError(null);
        return;
      }

      void validateAdmin(nextSession);
    },
    [validateAdmin],
  );

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      applySession(nextSession);
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setSession(null);
        setAuthLoading(false);
        setAdminLoading(false);
        setIsAdmin(false);
        setAuthError("Nao foi possivel conectar ao servico de autenticacao.");
        return;
      }
      applySession(data.session);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const value = useMemo<AuthState>(() => {
    const isAuthenticated = Boolean(session?.user);
    const status: AuthStatus = authLoading
      ? "loading"
      : isAuthenticated
        ? "authenticated"
        : "unauthenticated";

    return {
      status,
      session,
      user: session?.user ?? null,
      email: session?.user?.email ?? null,
      userId: session?.user?.id ?? null,
      authLoading,
      adminLoading,
      isAuthenticated,
      isAdmin,
      authError,
      signOut: async () => {
        validationTokenRef.current += 1;
        await supabase.auth.signOut();
        setSession(null);
        setAuthLoading(false);
        setAdminLoading(false);
        setIsAdmin(false);
        setAuthError(null);
      },
      refreshRole: async () => {
        await validateAdmin(session);
      },
    };
  }, [session, authLoading, adminLoading, isAdmin, authError, validateAdmin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
