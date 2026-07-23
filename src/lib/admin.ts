import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  type Anamnese,
  type Cliente,
  type StatusCliente,
  onlyDigits,
  rowToCliente,
  type ClienteRow,
} from "./clientes";

export const RISK_KEYS: Array<{ key: keyof Anamnese; label: string }> = [
  { key: "alergia", label: "Alergia" },
  { key: "diabetes", label: "Diabetes" },
  { key: "cardiopatia", label: "Cardiopatia" },
  { key: "hemofilia", label: "Coagulopatia / Hemofilia" },
];

export function getRiscos(a: Anamnese): string[] {
  return RISK_KEYS.filter(({ key }) => a[key] === "sim").map((r) => r.label);
}

export function isRisco(a: Anamnese): boolean {
  return getRiscos(a).length > 0;
}

export function isHoje(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}
export function isEsteMes(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}

export async function listarClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .order("atualizado_em", { ascending: false });
  if (error) {
    console.error("listarClientes", error);
    return [];
  }
  return (data ?? []).map((r) => rowToCliente(r as unknown as ClienteRow));
}

export async function deleteCliente(cpf: string) {
  const { error } = await supabase.from("clientes").delete().eq("cpf", onlyDigits(cpf));
  if (error) console.error("deleteCliente", error);
}

export async function updateCliente(c: Cliente) {
  const cpfD = onlyDigits(c.cpf);
  const { error } = await supabase
    .from("clientes")
    .update({
      nome_completo: c.dadosCadastrais.nomeCompleto,
      telefone: c.dadosCadastrais.telefone || null,
      email: c.dadosCadastrais.email || null,
      tatuador: c.dadosCadastrais.tatuador || null,
      dados_cadastrais: { ...c.dadosCadastrais, cpf: cpfD } as unknown as Json,
      anamnese: c.anamnese as unknown as Json,
      assinatura: c.assinatura || null,
      sessoes: c.sessoes as unknown as Json,

      status: c.status,
    })
    .eq("cpf", cpfD);
  if (error) console.error("updateCliente", error);
}

export async function setStatus(cpf: string, status: StatusCliente) {
  const { error } = await supabase.from("clientes").update({ status }).eq("cpf", onlyDigits(cpf));
  if (error) console.error("setStatus", error);
}

export function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
