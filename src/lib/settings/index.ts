import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const studioSchema = z.object({
  nomeEstudio: z
    .string()
    .trim()
    .min(2, "Nome do estudio e obrigatorio (min. 2 caracteres)")
    .max(120, "Maximo de 120 caracteres"),
  nomeEmpresarial: z.string().trim().max(160, "Maximo de 160 caracteres").default(""),
  documento: z.string().trim().max(32, "Maximo de 32 caracteres").default(""),
  telefone: z.string().trim().max(32).default(""),
  whatsapp: z.string().trim().max(32).default(""),
  email: z
    .string()
    .trim()
    .max(254)
    .default("")
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail invalido"),
  site: z
    .string()
    .trim()
    .max(254)
    .default("")
    .refine((v) => v === "" || /^https?:\/\/.+/i.test(v), "URL deve comecar com http(s)://"),
  endereco: z.string().trim().max(200).default(""),
  cidade: z.string().trim().max(80).default(""),
  estado: z.string().trim().max(40).default(""),
  cep: z
    .string()
    .trim()
    .max(9)
    .default("")
    .refine((v) => v === "" || /^\d{5}-?\d{3}$/.test(v), "CEP invalido"),
  timezone: z.string().trim().min(1).max(60).default("America/Fortaleza"),
  horario: z.string().trim().max(200).default(""),
  descricao: z.string().trim().max(500).default(""),
  lgpdEmail: z
    .string()
    .trim()
    .max(254)
    .default("")
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail LGPD invalido"),
  privacyContactChannel: z.string().trim().max(200).default(""),
  privacyResponsible: z.string().trim().max(160).default(""),
  dpoName: z.string().trim().max(160).default(""),
  privacyResponseDeadlineDays: z.coerce.number().int().min(1).max(60).default(15),
  productionChecklistCompleted: z.boolean().default(false),
});

export type StudioSettings = z.infer<typeof studioSchema>;

export const DEFAULT_STUDIO: StudioSettings = studioSchema.parse({
  nomeEstudio: "85 TATTOO Studio",
  productionChecklistCompleted: false,
});

const KEY_STUDIO = "studio.v1";

export interface StudioSnapshot {
  data: StudioSettings;
  updatedAt: string | null;
  persistedInDb: boolean;
}

export async function fetchStudioSettings(): Promise<StudioSnapshot> {
  try {
    const { data, error } = await supabase
      .from("app_config")
      .select("value, atualizado_em")
      .eq("key", KEY_STUDIO)
      .maybeSingle();

    if (!error && data?.value) {
      const parsed = studioSchema.safeParse({
        ...DEFAULT_STUDIO,
        ...JSON.parse(data.value as string),
      });

      if (parsed.success) {
        return {
          data: parsed.data,
          updatedAt: data.atualizado_em as string,
          persistedInDb: true,
        };
      }
    }
  } catch {
    // Mantem fallback apenas em memoria/defaults.
  }

  return { data: DEFAULT_STUDIO, updatedAt: null, persistedInDb: false };
}

export async function saveStudioSettings(
  next: StudioSettings,
): Promise<
  { ok: true; persistedInDb: boolean; updatedAt: string | null } | { ok: false; error: string }
> {
  const parsed = studioSchema.safeParse(next);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Valores invalidos" };
  }

  try {
    const { data, error } = await supabase
      .from("app_config")
      .upsert({ key: KEY_STUDIO, value: JSON.stringify(parsed.data) }, { onConflict: "key" })
      .select("atualizado_em")
      .maybeSingle();

    if (error) {
      return { ok: false, error: error.message || "Falha ao salvar no banco" };
    }

    return {
      ok: true,
      persistedInDb: true,
      updatedAt: (data?.atualizado_em as string) ?? new Date().toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Falha ao salvar",
    };
  }
}

export interface UseStudioSettings {
  data: StudioSettings;
  updatedAt: string | null;
  persistedInDb: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  save: (
    next: StudioSettings,
  ) => Promise<{ ok: true; persistedInDb: boolean } | { ok: false; error: string }>;
}

export function useStudioSettings(): UseStudioSettings {
  const [data, setData] = useState<StudioSettings>(DEFAULT_STUDIO);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [persistedInDb, setPersistedInDb] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const snap = await fetchStudioSettings();
      setData(snap.data);
      setUpdatedAt(snap.updatedAt);
      setPersistedInDb(snap.persistedInDb);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (next: StudioSettings) => {
    const result = await saveStudioSettings(next);
    if (result.ok) {
      setData(next);
      setUpdatedAt(result.updatedAt);
      setPersistedInDb(result.persistedInDb);
      return { ok: true as const, persistedInDb: result.persistedInDb };
    }
    return { ok: false as const, error: result.error };
  }, []);

  return { data, updatedAt, persistedInDb, isLoading, error, refetch: load, save };
}
