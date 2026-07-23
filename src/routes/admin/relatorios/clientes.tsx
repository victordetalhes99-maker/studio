import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users } from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { MetricCard } from "@/components/admin/dashboard/MetricCard";
import { Breadcrumbs } from "@/components/admin/reports/Breadcrumbs";
import { ReportTable } from "@/components/admin/reports/ReportTable";
import {
  DEFAULT_FILTERS,
  type ClientFiltersState,
  formatDateBR,
  useAdminClients,
  useDebounced,
  useFilteredClients,
} from "@/lib/clientes-admin";
import type { AdminClient } from "@/lib/clientes-admin";

export default function RelatorioClientes() {
  const navigate = useNavigate();
  const { data, isLoading } = useAdminClients();
  const [filters, setFilters] = useState<ClientFiltersState>(DEFAULT_FILTERS);
  const q = useDebounced(filters.q, 200);
  const rows = useFilteredClients(data, { ...filters, q });

  const metrics = useMemo(() => {
    const total = data.length;
    const comFicha = data.filter((c) => c.temFicha).length;
    const comContrato = data.filter((c) => c.temAssinatura).length;
    const comRisco = data.filter((c) => c.riscoNivel === "attention").length;
    const recorrentes = data.filter((c) => c.totalSessoes > 1).length;
    const novos = total - recorrentes;
    return { total, comFicha, comContrato, comRisco, recorrentes, novos };
  }, [data]);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Relatórios", to: "/admin/relatorios" }, { label: "Clientes" }]}
      />
      <PageHeader
        title="Relatório de clientes"
        description="Base única do estúdio. Cada cliente é identificado pelo CPF, com histórico de sessões, ficha e risco."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MetricCard icon={Users} label="Total" value={isLoading ? null : metrics.total} />
        <MetricCard icon={Users} label="Novos" value={isLoading ? null : metrics.novos} />
        <MetricCard
          icon={Users}
          label="Recorrentes"
          value={isLoading ? null : metrics.recorrentes}
        />
        <MetricCard icon={Users} label="Com ficha" value={isLoading ? null : metrics.comFicha} />
        <MetricCard
          icon={Users}
          label="Com assinatura"
          value={isLoading ? null : metrics.comContrato}
        />
        <MetricCard
          icon={Users}
          label="Com risco"
          value={isLoading ? null : metrics.comRisco}
          tone={metrics.comRisco > 0 ? "danger" : "default"}
        />
      </div>

      <input
        type="search"
        value={filters.q}
        onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        placeholder="Buscar por nome, CPF, telefone, e-mail ou tatuador…"
        className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm focus:border-[color:var(--gold)]/60 focus:outline-none"
      />

      <ReportTable<AdminClient>
        ariaLabel="Tabela de clientes"
        isLoading={isLoading}
        rows={rows}
        keyOf={(r) => r.cpf}
        onRowClick={(r) => navigate(`/admin/clientes/${r.cpf}`)}
        emptyIcon={Search}
        emptyTitle={data.length === 0 ? "Nenhum cliente cadastrado" : "Nenhum resultado"}
        emptyDescription={
          data.length === 0
            ? "Assim que houver check-ins, os clientes aparecerão aqui automaticamente."
            : "Ajuste a pesquisa para localizar o cliente."
        }
        columns={[
          { key: "cliente", label: "Cliente", render: (r) => r.nome || "—" },
          { key: "tatuador", label: "Tatuador", render: (r) => r.tatuador ?? "—" },
          { key: "cadastro", label: "Cadastro", render: (r) => formatDateBR(r.criadoEm) },
          {
            key: "ultimo",
            label: "Último atendimento",
            render: (r) => formatDateBR(r.ultimaSessao),
          },
          { key: "qtd", label: "Sessões", render: (r) => r.totalSessoes },
          { key: "ficha", label: "Ficha", render: (r) => (r.temFicha ? "Sim" : "—") },
          {
            key: "risco",
            label: "Risco",
            render: (r) => (r.riscoNivel === "attention" ? "Atenção" : "—"),
          },
          { key: "status", label: "Status", render: (r) => r.status },
        ]}
      />
    </div>
  );
}
