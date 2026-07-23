import { sha256Hex as hashDocumentText } from "@/lib/document-templates";

export const CONTRACT_TEMPLATE_ID = "termo-atendimento";
export const CONTRACT_TEMPLATE_LABEL = "Termo de atendimento e responsabilidade";

export interface ContractTemplateDescriptor {
  id: string;
  nome: string;
  versao: string;
  ativo: boolean;
}

export function getContractTemplate(versao: string | null | undefined): ContractTemplateDescriptor {
  return {
    id: CONTRACT_TEMPLATE_ID,
    nome: CONTRACT_TEMPLATE_LABEL,
    versao: versao?.trim() || "legacy",
    ativo: true,
  };
}

export async function sha256Hex(texto: string): Promise<string> {
  return hashDocumentText(texto);
}
