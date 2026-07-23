import { useMemo, useState } from "react";
import { ClipboardList, Search, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { MetricCard } from "@/components/admin/dashboard/MetricCard";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import { Breadcrumbs } from "@/components/admin/reports/Breadcrumbs";
import { ExportActions } from "@/components/admin/reports/ExportActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import {
  DEFAULT_FICHAS_FILTERS,
  formatDateBR,
  STATUS_LABEL,
  TIPO_LABEL,
  useDebounced,
  useFichas,
  useFichasFiltradas,
} from "@/lib/fichas";
import { exportFichasPdf, exportFichasXlsx } from "@/lib/fichas/export";

/**
 * Relatório de fichas — mesma fonte central. Preserva a proteção de dados
 * clínicos (mostra apenas contagens e metadados, não o conteúdo das respostas).
 */
export default function RelatorioFichas() {
  const { data, isLoading, error, refetch } = useFichas();
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 200);
  const rows = useFichasFiltradas(data, { ...DEFAULT_FICHAS_FILTERS, q: debouncedQ });

  const metrics = useMemo(
    () => ({
      total: data.length,
      concluidas: data.filter((f) => f.status === "concluida").length,
      incompletas: data.filter((f) => f.status === "incompleta").length,
      alerta: data.filter((f) => f.risco === "attention").length,
      primeiraVisita: data.filter((f) => f.tipo === "primeira_visita").length,
      recorrentes: data.filter((f) => f.tipo === "recorrente").length,
    }),
    [data],
  );

  const hasData = rows.length > 0;

  return (
    <div className="space-y-6" data-print-area>
      <Breadcrumbs
        items={[{ label: "Relatórios", to: "/admin/relatorios" }, { label: "Fichas" }]}
      />
      <PageHeader
        title="Relatório de fichas"
        description="Anamnese preenchida pelos clientes. Informações clínicas ficam protegidas — o relatório mostra apenas contagens e metadados."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refetch} data-no-print>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Atualizar
            </Button>
            <ExportActions
              disabled={!hasData}
              onExportPdf={() =>
                exportFichasPdf(rows, { ...DEFAULT_FICHAS_FILTERS, q: debouncedQ })
              }
              onExportXlsx={() =>
                exportFichasXlsx(rows, { ...DEFAULT_FICHAS_FILTERS, q: debouncedQ })
              }
              onPrint={() => window.print()}
            />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MetricCard icon={ClipboardList} label="Total" value={metrics.total} />
        <MetricCard icon={ClipboardList} label="Concluídas" value={metrics.concluidas} />
        <MetricCard icon={ClipboardList} label="Incompletas" value={metrics.incompletas} />
        <MetricCard icon={ShieldAlert} label="Com alerta" value={metrics.alerta} tone="warning" />
        <MetricCard icon={Sparkles} label="Primeira visita" value={metrics.primeiraVisita} />
        <MetricCard icon={RefreshCw} label="Recorrentes" value={metrics.recorrentes} />
      </div>

      <div className="relative max-w-md" data-no-print>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por cliente, CPF ou tatuador…"
          className="pl-9"
        />
      </div>

      {error ? (
        <EmptyState icon={ClipboardList} title="Falha ao carregar" description={error.message} />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhuma ficha"
          description={
            data.length === 0
              ? "As fichas aparecem aqui após o preenchimento pelos clientes."
              : "Ajuste a pesquisa para ver as fichas."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Cliente</th>
                <th className="px-4 py-3 text-left font-medium">Tatuador</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-left font-medium">Data</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Risco</th>
                <th className="px-4 py-3 text-left font-medium">Assinatura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {rows.map((f) => (
                <tr key={f.id} className="transition-colors hover:bg-background/30">
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/fichas/${f.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {f.clienteNome || "—"}
                    </Link>
                    <div className="text-xs text-muted-foreground">{f.cpfMasked}</div>
                  </td>
                  <td className="px-4 py-3 text-foreground/80">{f.tatuador ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={f.tipo === "primeira_visita" ? "default" : "secondary"}>
                      {TIPO_LABEL[f.tipo]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-foreground/80">{formatDateBR(f.data)}</td>
                  <td className="px-4 py-3 text-foreground/80">{STATUS_LABEL[f.status]}</td>
                  <td className="px-4 py-3">
                    {f.risco === "attention" ? (
                      <Badge variant="destructive">Alerta</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {f.temAssinatura ? (
                      "Sim"
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
