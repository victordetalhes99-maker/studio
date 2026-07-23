import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  STATUS_LABEL,
  TIPO_LABEL,
  documentoViewRoute,
  formatDateTimeBR,
  getAssinaturaSignedUrl,
  useDocumento,
  type DocumentoStatus,
} from "@/lib/documentos";

const STATUS_TONE: Record<DocumentoStatus, string> = {
  disponivel: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  pendente: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  erro: "bg-red-500/10 text-red-600 border-red-500/30",
  arquivado: "bg-muted text-muted-foreground border-border/40",
};

export default function AdminDocumentoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const decoded = id ? decodeURIComponent(id) : undefined;
  const navigate = useNavigate();
  const { data, isLoading, notFound, error } = useDocumento(decoded);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setPreviewUrl(null);
    if (data && data.tipo === "assinatura" && data.storagePath) {
      setPreviewLoading(true);
      getAssinaturaSignedUrl(data.storagePath)
        .then((u) => alive && setPreviewUrl(u))
        .catch(() => alive && setPreviewUrl(null))
        .finally(() => alive && setPreviewLoading(false));
    }
    return () => {
      alive = false;
    };
  }, [data]);

  const handleDownload = async () => {
    if (!data) return;
    setDownloadBusy(true);
    try {
      if (data.tipo === "contrato" && data.contratoId) {
        const [{ useContratoDetalhe: _ }, { gerarContratoPdf }] = await Promise.all([
          import("@/lib/contratos"),
          import("@/lib/contratos/export"),
        ]);
        const { supabase } = await import("@/integrations/supabase/client");
        // Buscar detalhe via mesma pipeline usada em contratos
        const { data: row } = await supabase
          .from("consent_records")
          .select("*")
          .eq("id", data.contratoId)
          .maybeSingle();
        if (!row) throw new Error("Contrato não encontrado");
        // Reaproveita a rota individual: redireciona
        navigate(`/admin/contratos/${data.contratoId}`);
        toast.info("Abra o contrato e use ‘Gerar PDF’.");
        void _;
        void gerarContratoPdf;
        return;
      }
      if (data.tipo === "ficha" && data.fichaId) {
        navigate(`/admin/fichas/${data.fichaId}`);
        toast.info("Abra a ficha para gerar o PDF completo.");
        return;
      }
      if (data.tipo === "assinatura" && data.storagePath) {
        const url = previewUrl || (await getAssinaturaSignedUrl(data.storagePath));
        if (!url) throw new Error("Assinatura indisponível");
        const a = document.createElement("a");
        a.href = url;
        a.download = data.fileName;
        a.rel = "noopener";
        a.click();
        toast.success("Download iniciado.");
        return;
      }
      if (data.tipo === "termo_lgpd") {
        toast.info("O termo LGPD é um registro de aceite. Consulte o cliente para ver detalhes.");
        return;
      }
      toast.error("Este documento não possui arquivo para download.");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Falha no download.");
    } finally {
      setDownloadBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <EmptyState
        icon={FileText}
        title="Documento não encontrado"
        description="O documento pode ter sido removido ou o link está incorreto."
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={FileText}
        title="Falha ao carregar documento"
        description={error.message || "Tente novamente em instantes."}
      />
    );
  }

  const externalRoute = documentoViewRoute(data);
  const hasExternalRoute = externalRoute !== `/admin/documentos/${encodeURIComponent(data.id)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/documentos")}
          className="gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Button>
      </div>

      <PageHeader
        title={data.fileName}
        description={`${TIPO_LABEL[data.tipo]} · ${data.clienteNome}`}
        actions={
          <>
            {hasExternalRoute && (
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <Link to={externalRoute}>
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir origem
                </Link>
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={downloadBusy || (!data.temPdf && data.tipo !== "assinatura")}
              className="gap-1.5"
            >
              {downloadBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Baixar
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Resumo */}
        <div className="rounded-xl border border-border/50 bg-card/50 p-5 shadow-sm lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Resumo</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <Info label="Cliente" value={data.clienteNome} />
            <Info label="CPF" value={data.clienteCpfMasked} />
            <Info label="Tatuador" value={data.tatuador ?? "—"} />
            <Info label="Tipo" value={TIPO_LABEL[data.tipo]} />
            <Info label="Versão" value={data.versao ?? "—"} />
            <Info
              label="Status"
              value={
                <Badge variant="outline" className={STATUS_TONE[data.status]}>
                  {STATUS_LABEL[data.status]}
                </Badge>
              }
            />
            <Info label="Origem" value={data.origem} />
            <Info label="MIME type" value={data.mimeType} />
            <Info label="Criado em" value={formatDateTimeBR(data.criadoEm)} />
            <Info label="Atualizado em" value={formatDateTimeBR(data.atualizadoEm)} />
          </div>
        </div>

        {/* Integridade & segurança */}
        <div className="rounded-xl border border-border/50 bg-card/50 p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Segurança</h2>
          <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
              {data.storagePath
                ? "Arquivo em bucket privado. Acesso via URL temporária."
                : "Documento derivado — gerado sob demanda a partir dos dados originais."}
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
              CPF completo nunca é exposto no nome do arquivo.
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
              Todas as ações administrativas são registradas no histórico do cliente.
            </li>
          </ul>
          {data.tipo === "contrato" && data.status === "pendente" && (
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
              Contrato aceito sem assinatura registrada. O PDF só será gerado após o cliente
              assinar.
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      {data.tipo === "assinatura" && (
        <div className="rounded-xl border border-border/50 bg-card/50 p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Assinatura</h2>
          <div className="mt-4 flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border/50 bg-background/50 p-6">
            {previewLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="Assinatura digital"
                className="max-h-64 w-auto object-contain"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar a pré-visualização.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium text-foreground">{value}</div>
    </div>
  );
}
