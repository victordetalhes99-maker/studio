import { useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

function passwordStrength(pw: string): { label: string; score: number } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte", "Excelente"];
  return { label: labels[score], score };
}

function useCurrentSession() {
  const { email, userId, status } = useAuth();
  return { email, userId, loading: status === "loading" };
}

export default function ConfigSegurancaPage() {
  const session = useCurrentSession();
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const strength = passwordStrength(pw);
  const strongEnough = pw.length >= 8 && strength.score >= 3;
  const match = Boolean(pw) && pw === confirm;
  const authed = Boolean(session.userId && session.email);
  const canSubmit = authed && strongEnough && match && !submitting && current.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !session.email) return;
    setSubmitting(true);
    try {
      // Reautenticação real com a senha atual
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: session.email,
        password: current,
      });
      if (signInErr) {
        toast.error("Senha atual incorreta.");
        return;
      }
      const { error: updateErr } = await supabase.auth.updateUser({ password: pw });
      if (updateErr) {
        toast.error(updateErr.message || "Não foi possível atualizar a senha.");
        return;
      }
      toast.success("Senha atualizada com sucesso.");
      setCurrent("");
      setPw("");
      setConfirm("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {!session.loading && !authed && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300/90">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Você precisa estar autenticado como administrador para alterar a senha. Faça login antes
            de continuar — este formulário nunca envia dados sem uma sessão real.
          </p>
        </div>
      )}

      <SettingsSection
        title="Alterar senha"
        description="Reautentica com a senha atual antes de trocar. Nada é salvo sem confirmação do provedor de autenticação."
        footer={
          <>
            <div className="mr-auto flex items-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3" />
              {authed ? `Autenticado como ${session.email}` : "Sem sessão"}
            </div>
            <Button className="btn-gold" disabled={!canSubmit} onClick={handleSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Salvando…
                </>
              ) : (
                "Salvar nova senha"
              )}
            </Button>
          </>
        }
      >
        <fieldset disabled={!authed || submitting} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs font-medium text-muted-foreground">Senha atual</Label>
              <div className="relative mt-1.5">
                <Input
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Nova senha</Label>
              <Input
                className="mt-1.5"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
              {pw && (
                <div className="mt-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                    <div
                      className="h-full bg-gradient-to-r from-[color:var(--gold-soft)] to-[color:var(--gold)] transition-all"
                      style={{ width: `${(strength.score / 5) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Força: {strength.label}
                    {!strongEnough && " — recomenda-se pontuação ≥ 3"}
                  </p>
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">
                Confirmar nova senha
              </Label>
              <Input
                className="mt-1.5"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {confirm && !match && (
                <p className="mt-1 text-[11px] text-destructive">As senhas não coincidem.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border/50 bg-background/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
            Requisitos recomendados: 8+ caracteres, letras maiúsculas e minúsculas, número e
            caractere especial. A senha nunca é registrada em logs nem enviada em URL.
          </div>
        </fieldset>
      </SettingsSection>

      <SettingsSection
        title="Sessões e MFA"
        description="Recursos avançados de sessão dependem do provedor de autenticação."
      >
        <Row
          title="Encerrar esta sessão"
          desc="Faz logout imediato do dispositivo atual."
          actionLabel="Sair"
          disabled={!authed}
          onAction={async () => {
            await supabase.auth.signOut();
            toast.success("Sessão encerrada.");
          }}
        />
        <Row
          title="Encerrar sessões em todos os dispositivos"
          desc="Requer suporte do provedor. Ainda não disponível nesta instância."
          actionLabel="Indisponível"
          disabled
          hint="Aguardando backend"
        />
        <Row
          title="Autenticação em duas etapas (MFA)"
          desc="Camada extra de segurança para o login administrativo."
          actionLabel="Indisponível"
          disabled
          hint="Requer configuração no provedor de autenticação"
        />
      </SettingsSection>
    </div>
  );
}

function Row({
  title,
  desc,
  actionLabel,
  onAction,
  disabled,
  hint,
}: {
  title: string;
  desc: string;
  actionLabel: string;
  onAction?: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-lg border border-border/40 bg-background/30 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
        {hint && (
          <p className="mt-1 text-[10px] uppercase tracking-wider text-amber-300/80">{hint}</p>
        )}
      </div>
      <Button size="sm" variant="outline" disabled={disabled} onClick={onAction} title={hint}>
        {actionLabel}
      </Button>
    </div>
  );
}
