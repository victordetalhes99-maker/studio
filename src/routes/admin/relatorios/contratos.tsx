import { useState } from "react";
import { FileSignature, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { MetricCard } from "@/components/admin/dashboard/MetricCard";
import { Breadcrumbs } from "@/components/admin/reports/Breadcrumbs";
import { ReportFilters } from "@/components/admin/reports/ReportFilters";
import { ReportTable } from "@/components/admin/reports/ReportTable";
import { ExportActions } from "@/components/admin/reports/ExportActions";
import {
  DEFAULT_PERIOD,
  useContractsReport,
  useTattooArtistPerformance,
} from "@/lib/reports/hooks";
import type { ContractRow, ReportFilterState } from "@/lib/reports/types";

export default function RelatorioContratos() {
  const [filters, setFilters] = useState<ReportFilterState>({ period: DEFAULT_PERIOD, q: "" });
  const { data, isLoading } = useContractsReport(filters);
  const { data: tatuadores } = useTattooArtistPerformance(filters.period);
  const hasData = (data.rows?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Relatórios", to: "/admin/relatorios" }, { label: "Contratos" }]}
      />
      <PageHeader
        title="Relatório de contratos"
        description="Assinaturas realizadas, pendências e status por profissional."
        actions={<ExportActions disabled={!hasData} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <MetricCard icon={FileSignature} label="Total" value={data.total} />
        <MetricCard icon={FileSignature} label="Assinados" value={data.assinados} />
        <MetricCard icon={FileSignature} label="Pendentes" value={data.pendentes} />
        <MetricCard icon={FileSignature} label="Sem PDF" value={data.semPdf} />
        <MetricCard icon={FileSignature} label="Com erro" value={data.comErro} tone="danger" />
      </div>

      <ReportFilters
        value={filters}
        onChange={setFilters}
        onClear={() => setFilters({ period: DEFAULT_PERIOD, q: "" })}
        tatuadores={tatuadores.map((t) => ({ id: t.id, nome: t.nome }))}
        showStatus
        statuses={[
          { value: "assinado", label: "Assinado" },
          { value: "pendente", label: "Pendente" },
          { value: "erro", label: "Com erro" },
        ]}
      />

      <ReportTable<ContractRow>
        ariaLabel="Tabela de contratos"
        isLoading={isLoading}
        rows={data.rows}
        keyOf={(r) => r.id}
        emptyIcon={Search}
        emptyTitle="Nenhum contrato"
        emptyDescription="Nenhum contrato encontrado para o período e filtros selecionados."
        columns={[
          { key: "cliente", label: "Cliente", render: (r) => r.cliente },
          { key: "tatuador", label: "Tatuador", render: (r) => r.tatuador ?? "—" },
          { key: "data", label: "Data", render: (r) => r.data ?? "—" },
          { key: "status", label: "Status", render: (r) => r.status ?? "—" },
          {
            key: "assinatura",
            label: "Assinatura",
            render: (r) => (r.temAssinatura ? "Sim" : "—"),
          },
          { key: "pdf", label: "PDF", render: (r) => (r.temPdf ? "Disponível" : "—") },
        ]}
      />
    </div>
  );
}
