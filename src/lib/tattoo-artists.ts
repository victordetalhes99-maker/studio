import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/checkins";
import type { AsyncState, TattooArtist } from "@/lib/admin-data/types";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type TattooArtistRow = {
  id: string;
  nome: string;
  slug: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
};

type TattooArtistInsert = TablesInsert<"tattoo_artists">;
type TattooArtistUpdate = TablesUpdate<"tattoo_artists">;

export interface TattooArtistInput {
  nome: string;
  ativo?: boolean;
}

function empty<T>(data: T): AsyncState<T> {
  return { data, isLoading: true, isEmpty: false, error: null };
}

function normalizeSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function initials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "--";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function monthPrefix(iso: string) {
  return iso.slice(0, 7);
}

async function fetchTattooArtistRows(): Promise<TattooArtistRow[]> {
  const { data, error } = await supabase
    .from("tattoo_artists")
    .select("id, nome, slug, ativo, criado_em, atualizado_em")
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TattooArtistRow[];
}

async function fetchArtistMetrics() {
  const [{ data: clientes, error: clientesError }, { data: checkins, error: checkinsError }] =
    await Promise.all([
      supabase.from("clientes").select("tatuador, atualizado_em"),
      supabase
        .from("check_ins")
        .select("tatuador, queue_day, status, arrival_at, started_at, completed_at, atualizado_em"),
    ]);

  if (clientesError) throw clientesError;
  if (checkinsError) throw checkinsError;

  return {
    clientes: (clientes ?? []) as Array<{ tatuador: string | null; atualizado_em: string }>,
    checkins: (checkins ?? []) as Array<{
      tatuador: string | null;
      queue_day: string;
      status: string;
      arrival_at: string;
      started_at: string | null;
      completed_at: string | null;
      atualizado_em: string;
    }>,
  };
}

function mapArtistRows(
  rows: TattooArtistRow[],
  metrics: Awaited<ReturnType<typeof fetchArtistMetrics>>,
): TattooArtist[] {
  const today = todayISO();
  const currentMonth = monthPrefix(today);

  return rows.map((row) => {
    const clienteEventos = metrics.clientes.filter((item) => item.tatuador === row.nome);
    const checkinEventos = metrics.checkins.filter((item) => item.tatuador === row.nome);

    const clientesHoje = checkinEventos.filter((item) => item.queue_day === today).length;
    const atendimentosMes = checkinEventos.filter(
      (item) => monthPrefix(item.queue_day) === currentMonth,
    ).length;
    const ultimaAtividade =
      [
        ...clienteEventos.map((item) => item.atualizado_em),
        ...checkinEventos
          .map(
            (item) => item.completed_at ?? item.started_at ?? item.arrival_at ?? item.atualizado_em,
          )
          .filter(Boolean as unknown as (value: string | null) => value is string),
      ].sort((a, b) => b.localeCompare(a))[0] ?? null;

    return {
      id: row.id,
      nome: row.nome,
      iniciais: initials(row.nome),
      status: row.ativo ? "ativo" : "inativo",
      clientesHoje,
      atendimentosMes,
      ultimaAtividade,
    };
  });
}

export function useTattooArtists(): AsyncState<TattooArtist[]> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<TattooArtist[]>>(empty([]));
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, isLoading: true, error: null }));
    try {
      const [rows, metrics] = await Promise.all([fetchTattooArtistRows(), fetchArtistMetrics()]);
      const data = mapArtistRows(rows, metrics);
      setState({ data, isLoading: false, isEmpty: data.length === 0, error: null });
    } catch (error) {
      setState({
        data: [],
        isLoading: false,
        isEmpty: true,
        error: error instanceof Error ? error : new Error("Falha ao carregar tatuadores"),
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, tick]);

  return useMemo(
    () => ({
      ...state,
      refetch: () => setTick((value) => value + 1),
    }),
    [state],
  );
}

export function useActiveTattooArtistNames(): string[] {
  const { data } = useTattooArtists();
  return useMemo(
    () =>
      data
        .filter((artist) => artist.status === "ativo")
        .map((artist) => artist.nome)
        .sort((a, b) => a.localeCompare(b)),
    [data],
  );
}

export async function createTattooArtist(input: TattooArtistInput) {
  const nome = input.nome.trim();
  if (nome.length < 2) {
    throw new Error("Nome do tatuador deve ter pelo menos 2 caracteres.");
  }

  const payload: TattooArtistInsert = {
    nome,
    slug: normalizeSlug(nome),
    ativo: input.ativo ?? true,
  };

  const { error } = await supabase.from("tattoo_artists").insert(payload);
  if (error) throw error;
}

export async function updateTattooArtist(id: string, input: TattooArtistInput) {
  const nome = input.nome.trim();
  if (nome.length < 2) {
    throw new Error("Nome do tatuador deve ter pelo menos 2 caracteres.");
  }

  const payload: TattooArtistUpdate = {
    nome,
    slug: normalizeSlug(nome),
    ativo: input.ativo ?? true,
  };

  const { error } = await supabase.from("tattoo_artists").update(payload).eq("id", id);
  if (error) throw error;
}

export async function setTattooArtistActive(id: string, ativo: boolean) {
  const { error } = await supabase.from("tattoo_artists").update({ ativo }).eq("id", id);
  if (error) throw error;
}

export async function deleteTattooArtist(id: string, nome: string) {
  const [
    { count: clientesCount, error: clientesError },
    { count: checkinsCount, error: checkinsError },
  ] = await Promise.all([
    supabase.from("clientes").select("cpf", { count: "exact", head: true }).eq("tatuador", nome),
    supabase.from("check_ins").select("id", { count: "exact", head: true }).eq("tatuador", nome),
  ]);

  if (clientesError) throw clientesError;
  if (checkinsError) throw checkinsError;

  if ((clientesCount ?? 0) > 0 || (checkinsCount ?? 0) > 0) {
    throw new Error("Nao e possivel remover um tatuador com clientes ou check-ins vinculados.");
  }

  const { error } = await supabase.from("tattoo_artists").delete().eq("id", id);
  if (error) throw error;
}
