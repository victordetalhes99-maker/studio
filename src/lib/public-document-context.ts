import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeDocumentSettings, type DocumentRenderContext } from "@/lib/document-templates";
import { DEFAULT_STUDIO, studioSchema, type StudioSettings } from "@/lib/settings";
import {
  DEFAULT_DOCUMENT_SETTINGS,
  DEFAULT_IDENTITY,
  documentSettingsSchema,
  identitySchema,
  type DocumentSettings,
  type IdentitySettings,
} from "@/lib/settings/admin-config";

const publicDocumentContextSchema = z.object({
  studio: studioSchema.default(DEFAULT_STUDIO),
  identity: identitySchema.default(DEFAULT_IDENTITY),
  documents: documentSettingsSchema.default(DEFAULT_DOCUMENT_SETTINGS),
  missingRequiredFields: z.array(z.string()).default([]),
  legalReady: z.boolean().default(false),
});

export interface PublicDocumentContext {
  studio: StudioSettings;
  identity: IdentitySettings;
  documents: DocumentSettings;
  missingRequiredFields: string[];
  legalReady: boolean;
}

export async function fetchPublicDocumentContext(): Promise<PublicDocumentContext> {
  const { data, error } = await supabase.rpc("get_public_document_context" as never);
  if (error) throw error;

  const parsed = publicDocumentContextSchema.safeParse(data ?? {});
  if (!parsed.success) {
    return {
      studio: DEFAULT_STUDIO,
      identity: DEFAULT_IDENTITY,
      documents: DEFAULT_DOCUMENT_SETTINGS,
      missingRequiredFields: [],
      legalReady: false,
    };
  }

  return {
    studio: parsed.data.studio,
    identity: parsed.data.identity,
    documents: sanitizeDocumentSettings(parsed.data.documents),
    missingRequiredFields: parsed.data.missingRequiredFields,
    legalReady: parsed.data.legalReady,
  };
}

export function usePublicDocumentContext() {
  const [data, setData] = useState<PublicDocumentContext>({
    studio: DEFAULT_STUDIO,
    identity: DEFAULT_IDENTITY,
    documents: DEFAULT_DOCUMENT_SETTINGS,
    missingRequiredFields: [],
    legalReady: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setData(await fetchPublicDocumentContext());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar contexto documental");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return useMemo(
    () => ({
      data,
      isLoading,
      error,
      refetch: load,
    }),
    [data, error, isLoading, load],
  );
}

export function createRenderContext(
  context: PublicDocumentContext,
  input: {
    acceptedAt: string;
    acceptanceId: string;
    source: string;
    client: DocumentRenderContext["client"];
    artist: DocumentRenderContext["artist"];
  },
): DocumentRenderContext {
  return {
    acceptedAt: input.acceptedAt,
    acceptanceId: input.acceptanceId,
    artist: input.artist,
    client: input.client,
    documents: context.documents,
    identity: context.identity,
    source: input.source,
    studio: context.studio,
  };
}
