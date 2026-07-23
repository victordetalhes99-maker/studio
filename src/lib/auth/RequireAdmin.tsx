import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "./AuthProvider";

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-background/60 p-6 text-center backdrop-blur">
        {children}
      </div>
    </div>
  );
}

export default function RequireAdmin() {
  const { authLoading, status, isAdmin, adminLoading } = useAuth();
  const location = useLocation();

  if (authLoading || status === "loading") {
    return (
      <FullScreen>
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-[color:var(--gold)]" />
        <p className="mt-3 text-sm text-muted-foreground">Verificando sessao...</p>
      </FullScreen>
    );
  }

  if (status === "unauthenticated") {
    const next = location.pathname + location.search;
    return <Navigate to={`/admin-login?next=${encodeURIComponent(next)}`} replace />;
  }

  if (adminLoading) {
    return (
      <FullScreen>
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-[color:var(--gold)]" />
        <p className="mt-3 text-sm text-muted-foreground">Carregando permissoes...</p>
      </FullScreen>
    );
  }

  if (isAdmin !== true) {
    return <Navigate to="/acesso-negado" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
