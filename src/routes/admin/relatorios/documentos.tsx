import { useState } from "react";
import { Files, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { MetricCard } from "@/components/admin/dashboard/MetricCard";
import { Breadcrumbs } from "@/components/admin/reports/Breadcrumbs";
import { ReportFilters } from "@/components/admin/reports/ReportFilters";
import { ReportTable } from "@/components/admin/reports/ReportTable";
import { ExportActions } from "@/components/admin/reports/ExportActions";
import {
  DEFAULT_PERIOD,
  useDocumentsReport,
  useTattooArtistPerformance,
} from "@/lib/reports/hooks";
import type { DocumentRow, ReportFilterState } from "@/lib/reports/types";

export default function RelatorioDocumentos() {
  const [filters, setFilters] = useState<ReportFilterState>({ period: DEFAULT_PERIOD, q: "" });
  const { data, isLoading } = useDocumentsReport(filters);
  const { data: tatuadores } = useTattooArtistPerformance(filters.period);
  const hasData = (data.rows?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Relatórios", to: "/admin/relatorios" }, { label: "Documentos" }]}
      />
      <PageHeader
        title="Relatório de documentos"
        description="Documentos gerados pelo estúdio: fichas, contratos, termos e comprovantes."
        actions={<ExportActions disabled={!hasData} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard icon={Files} label="Total" value={data.total} />
        <MetricCard icon={Files} label="Disponíveis" value={data.disponiveis} />
        <MetricCard icon={Files} label="Pendentes" value={data.pendentes} />
        <MetricCard icon={Files} label="Falhas" value={data.falhas} tone="danger" />
      </div>

      <ReportFilters
        value={filters}
        onChange={setFilters}
        onClear={() => setFilters({ period: DEFAULT_PERIOD, q: "" })}
        tatuadores={tatuadores.map((t) => ({ id: t.id, nome: t.nome }))}
        showTipo
        tipos={[
          { value: "ficha", label: "Ficha" },
          { value: "contrato", label: "Contrato" },
          { value: "termo", label: "Termo" },
          { value: "comprovante", label: "Comprovante" },
        ]}
        showStatus
        statuses={[
          { value: "disponivel", label: "Disponível" },
          { value: "pendente", label: "Pendente" },
          { value: "erro", label: "Com erro" },
        ]}
      />

      <ReportTable<DocumentRow>
        ariaLabel="Tabela de documentos"
        isLoading={isLoading}
        rows={data.rows}
        keyOf={(r) => r.id}
        emptyIcon={Search}
        emptyTitle="Nenhum documento"
        emptyDescription="Nenhum documento encontrado para o período e filtros selecionados."
        columns={[
          { key: "documento", label: "Documento", render: (r) => r.documento },
          { key: "cliente", label: "Cliente", render: (r) => r.cliente },
          { key: "tatuador", label: "Tatuador", render: (r) => r.tatuador ?? "—" },
          { key: "tipo", label: "Tipo", render: (r) => r.tipo ?? "—" },
          { key: "data", label: "Data", render: (r) => r.data ?? "—" },
          { key: "status", label: "Status", render: (r) => r.status ?? "—" },
        ]}
      />
    </div>
  );
}
