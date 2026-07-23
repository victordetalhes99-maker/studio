// ============================================================================
// Camada provisoria de dados administrativos.
//
// Estes hooks ja usam a assinatura final (AsyncState<T>) para que a UI nao
// precise mudar quando as integracoes reais forem ligadas. Os modulos que ainda
// nao foram conectados ao backend continuam retornando estado vazio honesto.
// ============================================================================

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminClients } from "@/lib/clientes-admin";
import { useCheckInsList, todayISO } from "@/lib/checkins";
import { useRiskAlerts } from "@/lib/risk";
import { useTattooArtists } from "@/lib/tattoo-artists";
import type {
  Activity,
  AdminDocument,
  AsyncState,
  CheckIn,
  Client,
  ClientForm,
  Contract,
  IntegrationInfo,
  RiskAlert,
  SystemSettings,
  TattooArtist,
} from "./types";

function empty<T>(data: T): AsyncState<T> {
  return { data, isLoading: false, isEmpty: true, error: null };
}

function ready<T>(data: T, isEmpty = false): AsyncState<T> {
  return { data, isLoading: false, isEmpty, error: null };
}

// ---------------------------------------------------------------------------
// Tatuadores - fonte real em public.tattoo_artists com métricas derivadas.
// ---------------------------------------------------------------------------
export function useTatuadores(): AsyncState<TattooArtist[]> {
  const { refetch: _refetch, ...state } = useTattooArtists();
  void _refetch;
  return state;
}

export function useClientes(): AsyncState<Client[]> {
  const { data, isLoading, error } = useAdminClients();
  const mapped: Client[] = data.map((c) => ({
    id: c.cpf,
    cpf: c.cpf,
    nome: c.nome,
    telefone: c.telefone,
    email: c.email,
    tatuador: c.tatuador,
    temFicha: c.temFicha,
    temContrato: c.temAssinatura,
    risco: c.riscoNivel === "attention",
    criadoEm: c.criadoEm,
    atualizadoEm: c.atualizadoEm,
  }));
  return { data: mapped, isLoading, isEmpty: !isLoading && mapped.length === 0, error };
}

export function useCheckIns(): AsyncState<CheckIn[]> {
  const { data, isLoading, error } = useCheckInsList();
  const today = todayISO();
  const mapped: CheckIn[] = data
    .filter((c) => c.queueDay === today)
    .map((c) => ({
      id: c.id,
      clienteNome: c.clienteNome,
      cpf: c.cpf,
      tatuador: c.tatuador,
      horario: c.arrivalAt,
      status:
        c.status === "in_service"
          ? "em_atendimento"
          : c.status === "completed"
            ? "concluido"
            : "aguardando",
      temFicha: c.hasFicha,
      temContrato: c.hasAssinatura,
      risco: c.riskFlag,
    }));
  return { data: mapped, isLoading, isEmpty: !isLoading && mapped.length === 0, error };
}

export function useFichas(): AsyncState<ClientForm[]> {
  return empty<ClientForm[]>([]);
}

export function useContratos(): AsyncState<Contract[]> {
  return empty<Contract[]>([]);
}

export function useDocumentos(): AsyncState<AdminDocument[]> {
  return empty<AdminDocument[]>([]);
}

export function useAlertasRisco(): AsyncState<RiskAlert[]> {
  const { data, isLoading, error } = useRiskAlerts();
  const mapped: RiskAlert[] = data
    .filter((a) => a.status !== "archived")
    .slice(0, 8)
    .map((a) => ({
      id: a.id,
      clienteNome: a.clienteNome,
      restricoes: a.reasons.map((r) => r.label),
      criadoEm: a.detectedAt,
    }));
  return { data: mapped, isLoading, isEmpty: !isLoading && mapped.length === 0, error };
}

export function useAtividadeRecente(): AsyncState<Activity[]> {
  return empty<Activity[]>([]);
}

export function useIntegracoes(): AsyncState<IntegrationInfo[]> {
  const [state, setState] = useState<AsyncState<IntegrationInfo[]>>({
    data: [],
    isLoading: true,
    isEmpty: true,
    error: null,
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const [dbRes, storageRes, destinationsRes, spreadsheetRes] = await Promise.allSettled([
          supabase.from("clientes").select("cpf", { head: true, count: "exact" }),
          supabase.storage.getBucket("assinaturas"),
          supabase
            .from("backup_destinations")
            .select("kind, label, status, last_error")
            .order("criado_em", { ascending: true }),
          supabase
            .from("app_config")
            .select("value")
            .eq("key", "backup_spreadsheet_id")
            .maybeSingle(),
        ]);

        const dbOk = dbRes.status === "fulfilled" && !dbRes.value.error;
        const storageOk = storageRes.status === "fulfilled" && !storageRes.value.error;
        const destinationRows =
          destinationsRes.status === "fulfilled" && !destinationsRes.value.error
            ? ((destinationsRes.value.data ?? []) as Array<{
                kind: string;
                label: string;
                status: string;
                last_error: string | null;
              }>)
            : [];
        const spreadsheetId =
          spreadsheetRes.status === "fulfilled" && !spreadsheetRes.value.error
            ? spreadsheetRes.value.data?.value
            : null;

        const googleDriveTargets = destinationRows.filter((row) => row.kind === "google_drive");
        const googleDriveConnected = googleDriveTargets.find((row) => row.status === "conectado");
        const googleDriveErro = googleDriveTargets.find((row) => row.status === "erro");
        const googleDrivePendente = googleDriveTargets.find((row) =>
          ["configuracao_incompleta", "nao_configurado", "desativado"].includes(row.status),
        );

        const lista: IntegrationInfo[] = [
          {
            kind: "database",
            label: "Banco de dados",
            descricao: "Persistencia principal dos registros do estudio.",
            status: dbOk ? "conectado" : "erro",
            statusDetail: dbOk
              ? "Leitura autenticada das tabelas administrativas em funcionamento."
              : "O frontend nao conseguiu validar leitura autenticada no banco.",
          },
          {
            kind: "google_drive",
            label: "Google Drive",
            descricao: "Armazenamento de fichas, contratos e documentos.",
            status: googleDriveConnected
              ? "conectado"
              : googleDriveErro
                ? "erro"
                : googleDrivePendente || spreadsheetId
                  ? "pendente"
                  : "nao_configurado",
            statusDetail: googleDriveConnected
              ? `Destino ativo: ${googleDriveConnected.label}.`
              : googleDriveErro?.last_error
                ? `Ultimo erro: ${googleDriveErro.last_error}`
                : spreadsheetId
                  ? "Planilha de backup ja registrada, mas sem destino conectado no painel."
                  : "Nenhum destino Google configurado no backend.",
          },
          {
            kind: "storage",
            label: "Armazenamento",
            descricao: "Backup de arquivos e assinaturas.",
            status: storageOk ? "conectado" : "erro",
            statusDetail: storageOk
              ? "Bucket 'assinaturas' acessivel para uploads autenticados."
              : "Bucket 'assinaturas' indisponivel ou sem permissao neste deploy.",
          },
          {
            kind: "email",
            label: "E-mail transacional",
            descricao: "Confirmacoes, recuperacao de acesso e avisos.",
            status: "pendente",
            statusDetail: "Fluxo seguro de diagnostico ainda depende de backend dedicado.",
          },
          {
            kind: "calendar",
            label: "Calendario",
            descricao: "Sincronizacao de sessoes e agendamentos.",
            status: "nao_configurado",
            statusDetail: "Nenhuma integracao de calendario foi provisionada ate agora.",
          },
          {
            kind: "whatsapp",
            label: "WhatsApp",
            descricao: "Notificacao de check-ins e mensagens ao cliente.",
            status: "nao_configurado",
            statusDetail: "Nenhum backend de envio ou webhook foi configurado ate agora.",
          },
        ];

        if (!alive) return;
        setState({
          data: lista,
          isLoading: false,
          isEmpty: false,
          error: null,
        });
      } catch (error) {
        if (!alive) return;
        setState({
          data: [],
          isLoading: false,
          isEmpty: true,
          error: error instanceof Error ? error : new Error("Falha ao carregar integracoes"),
        });
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  nomeEstudio: "85 TATTOO Studio",
  nomeEmpresarial: "",
  telefone: "",
  whatsapp: "",
  email: "",
  endereco: "",
  cidade: "",
  estado: "",
  cep: "",
  horario: "",
  descricao: "",
};
