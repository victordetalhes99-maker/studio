import {
  buildAnamneseText,
  buildContractText,
  type DocumentRenderContext,
} from "@/lib/document-templates";

export type TermoRenderContext = DocumentRenderContext;

export function buildAnamneseAvisos(context: TermoRenderContext) {
  return buildAnamneseText(context);
}

export function buildTermoTexto(context: TermoRenderContext) {
  return buildContractText(context);
}
