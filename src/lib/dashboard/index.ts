// ============================================================================
// Fonte única do Dashboard Administrativo — 85 TATTOO
// ----------------------------------------------------------------------------
// O dashboard NÃO possui dados próprios. Este módulo apenas AGREGA os hooks
// já existentes dos módulos auditados (clientes, check-ins, fichas, contratos,
// documentos, risco, backup, tatuadores). Nenhum número é inventado: quando o
// dado real não estiver disponível, a métrica cai para `null` e a UI mostra
// "—" / "Sem dados disponíveis".
// ============================================================================
import { useMemo } from "react";
import { useAdminClients } from "@/lib/clientes-admin";
import {
  useCheckInsList,
  computeMetrics as computeCheckInMetrics,
  todayISO,
  waitMinutes,
  type CheckIn,
} from "@/lib/checkins";
import { useFichas } from "@/lib/fichas";
import { useContratos } from "@/lib/contratos";
import { useDocumentos } from "@/lib/documentos";
import { useRiskAlerts, computeMetrics as computeRiskMetrics } from "@/lib/risk";
import { useBackupOverview, useBackupDestinations, useBackupSettings } from "@/lib/backup/hooks";
import { useTatuadores } from "@/lib/admin-data/hooks";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export interface DashboardActivity {
  id: string;
  kind: "cliente" | "checkin" | "ficha" | "contrato" | "risco" | "backup";
  title: string;
  subtitle: string | null;
  at: string; // ISO
  route: string | null;
}

export interface DashboardOperationToday {
  total: number;
  aguardando: number;
  chamados: number;
  emAtendimento: number;
  concluidos: number;
  cancelados: number;
  ausentes: number;
  esperaMediaMin: number | null;
}

export interface DashboardPendingItem {
  id: string;
  severity: "info" | "atencao" | "critico";
  title: string;
  count: number;
  description: string;
  route: string;
}

export interface DashboardBackupStatus {
  configured: boolean;
  destinosConectados: number;
  destinosTotal: number;
  lastAt: string | null;
  lastStatus: string | null;
  autoEnabled: boolean;
  encryptionEnabled: boolean;
}

export interface DashboardSummary {
  isLoading: boolean;
  hasError: boolean;
  operation: DashboardOperationToday;
  totals: {
    clientes: number | null;
    tatuadoresAtivos: number | null;
    fichasTotal: number | null;
    fichasIncompletas: number | null;
    fichasHoje: number | null;
    contratosTotal: number | null;
    contratosPendentes: number | null;
    documentosTotal: number | null;
    documentosErro: number | null;
    documentosPendentes: number | null;
    riscoPendentes: number | null;
    riscoAlto: number | null;
  };
  queue: CheckIn[];
  inService: CheckIn[];
  recentClients: Array<{
    cpf: string;
    nome: string;
    tatuador: string | null;
    criadoEm: string;
    temFicha: boolean;
    temAssinatura: boolean;
  }>;
  artistsToday: Array<{
    nome: string;
    aguardando: number;
    emAtendimento: number;
    concluidos: number;
  }>;
  pending: DashboardPendingItem[];
  activity: DashboardActivity[];
  backup: DashboardBackupStatus;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Hook agregador
// ---------------------------------------------------------------------------
export function useDashboardSummary(): DashboardSummary {
  const clientes = useAdminClients();
  const checkins = useCheckInsList();
  const fichas = useFichas();
  const contratos = useContratos();
  const documentos = useDocumentos();
  const risco = useRiskAlerts();
  const overview = useBackupOverview();
  const destinos = useBackupDestinations();
  const settings = useBackupSettings();
  const tatuadores = useTatuadores();

  return useMemo<DashboardSummary>(() => {
    const isLoading =
      clientes.isLoading ||
      checkins.isLoading ||
      fichas.isLoading ||
      contratos.isLoading ||
      documentos.isLoading ||
      risco.isLoading ||
      overview.isLoading;

    const errors = [
      clientes.error,
      checkins.error,
      fichas.error,
      contratos.error,
      documentos.error,
      risco.error,
      overview.error,
    ]
      .filter(Boolean)
      .map((e) => (e as Error).message);

    // Operação de hoje — vem direto do módulo de check-ins.
    const cm = computeCheckInMetrics(checkins.data);
    const today = todayISO();
    const dia = checkins.data.filter((c) => c.queueDay === today);

    const queue = dia
      .filter((c) => c.status === "waiting" || c.status === "called")
      .sort((a, b) => a.queuePosition - b.queuePosition)
      .slice(0, 6);

    const inService = dia.filter((c) => c.status === "in_service").slice(0, 6);

    // Clientes recentes — ordenados por criadoEm real.
    const recentClients = [...clientes.data]
      .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
      .slice(0, 5)
      .map((c) => ({
        cpf: c.cpf,
        nome: c.nome,
        tatuador: c.tatuador,
        criadoEm: c.criadoEm,
        temFicha: c.temFicha,
        temAssinatura: c.temAssinatura,
      }));

    // Tatuadores em operação — derivado dos check-ins do dia.
    const artistMap = new Map<
      string,
      { aguardando: number; emAtendimento: number; concluidos: number }
    >();
    for (const c of dia) {
      const nome = c.tatuador?.trim();
      if (!nome) continue;
      const cur = artistMap.get(nome) ?? { aguardando: 0, emAtendimento: 0, concluidos: 0 };
      if (c.status === "waiting" || c.status === "called") cur.aguardando++;
      else if (c.status === "in_service") cur.emAtendimento++;
      else if (c.status === "completed") cur.concluidos++;
      artistMap.set(nome, cur);
    }
    const artistsToday = Array.from(artistMap.entries())
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.emAtendimento + b.aguardando - (a.emAtendimento + a.aguardando));

    // Fichas — derivadas da fonte central.
    const fichasIncompletas = fichas.data.filter((f) => f.status === "incompleta").length;
    const todayDate = today;
    const fichasHoje = fichas.data.filter((f) => (f.data || "").slice(0, 10) === todayDate).length;

    // Contratos "pendentes" = registrados mas sem assinatura digital vinculada.
    const contratosPendentes = contratos.data.filter((c) => !c.assinadoEm).length;
    const contratosComErro = contratos.data.filter((c) => c.status === "error").length;

    // Documentos — pendentes e erro (fonte real).
    const documentosPendentes = documentos.data.filter((d) => d.status === "pendente").length;
    const documentosErro = documentos.data.filter((d) => d.status === "erro").length;

    // Risco — do computeMetrics oficial.
    const rm = computeRiskMetrics(risco.data);

    // Backup
    const backup: DashboardBackupStatus = {
      configured: overview.data.destinos_total > 0,
      destinosConectados: overview.data.destinos_conectados,
      destinosTotal: overview.data.destinos_total,
      lastAt:
        overview.data.ultimo_backup?.completed_at ??
        overview.data.ultimo_backup?.started_at ??
        null,
      lastStatus: overview.data.ultimo_backup?.status ?? null,
      autoEnabled: overview.data.auto_enabled,
      encryptionEnabled: overview.data.encryption_enabled,
    };

    // Pendências — somente reais.
    const pending: DashboardPendingItem[] = [];
    if (fichasIncompletas > 0)
      pending.push({
        id: "fichas-incompletas",
        severity: "atencao",
        title: "Fichas incompletas",
        count: fichasIncompletas,
        description: "Clientes com anamnese pendente de conclusão.",
        route: "/admin/fichas?status=incompleta",
      });
    if (contratosPendentes > 0)
      pending.push({
        id: "contratos-pendentes",
        severity: "atencao",
        title: "Contratos sem assinatura",
        count: contratosPendentes,
        description: "Termos aguardando assinatura digital do cliente.",
        route: "/admin/contratos?status=pendente",
      });
    if (documentosErro > 0)
      pending.push({
        id: "documentos-erro",
        severity: "critico",
        title: "Documentos com erro",
        count: documentosErro,
        description: "Falha ao gerar/armazenar documento.",
        route: "/admin/documentos?status=erro",
      });
    if (rm.pending > 0)
      pending.push({
        id: "risco-pendentes",
        severity: "atencao",
        title: "Alertas de risco pendentes",
        count: rm.pending,
        description: "Aguardando revisão clínica administrativa.",
        route: "/admin/clientes-risco",
      });
    if (!backup.configured)
      pending.push({
        id: "backup-nao-configurado",
        severity: "atencao",
        title: "Backup não configurado",
        count: 1,
        description: "Nenhum destino de backup cadastrado.",
        route: "/admin/backup",
      });

    // Atividade recente — somente eventos reais dos módulos.
    const activity: DashboardActivity[] = [];
    for (const c of clientes.data.slice(0, 20)) {
      activity.push({
        id: `cli:${c.cpf}`,
        kind: "cliente",
        title: `Cliente cadastrado: ${c.nome}`,
        subtitle: c.tatuador ? `Tatuador: ${c.tatuador}` : null,
        at: c.criadoEm,
        route: `/admin/clientes/${c.cpf}`,
      });
    }
    for (const ci of checkins.data.slice(0, 30)) {
      activity.push({
        id: `chk:${ci.id}`,
        kind: "checkin",
        title:
          ci.status === "completed"
            ? `Atendimento concluído: ${ci.clienteNome}`
            : ci.status === "in_service"
              ? `Atendimento iniciado: ${ci.clienteNome}`
              : `Check-in: ${ci.clienteNome}`,
        subtitle: ci.tatuador ? `Tatuador: ${ci.tatuador}` : null,
        at: ci.completedAt ?? ci.startedAt ?? ci.calledAt ?? ci.arrivalAt,
        route: `/admin/checkins/${ci.id}`,
      });
    }
    for (const co of contratos.data.slice(0, 20)) {
      if (!co.assinadoEm) continue;
      activity.push({
        id: `ctr:${co.id}`,
        kind: "contrato",
        title: `Contrato assinado: ${co.clienteNome}`,
        subtitle: co.tatuador ? `Tatuador: ${co.tatuador}` : null,
        at: co.assinadoEm,
        route: `/admin/contratos/${co.id}`,
      });
    }
    for (const r of risco.data.slice(0, 10)) {
      activity.push({
        id: `rsk:${r.id}`,
        kind: "risco",
        title: `Alerta de risco: ${r.clienteNome}`,
        subtitle: r.level === "high" ? "Nível alto" : "Atenção",
        at: r.detectedAt,
        route: `/admin/clientes-risco/${encodeURIComponent(r.id)}`,
      });
    }
    if (backup.lastAt) {
      activity.push({
        id: `bkp:${backup.lastAt}`,
        kind: "backup",
        title: `Backup ${backup.lastStatus ?? "executado"}`,
        subtitle: null,
        at: backup.lastAt,
        route: "/admin/backup/historico",
      });
    }
    activity.sort((a, b) => (a.at < b.at ? 1 : -1));

    return {
      isLoading,
      hasError: errors.length > 0,
      operation: {
        total: cm.totalHoje,
        aguardando: cm.aguardando,
        chamados: cm.chamados,
        emAtendimento: cm.emAtendimento,
        concluidos: cm.concluidos,
        cancelados: cm.cancelados,
        ausentes: cm.ausentes,
        esperaMediaMin: cm.esperaMediaMin,
      },
      totals: {
        clientes: clientes.isLoading ? null : clientes.data.length,
        tatuadoresAtivos: tatuadores.data.length || null,
        fichasTotal: fichas.isLoading ? null : fichas.data.length,
        fichasIncompletas: fichas.isLoading ? null : fichasIncompletas,
        fichasHoje: fichas.isLoading ? null : fichasHoje,
        contratosTotal: contratos.isLoading ? null : contratos.data.length,
        contratosPendentes: contratos.isLoading ? null : contratosPendentes,
        documentosTotal: documentos.isLoading ? null : documentos.data.length,
        documentosErro: documentos.isLoading ? null : documentosErro,
        documentosPendentes: documentos.isLoading ? null : documentosPendentes,
        riscoPendentes: risco.isLoading ? null : rm.pending,
        riscoAlto: risco.isLoading ? null : rm.high,
      },
      queue,
      inService,
      recentClients,
      artistsToday,
      pending,
      activity: activity.slice(0, 10),
      backup,
      errors,
    };
  }, [
    clientes.data,
    clientes.isLoading,
    clientes.error,
    checkins.data,
    checkins.isLoading,
    checkins.error,
    fichas.data,
    fichas.isLoading,
    fichas.error,
    contratos.data,
    contratos.isLoading,
    contratos.error,
    documentos.data,
    documentos.isLoading,
    documentos.error,
    risco.data,
    risco.isLoading,
    risco.error,
    overview.data,
    overview.isLoading,
    overview.error,
    tatuadores.data,
  ]);
}

export function formatWaitShort(min: number | null): string {
  if (min === null || min === undefined || !Number.isFinite(min)) return "—";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}min`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
