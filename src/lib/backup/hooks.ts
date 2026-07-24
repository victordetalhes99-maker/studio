// ============================================================================
// Hooks da Central de proteção de dados.
// Todos leem dados reais das tabelas backup_* via Supabase. Quando as tabelas
// ainda não estão acessíveis (usuário não é admin, sem sessão, etc.) os hooks
// retornam estado vazio honesto — nunca dados fictícios.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  AsyncData,
  BackupAlert,
  BackupDestination,
  BackupJob,
  BackupOverview,
  BackupSettings,
} from "./types";

function useAsync<T>(
  fn: () => Promise<T>,
  fallback: T,
  isEmptyOf: (v: T) => boolean,
): AsyncData<T> {
  const [state, setState] = useState<Omit<AsyncData<T>, "refetch">>({
    data: fallback,
    isLoading: true,
    isEmpty: true,
    error: null,
  });

  const run = useCallback(() => {
    let alive = true;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    fn()
      .then((data) => {
        if (!alive) return;
        setState({ data, isLoading: false, isEmpty: isEmptyOf(data), error: null });
      })
      .catch((err: Error) => {
        if (!alive) return;
        setState({ data: fallback, isLoading: false, isEmpty: true, error: err });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const cleanup = run();
    return cleanup;
  }, [run]);

  return { ...state, refetch: run };
}

export function useBackupOverview(): AsyncData<BackupOverview> {
  return useAsync<BackupOverview>(
    async () => {
      const { data, error } = await supabase.from("backup_overview").select("*").maybeSingle();
      if (error) throw error;
      return (
        (data as BackupOverview) ?? {
          destinos_conectados: 0,
          destinos_total: 0,
          ultimo_backup: null,
          auto_enabled: false,
          encryption_enabled: false,
        }
      );
    },
    {
      destinos_conectados: 0,
      destinos_total: 0,
      ultimo_backup: null,
      auto_enabled: false,
      encryption_enabled: false,
    },
    (v) => v.destinos_total === 0 && v.ultimo_backup === null,
  );
}

export function useBackupDestinations(): AsyncData<BackupDestination[]> {
  return useAsync<BackupDestination[]>(
    async () => {
      const { data, error } = await supabase
        .from("backup_destinations")
        .select("*")
        .order("criado_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BackupDestination[];
    },
    [],
    (v) => v.length === 0,
  );
}

export function useBackupJobs(): AsyncData<BackupJob[]> {
  return useAsync<BackupJob[]>(
    async () => {
      const { data, error } = await supabase
        .from("backup_jobs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as BackupJob[];
    },
    [],
    (v) => v.length === 0,
  );
}

export function useBackupSettings(): AsyncData<BackupSettings | null> {
  return useAsync<BackupSettings | null>(
    async () => {
      const { data, error } = await supabase
        .from("backup_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as BackupSettings) ?? null;
    },
    null,
    (v) => v === null,
  );
}

/**
 * Alertas derivados do estado real do sistema. Nunca fictícios: cada alerta
 * corresponde a uma condição verificável no backend.
 */
export function useBackupAlerts(
  overview: BackupOverview,
  destinations: BackupDestination[],
  jobs: BackupJob[],
  settings: BackupSettings | null,
): BackupAlert[] {
  const alerts: BackupAlert[] = [];

  const ultimo = overview.ultimo_backup;

  if (!ultimo) {
    alerts.push({
      id: "never-backed-up",
      severity: "critico",
      title: "Nenhum backup local foi executado ainda",
      description: "Gere o primeiro backup local — funciona sem serviços externos e sem custo.",
      action: { label: "Executar backup", to: "/admin/backup" },
    });
  }

  const erroDestino = destinations.find((d) => d.status === "erro");
  if (erroDestino) {
    alerts.push({
      id: `dest-error-${erroDestino.id}`,
      severity: "atencao",
      title: `Falha no destino opcional ${erroDestino.label}`,
      description: erroDestino.last_error ?? "Última validação retornou erro.",
      action: { label: "Ver destinos", to: "/admin/backup/destinos" },
    });
  }

  if (ultimo?.started_at) {
    const diasSemBackup = Math.floor(
      (Date.now() - new Date(ultimo.started_at).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diasSemBackup > 7) {
      alerts.push({
        id: "stale-backup",
        severity: "critico",
        title: "Último backup muito antigo",
        description: `A última cópia local foi realizada há ${diasSemBackup} dias.`,
        action: { label: "Executar agora", to: "/admin/backup" },
      });
    }
  }

  const falhas = jobs.slice(0, 3).filter((j) => j.status === "failed" || j.status === "partial");
  if (falhas.length >= 2) {
    alerts.push({
      id: "recent-failures",
      severity: "critico",
      title: "Falhas consecutivas",
      description: `${falhas.length} das últimas 3 execuções não foram concluídas.`,
      action: { label: "Ver histórico", to: "/admin/backup/historico" },
    });
  }

  return alerts;
}
