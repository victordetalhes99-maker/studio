import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Palette, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { MetricCard } from "@/components/admin/dashboard/MetricCard";
import { Breadcrumbs } from "@/components/admin/reports/Breadcrumbs";
import { ReportFilters } from "@/components/admin/reports/ReportFilters";
import { ReportTable } from "@/components/admin/reports/ReportTable";
import { ExportActions } from "@/components/admin/reports/ExportActions";
import { useTattooArtistPerformance, DEFAULT_PERIOD } from "@/lib/reports/hooks";
import type { ReportFilterState, TattooArtistPerformance } from "@/lib/reports/types";
import { exportTattooArtistsPdf } from "@/lib/reports/export/exportTattooArtistsPdf";
import { exportTattooArtistsXlsx } from "@/lib/reports/export/exportTattooArtistsXlsx";
import { printReport } from "@/lib/reports/export/print";
import { filtersDescription, nowPtBr } from "@/lib/reports/export/format";

const dash = (n: number | null) =>
  n === null || n === undefined ? "—" : n.toLocaleString("pt-BR");

export default function RelatorioTatuadores() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ReportFilterState>({
    period: DEFAULT_PERIOD,
    q: "",
    status: null,
  });

  const { data, isLoading } = useTattooArtistPerformance(filters.period);

  const filtrados = useMemo(() => {
    const term = (filters.q ?? "").trim().toLowerCase();
    return data.filter((t) => {
      if (term && !t.nome.toLowerCase().includes(term)) return false;
      if (filters.status && t.status !== filters.status) return false;
      return true;
    });
  }, [data, filters]);

  const ativos = data.filter((a) => a.status === "ativo").length;
  const noData = filtrados.length === 0;

  return (
    <div className="space-y-6" data-print-area>
      <Breadcrumbs
        items={[{ label: "Relatórios", to: "/admin/relatorios" }, { label: "Tatuadores" }]}
      />

      <PageHeader
        title="Desempenho dos tatuadores"
        description="Acompanhe a distribuição dos atendimentos e a atividade dos profissionais do estúdio."
        actions={
          <ExportActions
            disabled={noData}
            disabledReason="Nenhum dado disponível para os filtros selecionados"
            onExportPdf={() => exportTattooArtistsPdf(filtrados, filters)}
            onExportXlsx={() => exportTattooArtistsXlsx(filtrados, filters)}
            onPrint={printReport}
          />
        }
      />

      <div className="hidden print:block text-xs">
        Gerado em {nowPtBr()} — {filtersDescription(filters).join(" · ")}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          icon={Palette}
          label="Tatuadores ativos"
          value={ativos}
          hint={`${data.length} cadastrados`}
        />
        <MetricCard
          icon={Users}
          label="Atendimentos no período"
          value={null}
          hint="Aguardando dados de atendimento"
        />
        <MetricCard
          icon={Users}
          label="Clientes novos"
          value={null}
          hint="Aguardando dados de atendimento"
        />
        <MetricCard
          icon={Users}
          label="Clientes recorrentes"
          value={null}
          hint="Aguardando dados de atendimento"
        />
        <MetricCard
          icon={Users}
          label="Média por tatuador"
          value={null}
          hint="Aguardando dados de atendimento"
        />
        <MetricCard
          icon={Users}
          label="Com atendimento hoje"
          value={null}
          hint="Aguardando dados de atendimento"
        />
      </div>

      <ReportFilters
        value={filters}
        onChange={setFilters}
        onClear={() => setFilters({ period: DEFAULT_PERIOD, q: "", status: null })}
        showTatuador={false}
        showStatus
        statuses={[
          { value: "ativo", label: "Ativo" },
          { value: "pausado", label: "Pausado" },
          { value: "inativo", label: "Inativo" },
        ]}
      />

      <ReportTable<TattooArtistPerformance>
        ariaLabel="Tabela de desempenho dos tatuadores"
        isLoading={isLoading}
        rows={filtrados}
        keyOf={(r) => r.id}
        emptyIcon={Search}
        emptyTitle="Nenhum tatuador encontrado"
        emptyDescription="Ajuste a busca ou o filtro de status."
        onRowClick={(r) => navigate(`/admin/relatorios/tatuadores/${r.id}`)}
        columns={[
          {
            key: "tatuador",
            label: "Tatuador",
            render: (r) => (
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--gold)]/40 bg-background/60 text-[10px] font-semibold text-[color:var(--gold)]">
                  {r.iniciais}
                </span>
                <span className="font-medium text-foreground">{r.nome}</span>
              </div>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <Badge
                variant="outline"
                className={
                  r.status === "ativo"
                    ? "border-emerald-500/40 text-emerald-400"
                    : "border-border/60 text-muted-foreground"
                }
              >
                {r.status}
              </Badge>
            ),
          },
          { key: "hoje", label: "Hoje", render: (r) => dash(r.clientesHoje) },
          { key: "periodo", label: "Período", render: (r) => dash(r.clientesPeriodo) },
          { key: "novos", label: "Novos", render: (r) => dash(r.clientesNovos) },
          { key: "recorrentes", label: "Recorrentes", render: (r) => dash(r.clientesRecorrentes) },
          { key: "fichas", label: "Fichas", render: (r) => dash(r.fichasConcluidas) },
          { key: "contratos", label: "Contratos", render: (r) => dash(r.contratosAssinados) },
          {
            key: "ultima",
            label: "Última atividade",
            render: (r) =>
              r.ultimaAtividade ? new Date(r.ultimaAtividade).toLocaleString("pt-BR") : "—",
          },
          {
            key: "acoes",
            label: "Ações",
            className: "w-[1%]",
            render: (r) => (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="gap-1 text-[color:var(--gold)] hover:text-[color:var(--gold)]"
                onClick={(e) => e.stopPropagation()}
              >
                <a href={`/admin/relatorios/tatuadores/${r.id}`}>
                  Ver detalhes
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </Button>
            ),
          },
        ]}
      />
    </div>
  );
}
