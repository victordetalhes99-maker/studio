// ============================================================================
// Detalhe do contrato — /admin/contratos/:id
// ----------------------------------------------------------------------------
// Mostra o contrato individual, com:
//   • cabeçalho com status + integridade (hash SHA-256)
//   • dados do contratante e do estúdio/tatuador
//   • texto exato aceito (reconstruído da versão do template)
//   • assinatura embutida (imagem privada do bucket)
//   • timeline de eventos
//   • ações: gerar PDF, imprimir, abrir cliente, abrir ficha
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileSignature,
  FileText,
  Fingerprint,
  Loader2,
  Printer,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getAssinaturaUrl } from "@/lib/clientes";
import {
  EVENT_LABEL,
  formatDateTimeBR,
  ORIGEM_LABEL,
  STATUS_LABEL,
  useContratoDetalhe,
  type ContratoStatus,
} from "@/lib/contratos";
import { gerarContratoPdf } from "@/lib/contratos/export";
import { sha256Hex } from "@/lib/contratos/templates";

export default function AdminContratoDetalhePage() {
  const params = useParams();
  const navigate = useNavigate();
  const { data, isLoading, notFound, error, refetch } = useContratoDetalhe(params.id);

  const [pdfBusy, setPdfBusy] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [hashCheck, setHashCheck] = useState<"loading" | "ok" | "diff" | "unknown">("loading");
  const [hashCalc, setHashCalc] = useState<string | null>(null);

  const texto = useMemo(() => {
    if (!data) return "";
    return (
      data.renderedText ??
      `${data.legacyNotice ?? "Documento legado"}\n\nEste aceite foi preservado sem snapshot integral do texto. O painel não reconstrói retroativamente o conteúdo aceito com base na configuração atual.`
    );
  }, [data]);

  useEffect(() => {
    if (!data) return;
    let alive = true;
    setHashCheck("loading");
    (async () => {
      try {
        if (!data.renderedText) {
          if (alive) {
            setHashCalc(null);
            setHashCheck("unknown");
          }
          return;
        }
        const h = await sha256Hex(texto);
        if (!alive) return;
        setHashCalc(h);
        if (!data.textoHash) setHashCheck("unknown");
        else setHashCheck(h === data.textoHash ? "ok" : "diff");
      } catch {
        if (alive) setHashCheck("unknown");
      }
    })();
    return () => {
      alive = false;
    };
  }, [data, texto]);

  // Carrega URL assinada da assinatura
  useEffect(() => {
    if (!data?.assinaturaPath) {
      setSignatureUrl(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const url = await getAssinaturaUrl(data.assinaturaPath);
        if (alive) setSignatureUrl(url);
      } catch {
        if (alive) setSignatureUrl(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [data?.assinaturaPath]);

  async function onPdf() {
    if (!data) return;
    setPdfBusy(true);
    try {
      await gerarContratoPdf(data);
      toast.success("PDF do contrato gerado.");
    } catch (e) {
      toast.error(`Falha ao gerar PDF: ${(e as Error).message}`);
    } finally {
      setPdfBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Não foi possível carregar o contrato"
        description={error.message}
        action={
          <Button variant="outline" onClick={refetch}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> Tentar novamente
          </Button>
        }
      />
    );
  }

  if (notFound || !data) {
    return (
      <EmptyState
        icon={FileSignature}
        title="Contrato não encontrado"
        description="O contrato solicitado não existe ou foi removido."
        action={
          <Button variant="outline" onClick={() => navigate("/admin/contratos")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar para contratos
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6" data-print-area>
      <PageHeader
        title={data.documentLabel}
        description={`Contrato ${data.id}`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} data-no-print>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
            </Button>
            <Button variant="outline" size="sm" onClick={refetch} data-no-print>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={onPdf} disabled={pdfBusy} data-no-print>
              {pdfBusy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-1.5 h-4 w-4" />
              )}
              Baixar PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} data-no-print>
              <Printer className="mr-1.5 h-4 w-4" /> Imprimir
            </Button>
          </>
        }
      />

      {/* Cabeçalho de status */}
      <section className="grid gap-3 md:grid-cols-3">
        <StatusCard status={data.status} versao={data.versao} />
        <SignatureStatusCard tem={data.temAssinatura} em={data.assinadoEm} />
        <IntegrityCard check={hashCheck} stored={data.textoHash} calculated={hashCalc} />
      </section>

      {/* Partes */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card/40 p-5">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <User className="h-3.5 w-3.5" /> Contratante
          </div>
          <div className="text-lg font-semibold text-foreground">{data.cliente.nomeCompleto}</div>
          <dl className="mt-4 grid grid-cols-1 gap-2 text-sm">
            <Field label="CPF" value={data.cliente.cpfMasked} />
            {data.cliente.dataNascimento && (
              <Field label="Nascimento" value={data.cliente.dataNascimento} />
            )}
            {data.cliente.telefone && <Field label="Telefone" value={data.cliente.telefone} />}
            {data.cliente.email && <Field label="E-mail" value={data.cliente.email} />}
            {data.cliente.endereco && <Field label="Endereço" value={data.cliente.endereco} />}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2" data-no-print>
            <Button asChild variant="outline" size="sm">
              <Link to={`/admin/clientes/${data.cliente.cpf}`}>
                <User className="mr-1.5 h-4 w-4" /> Ver cliente
              </Link>
            </Button>
            {data.fichaId && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/admin/fichas/${data.fichaId}`}>
                  <ClipboardList className="mr-1.5 h-4 w-4" /> Ver ficha
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/40 p-5">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <FileSignature className="h-3.5 w-3.5" /> Contratado
          </div>
          <div className="text-lg font-semibold text-foreground">{data.studioDisplayName}</div>
          <dl className="mt-4 grid grid-cols-1 gap-2 text-sm">
            <Field label="Tatuador" value={data.tatuador ?? "—"} />
            <Field label="Origem" value={ORIGEM_LABEL[data.origem]} />
            <Field label="Template" value={`${data.templateId} · ${data.versao}`} />
            <Field label="Aceito em" value={formatDateTimeBR(data.aceitoEm)} />
            {data.studioCompanyName && (
              <Field label="Razão social" value={data.studioCompanyName} />
            )}
          </dl>
        </div>
      </section>

      {/* Texto do contrato */}
      <section className="rounded-xl border border-border/60 bg-card/40 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> Texto aceito pelo contratante
          </div>
          <Badge variant="outline">Versão {data.versao}</Badge>
        </div>
        {!data.renderedText && (
          <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            {data.legacyNotice}
          </div>
        )}
        <pre className="max-h-[440px] overflow-auto whitespace-pre-wrap rounded-lg border border-border/40 bg-background/40 p-4 font-sans text-sm leading-relaxed text-foreground/90">
          {texto}
        </pre>
      </section>

      {/* Assinatura */}
      <section className="rounded-xl border border-border/60 bg-card/40 p-5">
        <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <FileSignature className="h-3.5 w-3.5" /> Assinatura digital
        </div>
        {data.temAssinatura ? (
          signatureUrl ? (
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <img
                src={signatureUrl}
                alt="Assinatura do contratante"
                className="max-h-40 rounded-md border border-border/60 bg-white p-2"
              />
              <div className="text-sm text-muted-foreground">
                <div>
                  Registrada em{" "}
                  <span className="text-foreground/90">{formatDateTimeBR(data.assinadoEm)}</span>
                </div>
                <div className="mt-1">
                  IP: <span className="text-foreground/80">{data.aceite.ip ?? "—"}</span>
                </div>
                <div className="mt-1 max-w-xl truncate">
                  Navegador:{" "}
                  <span className="text-foreground/80">{data.aceite.userAgent ?? "—"}</span>
                </div>
              </div>
            </div>
          ) : (
            <Skeleton className="h-32 w-64" />
          )
        ) : (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            Nenhuma assinatura vinculada a este aceite. O aceite eletrônico do texto foi registrado,
            mas não há imagem de assinatura arquivada para este contrato.
          </div>
        )}
      </section>

      {/* Timeline */}
      <section className="rounded-xl border border-border/60 bg-card/40 p-5">
        <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Fingerprint className="h-3.5 w-3.5" /> Histórico do contrato
        </div>
        <ol className="space-y-3">
          {data.historico.map((ev, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="mt-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-[color:var(--gold)]" />
              <div className="flex-1">
                <div className="font-medium text-foreground">{EVENT_LABEL[ev.tipo]}</div>
                {ev.detalhes && <div className="text-xs text-muted-foreground">{ev.detalhes}</div>}
              </div>
              <div className="text-xs text-muted-foreground">{formatDateTimeBR(ev.em)}</div>
            </li>
          ))}
        </ol>
      </section>

      {/* Outros contratos do cliente */}
      {data.outrosContratos.length > 0 && (
        <section className="rounded-xl border border-border/60 bg-card/40 p-5">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <FileSignature className="h-3.5 w-3.5" /> Outros contratos deste cliente
          </div>
          <ul className="divide-y divide-border/40">
            {data.outrosContratos.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="text-foreground/90">Versão {o.versao}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTimeBR(o.aceitoEm)}
                  </div>
                </div>
                <Button asChild size="sm" variant="ghost">
                  <Link to={`/admin/contratos/${o.id}`}>Abrir</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/30 pb-1.5 last:border-0">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm text-foreground/90">{value}</dd>
    </div>
  );
}

function StatusCard({ status, versao }: { status: ContratoStatus; versao: string }) {
  const tones: Record<ContratoStatus, string> = {
    signed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    cancelled: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    superseded: "border-slate-500/40 bg-slate-500/10 text-slate-200",
    error: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[status]}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider">
        <CheckCircle2 className="h-3.5 w-3.5" /> Status
      </div>
      <div className="mt-2 text-lg font-semibold">{STATUS_LABEL[status]}</div>
      <div className="mt-1 text-xs opacity-80">Versão {versao}</div>
    </div>
  );
}

function SignatureStatusCard({ tem, em }: { tem: boolean; em: string | null }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        tem
          ? "border-[color:var(--gold)]/40 bg-[color:var(--gold)]/10 text-[color:var(--gold)]"
          : "border-amber-500/40 bg-amber-500/10 text-amber-300"
      }`}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider">
        <FileSignature className="h-3.5 w-3.5" /> Assinatura
      </div>
      <div className="mt-2 text-lg font-semibold">{tem ? "Registrada" : "Ausente"}</div>
      <div className="mt-1 text-xs opacity-80">
        {tem ? formatDateTimeBR(em) : "Somente aceite eletrônico"}
      </div>
    </div>
  );
}

function IntegrityCard({
  check,
  stored,
  calculated,
}: {
  check: "loading" | "ok" | "diff" | "unknown";
  stored: string | null;
  calculated: string | null;
}) {
  const tone =
    check === "ok"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : check === "diff"
        ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
        : "border-slate-500/40 bg-slate-500/10 text-slate-200";
  const label =
    check === "loading"
      ? "Verificando…"
      : check === "ok"
        ? "Íntegro"
        : check === "diff"
          ? "Divergente"
          : "Não verificado";
  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider">
        <ShieldCheck className="h-3.5 w-3.5" /> Integridade SHA-256
      </div>
      <div className="mt-2 text-lg font-semibold">{label}</div>
      <div className="mt-2 space-y-1 text-[10px] leading-relaxed opacity-80">
        <div className="truncate">Armazenado: {stored ?? "—"}</div>
        <div className="truncate">Calculado: {calculated ?? "—"}</div>
      </div>
    </div>
  );
}
