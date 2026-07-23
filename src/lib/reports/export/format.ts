import type { ReportFilterState, ReportPeriod } from "../types";

const PRESET_LABELS: Record<ReportPeriod["preset"], string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  semana: "Esta semana",
  semana_anterior: "Semana anterior",
  mes_atual: "Este mês",
  mes_anterior: "Mês anterior",
  ultimos_30: "Últimos 30 dias",
  personalizado: "Período personalizado",
};

export function periodLabel(p: ReportPeriod): string {
  if (p.preset === "personalizado" && (p.inicio || p.fim)) {
    const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
    return `${fmt(p.inicio)} a ${fmt(p.fim)}`;
  }
  return PRESET_LABELS[p.preset];
}

export function periodFileSuffix(p: ReportPeriod): string {
  const today = new Date().toISOString().slice(0, 10);
  if (p.preset === "personalizado" && p.inicio && p.fim) {
    return `${p.inicio.slice(0, 10)}-a-${p.fim.slice(0, 10)}`;
  }
  return today;
}

export function filtersDescription(f: ReportFilterState): string[] {
  const list: string[] = [`Período: ${periodLabel(f.period)}`];
  if (f.status) list.push(`Status: ${f.status}`);
  if (f.q?.trim()) list.push(`Pesquisa: "${f.q.trim()}"`);
  if (f.tipo) list.push(`Tipo: ${f.tipo}`);
  return list;
}

export function nowPtBr(): string {
  return new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
}

export function buildFileName(base: string, period: ReportPeriod, ext: string): string {
  return `85-tattoo-${slugify(base)}-${periodFileSuffix(period)}.${ext}`;
}

export const dashNum = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n.toLocaleString("pt-BR");
