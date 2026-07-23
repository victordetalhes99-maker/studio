import * as XLSX from "xlsx";
import type { ReportFilterState, TattooArtistPerformance } from "../types";
import { buildFileName, filtersDescription, nowPtBr, periodLabel } from "./format";

export function exportTattooArtistsXlsx(
  rows: TattooArtistPerformance[],
  filters: ReportFilterState,
): void {
  const wb = XLSX.utils.book_new();

  const ativos = rows.filter((r) => r.status === "ativo").length;
  const resumo = [
    ["Relatório", "Desempenho dos tatuadores — 85 Tattoo"],
    ["Gerado em", nowPtBr()],
    ["Período", periodLabel(filters.period)],
    ...filtersDescription(filters)
      .slice(1)
      .map((l) => l.split(": ") as [string, string]),
    [],
    ["Total de tatuadores", rows.length],
    ["Tatuadores ativos", ativos],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
  wsResumo["!cols"] = [{ wch: 28 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  const dash = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n);

  const header = [
    "ID",
    "Nome",
    "Iniciais",
    "Status",
    "Clientes hoje",
    "Atendimentos no período",
    "Clientes novos",
    "Clientes recorrentes",
    "Fichas concluídas",
    "Contratos assinados",
    "Última atividade",
  ];
  const data = rows.map((r) => [
    r.id,
    r.nome,
    r.iniciais,
    r.status,
    dash(r.clientesHoje),
    dash(r.clientesPeriodo),
    dash(r.clientesNovos),
    dash(r.clientesRecorrentes),
    dash(r.fichasConcluidas),
    dash(r.contratosAssinados),
    r.ultimaAtividade ? new Date(r.ultimaAtividade).toLocaleString("pt-BR") : "—",
  ]);
  const wsTat = XLSX.utils.aoa_to_sheet([header, ...data]);
  wsTat["!cols"] = [
    { wch: 10 },
    { wch: 28 },
    { wch: 8 },
    { wch: 10 },
    { wch: 14 },
    { wch: 22 },
    { wch: 16 },
    { wch: 20 },
    { wch: 18 },
    { wch: 20 },
    { wch: 22 },
  ];
  wsTat["!freeze"] = { xSplit: 0, ySplit: 1 };
  if (data.length > 0) {
    wsTat["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { c: 0, r: 0 },
        e: { c: header.length - 1, r: data.length },
      }),
    };
  }
  XLSX.utils.book_append_sheet(wb, wsTat, "Tatuadores");

  XLSX.writeFile(wb, buildFileName("relatorio-tatuadores", filters.period, "xlsx"));
}
