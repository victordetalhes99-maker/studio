// ============================================================================
// Tipos do domínio administrativo do 85 TATTOO.
// Estruturas prontas para receber dados reais quando o backend estiver ligado.
// ============================================================================

export type ArtistStatus = "ativo" | "inativo" | "pausado";

export interface TattooArtist {
  id: string;
  nome: string;
  iniciais: string;
  status: ArtistStatus;
  clientesHoje: number | null;
  atendimentosMes: number | null;
  ultimaAtividade: string | null; // ISO
}

export interface Client {
  id: string;
  cpf: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  tatuador: string | null;
  temFicha: boolean;
  temContrato: boolean;
  risco: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CheckIn {
  id: string;
  clienteNome: string;
  cpf: string;
  tatuador: string | null;
  horario: string;
  status: "aguardando" | "em_atendimento" | "concluido";
  temFicha: boolean;
  temContrato: boolean;
  risco: boolean;
}

export interface ClientForm {
  id: string;
  clienteNome: string;
  tatuador: string | null;
  status: "pendente" | "concluida";
  risco: boolean;
  criadoEm: string;
}

export interface Contract {
  id: string;
  clienteNome: string;
  tatuador: string | null;
  status: "pendente" | "assinado";
  assinadoEm: string | null;
  arquivoUrl: string | null;
}

export interface AdminDocument {
  id: string;
  tipo: "ficha" | "contrato" | "termo" | "comprovante";
  clienteNome: string;
  tatuador: string | null;
  criadoEm: string;
  arquivoUrl: string | null;
}

export interface RiskAlert {
  id: string;
  clienteNome: string;
  restricoes: string[];
  criadoEm: string;
}

export interface Activity {
  id: string;
  tipo: "cadastro" | "checkin" | "ficha" | "contrato" | "documento" | "sistema";
  titulo: string;
  descricao: string;
  criadoEm: string; // ISO
}

export type IntegrationKind =
  "database" | "google_drive" | "storage" | "email" | "calendar" | "whatsapp";

export type IntegrationStatus =
  "nao_configurado" | "pendente" | "conectado" | "erro" | "desativado";

export interface IntegrationInfo {
  kind: IntegrationKind;
  label: string;
  descricao: string;
  status: IntegrationStatus;
  statusDetail?: string;
}

export interface SystemSettings {
  nomeEstudio: string;
  nomeEmpresarial: string;
  telefone: string;
  whatsapp: string;
  email: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  horario: string;
  descricao: string;
}

export interface AsyncState<T> {
  data: T;
  isLoading: boolean;
  isEmpty: boolean;
  error: Error | null;
}
