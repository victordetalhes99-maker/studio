import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [hasRecovery, setHasRecovery] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Redefinir senha - 85 TATTOO";
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrapRecovery() {
      const currentUrl = new URL(window.location.href);
      const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
      const searchParams = currentUrl.searchParams;

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const recoveryType = hashParams.get("type");
      const authCode = searchParams.get("code");

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!active) return;

        if (!sessionError) {
          setHasRecovery(recoveryType === "recovery" || true);
          window.history.replaceState({}, document.title, "/reset-password");
          return;
        }
      }

      if (authCode) {
        const { data, error: codeError } = await supabase.auth.exchangeCodeForSession(authCode);

        if (!active) return;

        if (!codeError && data.session) {
          setHasRecovery(true);
          window.history.replaceState({}, document.title, "/reset-password");
          return;
        }
      }

      const { data } = await supabase.auth.getSession();

      if (!active) return;

      if (data.session) setHasRecovery(true);
      else setHasRecovery(false);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setHasRecovery(true);
      else if (session) setHasRecovery(true);
    });

    void bootstrapRecovery();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const score = passwordStrength(pw);
  const strongEnough = pw.length >= 8 && score >= 3;
  const match = Boolean(pw) && pw === confirm;
  const canSubmit = hasRecovery === true && strongEnough && match && !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: pw });
      if (err) {
        setError(err.message || "Nao foi possivel atualizar a senha.");
        return;
      }
      toast.success("Senha redefinida com sucesso.");
      await supabase.auth.signOut();
      navigate("/admin-login", { replace: true });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-shell flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--gold)]/40 bg-background/60">
            <KeyRound className="h-5 w-5 text-[color:var(--gold)]" />
          </div>
          <h1 className="mt-4 font-serif text-2xl font-semibold text-foreground">
            Redefinir senha
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Escolha uma nova senha forte para sua conta administrativa.
          </p>
        </div>

        {hasRecovery === false ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-sm text-amber-300/90">
            Este link e invalido ou ja expirou. Solicite uma nova recuperacao de senha.
            <div className="mt-4">
              <Link
                to="/forgot-password"
                className="text-xs text-[color:var(--gold)] hover:underline"
              >
                Solicitar nova recuperacao
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-border/60 bg-background/60 p-6"
          >
            <div className="space-y-1.5">
              <Label htmlFor="pw">Nova senha</Label>
              <div className="relative">
                <Input
                  id="pw"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  disabled={submitting || hasRecovery === null}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                  tabIndex={-1}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Minimo de 8 caracteres, com maiusculas, minusculas e numeros.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmar nova senha</Label>
              <Input
                id="confirm"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={submitting || hasRecovery === null}
              />
              {confirm && !match && (
                <p className="text-[11px] text-red-300">As senhas nao coincidem.</p>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300"
              >
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                </>
              ) : (
                "Salvar nova senha"
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
