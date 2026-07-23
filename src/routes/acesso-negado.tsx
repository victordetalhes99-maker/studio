import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AcessoNegadoPage() {
  return (
    <div className="admin-shell flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-background/60 p-6 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-amber-400" />
        <h1 className="mt-3 text-lg font-semibold text-foreground">Acesso negado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Você não possui permissão para acessar essa área.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/">Ir para recepção</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/admin-login">Entrar como admin</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
