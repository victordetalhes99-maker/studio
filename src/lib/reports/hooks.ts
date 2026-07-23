import { useEffect, useState } from "react";
import type {
  AsyncResult,
  AttendanceReport,
  CheckInReport,
  ClientReport,
  ContractReport,
  DocumentReport,
  FormReport,
  ReportFilterState,
  ReportOverview,
  ReportPeriod,
  RiskReport,
  TattooArtistDetail,
  TattooArtistPerformance,
} from "./types";
import { reportsRepository } from "./repository";

export const DEFAULT_PERIOD: ReportPeriod = { preset: "mes_atual" };

function useAsync<T>(loader: () => Promise<T>, initial: T, deps: unknown[]): AsyncResult<T> {
  const [state, setState] = useState<AsyncResult<T>>({
    data: initial,
    isLoading: true,
    isEmpty: false,
    error: null,
  });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    loader()
      .then((data) => {
        if (!alive) return;
        const isEmpty = detectEmpty(data);
        setState({ data, isLoading: false, isEmpty, error: null });
      })
      .catch((error: Error) => {
        if (!alive) return;
        setState({ data: initial, isLoading: false, isEmpty: true, error });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function detectEmpty(data: unknown): boolean {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === "object" && "rows" in (data as Record<string, unknown>)) {
    const rows = (data as { rows: unknown[] }).rows;
    return !rows || rows.length === 0;
  }
  return false;
}

export function useOverview(period: ReportPeriod = DEFAULT_PERIOD) {
  return useAsync<ReportOverview | null>(() => reportsRepository.getOverview(period), null, [
    period.preset,
    period.inicio,
    period.fim,
  ]);
}

export function useTattooArtistPerformance(period: ReportPeriod = DEFAULT_PERIOD) {
  return useAsync<TattooArtistPerformance[]>(
    () => reportsRepository.getTattooArtistPerformance(period),
    [],
    [period.preset, period.inicio, period.fim],
  );
}

export function useTattooArtistDetails(
  id: string | undefined,
  period: ReportPeriod = DEFAULT_PERIOD,
) {
  return useAsync<TattooArtistDetail | null>(
    () => (id ? reportsRepository.getTattooArtistDetails(id, period) : Promise.resolve(null)),
    null,
    [id, period.preset, period.inicio, period.fim],
  );
}

export function useAttendances(filters: ReportFilterState) {
  return useAsync<AttendanceReport>(
    () => reportsRepository.getAttendances(filters.period, filters),
    {
      totalPeriodo: null,
      hoje: null,
      concluidos: null,
      pendentes: null,
      cancelados: null,
      mediaDiaria: null,
      duracaoMedia: null,
      rows: [],
    },
    [JSON.stringify(filters)],
  );
}

export function useClientsReport(filters: ReportFilterState) {
  return useAsync<ClientReport>(
    () => reportsRepository.getClients(filters.period, filters),
    {
      total: null,
      novos: null,
      recorrentes: null,
      comFicha: null,
      comContrato: null,
      comRisco: null,
      rows: [],
    },
    [JSON.stringify(filters)],
  );
}

export function useContractsReport(filters: ReportFilterState) {
  return useAsync<ContractReport>(
    () => reportsRepository.getContracts(filters.period, filters),
    { total: null, assinados: null, pendentes: null, semPdf: null, comErro: null, rows: [] },
    [JSON.stringify(filters)],
  );
}

export function useFormsReport(filters: ReportFilterState) {
  return useAsync<FormReport>(
    () => reportsRepository.getForms(filters.period, filters),
    {
      total: null,
      concluidas: null,
      incompletas: null,
      comAlerta: null,
      primeiraVisita: null,
      recorrentes: null,
      rows: [],
    },
    [JSON.stringify(filters)],
  );
}

export function useRiskReport(filters: ReportFilterState) {
  return useAsync<RiskReport>(
    () => reportsRepository.getRiskClients(filters.period, filters),
    {
      totalAlertas: null,
      aguardandoRevisao: null,
      revisados: null,
      nivelAtencao: null,
      nivelAlto: null,
      rows: [],
    },
    [JSON.stringify(filters)],
  );
}

export function useDocumentsReport(filters: ReportFilterState) {
  return useAsync<DocumentReport>(
    () => reportsRepository.getDocuments(filters.period, filters),
    {
      total: null,
      disponiveis: null,
      pendentes: null,
      falhas: null,
      contratos: null,
      fichas: null,
      assinaturas: null,
      rows: [],
    },
    [JSON.stringify(filters)],
  );
}

export function useCheckInsReport(filters: ReportFilterState) {
  return useAsync<CheckInReport>(
    () => reportsRepository.getCheckIns(filters.period, filters),
    {
      hoje: null,
      periodo: null,
      aguardando: null,
      emAtendimento: null,
      atendidos: null,
      cancelados: null,
      naoCompareceram: null,
      mediaEspera: null,
      mediaDiaria: null,
      rows: [],
    },
    [JSON.stringify(filters)],
  );
}
