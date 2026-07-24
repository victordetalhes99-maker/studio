import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function safeNext(raw: string | null): string {
  if (!raw) return "/admin";
  try {
    const decoded = decodeURIComponent(raw);
    if (
      decoded.startsWith("/admin") &&
      !decoded.startsWith("//") &&
      !decoded.includes("://") &&
      !decoded.toLowerCase().startsWith("javascript:")
    ) {
      return decoded;
    }
  } catch {
    /* ignore */
  }
  return "/admin";
}

export default function AdminLoginPage() {
  const { authLoading, status, isAdmin, adminLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const search = new URLSearchParams(location.search);
  const next = safeNext(search.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Entrar - 85 TATTOO Admin";
  }, []);

  if (!authLoading && status === "authenticated" && !adminLoading && isAdmin === true) {
    return <Navigate to={next} replace />;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    setError(null);

    // Rede de seguranca: em alguns navegadores/gerenciadores de senha, o
    // autofill escreve no DOM sem disparar o evento "input" que o React
    // escuta, deixando o estado controlado (useState) vazio mesmo com o
    // campo visualmente preenchido. Por isso lemos o valor tambem via
    // FormData diretamente do <form> no momento do submit e usamos o que
    // nao estiver vazio.
    const formData = new FormData(e.currentTarget);
    const domEmail = (formData.get("email") as string) ?? "";
    const domPassword = (formData.get("password") as string) ?? "";

    const resolvedEmail = email || domEmail;
    const resolvedPassword = password || domPassword;
    const cleanEmail = resolvedEmail.trim().toLowerCase();

    if (!cleanEmail || !resolvedPassword) {
      setError("Informe e-mail e senha.");
      return;
    }

    setSubmitting(true);

    try {
      const { data: lock, error: lockError } = await supabase.rpc("check_login_lockout", {
        _email: cleanEmail,
        _ip: "",
      });

      if (lockError) {
        console.warn("Login lockout check failed:", lockError);
      }

      const locked = (lock as { locked?: boolean } | null)?.locked;

      if (locked) {
        setError("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
        return;
      }

      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: resolvedPassword,
      });

      const { error: recordError } = await supabase.rpc("record_login_attempt", {
        _email: cleanEmail,
        _ip: "",
        _success: !signInErr,
        _user_agent: navigator.userAgent.slice(0, 512),
      });

      if (recordError) {
        console.warn("Login attempt audit failed:", recordError);
      }

      if (signInErr || !signInData?.user?.id || !signInData.session) {
        setError("E-mail ou senha incorretos.");
        setPassword("");
        return;
      }

      const { data: hasAdminRole, error: roleError } = await supabase.rpc("has_role", {
        _user_id: signInData.user.id,
        _role: "admin",
      });

      if (roleError) {
        console.error("Admin role validation failed:", roleError);
        await supabase.auth.signOut();
        setError("Nao foi possivel validar o acesso administrativo.");
        return;
      }

      if (hasAdminRole !== true) {
        await supabase.auth.signOut();
        setError("Este usuario nao possui acesso administrativo.");
        return;
      }

      try {
        toast.success("Bem-vindo(a) ao painel.");
        navigate(next, { replace: true });
      } catch {
        await supabase.auth.signOut();
        setError("Nao foi possivel concluir a navegacao do painel.");
        return;
      }
    } catch {
      setError("Nao foi possivel conectar ao servico de autenticacao.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-shell flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--gold)]/40 bg-background/60">
            <ShieldCheck className="h-5 w-5 text-[color:var(--gold)]" />
          </div>
          <h1 className="mt-4 font-serif text-2xl font-semibold tracking-tight text-foreground">
            85 TATTOO - Painel Administrativo
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Area restrita. Acesso somente para administradores autorizados.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-border/60 bg-background/60 p-6 backdrop-blur"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              required
              placeholder="voce@85tattoo.com"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <Link
                to="/forgot-password"
                className="text-[11px] text-muted-foreground hover:text-[color:var(--gold)]"
              >
                Esqueci a senha
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300"
            >
              {error}
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </Button>

          <p className="text-center text-[11px] text-muted-foreground">
            Ao continuar, voce concorda com o uso responsavel do painel administrativo.
          </p>
        </form>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            {"<-"} Voltar para a recepcao
          </Link>
        </div>
      </div>
    </div>
  );
}
