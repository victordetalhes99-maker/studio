import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildPrivacyNotice } from "@/lib/lgpd";
import { isValidCPF, maskCPF, onlyDigits } from "@/lib/clientes";
import { rateLimit } from "@/lib/lgpd-consent";
import { usePublicDocumentContext } from "@/lib/public-document-context";
import { buildOperationId, logSecure } from "@/lib/logger";
import Turnstile from "@/components/Turnstile";
import { verifyTurnstileToken } from "@/lib/turnstile";

type Tipo = "delete" | "anonymize" | "export" | "rectify";

const TIPOS: { v: Tipo; label: string; desc: string }[] = [
  {
    v: "export",
    label: "Exportar dados",
    desc: "Solicitar uma copia dos dados pessoais sujeitos a avaliacao e verificacao.",
  },
  {
    v: "rectify",
    label: "Corrigir dados",
    desc: "Solicitar correcao de dados incorretos ou desatualizados.",
  },
  {
    v: "anonymize",
    label: "Anonimizar ou bloquear",
    desc: "Solicitar anonimização ou bloqueio quando aplicavel.",
  },
  {
    v: "delete",
    label: "Solicitar eliminacao",
    desc: "Solicitar eliminacao, anonimização ou bloqueio, observadas as hipoteses legais de conservacao.",
  },
];

export default function LgpdSolicitacao() {
  const {
    data: documentContext,
    isLoading: documentContextLoading,
    error: documentContextError,
  } = usePublicDocumentContext();
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [tipo, setTipo] = useState<Tipo>("export");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [tsToken, setTsToken] = useState<string | null>(null);

  const ok = isValidCPF(cpf) && email.includes("@") && motivo.trim().length >= 5 && !!tsToken;
  const privacyNotice = useMemo(() => {
    if (documentContextLoading) return "Carregando aviso de privacidade...";
    if (documentContextError) return documentContextError;
    if (!documentContext.legalReady) {
      if (documentContext.missingRequiredFields.length === 0) {
        return "Configuração jurídica incompleta.";
      }
      return `Configuração jurídica incompleta. Preencha: ${documentContext.missingRequiredFields.join(", ")}.`;
    }
    return buildPrivacyNotice(documentContext.studio);
  }, [documentContext, documentContextError, documentContextLoading]);

  const enviar = async () => {
    if (!ok || enviando) return;
    setEnviando(true);
    try {
      const tsOk = await verifyTurnstileToken(tsToken, "dsr");
      if (!tsOk) {
        toast.error("Verificacao de seguranca falhou. Recarregue e tente novamente.");
        setTsToken(null);
        return;
      }
      const cpfD = onlyDigits(cpf);
      const allowed = await rateLimit(`cpf:${cpfD}:dsr`, 3, 86400);
      if (!allowed) {
        toast.error("Solicitacao recebida recentemente. Aguarde antes de reenviar.");
        return;
      }
      const ua = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 1024) : "";
      const operationId = buildOperationId("lgpd");
      const { data, error } = await supabase
        .from("data_subject_requests")
        .insert({
          cpf: cpfD,
          email: email.trim().slice(0, 254),
          tipo,
          motivo: motivo.trim().slice(0, 2000),
          status: "pendente",
          user_agent: ua,
          operation_id: operationId,
        } as never)
        .select("id, protocolo")
        .maybeSingle();
      if (error) throw error;
      setProtocolo((data as { protocolo?: string } | null)?.protocolo ?? operationId);
      setFeito(true);
    } catch (e) {
      logSecure("warn", "envio lgpd falhou", { error: e instanceof Error ? e.message : String(e) });
      toast.error("Nao foi possivel registrar a solicitacao agora. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  if (feito) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-strong rounded-2xl p-10 max-w-md text-center">
          <h2 className="text-2xl font-light mb-2">Solicitacao registrada</h2>
          <p className="text-muted-foreground mb-3">
            Se os dados informados corresponderem a um cadastro valido e a verificacao de identidade
            for concluida, o pedido seguira para analise administrativa.
          </p>
          <p className="text-xs uppercase tracking-[0.3em] text-gold/80 mb-6">
            Protocolo {protocolo ?? "em processamento"}
          </p>
          <Link
            to="/"
            className="btn-ghost-gold inline-block px-6 py-3 rounded-xl uppercase tracking-[0.2em] text-sm"
          >
            Voltar ao inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link
          to="/"
          className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-gold"
        >
          {"<- Inicio"}
        </Link>
        <header className="mt-6">
          <p className="text-[10px] tracking-[0.5em] text-gold/80 uppercase mb-2">
            Direitos do titular
          </p>
          <h1 className="text-3xl sm:text-4xl font-light">
            Solicitacao <span className="gradient-gold-text font-serif italic">LGPD</span>
          </h1>
          <p className="text-muted-foreground mt-3 leading-relaxed">
            Use este formulario para solicitar acesso, correcao, anonimização, bloqueio ou
            eliminacao quando aplicavel. O sistema nao promete exclusao automatica imediata.
          </p>
        </header>

        <section className="glass-strong rounded-2xl p-5 sm:p-8 space-y-5">
          <label className="block">
            <span className="block text-[10px] tracking-[0.3em] text-gold/80 uppercase mb-2">
              CPF
            </span>
            <input
              className="luxury-input w-full rounded-xl px-4 py-3"
              value={cpf}
              onChange={(e) => setCpf(maskCPF(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />
          </label>
          <label className="block">
            <span className="block text-[10px] tracking-[0.3em] text-gold/80 uppercase mb-2">
              E-mail para contato
            </span>
            <input
              type="email"
              className="luxury-input w-full rounded-xl px-4 py-3"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <div>
            <span className="block text-[10px] tracking-[0.3em] text-gold/80 uppercase mb-3">
              Tipo de solicitacao
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.v}
                  type="button"
                  onClick={() => setTipo(t.v)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    tipo === t.v
                      ? "bg-gold/10 border-gold text-foreground"
                      : "border-white/10 text-foreground/75 hover:border-gold/40"
                  }`}
                >
                  <p className="text-sm font-medium mb-1">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="block text-[10px] tracking-[0.3em] text-gold/80 uppercase mb-2">
              Motivo / detalhes
            </span>
            <textarea
              className="luxury-input w-full rounded-xl px-4 py-3 min-h-32"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value.slice(0, 2000))}
              placeholder="Descreva o pedido sem incluir documentos sensiveis no texto."
            />
          </label>
          <div className="rounded-xl border border-white/10 bg-background/20 p-4 text-sm text-foreground/80">
            {
              "Fluxo previsto: solicitacao -> protocolo -> verificacao de identidade -> analise -> classificacao dos dados -> decisao registrada -> resposta ao titular."
            }
          </div>
          <div className="flex justify-center">
            <Turnstile onToken={setTsToken} action="dsr" />
          </div>
          <button
            onClick={enviar}
            disabled={!ok || enviando}
            className="btn-gold w-full px-6 py-3.5 rounded-xl uppercase tracking-[0.2em] text-sm"
          >
            {enviando ? "Enviando..." : "Enviar solicitacao"}
          </button>
          <p className="text-xs text-muted-foreground">
            Mensagens publicas permanecem neutras. A verificacao sera enviada ao contato ja
            registrado, sem revelar antecipadamente a existencia ou nao do cadastro.
          </p>
        </section>

        <section className="glass rounded-2xl p-5 sm:p-8">
          <p className="text-[10px] tracking-[0.3em] text-gold/80 uppercase mb-3">
            Aviso de privacidade
          </p>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80 font-sans">
            {privacyNotice}
          </pre>
        </section>
      </div>
    </main>
  );
}
