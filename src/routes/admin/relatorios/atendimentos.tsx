import { useState } from "react";
import { BarChart3, Calendar, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { MetricCard } from "@/components/admin/dashboard/MetricCard";
import { Breadcrumbs } from "@/components/admin/reports/Breadcrumbs";
import { ReportFilters } from "@/components/admin/reports/ReportFilters";
import { ReportTable } from "@/components/admin/reports/ReportTable";
import { ChartPlaceholder } from "@/components/admin/reports/ChartPlaceholder";
import { ExportActions } from "@/components/admin/reports/ExportActions";
import { DEFAULT_PERIOD, useAttendances, useTattooArtistPerformance } from "@/lib/reports/hooks";
import type { AttendanceRow, ReportFilterState } from "@/lib/reports/types";

export default function RelatorioAtendimentos() {
  const [filters, setFilters] = useState<ReportFilterState>({ period: DEFAULT_PERIOD, q: "" });
  const { data, isLoading } = useAttendances(filters);
  const { data: tatuadores } = useTattooArtistPerformance(filters.period);
  const hasData = (data.rows?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Relatórios", to: "/admin/relatorios" }, { label: "Atendimentos" }]}
      />
      <PageHeader
        title="Relatório de atendimentos"
        description="Volume, distribuição e desempenho operacional do estúdio."
        actions={<ExportActions disabled={!hasData} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <MetricCard icon={BarChart3} label="Total no período" value={data.totalPeriodo} />
        <MetricCard icon={Calendar} label="Hoje" value={data.hoje} />
        <MetricCard icon={BarChart3} label="Concluídos" value={data.concluidos} />
        <MetricCard icon={BarChart3} label="Pendentes" value={data.pendentes} />
        <MetricCard icon={BarChart3} label="Média diária" value={data.mediaDiaria} />
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartPlaceholder title="Movimento por dia" />
        <ChartPlaceholder title="Distribuição por tatuador" />
      </div>

      <ReportTable<AttendanceRow>
        ariaLabel="Tabela de atendimentos"
        isLoading={isLoading}
        rows={data.rows}
        keyOf={(r) => r.id}
        emptyIcon={Search}
        emptyTitle="Sem atendimentos"
        emptyDescription="Nenhum atendimento encontrado para o período e filtros selecionados."
        columns={[
          { key: "cliente", label: "Cliente", render: (r) => r.cliente },
          { key: "tatuador", label: "Tatuador", render: (r) => r.tatuador ?? "—" },
          { key: "data", label: "Data", render: (r) => r.data ?? "—" },
          { key: "horario", label: "Horário", render: (r) => r.horario ?? "—" },
          { key: "tipo", label: "Tipo", render: (r) => r.tipo ?? "—" },
          { key: "status", label: "Status", render: (r) => r.status ?? "—" },
        ]}
      />
    </div>
  );
}
