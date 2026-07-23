import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardList, FileSignature, Palette, ShieldAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { MetricCard } from "@/components/admin/dashboard/MetricCard";
import { Breadcrumbs } from "@/components/admin/reports/Breadcrumbs";
import { ReportFilters } from "@/components/admin/reports/ReportFilters";
import { ReportTable } from "@/components/admin/reports/ReportTable";
import { ExportActions } from "@/components/admin/reports/ExportActions";
import { EmptyState } from "@/components/admin/feedback/EmptyState";
import { DEFAULT_PERIOD, useTattooArtistDetails } from "@/lib/reports/hooks";
import type { AttendanceRow, ReportFilterState } from "@/lib/reports/types";
import {
  exportTattooArtistDetailPdf,
  exportTattooArtistDetailXlsx,
} from "@/lib/reports/export/exportTattooArtistDetailPdf";
import { printReport } from "@/lib/reports/export/print";

export default function RelatorioTatuadorDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ReportFilterState>({ period: DEFAULT_PERIOD, q: "" });
  const { data, isLoading } = useTattooArtistDetails(id, filters.period);

  const rows = useMemo(() => data?.atendimentos ?? [], [data]);

  if (!isLoading && !data) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Relatórios", to: "/admin/relatorios" },
            { label: "Tatuadores", to: "/admin/relatorios/tatuadores" },
            { label: "Não encontrado" },
          ]}
        />
        <EmptyState
          icon={Palette}
          title="Tatuador não encontrado"
          description="O identificador informado não corresponde a nenhum profissional cadastrado."
          action={
            <Button asChild variant="outline">
              <Link to="/admin/relatorios/tatuadores">Voltar para a lista</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-print-area>
      <Breadcrumbs
        items={[
          { label: "Relatórios", to: "/admin/relatorios" },
          { label: "Tatuadores", to: "/admin/relatorios/tatuadores" },
          { label: data?.nome ?? "…" },
        ]}
      />

      <PageHeader
        title={data?.nome ?? "Tatuador"}
        description="Relatório individual do profissional. Métricas serão exibidas após a integração operacional."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(-1)}
              data-no-print
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
            <ExportActions
              disabled={!data}
              disabledReason="Tatuador não encontrado"
              onExportPdf={() => {
                if (data) exportTattooArtistDetailPdf(data, filters, rows);
              }}
              onExportXlsx={() => {
                if (data) exportTattooArtistDetailXlsx(data, filters, rows);
              }}
              onPrint={printReport}
            />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--gold)]/40 bg-background/60 text-sm font-semibold text-[color:var(--gold)]">
          {data?.iniciais}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{data?.nome}</div>
          <div className="text-xs text-muted-foreground">
            {data?.especialidade ?? "Especialidade não informada"}
          </div>
        </div>
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
          {data?.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <MetricCard icon={Users} label="Atendidos hoje" value={data?.clientesHoje ?? null} />
        <MetricCard
          icon={Users}
          label="Atendidos no período"
          value={data?.clientesPeriodo ?? null}
        />
        <MetricCard icon={Users} label="Clientes novos" value={data?.clientesNovos ?? null} />
        <MetricCard icon={Users} label="Recorrentes" value={data?.clientesRecorrentes ?? null} />
        <MetricCard
          icon={ClipboardList}
          label="Fichas concluídas"
          value={data?.fichasConcluidas ?? null}
        />
        <MetricCard
          icon={FileSignature}
          label="Contratos assinados"
          value={data?.contratosAssinados ?? null}
        />
        <MetricCard icon={Users} label="Check-ins" value={data?.checkinsPeriodo ?? null} />
        <MetricCard
          icon={ShieldAlert}
          label="Pendências"
          value={data?.pendencias ?? null}
          tone="warning"
        />
      </div>

      <ReportFilters
        value={filters}
        onChange={setFilters}
        onClear={() => setFilters({ period: DEFAULT_PERIOD, q: "" })}
        showTatuador={false}
        showStatus
        statuses={[
          { value: "aguardando", label: "Aguardando" },
          { value: "em_atendimento", label: "Em atendimento" },
          { value: "concluido", label: "Concluído" },
        ]}
      />

      <ReportTable<AttendanceRow>
        ariaLabel="Atendimentos do tatuador"
        isLoading={isLoading}
        rows={rows}
        keyOf={(r) => r.id}
        emptyTitle="Nenhum atendimento disponível"
        emptyDescription="Nenhum atendimento disponível para este profissional no período selecionado."
        columns={[
          { key: "cliente", label: "Cliente", render: (r) => r.cliente },
          { key: "data", label: "Data", render: (r) => r.data ?? "—" },
          { key: "horario", label: "Horário", render: (r) => r.horario ?? "—" },
          { key: "tipo", label: "Tipo", render: (r) => r.tipo ?? "—" },
          { key: "status", label: "Status", render: (r) => r.status ?? "—" },
          { key: "ficha", label: "Ficha", render: (r) => (r.ficha ? "Sim" : "—") },
          { key: "contrato", label: "Contrato", render: (r) => (r.contrato ? "Sim" : "—") },
          { key: "checkin", label: "Check-in", render: (r) => (r.checkin ? "Sim" : "—") },
        ]}
      />
    </div>
  );
}
