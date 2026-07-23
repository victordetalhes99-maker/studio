import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { MetricCard } from "@/components/admin/dashboard/MetricCard";
import { Breadcrumbs } from "@/components/admin/reports/Breadcrumbs";
import { ReportFilters } from "@/components/admin/reports/ReportFilters";
import { ReportTable } from "@/components/admin/reports/ReportTable";
import { ExportActions } from "@/components/admin/reports/ExportActions";
import { DEFAULT_PERIOD, useRiskReport, useTattooArtistPerformance } from "@/lib/reports/hooks";
import type { ReportFilterState, RiskRow } from "@/lib/reports/types";

export default function RelatorioClientesRisco() {
  const [filters, setFilters] = useState<ReportFilterState>({ period: DEFAULT_PERIOD, q: "" });
  const { data, isLoading } = useRiskReport(filters);
  const { data: tatuadores } = useTattooArtistPerformance(filters.period);
  const hasData = (data.rows?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Relatórios", to: "/admin/relatorios" }, { label: "Clientes de risco" }]}
      />
      <PageHeader
        title="Clientes de risco"
        description="Alertas de saúde e restrições. Os detalhes clínicos permanecem protegidos e visíveis apenas no prontuário do cliente."
        actions={<ExportActions disabled={!hasData} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard
          icon={ShieldAlert}
          label="Total de alertas"
          value={data.totalAlertas}
          tone="warning"
        />
        <MetricCard
          icon={ShieldAlert}
          label="Aguardando revisão"
          value={data.aguardandoRevisao}
          tone="warning"
        />
        <MetricCard icon={ShieldAlert} label="Revisados" value={data.revisados} />
      </div>

      <ReportFilters
        value={filters}
        onChange={setFilters}
        onClear={() => setFilters({ period: DEFAULT_PERIOD, q: "" })}
        tatuadores={tatuadores.map((t) => ({ id: t.id, nome: t.nome }))}
        showStatus
        statuses={[
          { value: "aguardando_revisao", label: "Aguardando revisão" },
          { value: "revisado", label: "Revisado" },
        ]}
      />

      <ReportTable<RiskRow>
        ariaLabel="Tabela de clientes de risco"
        isLoading={isLoading}
        rows={data.rows}
        keyOf={(r) => r.id}
        emptyIcon={ShieldAlert}
        emptyTitle="Sem alertas de risco"
        emptyDescription="Nenhum dado de risco disponível. As informações aparecerão após o preenchimento das fichas."
        columns={[
          { key: "cliente", label: "Cliente", render: (r) => r.cliente },
          { key: "tatuador", label: "Tatuador", render: (r) => r.tatuador ?? "—" },
          { key: "motivo", label: "Motivo", render: (r) => r.motivo ?? "—" },
          { key: "nivel", label: "Nível", render: (r) => r.nivel ?? "—" },
          { key: "data", label: "Data", render: (r) => r.data ?? "—" },
          { key: "status", label: "Status", render: (r) => r.status ?? "—" },
        ]}
      />
    </div>
  );
}
