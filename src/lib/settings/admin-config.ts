import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_ANAMNESE_TEMPLATE_BODY,
  DEFAULT_CONTRACT_TEMPLATE_BODY,
  DEFAULT_LGPD_TEMPLATE_BODY,
  sanitizeDocumentSettings,
  type StoredDocumentTemplate,
} from "@/lib/document-templates";

const BRANDING_KEY = "branding.v1";
const ADMIN_PROFILE_KEY = "admin_profile.v1";
const OPERATION_KEY = "operation.v1";
const DOCUMENTS_KEY = "documents.v1";
const DEFAULT_TEMPLATE_CREATED_AT = "2026-07-20T00:00:00.000Z";

function createEmailField(label: string) {
  return z
    .string()
    .trim()
    .max(254, `Maximo de 254 caracteres para ${label}`)
    .default("")
    .refine(
      (value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      `${label} invalido`,
    );
}

async function fetchConfigRecord<T>(key: string, schema: z.ZodType<T>, fallback: T) {
  const { data, error } = await supabase
    .from("app_config")
    .select("value, atualizado_em")
    .eq("key", key)
    .maybeSingle();

  if (error || !data?.value) {
    return { data: fallback, updatedAt: null, persistedInDb: false };
  }

  const parsed = schema.safeParse({ ...fallback, ...JSON.parse(data.value as string) });
  if (!parsed.success) {
    return { data: fallback, updatedAt: data.atualizado_em as string, persistedInDb: true };
  }

  return {
    data: parsed.data,
    updatedAt: data.atualizado_em as string,
    persistedInDb: true,
  };
}

async function saveConfigRecord<T>(key: string, schema: z.ZodType<T>, next: T) {
  const parsed = schema.safeParse(next);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Valores invalidos" };
  }

  const payload = JSON.stringify(parsed.data);
  const { data, error } = await supabase
    .from("app_config")
    .upsert({ key, value: payload }, { onConflict: "key" })
    .select("atualizado_em")
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return {
    ok: true as const,
    updatedAt: (data?.atualizado_em as string) ?? new Date().toISOString(),
  };
}

function useConfigState<T>(key: string, schema: z.ZodType<T>, fallback: T) {
  const [data, setData] = useState<T>(fallback);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [persistedInDb, setPersistedInDb] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const snapshot = await fetchConfigRecord(key, schema, fallback);
      setData(snapshot.data);
      setUpdatedAt(snapshot.updatedAt);
      setPersistedInDb(snapshot.persistedInDb);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar");
    } finally {
      setIsLoading(false);
    }
  }, [fallback, key, schema]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (next: T) => {
      const result = await saveConfigRecord(key, schema, next);
      if (result.ok) {
        setData(next);
        setUpdatedAt(result.updatedAt);
        setPersistedInDb(true);
      }
      return result;
    },
    [key, schema],
  );

  return useMemo(
    () => ({ data, updatedAt, persistedInDb, isLoading, error, refetch: load, save }),
    [data, error, isLoading, load, persistedInDb, save, updatedAt],
  );
}

export const identitySchema = z.object({
  systemName: z.string().trim().min(2).max(120).default("85 TATTOO Studio"),
  logoPath: z.string().trim().max(255).default(""),
  iconPath: z.string().trim().max(255).default(""),
  backgroundPath: z.string().trim().max(255).default(""),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#0A0A0A"),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#C8A951"),
  surfaceColor: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#151515"),
  pdfHeader: z.string().trim().max(140).default("85 TATTOO Studio"),
  pdfFooter: z.string().trim().max(240).default("Documento emitido pelo painel administrativo."),
});

export type IdentitySettings = z.infer<typeof identitySchema>;

export const DEFAULT_IDENTITY: IdentitySettings = identitySchema.parse({});

export const adminProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(120).default("Administrador"),
  roleTitle: z.string().trim().max(120).default("Administrador responsavel"),
  avatarPath: z.string().trim().max(255).default(""),
  supportEmail: createEmailField("e-mail de suporte"),
  notes: z.string().trim().max(500).default(""),
});

export type AdminProfileSettings = z.infer<typeof adminProfileSchema>;

export const DEFAULT_ADMIN_PROFILE: AdminProfileSettings = adminProfileSchema.parse({});

export const operationSchema = z.object({
  businessHours: z.string().trim().max(200).default("Seg-Sab, 10h-19h"),
  defaultSessionMinutes: z.coerce.number().int().min(15).max(720).default(120),
  lateToleranceMinutes: z.coerce.number().int().min(0).max(180).default(15),
  dailyCapacity: z.coerce.number().int().min(1).max(500).default(40),
  queueStrategy: z.string().trim().max(120).default("ordem_de_chegada"),
  checkinRules: z.string().trim().max(600).default(""),
  paymentMethods: z.array(z.string().trim().min(1).max(60)).default(["pix", "cartao", "dinheiro"]),
  appointmentTypes: z
    .array(z.string().trim().min(1).max(60))
    .default(["primeira visita", "retorno", "avaliacao"]),
  rooms: z.array(z.string().trim().min(1).max(60)).default(["Sala 1"]),
  stations: z.array(z.string().trim().min(1).max(60)).default(["Estacao principal"]),
  recurrenceRules: z.string().trim().max(400).default(""),
});

export type OperationSettings = z.infer<typeof operationSchema>;

export const DEFAULT_OPERATION: OperationSettings = operationSchema.parse({});

const storedDocumentTemplateSchema: z.ZodType<StoredDocumentTemplate> = z.object({
  version: z.string().trim().min(1).max(80),
  body: z.string().trim().min(20).max(20000),
  createdAt: z.string().trim().min(10).max(40),
});

export const documentSettingsSchema = z.object({
  filePrefix: z.string().trim().min(2).max(40).default("85-tattoo"),
  fichaVersionLabel: z.string().trim().max(40).default("v1"),
  pdfHeader: z.string().trim().max(140).default("85 TATTOO Studio"),
  pdfFooter: z.string().trim().max(240).default("Documento gerado pelo sistema administrativo."),
  contractLead: z.string().trim().max(400).default("Termo de atendimento e responsabilidade."),
  ficheLead: z.string().trim().max(400).default("Ficha do cliente e anamnese."),
  consentLead: z.string().trim().max(400).default("Registro de consentimento LGPD."),
  namingPattern: z.string().trim().max(120).default("{prefix}-{tipo}-{cpfMasked}-{versao}-{data}"),
  contractTemplateVersion: z.string().trim().min(1).max(80).default("2026-07-termo-v3"),
  contractTemplateBody: z
    .string()
    .trim()
    .min(20)
    .max(20000)
    .default(DEFAULT_CONTRACT_TEMPLATE_BODY),
  contractTemplateHistory: z.array(storedDocumentTemplateSchema).default([
    {
      version: "2026-07-termo-v3",
      body: DEFAULT_CONTRACT_TEMPLATE_BODY,
      createdAt: DEFAULT_TEMPLATE_CREATED_AT,
    },
  ]),
  anamneseTemplateVersion: z.string().trim().min(1).max(80).default("2026-07-anamnese-v2"),
  anamneseTemplateBody: z
    .string()
    .trim()
    .min(20)
    .max(20000)
    .default(DEFAULT_ANAMNESE_TEMPLATE_BODY),
  anamneseTemplateHistory: z.array(storedDocumentTemplateSchema).default([
    {
      version: "2026-07-anamnese-v2",
      body: DEFAULT_ANAMNESE_TEMPLATE_BODY,
      createdAt: DEFAULT_TEMPLATE_CREATED_AT,
    },
  ]),
  lgpdTemplateVersion: z.string().trim().min(1).max(80).default("2026-07-lgpd-v3"),
  lgpdTemplateBody: z.string().trim().min(20).max(20000).default(DEFAULT_LGPD_TEMPLATE_BODY),
  lgpdTemplateHistory: z.array(storedDocumentTemplateSchema).default([
    {
      version: "2026-07-lgpd-v3",
      body: DEFAULT_LGPD_TEMPLATE_BODY,
      createdAt: DEFAULT_TEMPLATE_CREATED_AT,
    },
  ]),
});

export type DocumentSettings = z.infer<typeof documentSettingsSchema>;

export const DEFAULT_DOCUMENT_SETTINGS: DocumentSettings = sanitizeDocumentSettings(
  documentSettingsSchema.parse({}),
);

export function useIdentitySettings() {
  return useConfigState(BRANDING_KEY, identitySchema, DEFAULT_IDENTITY);
}

export function useAdminProfileSettings() {
  return useConfigState(ADMIN_PROFILE_KEY, adminProfileSchema, DEFAULT_ADMIN_PROFILE);
}

export function useOperationSettings() {
  return useConfigState(OPERATION_KEY, operationSchema, DEFAULT_OPERATION);
}

async function fetchDocumentSettingsRecord() {
  const snapshot = await fetchConfigRecord(
    DOCUMENTS_KEY,
    documentSettingsSchema,
    DEFAULT_DOCUMENT_SETTINGS,
  );
  return {
    ...snapshot,
    data: sanitizeDocumentSettings(documentSettingsSchema.parse(snapshot.data)),
  };
}

async function saveDocumentSettingsRecord(next: DocumentSettings) {
  const parsed = documentSettingsSchema.safeParse(next);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Valores invalidos" };
  }
  const sanitized = sanitizeDocumentSettings(parsed.data);
  const result = await saveConfigRecord(DOCUMENTS_KEY, documentSettingsSchema, sanitized);
  if (!result.ok) return result;
  return { ...result, data: sanitized };
}

export function useDocumentSettings() {
  const [data, setData] = useState<DocumentSettings>(DEFAULT_DOCUMENT_SETTINGS);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [persistedInDb, setPersistedInDb] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const snapshot = await fetchDocumentSettingsRecord();
      setData(snapshot.data);
      setUpdatedAt(snapshot.updatedAt);
      setPersistedInDb(snapshot.persistedInDb);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (next: DocumentSettings) => {
    const result = await saveDocumentSettingsRecord(next);
    if (result.ok) {
      setData(result.data);
      setUpdatedAt(result.updatedAt);
      setPersistedInDb(true);
    }
    return result;
  }, []);

  return useMemo(
    () => ({ data, updatedAt, persistedInDb, isLoading, error, refetch: load, save }),
    [data, error, isLoading, load, persistedInDb, save, updatedAt],
  );
}

export async function uploadBrandingAsset(
  file: File,
  kind: "logo" | "icon" | "background" | "avatar",
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const fileName = `${kind}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from("branding").upload(fileName, file, {
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });

  if (error) throw error;
  return fileName;
}

export async function removeBrandingAsset(path: string) {
  if (!path) return;
  const { error } = await supabase.storage.from("branding").remove([path]);
  if (error) throw error;
}

export function getBrandingAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from("branding").getPublicUrl(path);
  return data.publicUrl;
}
