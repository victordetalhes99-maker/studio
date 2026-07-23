import {
  BarChart3,
  Calendar,
  ClipboardList,
  FileSignature,
  Files,
  Palette,
  ShieldAlert,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/admin/layout/PageHeader";
import { Breadcrumbs } from "@/components/admin/reports/Breadcrumbs";
import { ReportCard } from "@/components/admin/reports/ReportCard";
import { useOverview } from "@/lib/reports/hooks";

/**
 * Página principal de Relatórios.
 * - Cards clicáveis (elemento <Link>), com hover e foco por teclado.
 * - Valores nulos aparecem como "—" com descrição honesta.
 * - Único dado real hoje: número de tatuadores cadastrados.
 */
export default function RelatoriosIndex() {
  const { data } = useOverview();
  const c = data?.cards;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Relatórios" }]} />

      <PageHeader
        title="Relatórios"
        description="Escolha uma categoria para abrir o relatório detalhado. Os dados serão preenchidos após a conexão com o banco."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportCard
          icon={BarChart3}
          title="Atendimentos"
          to="/admin/relatorios/atendimentos"
          value={c?.atendimentos.value ?? null}
          summary="Volume operacional do estúdio"
          description="Total, média diária, horários e desempenho por profissional."
        />
        <ReportCard
          icon={Users}
          title="Clientes"
          to="/admin/relatorios/clientes"
          value={c?.clientes.value ?? null}
          summary="Base de clientes"
          description="Novos, recorrentes, com ficha, contrato ou alertas."
        />
        <ReportCard
          icon={Palette}
          title="Tatuadores"
          to="/admin/relatorios/tatuadores"
          value={c?.tatuadores.value ?? null}
          summary={
            c?.tatuadores.value
              ? `${c.tatuadores.value} profissionais cadastrados`
              : "Equipe do estúdio"
          }
          description="Visualize a equipe e prepare o acompanhamento dos atendimentos."
        />
        <ReportCard
          icon={FileSignature}
          title="Contratos"
          to="/admin/relatorios/contratos"
          value={c?.contratos.value ?? null}
          summary="Assinaturas e pendências"
          description="Contratos por status, com PDF, sem PDF e por profissional."
        />
        <ReportCard
          icon={ClipboardList}
          title="Fichas"
          to="/admin/relatorios/fichas"
          value={c?.fichas.value ?? null}
          summary="Anamnese dos clientes"
          description="Fichas concluídas, incompletas e com alerta de saúde."
        />
        <ReportCard
          icon={ShieldAlert}
          title="Clientes de risco"
          to="/admin/relatorios/clientes-risco"
          value={c?.["clientes-risco"].value ?? null}
          summary="Alertas de saúde e restrições"
          description="Dados aparecem após o preenchimento das fichas."
          cta="Ver estrutura"
        />
        <ReportCard
          icon={Files}
          title="Documentos"
          to="/admin/relatorios/documentos"
          value={c?.documentos.value ?? null}
          summary="Central de documentos"
          description="Fichas, contratos, termos e comprovantes gerados."
        />
        <ReportCard
          icon={Calendar}
          title="Check-ins"
          to="/admin/relatorios/check-ins"
          value={c?.["check-ins"].value ?? null}
          summary="Fila e atendimento"
          description="Movimento por horário, tempo de espera e por profissional."
        />
      </div>
    </div>
  );
}
