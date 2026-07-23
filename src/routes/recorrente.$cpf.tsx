import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { addSessao, getCliente, type ClientePublico, type Anamnese } from "@/lib/clientes";
import { SignaturePad } from "@/components/SignaturePad";
import {
  buildConsentSnapshotPayload,
  buildContractText,
  buildLgpdText,
  DocumentConfigError,
} from "@/lib/document-templates";
import { createRenderContext, usePublicDocumentContext } from "@/lib/public-document-context";
import { rateLimit, registrarConsentimento } from "@/lib/lgpd-consent";
import { toErrorLike } from "@/lib/errors";
import { logSecure } from "@/lib/logger";
import { useActiveTattooArtistNames } from "@/lib/tattoo-artists";

type Modo = "termo" | "sucesso";

function createAcceptanceId() {
  return `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function RecorrentePage() {
  const cpf = (typeof window !== "undefined" && sessionStorage.getItem("checkin_cpf")) || "";
  const navigate = useNavigate();
  const tattooArtists = useActiveTattooArtistNames();
  const {
    data: documentContext,
    isLoading: documentContextLoading,
    error: documentContextError,
  } = usePublicDocumentContext();

  const [cliente, setCliente] = useState<ClientePublico | null>(null);
  const [modo, setModo] = useState<Modo>("termo");
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [aceito, setAceito] = useState(false);
  const [aceitoLgpd, setAceitoLgpd] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [tatuadorSelecionado, setTatuadorSelecionado] = useState("");
  const [tatuadorOutro, setTatuadorOutro] = useState("");
  const [busca, setBusca] = useState("");
  const [acceptanceId] = useState(createAcceptanceId);

  const tatuadorFinal = (tatuadorSelecionado || tatuadorOutro).trim();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await getCliente(cpf);
      if (cancelled) return;
      if (!c) {
        navigate("/");
        return;
      }
      setCliente(c);
      const anterior = c.tatuador?.trim() ?? "";
      if (anterior) {
        if (tattooArtists.includes(anterior)) setTatuadorSelecionado(anterior);
        else setTatuadorOutro(anterior);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cpf, navigate, tattooArtists]);

  const filtrados = useMemo(
    () => tattooArtists.filter((t) => t.toLowerCase().includes(busca.toLowerCase())),
    [busca, tattooArtists],
  );

  const previewContext = useMemo(() => {
    if (!cliente || !tatuadorFinal) return null;
    return createRenderContext(documentContext, {
      acceptedAt: new Date().toISOString(),
      acceptanceId,
      source: "sessao_recorrente",
      client: {
        cpf,
        nomeCompleto: cliente.nomeCompleto,
      },
      artist: { nome: tatuadorFinal },
    });
  }, [acceptanceId, cliente, cpf, documentContext, tatuadorFinal]);

  const legalBlockingMessage = useMemo(() => {
    if (documentContextError) return documentContextError;
    if (documentContextLoading) return null;
    if (documentContext.legalReady) return null;
    if (documentContext.missingRequiredFields.length === 0) {
      return "Configuração jurídica incompleta.";
    }
    return `Configuração jurídica incompleta. Preencha: ${documentContext.missingRequiredFields.join(", ")}.`;
  }, [documentContext, documentContextError, documentContextLoading]);

  const termoPreview = useMemo(() => {
    if (documentContextLoading) return "Carregando termo atual...";
    if (!previewContext || !tatuadorFinal) return "Selecione o tatuador para carregar o termo.";
    try {
      return buildContractText(previewContext);
    } catch (error) {
      return error instanceof Error ? error.message : "Falha ao montar o termo.";
    }
  }, [documentContextLoading, previewContext, tatuadorFinal]);

  const lgpdPreview = useMemo(() => {
    if (documentContextLoading) return "Carregando aviso LGPD...";
    if (!previewContext || !tatuadorFinal)
      return "Selecione o tatuador para carregar o aviso LGPD.";
    try {
      return buildLgpdText(previewContext);
    } catch (error) {
      return error instanceof Error ? error.message : "Falha ao montar o aviso LGPD.";
    }
  }, [documentContextLoading, previewContext, tatuadorFinal]);

  if (!cliente) return null;

  const primeiroNome = cliente.nomeCompleto.split(" ")[0];

  const finalizar = async () => {
    if (!assinatura || !aceito || !aceitoLgpd || !tatuadorFinal || enviando) return;
    if (!documentContext.legalReady) {
      const message = legalBlockingMessage ?? "Configuração jurídica incompleta.";
      setErroEnvio(message);
      toast.error(message);
      return;
    }

    const acceptedAt = new Date().toISOString();
    const sessao = {
      data: acceptedAt,
      assinatura,
      anamnese: {} as unknown as Anamnese,
      tatuador: tatuadorFinal,
    };

    setEnviando(true);
    setErroEnvio(null);
    try {
      const ok = await rateLimit(`cpf:${cpf}:recorrente`, 10, 3600);
      if (!ok) {
        const message = "Muitas tentativas em pouco tempo. Aguarde alguns minutos.";
        setErroEnvio(message);
        toast.error(message);
        return;
      }

      const sessaoSalva = await addSessao(cpf, sessao);
      const renderContext = createRenderContext(documentContext, {
        acceptedAt,
        acceptanceId,
        source: "sessao_recorrente",
        client: {
          cpf,
          nomeCompleto: cliente.nomeCompleto,
        },
        artist: { nome: tatuadorFinal },
      });

      const signatureSnapshot = {
        present: true,
        source: "clientes.sessoes.assinatura",
        storagePath: sessaoSalva.assinatura || null,
      };

      const [lgpdSnapshot, contractSnapshot] = await Promise.all([
        buildConsentSnapshotPayload("lgpd", renderContext, signatureSnapshot),
        buildConsentSnapshotPayload("contract", renderContext, signatureSnapshot),
      ]);

      await Promise.allSettled([
        registrarConsentimento({
          cpf,
          tipo: "lgpd",
          texto: lgpdSnapshot.renderedText,
          versao: lgpdSnapshot.templateVersion,
          finalidade: "tratamento_dados_procedimento",
          contexto: "sessao_recorrente",
          consentScope: "required",
          metadata: { acceptanceId },
          documentType: lgpdSnapshot.documentType,
          templateVersion: lgpdSnapshot.templateVersion,
          templateHash: lgpdSnapshot.templateHash,
          renderedText: lgpdSnapshot.renderedText,
          configSnapshot: lgpdSnapshot.configSnapshot,
          clientSnapshot: lgpdSnapshot.clientSnapshot,
          artistSnapshot: lgpdSnapshot.artistSnapshot,
          acceptedAt: lgpdSnapshot.acceptedAt,
          signatureSnapshot: lgpdSnapshot.signatureSnapshot,
          source: lgpdSnapshot.source,
        }),
        registrarConsentimento({
          cpf,
          tipo: "termo",
          texto: contractSnapshot.renderedText,
          versao: contractSnapshot.templateVersion,
          finalidade: "autorizacao_procedimento",
          contexto: "sessao_recorrente",
          consentScope: "required",
          metadata: { acceptanceId },
          documentType: contractSnapshot.documentType,
          templateVersion: contractSnapshot.templateVersion,
          templateHash: contractSnapshot.templateHash,
          renderedText: contractSnapshot.renderedText,
          configSnapshot: contractSnapshot.configSnapshot,
          clientSnapshot: contractSnapshot.clientSnapshot,
          artistSnapshot: contractSnapshot.artistSnapshot,
          acceptedAt: contractSnapshot.acceptedAt,
          signatureSnapshot: contractSnapshot.signatureSnapshot,
          source: contractSnapshot.source,
        }),
      ]);

      setModo("sucesso");
    } catch (error) {
      const el = toErrorLike(error);
      logSecure("warn", "recorrente falhou", { message: el.message, statusCode: el.statusCode });
      const message =
        error instanceof DocumentConfigError
          ? error.message
          : el.message?.includes("storage") || el.message?.includes("upload") || el.statusCode
            ? "Não conseguimos enviar sua assinatura. Verifique sua conexão e toque em Reenviar."
            : "Não foi possível registrar a sessão. Toque em Reenviar para tentar de novo.";

      setErroEnvio(message);
      toast.error(message, {
        action: { label: "Reenviar", onClick: () => finalizar() },
        duration: 10000,
      });
    } finally {
      setEnviando(false);
    }
  };

  if (modo === "sucesso") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-strong rounded-2xl p-10 max-w-md text-center">
          <div
            className="mx-auto size-16 rounded-full flex items-center justify-center mb-5"
            style={{ background: "var(--gradient-gold)" }}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              style={{ color: "oklch(0.15 0.005 270)" }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l5 5L20 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-light mb-2">Sessão registrada!</h2>
          <p className="text-muted-foreground mb-6">
            Bom trabalho, {primeiroNome}. A recepção já recebeu sua assinatura.
          </p>
          <button
            onClick={() => navigate("/")}
            className="btn-ghost-gold w-full px-6 py-3 rounded-xl uppercase tracking-[0.2em] text-sm"
          >
            Voltar ao início
          </button>
        </div>
      </main>
    );
  }

  const submitDisabled =
    !assinatura ||
    !aceito ||
    !aceitoLgpd ||
    !tatuadorFinal ||
    enviando ||
    documentContextLoading ||
    !documentContext.legalReady;

  return (
    <main className="min-h-screen px-4 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto">
        <Link
          to="/"
          className="text-xs uppercase tracking-[0.3em] text-muted-foreground hover:text-gold"
        >
          {"<- Inicio"}
        </Link>

        <header className="mt-6 mb-8">
          <p className="text-[10px] tracking-[0.5em] text-gold/80 uppercase mb-2">
            Bom ver você de volta!
          </p>
          <h1 className="text-3xl sm:text-4xl font-light">
            Olá, <span className="gradient-gold-text font-serif italic">{primeiroNome}</span>!
          </h1>
          <p className="text-muted-foreground mt-3 leading-relaxed">
            Confirme o tatuador, releia o termo e assine para liberar a sessão de hoje.
          </p>
        </header>

        <section className="glass-strong rounded-2xl p-5 sm:p-8">
          <h2 className="text-xl font-light mb-1">Termo de responsabilidade</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Você pode manter o mesmo tatuador da última visita ou escolher outro.
          </p>

          <div className="mb-6">
            <p className="text-[10px] tracking-[0.3em] text-gold/80 uppercase mb-3">
              Tatuador responsável
            </p>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar tatuador..."
              className="luxury-input w-full rounded-xl px-4 py-3 mb-2"
            />
            <select
              className="luxury-input w-full rounded-xl px-4 py-3"
              value={tatuadorSelecionado}
              onChange={(e) => {
                setTatuadorSelecionado(e.target.value);
                if (e.target.value) setTatuadorOutro("");
              }}
            >
              <option value="">Selecione seu tatuador</option>
              {filtrados.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {tatuadorFinal && (
              <p className="text-[11px] text-gold/80 mt-2">
                Profissional selecionado: <span className="font-medium">{tatuadorFinal}</span>
              </p>
            )}
          </div>

          {legalBlockingMessage && !documentContextLoading && (
            <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
              {legalBlockingMessage}
            </div>
          )}

          <div className="glass rounded-xl p-5 max-h-72 overflow-y-auto text-sm leading-relaxed text-foreground/80 whitespace-pre-line">
            {termoPreview}
          </div>

          <label className="flex items-start gap-3 mt-5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={aceito}
              onChange={(e) => setAceito(e.target.checked)}
              className="mt-1 size-4 accent-[oklch(0.82_0.13_85)]"
            />
            <span className="text-sm text-foreground/85">
              Li, compreendi e aceito o termo necessário ao procedimento.
            </span>
          </label>

          <div className="mt-8">
            <p className="text-[10px] tracking-[0.3em] text-gold/80 uppercase mb-3">
              Proteção de dados - LGPD
            </p>
            <div className="glass rounded-xl p-5 max-h-60 overflow-y-auto text-sm leading-relaxed text-foreground/80 whitespace-pre-line">
              {lgpdPreview}
            </div>
            <label className="flex items-start gap-3 mt-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={aceitoLgpd}
                onChange={(e) => setAceitoLgpd(e.target.checked)}
                className="mt-1 size-4 accent-[oklch(0.82_0.13_85)]"
              />
              <span className="text-sm text-foreground/85">
                Li, compreendi e aceito o tratamento dos dados estritamente necessário à sessão.
              </span>
            </label>
          </div>

          <div className="mt-6">
            <p className="text-[10px] tracking-[0.3em] text-gold/80 uppercase mb-3">
              Assinatura digital - sessão de hoje
            </p>
            <SignaturePad value={assinatura ?? undefined} onChange={setAssinatura} />
          </div>

          <div className="mt-8">
            <button
              onClick={finalizar}
              disabled={submitDisabled}
              className="btn-gold w-full px-6 py-3.5 rounded-xl uppercase tracking-[0.2em] text-sm"
            >
              {enviando ? "Enviando..." : erroEnvio ? "Reenviar" : "Finalizar e enviar"}
            </button>
            {erroEnvio && (
              <div className="mt-4 p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-sm">
                <p className="font-medium text-destructive mb-1">Falha no envio</p>
                <p className="text-foreground/80">{erroEnvio}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
