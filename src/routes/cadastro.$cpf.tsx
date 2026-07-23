import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  type Anamnese,
  type Cliente,
  type DadosCadastrais,
  calculateAgeFromBirthDate,
  maskCPF,
  maskPhone,
  saveCliente,
} from "@/lib/clientes";
import { AnamneseForm, emptyAnamnese } from "@/components/AnamneseForm";
import { BirthDatePicker } from "@/components/BirthDatePicker";
import { SignaturePad } from "@/components/SignaturePad";
import { TatuadorSelect } from "@/components/TatuadorSelect";
import {
  buildAnamneseText,
  buildConsentSnapshotPayload,
  buildContractText,
  buildLgpdText,
  DocumentConfigError,
} from "@/lib/document-templates";
import { createRenderContext, usePublicDocumentContext } from "@/lib/public-document-context";
import { IMAGE_CONSENT_PURPOSES, IMAGE_CONSENT_TEXT } from "@/lib/lgpd";
import { rateLimit, registrarConsentimento } from "@/lib/lgpd-consent";
import { toErrorLike } from "@/lib/errors";
import { logSecure } from "@/lib/logger";

const STEPS = ["Cadastro", "Anamnese", "Termo"];

type ImageConsentState = Record<(typeof IMAGE_CONSENT_PURPOSES)[number], boolean>;

const DEFAULT_IMAGE_CONSENT: ImageConsentState = {
  portfolio: false,
  redes_sociais: false,
  publicidade: false,
  materiais_promocionais: false,
};

export default function CadastroPage() {
  const navigate = useNavigate();
  const cpf = (typeof window !== "undefined" && sessionStorage.getItem("checkin_cpf")) || "";
  const [step, setStep] = useState(0);
  const [acceptanceId] = useState(
    () => globalThis.crypto?.randomUUID?.() ?? `consent-${Date.now().toString(36)}`,
  );

  useEffect(() => {
    document.title = "Primeiro cadastro - 85 TATTOO";
    if (!cpf) navigate("/", { replace: true });
  }, [cpf, navigate]);

  const [dados, setDados] = useState<DadosCadastrais>({
    nomeCompleto: "",
    dataNascimento: "",
    genero: "",
    rg: "",
    cpf: maskCPF(cpf),
    telefone: "",
    email: "",
    endereco: "",
    comoConheceu: "",
    tatuador: "",
    responsavelLegalNome: "",
    responsavelLegalContato: "",
  });
  const [anamnese, setAnamnese] = useState<Anamnese>(emptyAnamnese());
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [aceitoTermo, setAceitoTermo] = useState(false);
  const [aceitoLgpd, setAceitoLgpd] = useState(false);
  const [imageConsent, setImageConsent] = useState<ImageConsentState>(DEFAULT_IMAGE_CONSENT);
  const [feito, setFeito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const [tatuadorSelecionado, setTatuadorSelecionado] = useState("");
  const [tatuadorErro, setTatuadorErro] = useState<string | null>(null);
  const tatuadorFinal = tatuadorSelecionado.trim();

  const {
    data: documentContext,
    isLoading: documentContextLoading,
    error: documentContextError,
  } = usePublicDocumentContext();

  const idade = useMemo(
    () => calculateAgeFromBirthDate(dados.dataNascimento),
    [dados.dataNascimento],
  );
  const isMinor = idade !== null && idade < 18;
  const guardianInfoOk =
    !isMinor ||
    ((dados.responsavelLegalNome ?? "").trim().length >= 3 &&
      (dados.responsavelLegalContato ?? "").trim().length >= 8);

  const dadosOk =
    dados.nomeCompleto.trim().length > 2 &&
    dados.dataNascimento &&
    dados.genero &&
    dados.telefone.length >= 14 &&
    dados.email.includes("@") &&
    dados.endereco.trim().length > 4 &&
    guardianInfoOk;

  const anamneseOk =
    Object.entries(anamnese).every(([k, v]) =>
      k.endsWith("Desc") || k === "tipoSanguineo" ? true : v !== "",
    ) && anamnese.tipoSanguineo !== "";

  const consentSummary = IMAGE_CONSENT_PURPOSES.map((purpose) => ({
    purpose,
    granted: imageConsent[purpose],
  }));

  const previewContext = useMemo(
    () =>
      createRenderContext(documentContext, {
        acceptedAt: new Date().toISOString(),
        acceptanceId,
        source: isMinor ? "cadastro_menor" : "cadastro_padrao",
        client: {
          cpf,
          nomeCompleto: dados.nomeCompleto || "Titular em cadastro",
          email: dados.email,
          endereco: dados.endereco,
          telefone: dados.telefone,
        },
        artist: tatuadorFinal ? { nome: tatuadorFinal } : null,
      }),
    [
      acceptanceId,
      cpf,
      dados.email,
      dados.endereco,
      dados.nomeCompleto,
      dados.telefone,
      documentContext,
      isMinor,
      tatuadorFinal,
    ],
  );

  const legalBlockingMessage =
    documentContext.missingRequiredFields.length > 0
      ? `Configuracao juridica incompleta: ${documentContext.missingRequiredFields.join(", ")}.`
      : documentContextError;

  const anamnesePreview = useMemo(() => {
    if (documentContextLoading) return "Carregando declaracao de riscos...";
    if (!documentContext.legalReady) {
      return legalBlockingMessage ?? "Configuracao juridica incompleta.";
    }
    try {
      return buildAnamneseText(previewContext);
    } catch (error) {
      return error instanceof Error ? error.message : "Falha ao montar a declaracao.";
    }
  }, [documentContext.legalReady, documentContextLoading, legalBlockingMessage, previewContext]);

  const termoPreview = useMemo(() => {
    if (documentContextLoading) return "Carregando termo atual...";
    if (!documentContext.legalReady) {
      return legalBlockingMessage ?? "Configuracao juridica incompleta.";
    }
    try {
      return buildContractText(previewContext);
    } catch (error) {
      return error instanceof Error ? error.message : "Falha ao montar o termo.";
    }
  }, [documentContext.legalReady, documentContextLoading, legalBlockingMessage, previewContext]);

  const lgpdPreview = useMemo(() => {
    if (documentContextLoading) return "Carregando aviso LGPD...";
    if (!documentContext.legalReady) {
      return legalBlockingMessage ?? "Configuracao juridica incompleta.";
    }
    try {
      return buildLgpdText(previewContext);
    } catch (error) {
      return error instanceof Error ? error.message : "Falha ao montar o aviso LGPD.";
    }
  }, [documentContext.legalReady, documentContextLoading, legalBlockingMessage, previewContext]);

  const finalizar = async () => {
    if (!assinatura || !aceitoTermo || !aceitoLgpd || !tatuadorFinal || enviando) return;
    setEnviando(true);
    setErroEnvio(null);
    try {
      if (!documentContext.legalReady) {
        throw new DocumentConfigError(documentContext.missingRequiredFields);
      }
      const ok = await rateLimit(`cpf:${cpf}:cadastro`, 10, 3600);
      if (!ok) {
        const message = "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";
        setErroEnvio(message);
        toast.error(message);
        return;
      }

      const now = new Date().toISOString();
      const dadosComTatuador: DadosCadastrais = {
        ...dados,
        tatuador: tatuadorFinal,
      };
      const cliente: Cliente = {
        cpf,
        dadosCadastrais: dadosComTatuador,
        anamnese,
        assinatura,
        criadoEm: now,
        atualizadoEm: now,
        sessoes: [{ data: now, assinatura, anamnese, tatuador: tatuadorFinal }],
        status: isMinor ? "pendente_responsavel" : "aguardando",
      };

      const clienteSalvo = await saveCliente(cliente);
      const renderContext = createRenderContext(documentContext, {
        acceptedAt: now,
        acceptanceId,
        source: isMinor ? "cadastro_menor" : "cadastro_padrao",
        client: {
          cpf,
          nomeCompleto: dadosComTatuador.nomeCompleto,
          email: dadosComTatuador.email,
          endereco: dadosComTatuador.endereco,
          telefone: dadosComTatuador.telefone,
        },
        artist: { nome: tatuadorFinal },
      });

      const signatureSnapshot = {
        present: true,
        source: "clientes.assinatura",
        storagePath: clienteSalvo.assinatura || null,
      };

      const [lgpdSnapshot, contractSnapshot, anamneseSnapshot] = await Promise.all([
        buildConsentSnapshotPayload("lgpd", renderContext, signatureSnapshot),
        buildConsentSnapshotPayload("contract", renderContext, signatureSnapshot),
        buildConsentSnapshotPayload("anamnese", renderContext, signatureSnapshot),
      ]);

      await Promise.allSettled([
        registrarConsentimento({
          cpf,
          tipo: "lgpd",
          texto: lgpdSnapshot.renderedText,
          versao: lgpdSnapshot.templateVersion,
          finalidade: "tratamento_dados_procedimento",
          contexto: isMinor ? "cadastro_menor" : "cadastro_padrao",
          consentScope: "required",
          metadata: { acceptanceId, age: idade, minimumAgePolicy: "review_required" },
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
          contexto: isMinor ? "cadastro_menor" : "cadastro_padrao",
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
        registrarConsentimento({
          cpf,
          tipo: "anamnese",
          texto: anamneseSnapshot.renderedText,
          versao: anamneseSnapshot.templateVersion,
          finalidade: "triagem_saude",
          contexto: isMinor ? "cadastro_menor" : "cadastro_padrao",
          consentScope: "required",
          metadata: { acceptanceId },
          documentType: anamneseSnapshot.documentType,
          templateVersion: anamneseSnapshot.templateVersion,
          templateHash: anamneseSnapshot.templateHash,
          renderedText: anamneseSnapshot.renderedText,
          configSnapshot: anamneseSnapshot.configSnapshot,
          clientSnapshot: anamneseSnapshot.clientSnapshot,
          artistSnapshot: anamneseSnapshot.artistSnapshot,
          acceptedAt: anamneseSnapshot.acceptedAt,
          signatureSnapshot: anamneseSnapshot.signatureSnapshot,
          source: anamneseSnapshot.source,
        }),
        ...consentSummary.map((item) =>
          registrarConsentimento({
            cpf,
            tipo: "imagem",
            texto: IMAGE_CONSENT_TEXT,
            versao: documentContext.documents.lgpdTemplateVersion,
            finalidade: item.purpose,
            contexto: isMinor ? "cadastro_menor" : "cadastro_padrao",
            status: item.granted ? "granted" : "denied",
            consentScope: "optional",
            metadata: { acceptanceId, revocable: true },
            configSnapshot: contractSnapshot.configSnapshot,
            clientSnapshot: contractSnapshot.clientSnapshot,
            artistSnapshot: contractSnapshot.artistSnapshot,
            acceptedAt: now,
            signatureSnapshot,
            source: isMinor ? "cadastro_menor" : "cadastro_padrao",
          }),
        ),
      ]);

      setFeito(true);
    } catch (error) {
      const errorLike = toErrorLike(error);
      logSecure("warn", "cadastro falhou", {
        message: errorLike.message,
        statusCode: errorLike.statusCode,
      });
      const message = errorLike.message ?? "";
      const friendly = message.includes("Configuracao juridica incompleta")
        ? message
        : message.includes("storage") || message.includes("upload") || errorLike.statusCode
          ? "Nao conseguimos enviar sua assinatura. Verifique sua conexao e toque em Reenviar - seus dados permanecem protegidos."
          : "Nao foi possivel enviar o cadastro. Toque em Reenviar para tentar de novo.";

      setErroEnvio(friendly);
      toast.error(friendly, {
        action: { label: "Reenviar", onClick: () => finalizar() },
        duration: 10000,
      });
    } finally {
      setEnviando(false);
    }
  };

  if (feito) return <Sucesso onHome={() => navigate("/")} isMinor={isMinor} />;

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
            Primeiro cadastro
          </p>
          <h1 className="text-3xl sm:text-4xl font-light">
            Bem-vindo(a) ao <span className="gradient-gold-text font-serif italic">estudio</span>
          </h1>
        </header>

        <Stepper step={step} />

        <section className="glass-strong rounded-2xl p-5 sm:p-8 mt-6">
          {step === 0 && (
            <DadosForm
              dados={dados}
              setDados={setDados}
              isMinor={isMinor}
              idade={idade}
              guardianInfoOk={guardianInfoOk}
            />
          )}
          {step === 1 && (
            <>
              <h2 className="text-xl font-light mb-1">Ficha de anamnese</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Responda com sinceridade - isto existe para seguranca do atendimento.
              </p>
              <div className="glass rounded-xl p-5 mb-5 max-h-72 overflow-y-auto text-sm leading-relaxed text-foreground/80 whitespace-pre-line">
                {anamnesePreview}
              </div>
              <AnamneseForm value={anamnese} onChange={setAnamnese} />
            </>
          )}
          {step === 2 && (
            <TermoStep
              tatuador={tatuadorFinal}
              tatuadorSelecionado={tatuadorSelecionado}
              setTatuadorSelecionado={(value) => {
                setTatuadorSelecionado(value);
                if (value) setTatuadorErro(null);
              }}
              tatuadorErro={tatuadorErro}
              enviando={enviando}
              assinatura={assinatura}
              setAssinatura={setAssinatura}
              aceitoTermo={aceitoTermo}
              setAceitoTermo={setAceitoTermo}
              aceitoLgpd={aceitoLgpd}
              setAceitoLgpd={setAceitoLgpd}
              imageConsent={imageConsent}
              setImageConsent={setImageConsent}
              isMinor={isMinor}
              termoPreview={termoPreview}
              lgpdPreview={lgpdPreview}
              loadingContext={documentContextLoading}
              legalBlockingMessage={legalBlockingMessage}
            />
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 mt-8">
            {step > 0 && (
              <button
                onClick={() => setStep((value) => value - 1)}
                className="btn-ghost-gold w-full sm:w-auto px-6 py-3.5 rounded-xl uppercase tracking-[0.2em] text-sm"
              >
                Voltar
              </button>
            )}
            {step < 2 && (
              <button
                onClick={() => setStep((value) => value + 1)}
                disabled={(step === 0 && !dadosOk) || (step === 1 && !anamneseOk)}
                className="btn-gold w-full sm:flex-1 px-6 py-3.5 rounded-xl uppercase tracking-[0.2em] text-sm"
              >
                Continuar
              </button>
            )}
            {step === 2 && (
              <button
                onClick={() => {
                  if (!tatuadorFinal) {
                    setTatuadorErro("Selecione o tatuador responsavel pelo atendimento.");
                    return;
                  }
                  finalizar();
                }}
                disabled={
                  !assinatura ||
                  !aceitoTermo ||
                  !aceitoLgpd ||
                  enviando ||
                  !documentContext.legalReady ||
                  documentContextLoading
                }
                className="btn-gold w-full sm:flex-1 px-6 py-3.5 rounded-xl uppercase tracking-[0.2em] text-sm"
              >
                {enviando
                  ? "Enviando..."
                  : erroEnvio
                    ? "Reenviar cadastro"
                    : isMinor
                      ? "Registrar cadastro pendente"
                      : "Finalizar e enviar"}
              </button>
            )}
          </div>
          {erroEnvio && step === 2 && (
            <div className="mt-4 p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-sm text-destructive-foreground/90">
              <p className="font-medium mb-1">Falha no envio</p>
              <p className="text-foreground/80">{erroEnvio}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stepper({ step }: { step: number }) {
  const pct = ((step + 1) / STEPS.length) * 100;
  return (
    <div>
      <div className="flex justify-between mb-2">
        {STEPS.map((label, index) => (
          <span
            key={label}
            className={`text-[10px] sm:text-xs uppercase tracking-[0.25em] ${
              index <= step ? "text-gold" : "text-muted-foreground/60"
            }`}
          >
            {index + 1}. {label}
          </span>
        ))}
      </div>
      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-gold-soft to-gold transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] tracking-[0.3em] text-gold/80 uppercase mb-2">
        {label}
      </span>
      {children}
    </label>
  );
}

function DadosForm({
  dados,
  setDados,
  isMinor,
  idade,
  guardianInfoOk,
}: {
  dados: DadosCadastrais;
  setDados: (next: DadosCadastrais) => void;
  isMinor: boolean;
  idade: number | null;
  guardianInfoOk: boolean;
}) {
  const set = <K extends keyof DadosCadastrais>(key: K, value: DadosCadastrais[K]) =>
    setDados({ ...dados, [key]: value });

  return (
    <>
      <h2 className="text-xl font-light mb-1">Dados cadastrais</h2>
      <p className="text-sm text-muted-foreground mb-5">Precisamos te conhecer um pouco melhor.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label="Nome completo">
            <input
              className="luxury-input w-full rounded-xl px-4 py-3"
              value={dados.nomeCompleto}
              onChange={(event) => set("nomeCompleto", event.target.value)}
            />
          </Field>
        </div>
        <Field label="Data de nascimento">
          <BirthDatePicker
            value={dados.dataNascimento}
            onChange={(value) => set("dataNascimento", value)}
            ariaLabel="Data de nascimento"
          />
        </Field>
        <Field label="Genero">
          <select
            className="luxury-input w-full rounded-xl px-4 py-3"
            value={dados.genero}
            onChange={(event) => set("genero", event.target.value)}
          >
            <option value="">Selecione</option>
            <option>Feminino</option>
            <option>Masculino</option>
            <option>Nao-binario</option>
            <option>Prefiro nao informar</option>
          </select>
        </Field>
        <Field label="CPF">
          <input
            disabled
            className="luxury-input w-full rounded-xl px-4 py-3 opacity-70"
            value={dados.cpf}
          />
        </Field>
        <Field label="Telefone / WhatsApp">
          <input
            type="tel"
            inputMode="numeric"
            className="luxury-input w-full rounded-xl px-4 py-3"
            value={dados.telefone}
            onChange={(event) => set("telefone", maskPhone(event.target.value))}
            placeholder="(00) 00000-0000"
          />
        </Field>
        <Field label="E-mail">
          <input
            type="email"
            className="luxury-input w-full rounded-xl px-4 py-3"
            value={dados.email}
            onChange={(event) => set("email", event.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Endereco completo">
            <input
              className="luxury-input w-full rounded-xl px-4 py-3"
              value={dados.endereco}
              onChange={(event) => set("endereco", event.target.value)}
              placeholder="Rua, numero, bairro, cidade - UF"
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Como nos conheceu?">
            <div className="flex flex-wrap gap-2">
              {["Redes Sociais", "Indicacao", "Outro"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => set("comoConheceu", option)}
                  className={`px-4 py-2.5 rounded-lg text-sm border transition-all ${
                    dados.comoConheceu === option
                      ? "bg-gold/15 border-gold text-gold"
                      : "border-white/10 text-foreground/70 hover:border-gold/40"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>

      {idade !== null && (
        <div className="mt-5 rounded-xl border border-white/10 bg-background/30 p-4 text-sm text-foreground/80">
          Idade calculada no fluxo: <strong>{idade}</strong> ano(s).
        </div>
      )}

      {isMinor && (
        <div className="mt-5 space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p className="text-amber-200">
            Cadastro classificado como menor de idade. O sistema registrara o atendimento como
            <strong> pendente de validacao do responsavel</strong> e nao deve liberar o procedimento
            pelo fluxo comum sem revisao administrativa, juridica e sanitaria local.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nome do responsavel legal">
              <input
                className="luxury-input w-full rounded-xl px-4 py-3"
                value={dados.responsavelLegalNome ?? ""}
                onChange={(event) => set("responsavelLegalNome", event.target.value)}
              />
            </Field>
            <Field label="Contato do responsavel legal">
              <input
                className="luxury-input w-full rounded-xl px-4 py-3"
                value={dados.responsavelLegalContato ?? ""}
                onChange={(event) => set("responsavelLegalContato", event.target.value)}
              />
            </Field>
          </div>
          {!guardianInfoOk && (
            <p className="text-xs text-destructive">
              Preencha os dados minimos do responsavel legal para seguir.
            </p>
          )}
        </div>
      )}
    </>
  );
}

function TermoStep({
  tatuador,
  tatuadorSelecionado,
  setTatuadorSelecionado,
  tatuadorErro,
  enviando,
  assinatura,
  setAssinatura,
  aceitoTermo,
  setAceitoTermo,
  aceitoLgpd,
  setAceitoLgpd,
  imageConsent,
  setImageConsent,
  isMinor,
  termoPreview,
  lgpdPreview,
  loadingContext,
  legalBlockingMessage,
}: {
  tatuador: string;
  tatuadorSelecionado: string;
  setTatuadorSelecionado: (value: string) => void;
  tatuadorErro: string | null;
  enviando: boolean;
  assinatura: string | null;
  setAssinatura: (value: string | null) => void;
  aceitoTermo: boolean;
  setAceitoTermo: (value: boolean) => void;
  aceitoLgpd: boolean;
  setAceitoLgpd: (value: boolean) => void;
  imageConsent: ImageConsentState;
  setImageConsent: (state: ImageConsentState) => void;
  isMinor: boolean;
  termoPreview: string;
  lgpdPreview: string;
  loadingContext: boolean;
  legalBlockingMessage: string | null;
}) {
  const labels: Record<keyof ImageConsentState, string> = {
    portfolio: "Portfolio",
    redes_sociais: "Redes sociais",
    publicidade: "Publicidade",
    materiais_promocionais: "Materiais promocionais",
  };

  return (
    <>
      <h2 className="text-xl font-light mb-1">Termo de responsabilidade</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Leia com atencao, escolha seu tatuador e assine para concluir o registro.
      </p>

      <TatuadorSelect
        value={tatuadorSelecionado}
        onChange={setTatuadorSelecionado}
        disabled={enviando}
        error={tatuadorErro}
      />

      {legalBlockingMessage && !loadingContext && (
        <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          {legalBlockingMessage}
        </div>
      )}

      <div className="glass rounded-xl p-5 max-h-72 overflow-y-auto text-sm leading-relaxed text-foreground/80 whitespace-pre-line">
        {termoPreview}
      </div>

      <label className="flex items-start gap-3 mt-5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={aceitoTermo}
          onChange={(event) => setAceitoTermo(event.target.checked)}
          className="mt-1 size-4 accent-[oklch(0.82_0.13_85)]"
        />
        <span className="text-sm text-foreground/85">
          Li, compreendi e aceito o termo necessario ao procedimento.
        </span>
      </label>

      <div className="mt-8">
        <p className="text-[10px] tracking-[0.3em] text-gold/80 uppercase mb-3">
          Protecao de dados - LGPD
        </p>
        <div className="glass rounded-xl p-5 max-h-60 overflow-y-auto text-sm leading-relaxed text-foreground/80 whitespace-pre-line">
          {lgpdPreview}
        </div>
        <label className="flex items-start gap-3 mt-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={aceitoLgpd}
            onChange={(event) => setAceitoLgpd(event.target.checked)}
            className="mt-1 size-4 accent-[oklch(0.82_0.13_85)]"
          />
          <span className="text-sm text-foreground/85">
            Li, compreendi e aceito o tratamento dos dados estritamente necessario ao cadastro e ao
            procedimento.
          </span>
        </label>
      </div>

      <div className="mt-8 space-y-4 rounded-xl border border-white/10 bg-background/20 p-5">
        <div>
          <p className="text-[10px] tracking-[0.3em] text-gold/80 uppercase mb-3">
            Uso opcional de imagem
          </p>
          <p className="text-sm text-foreground/80 mb-4 whitespace-pre-line">
            {IMAGE_CONSENT_TEXT}
          </p>
        </div>
        {IMAGE_CONSENT_PURPOSES.map((purpose) => (
          <label key={purpose} className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={imageConsent[purpose]}
              onChange={(event) =>
                setImageConsent({
                  ...imageConsent,
                  [purpose]: event.target.checked,
                })
              }
              className="mt-1 size-4 accent-[oklch(0.82_0.13_85)]"
            />
            <span className="text-sm text-foreground/85">
              Autorizo de forma opcional o uso de imagem para <strong>{labels[purpose]}</strong>.
            </span>
          </label>
        ))}
        <p className="text-xs text-muted-foreground">
          Todas as opcoes acima comecam desmarcadas e podem ser recusadas sem bloquear o cadastro.
        </p>
      </div>

      {isMinor && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          Menor de idade: o cadastro sera salvo como pendente de validacao do responsavel e exige
          revisao presencial ou fluxo definido pela empresa antes do procedimento.
        </div>
      )}

      <div className="mt-6">
        <p className="text-[10px] tracking-[0.3em] text-gold/80 uppercase mb-3">
          Assinatura digital
        </p>
        <SignaturePad value={assinatura ?? undefined} onChange={setAssinatura} />
      </div>
    </>
  );
}

function Sucesso({ onHome, isMinor }: { onHome: () => void; isMinor: boolean }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-strong rounded-2xl p-10 max-w-md text-center">
        <div
          className="mx-auto size-16 rounded-full bg-gradient-gold-text flex items-center justify-center mb-5"
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
        <h2 className="text-2xl font-light mb-2">Tudo pronto!</h2>
        <p className="text-muted-foreground mb-6">
          {isMinor
            ? "O cadastro foi registrado como pendente de validacao do responsavel legal."
            : "Seu cadastro foi enviado para a recepcao."}
        </p>
        <button
          onClick={onHome}
          className="btn-ghost-gold w-full px-6 py-3 rounded-xl uppercase tracking-[0.2em] text-sm"
        >
          Voltar ao inicio
        </button>
      </div>
    </main>
  );
}
