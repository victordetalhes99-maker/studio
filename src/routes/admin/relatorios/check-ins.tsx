import { useState } from "react";
import { Calendar, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { MetricCard } from "@/components/admin/dashboard/MetricCard";
import { Breadcrumbs } from "@/components/admin/reports/Breadcrumbs";
import { ReportFilters } from "@/components/admin/reports/ReportFilters";
import { ReportTable } from "@/components/admin/reports/ReportTable";
import { ExportActions } from "@/components/admin/reports/ExportActions";
import { DEFAULT_PERIOD, useCheckInsReport, useTattooArtistPerformance } from "@/lib/reports/hooks";
import type { CheckInRow, ReportFilterState } from "@/lib/reports/types";

export default function RelatorioCheckIns() {
  const [filters, setFilters] = useState<ReportFilterState>({ period: DEFAULT_PERIOD, q: "" });
  const { data, isLoading } = useCheckInsReport(filters);
  const { data: tatuadores } = useTattooArtistPerformance(filters.period);
  const hasData = (data.rows?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Relatórios", to: "/admin/relatorios" }, { label: "Check-ins" }]}
      />
      <PageHeader
        title="Relatório de check-ins"
        description="Fila do dia, tempo de espera e distribuição por profissional."
        actions={<ExportActions disabled={!hasData} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <MetricCard icon={Calendar} label="Hoje" value={data.hoje} />
        <MetricCard icon={Calendar} label="No período" value={data.periodo} />
        <MetricCard icon={Calendar} label="Aguardando" value={data.aguardando} />
        <MetricCard icon={Calendar} label="Atendidos" value={data.atendidos} />
        <MetricCard icon={Calendar} label="Média diária" value={data.mediaDiaria} />
      </div>

      <ReportFilters
        value={filters}
        onChange={setFilters}
        onClear={() => setFilters({ period: DEFAULT_PERIOD, q: "" })}
        tatuadores={tatuadores.map((t) => ({ id: t.id, nome: t.nome }))}
        showStatus
        statuses={[
          { value: "aguardando", label: "Aguardando" },
          { value: "em_atendimento", label: "Em atendimento" },
          { value: "concluido", label: "Concluído" },
        ]}
      />

      <ReportTable<CheckInRow>
        ariaLabel="Tabela de check-ins"
        isLoading={isLoading}
        rows={data.rows}
        keyOf={(r) => r.id}
        emptyIcon={Search}
        emptyTitle="Sem check-ins"
        emptyDescription="Nenhum check-in encontrado para o período e filtros selecionados."
        columns={[
          { key: "cliente", label: "Cliente", render: (r) => r.cliente },
          { key: "tatuador", label: "Tatuador", render: (r) => r.tatuador ?? "—" },
          { key: "chegada", label: "Chegada", render: (r) => r.chegada ?? "—" },
          { key: "status", label: "Status", render: (r) => r.status ?? "—" },
          {
            key: "espera",
            label: "Tempo de espera",
            render: (r) => (r.tempoEspera != null ? `${r.tempoEspera} min` : "—"),
          },
        ]}
      />
    </div>
  );
}
